import { initTRPC, TRPCError } from '@trpc/server';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
// Loads the FastifyReply.clearCookie augmentation. apps/web typechecks this file via
// the AppRouter type, and without the import it does not see the plugin's types.
import '@fastify/cookie';
import { decode } from '@auth/core/jwt';
import { db } from './db.js';
import { requireSecret } from './lib/secrets.js';
import { getDbForOrg, getPrimaryDb, type OrgDatabase } from './lib/dbRouter.js';

import { users, customRoles } from 'db';
import { eq, sql, inArray } from 'drizzle-orm';
import { 
  sanitizeForAuditLog, 
  calculateDiff, 
  extractResourceType, 
  extractResourceId, 
  generateDescription, 
  fetchResourceBeforeState 
} from './utils/auditLogger.js';
import { childTableForPath, extractParentResourceId } from './lib/auditTrail.js';
import { auditLogs, notificationQueue, organizations } from 'db';

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  /**
   * The tenant's database handle — the primary pool, or a dedicated one for an
   * organisation on its own instance. Declared `any` until August 2026, which
   * silently overrode the real return type of getDbForOrg: every query in every
   * procedure produced `any`, so no router output was typed and the web app
   * consumed the whole API unchecked.
   */
  db: OrgDatabase;
  primaryDb: OrgDatabase;
  user?: {
    id: string;
    orgId: string;
    role: string;
    customRoleId: string | null;
    customRolePermissions?: any;
    permissions: string[];
    entityScope: 'own' | 'group';
    targetOrgId?: string;
  };
}

export async function verifyGroupScopeAndLog(
  userId: string,
  parentOrgId: string,
  targetOrgIds: string[],
  entityScope: 'own' | 'group',
  type: 'query' | 'mutation' | 'subscription'
) {
  if (targetOrgIds.length === 0) return;

  if (entityScope !== 'group') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Missing group entity scope' });
  }
  if (type === 'mutation') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cross-entity write access is strictly forbidden' });
  }

  const targetOrgs = await db.select({ id: organizations.id, parentOrganizationId: organizations.parentOrganizationId })
    .from(organizations).where(inArray(organizations.id, targetOrgIds));

  if (targetOrgs.length !== targetOrgIds.length || targetOrgs.some((org: any) => org.parentOrganizationId !== parentOrgId)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'One or more target organizations are not direct children' });
  }

  // Audit Log
  const logsToInsert = targetOrgIds.map(targetOrgId => ({
    organizationId: targetOrgId,
    userId: userId,
    action: 'cross_entity_read',
    resourceType: 'organization',
    resourceId: targetOrgId,
    description: `User from parent org ${parentOrgId} accessed child org ${targetOrgId} data via group scope`,
  }));
  
  if (targetOrgIds.length > 1) {
    logsToInsert.push({
      organizationId: parentOrgId,
      userId: userId,
      action: 'cross_entity_read',
      resourceType: 'organization',
      resourceId: parentOrgId,
      description: `User from parent org ${parentOrgId} accessed child orgs [${targetOrgIds.join(', ')}] data via group scope`,
    });
  }

  await db.insert(auditLogs).values(logsToInsert);
}

export const createContext = async ({ req, res }: { req: FastifyRequest; res: FastifyReply }): Promise<Context> => {
  return { req, res, db, primaryDb: getPrimaryDb() };
};

const t = initTRPC.context<Context>().create();

