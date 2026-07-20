import { initTRPC, TRPCError } from '@trpc/server';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { decode } from '@auth/core/jwt';
import { db } from './db.js';
import { getDbForOrg, getPrimaryDb } from './lib/dbRouter.js';

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
import { auditLogs, notificationQueue, organizations } from 'db';

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  db: any;
  primaryDb: any;
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

  const decoded = await decode({
    token: tokenStr,
    secret: process.env.AUTH_SECRET || 'secret',
    salt: cookieName,
  });

  if (!decoded || !decoded.sub || !decoded.org) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Check Token Invalidation
  const [userRec] = await db.select({ tokenInvalidatedAt: users.tokenInvalidatedAt })
    .from(users).where(eq(users.id, decoded.sub));

  if (!userRec || (userRec.tokenInvalidatedAt && (decoded.iat as number) * 1000 < userRec.tokenInvalidatedAt.getTime())) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token invalidated' });
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
    changes = calculateDiff(previousState, rawInput as Record<string, any>);
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
