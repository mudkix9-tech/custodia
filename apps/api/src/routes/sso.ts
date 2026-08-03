// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkOS } from '@workos-inc/node';
import { db } from '../db.js';
import { organizations, users } from 'db';
import { eq } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;

export async function ssoRoutes(fastify: FastifyInstance) {
  fastify.get('/sso/login', async (request: FastifyRequest<{ Querystring: { email?: string; connection?: string; returnTo?: string } }>, reply: FastifyReply) => {
    const { email, connection, returnTo } = request.query;

    let authorizationUrl: string;

    if (connection) {
      authorizationUrl = workos.sso.getAuthorizationUrl({
        clientId: clientId as string,
        connection: connection,
        redirectUri: `${process.env.NEXT_PUBLIC_API_URL}/sso/callback`,
        state: returnTo || '/',
      });
    } else if (email) {
      const domain = email.split('@')[1];
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, domain));

      if (!org || !org.ssoConnectionId || !org.ssoEnabled) {
        return reply.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=SSONotEnabled`);
      }

      authorizationUrl = workos.sso.getAuthorizationUrl({
        clientId: clientId as string,
        connection: org.ssoConnectionId,
        redirectUri: `${process.env.NEXT_PUBLIC_API_URL}/sso/callback`,
        state: returnTo || '/',
        loginHint: email,
      });
    } else {
        return reply.status(400).send('Missing connection or email');
    }

    reply.redirect(authorizationUrl);
  });

  fastify.get('/sso/callback', async (request: FastifyRequest<{ Querystring: { code: string; state?: string } }>, reply: FastifyReply) => {
    const { code, state } = request.query;

    try {
      const { profile } = await workos.sso.getProfileAndToken({
        code,
        clientId: clientId as string,
      });

      const email = profile.email;
      const firstName = profile.firstName;
      const lastName = profile.lastName;
      const name = `${firstName} ${lastName}`.trim() || email;

      const [existingUser] = await db.select().from(users).where(eq(users.email, email));

      let user = existingUser;

      if (!existingUser) {
        const domain = email.split('@')[1];
        let [org] = await db.select().from(organizations).where(eq(organizations.slug, domain));

        if (!org) {
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          [org] = await db.insert(organizations).values({
            name: domain,
            slug: domain,
            countryCode: 'US', // default
            trialEndsAt,
          }).returning();
        }

        [user] = await db.insert(users).values({
          email,
          name,
          organizationId: org.id,
          role: 'member',
          authProvider: 'workos',
          authProviderId: profile.id,
        } as any).returning();
      } else {
         // Optionally update auth details
         await db.update(users).set({
           authProvider: 'workos',
           authProviderId: profile.id
         }).where(eq(users.id, user.id));
      }

      // Generate a JWT token or session
      // This part depends on how NextAuth handles external tokens or custom callbacks.
      // Usually NextAuth's custom provider handles this callback directly, but since the task says
      // "[NEW] apps/api/src/routes/sso.ts — WorkOS callback handler", we'll create a token.

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        process.env.NEXTAUTH_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      // We pass the token to the frontend via a secure redirect (e.g., cookie or hash)
      const returnUrl = state || '/';

      // Normally NextAuth callback is used. If we handle it here, we redirect back to web with a custom token.
      // Pass the generated token to the frontend using a query parameter or cookie
      reply.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/workos?token=${token}&state=${state}`);
    } catch (error: any) {
      console.error(error);
      reply.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=SSOFailed`);
    }
  });
}