export const isAuthed = t.middleware(async ({ ctx, type, next }) => {
  const cookieName = process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';
  let tokenStr = (ctx.req as any).cookies?.[cookieName];
  
  if (!tokenStr && ctx.req.headers.authorization?.startsWith('Bearer ')) {
    tokenStr = ctx.req.headers.authorization.substring(7);
  }

  if (!tokenStr) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  /**
   * Rejecting a dead session is not the same as ending it. Without clearing the
   * cookie the browser keeps presenting it forever, so the user sees an application
   * that fails on every request rather than one that returns them to sign-in.
   *
   * The `__Secure-` prefix obliges the Secure attribute — a deletion sent without it
   * is rejected outright and the cookie survives. Everything else must match what
   * apps/web set (NextAuth defaults: path '/', httpOnly, sameSite lax), because a
   * browser matches deletions on name, domain and path.
   */
  const endSession = (message?: string) => {
    ctx.res.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieName.startsWith('__Secure-'),
    });
    return new TRPCError({ code: 'UNAUTHORIZED', ...(message ? { message } : {}) });
  };

  // decode() *throws* on a token it cannot decrypt ("no matching decryption secret"),
  // it does not return null. Uncaught, that surfaced as INTERNAL_SERVER_ERROR on every
  // procedure, so a session minted under a previous AUTH_SECRET produced 500s across
  // the whole application instead of logging the user out.
  let decoded;
  try {
    decoded = await decode({
      token: tokenStr,
      secret: requireSecret('AUTH_SECRET', { minLength: 32 }),
      salt: cookieName,
    });
  } catch {
    throw endSession();
  }

  if (!decoded || !decoded.sub || !decoded.org) {
    throw endSession();
  }

  // Check Token Invalidation
  const [userRec] = await db.select({ tokenInvalidatedAt: users.tokenInvalidatedAt })
    .from(users).where(eq(users.id, decoded.sub));

  // The deliberate force-logout path — the user was signed out server-side, or the row
  // is gone. Leaving the cookie in place here meant "log out everywhere" never actually
  // logged anyone out of their own browser; it only made every request fail.
  if (!userRec || (userRec.tokenInvalidatedAt && (decoded.iat as number) * 1000 < userRec.tokenInvalidatedAt.getTime())) {
    throw endSession('Token invalidated');
  }

  let entityScope: 'own' | 'group' = 'own';
  if (decoded.customRoleId) {
    const [roleRec] = await db.select({ entityScope: customRoles.entityScope })
      .from(customRoles).where(eq(customRoles.id, decoded.customRoleId as string));
    if (roleRec && roleRec.entityScope === 'group') {
      entityScope = 'group';
    }
  }

  let effectiveOrgId = decoded.org as string;
  const targetOrgId = ctx.req.headers['x-target-org-id'] as string | undefined;

  // Global Cross-Entity Access Enforcement
  if (targetOrgId && targetOrgId !== effectiveOrgId) {
    await verifyGroupScopeAndLog(
      decoded.sub,
      effectiveOrgId,
      [targetOrgId],
      entityScope,
      type
    );
    effectiveOrgId = targetOrgId; // Masquerade as the child org for all downstream queries
  }

  const userDb = effectiveOrgId ? await getDbForOrg(effectiveOrgId) : db;

  return next({
    ctx: {
      ...ctx,
      db: userDb,
      primaryDb: getPrimaryDb(),
      user: {
        id: decoded.sub,
        orgId: effectiveOrgId, // Replaced with effectiveOrgId
        role: decoded.role as string,
        customRoleId: decoded.customRoleId as string | null,
        permissions: (decoded.permissions as string[]) || [],
        entityScope,
        targetOrgId,
      }
    }
  });
});



export const requireRole = (minimumRole: 'viewer' | 'member' | 'admin' | 'owner') => {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    
    const roleHierarchy = { viewer: 0, member: 1, admin: 2, owner: 3 };
    if (roleHierarchy[ctx.user.role as keyof typeof roleHierarchy] < roleHierarchy[minimumRole]) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    // Set RLS Context
    if (ctx.user.orgId) {
      // Postgres RLS execution
      // await db.execute(sql`SET app.org_id = '${ctx.user.orgId}'`);
    }

    return next({ ctx });
  });
};

