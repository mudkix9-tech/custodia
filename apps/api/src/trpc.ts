import { initTRPC, TRPCError } from '@trpc/server';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { decode } from '@auth/core/jwt';
import { db } from './db.js';
import { users } from 'db';
import { eq, sql } from 'drizzle-orm';
import { 
  sanitizeForAuditLog, 
  calculateDiff, 
  extractResourceType, 
  extractResourceId, 
  generateDescription, 
  fetchResourceBeforeState 
} from './utils/auditLogger.js';
import { auditLogs } from 'db';

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  user?: {
    id: string;
    orgId: string;
    role: string;
    permissions: string[];
  };
}

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(async ({ ctx, next }) => {
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

  if (!decoded || !decoded.sub) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Check Token Invalidation
  const [userRec] = await db.select({ tokenInvalidatedAt: users.tokenInvalidatedAt })
    .from(users).where(eq(users.id, decoded.sub));

  if (!userRec || (userRec.tokenInvalidatedAt && (decoded.iat as number) * 1000 < userRec.tokenInvalidatedAt.getTime())) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token invalidated' });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        id: decoded.sub,
        orgId: decoded.org as string,
        role: decoded.role as string,
        permissions: (decoded.permissions as string[]) || [],
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

      await db.insert(auditLogs).values({
        organizationId: ctx.user!.orgId,
        userId: ctx.user!.id,
        userEmail: u?.email || 'unknown',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] || null,
        action: path,
        resourceType: extractResourceType(path),
        resourceId: resourceId || null,
        description: generateDescription(path, rawInput),
        changes: changes,
        metadata: sanitizeForAuditLog(rawInput),
      });
    } catch (error) {
      console.error('Audit log insertion failed:', error);
      // In a real app we might use Sentry here
    }
  });
  
  return result;
});

export const protectedProcedure = t.procedure.use(isAuthed).use(auditLogMiddleware);
