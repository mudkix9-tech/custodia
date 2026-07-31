import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { users, activeSessions } from 'db';
import { eq, and, ne } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import * as argon2 from 'argon2';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import { encrypt, decrypt } from '../lib/crypto.js';

// The types package is weird. We can use the default export or the internal authenticator.
// Usually `import { authenticator } from 'otplib'` works, but if there's an issue we fall back to TS any
const authenticator = (otplib as any).authenticator || (otplib as any).default?.authenticator;


export const securityRouter = router({
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      // Verifying current password
      if (user.passwordHash) {
          const isValid = await argon2.verify(user.passwordHash, input.currentPassword);
          if (!isValid) {
              throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Incorrect current password' });
          }
      }

      const newHash = await argon2.hash(input.newPassword);

      const [updated] = await ctx.db.update(users)
        .set({ passwordHash: newHash, tokenInvalidatedAt: new Date() })
        .where(eq(users.id, ctx.user!.id))
        .returning();

      await ctx.db.delete(activeSessions).where(eq(activeSessions.userId, ctx.user!.id));

      return { success: true };
    }),

  enableMfa: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      if (user.mfaEnabled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'MFA is already enabled' });
      }

      const secret = authenticator.generateSecret();
      const uri = authenticator.keyuri(user.email, 'Custodia', secret);
      const qrCodeUrl = await QRCode.toDataURL(uri);

      const encryptedSecret = encrypt(secret);
      await ctx.db.update(users).set({ mfaSecret: encryptedSecret }).where(eq(users.id, user.id));

      return { qrCodeUrl, secret };
    }),

  verifyMfa: protectedProcedure
    .input(z.object({
        token: z.string().length(6)
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!user.mfaSecret) throw new TRPCError({ code: 'BAD_REQUEST', message: 'MFA setup not initiated' });

      const secret = decrypt(user.mfaSecret);
      const isValid = authenticator.verify({ token: input.token, secret });

      if (!isValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid MFA token' });
      }

      await ctx.db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));
      return { success: true };
    }),

  disableMfa: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db.update(users).set({ mfaEnabled: false, mfaSecret: null }).where(eq(users.id, user.id));
      return { success: true };
    }),

  listSessions: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.select().from(activeSessions).where(eq(activeSessions.userId, ctx.user!.id));
    }),

  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [revoked] = await ctx.db.delete(activeSessions)
        .where(and(eq(activeSessions.id, input.sessionId), eq(activeSessions.userId, ctx.user!.id)))
        .returning();
      return { success: !!revoked };
    }),

  revokeAllSessions: protectedProcedure
    .input(z.object({
        currentSessionId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.currentSessionId) {
          await ctx.db.delete(activeSessions).where(and(eq(activeSessions.userId, ctx.user!.id), ne(activeSessions.id, input.currentSessionId)));
      } else {
          await ctx.db.delete(activeSessions).where(eq(activeSessions.userId, ctx.user!.id));
      }
      return { success: true };
    }),
});