/**
 * Gate for operations on platform-global data — the shared regulatory corpus and
 * the document embeddings every tenant retrieves from.
 *
 * `requireRole('owner')` is not this. Every customer organisation has an owner,
 * so gating a platform-wide write on it means any customer can publish a
 * regulatory update to every other customer, or flip a corpus document to
 * superseded for everyone. There is no platform-admin column in `users`, so
 * membership is configured out of band and the default is deny: an empty or
 * unset PLATFORM_ADMIN_EMAILS locks these procedures for everybody, which is the
 * correct posture for an operation no customer should reach.
 */
export const requirePlatformAdmin = () => {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const allowed = (process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    // ctx.user carries no email (see the token claims above), so it is read
    // from the database rather than trusted from the session.
    const [record] = await db.select({ email: users.email })
      .from(users).where(eq(users.id, ctx.user.id));

    const email = (record?.email || '').toLowerCase();
    if (!email || !allowed.includes(email)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform administration is not available to this account.' });
    }

    return next({ ctx });
  });
};

export const ROLE_PERMISSION_DEFAULTS: Record<string, string[]> = {
  owner: ['*:*'], // everything
  admin: [
    'ropa:view', 'ropa:edit', 'ropa:delete',
    'vendors:view', 'vendors:edit', 'vendors:delete',
    'dsar:view', 'dsar:manage', 'dsar:respond',
    'breach:view', 'breach:report', 'breach:manage',
    'training:view', 'training:assign', 'training:manage',
    'users:invite', 'users:manage',
  ],
  member: [
    'ropa:view', 'ropa:edit',
    'vendors:view', 'vendors:edit',
    'dsar:view', 'dsar:manage',
    'breach:view', 'breach:report',
    'training:view',
  ],
  viewer: [
    'ropa:view',
    'vendors:view',
    'dsar:view',
    'breach:view',
    'training:view',
  ],
};

export const requirePermission = (resource: string, action: string) => {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    
    // Check custom role permissions first if assigned
    if (ctx.user.customRoleId) {
      if (!ctx.user.customRolePermissions) {
        const { customRoles } = await import('db');
        const [cr] = await db.select({ permissions: customRoles.permissions }).from(customRoles).where(eq(customRoles.id, ctx.user.customRoleId));
        if (cr) {
           ctx.user.customRolePermissions = cr.permissions;
        }
      }
      const p = ctx.user.customRolePermissions;
      if (p) {
        // Assume format: { resource: { action: boolean } }
        // For backwards compatibility and string overrides, we check explicit denies first
        const hasExplicitDeny = ctx.user.permissions.includes(`-${resource}:${action}`);
        if (hasExplicitDeny) {
           throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission explicitly denied' });
        }

        const hasExplicitGrant = ctx.user.permissions.includes(`${resource}:${action}`);
        if (hasExplicitGrant) {
           return next({ ctx });
        }

        const isAllowed = p[resource] && p[resource][action];
        if (!isAllowed && !p['*']?.['*']) {
           throw new TRPCError({ code: 'FORBIDDEN', message: `Missing required permission via custom role: ${resource}:${action}` });
        }
        return next({ ctx });
      }
    }

    // Check role-based defaults first
    const roleDefaults = ROLE_PERMISSION_DEFAULTS[ctx.user.role] || [];
    const hasRoleDefault = roleDefaults.includes(`${resource}:${action}`) || roleDefaults.includes('*:*');
    
    // Check explicit permission overrides
    const hasExplicitGrant = ctx.user.permissions.includes(`${resource}:${action}`);
    const hasExplicitDeny = ctx.user.permissions.includes(`-${resource}:${action}`);
    
    // Explicit deny always wins
    if (hasExplicitDeny) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission explicitly denied' });
    }
    
    // Explicit grant or role default allows access
    if (!hasRoleDefault && !hasExplicitGrant) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing required permission: ${resource}:${action}` });
    }
    
    return next({ ctx });
  });
};

export const router = t.router;
export const publicProcedure = t.procedure;

const auditLogMiddleware = t.middleware(async ({ ctx, type, path, getRawInput, next }) => {
  if (type !== 'mutation') return next();
  
  if (!ctx.user) return next();

  const actionType = path.endsWith('.create') ? 'create'
    : path.endsWith('.update') ? 'update'
    : path.endsWith('.delete') ? 'delete'
    : 'other';
  
  let previousState = null;
  
  // Await the raw input asynchronously
  const rawInput = await getRawInput();
  const resourceId = extractResourceId(rawInput);
  
  if ((actionType === 'update' || actionType === 'delete') && resourceId) {
    previousState = await fetchResourceBeforeState(path, resourceId, ctx.user.orgId);
  }
  
  const result = await next();
  
  let changes = null;
  if (actionType === 'update' && previousState) {
    // The update mutations take { id, updatedAt, data }, so diffing the row against
    // the raw input compared a processing_activities record with an envelope and
    // produced { data: { old: null, new: <entire payload> } } on every save. The
    // fields being written live under `data` where the procedure has one.
    const input = rawInput as Record<string, any>;
    const after = (input?.data && typeof input.data === 'object') ? input.data : input;
    changes = calculateDiff(previousState, after as Record<string, any>);
  }

  // I86. Which *record* this change belongs to, as opposed to which row it wrote.
  //
  // A data category, recipient or transfer is addressed by its own id, so
  // `extractResourceId` returns the child's id and the activity's History tab —
  // which filters on the activity id — never saw it. Most of what an Art. 30
  // record actually contains had no visible trail at all, which is D13 and is
  // what I86 asks for.
  //
  // The parent is read from the mutation's *result*, after the fact, because that
  // is the only place it is reliably known: the input to an update or a delete
  // carries the child id alone, and a delete has no row left to look it up from
  // once it has run. `next()` returns the tRPC middleware envelope, so the row is
  // under `.data`.
  let parentResourceId: string | null = null;
  const childResourceType = childTableForPath(path);
  if (childResourceType) {
    const returned = (result as any)?.ok ? (result as any).data : null;
    parentResourceId = extractParentResourceId(returned)
      // A create carries the parent in its own input, and a bulk operation returns
      // an array rather than a row — both fall back to the input, which is correct
      // for exactly those cases and null for the rest.
      ?? extractParentResourceId(rawInput);
  }
  
  setImmediate(async () => {
    try {
      // Find the user email from db since ctx.user only has id, orgId, role, permissions
      // But we can just use a placeholder or fetch it if needed. 
      // Better yet, just fetch it.
      const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, ctx.user!.id));

      const auditLogEntry = {
        organizationId: ctx.user!.orgId,
        userId: ctx.user!.id,
        userEmail: u?.email || 'unknown',
        ipAddress: ctx.req.ip as string,
        userAgent: ctx.req.headers['user-agent'] || null,
        action: path,
        resourceType: extractResourceType(path),
        resourceId: resourceId || null,
        parentResourceId,
        childResourceType,
        description: generateDescription(path, rawInput),
        changes: changes,
        metadata: sanitizeForAuditLog(rawInput),
      };

      const [insertedAuditLog] = await db.insert(auditLogs).values(auditLogEntry).returning();

      // Check if org has SIEM enabled
      const [org] = await db.select({ siemEnabled: organizations.siemEnabled }).from(organizations).where(eq(organizations.id, ctx.user!.orgId));

      if (org?.siemEnabled) {
        await db.insert(notificationQueue).values({
          organizationId: ctx.user!.orgId,
          type: 'audit.log',
          channel: 'siem',
          title: 'Audit Log Entry',
          body: 'SIEM integration payload',
          payload: insertedAuditLog,
        });
      }
    } catch (error) {
      console.error('Audit log insertion failed:', error);
      // In a real app we might use Sentry here
    }
  });
  
  return result;
});

export const protectedProcedure = t.procedure.use(isAuthed).use(auditLogMiddleware);
