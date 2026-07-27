import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db';
import Resend from 'next-auth/providers/resend';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import WorkOS from 'next-auth/providers/workos';
import { eq } from 'drizzle-orm';
import { users, organizations, pendingSignups, assessments, auditLogs, account, session, verificationToken } from 'db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: account,
    sessionsTable: session,
    verificationTokensTable: verificationToken,
  }),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Resend({
      from: 'noreply@trycustodia.online',
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
        WorkOS({
      clientId: process.env.WORKOS_CLIENT_ID,
      clientSecret: process.env.WORKOS_API_KEY,
      issuer: 'https://api.workos.com/sso/saml',
      profile(profile) {
        return {
          id: profile.id,
          name: profile.first_name ? `${profile.first_name} ${profile.last_name}` : profile.email,
          email: profile.email,
          image: profile.raw_attributes?.picture ?? null,
        }
      }
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
    } as any)
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        const [dbUser] = await db.select().from(users).where(eq(users.id, user.id as string));
        if (dbUser) {
          token.org = dbUser.organizationId;
          token.role = dbUser.role;
          token.customRoleId = dbUser.customRoleId;
          token.permissions = dbUser.permissions;
          token.tokenInvalidatedAt = dbUser.tokenInvalidatedAt ? dbUser.tokenInvalidatedAt.getTime() : null;
          
          if (dbUser.organizationId) {
            const [org] = await db.select().from(organizations).where(eq(organizations.id, dbUser.organizationId));
            token.tier = org?.subscriptionTier || 'starter';
            token.onboardingCompleted = org?.onboardingCompleted;
            token.onboardingDismissed = org?.onboardingDismissed;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        (session.user as any).organizationId = token.org as string;
        (session.user as any).role = token.role as string;
        (session.user as any).customRoleId = token.customRoleId as string | null;
        (session.user as any).permissions = token.permissions as string[];
        (session.user as any).tier = token.tier as string;
        (session as any).onboardingCompleted = token.onboardingCompleted as boolean;
        (session as any).onboardingDismissed = token.onboardingDismissed as boolean;
        (session as any).tokenInvalidatedAt = token.tokenInvalidatedAt;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      
      // 1. Auto-create organization from email domain
      const domain = user.email.split('@')[1] || 'agency';
      const [newOrg] = await db.insert(organizations).values({
        name: domain,
        slug: domain,
        countryCode: 'US', // Default required by schema
      }).returning();
      
      // 2. Fetch pending signups to check for marketing consent and anonymous sessions
      const [pending] = await db.select().from(pendingSignups)
        .where(eq(pendingSignups.email, user.email));
        
      // 3. Set user as owner and apply marketing consent
      await db.update(users).set({
        organizationId: newOrg.id,
        role: 'owner',
        marketingConsent: pending?.marketingConsent ?? false,
      }).where(eq(users.id, user.id));
      
      // 4. Migrate assessments
      if (pending && pending.anonymousSessionId) {
        await db.update(assessments).set({
          organizationId: newOrg.id,
        }).where(eq(assessments.anonymousSessionId, pending.anonymousSessionId));
      }
    },
    async signIn({ user }) {
      if (!user || !user.id) return;
      
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
      if (dbUser) {
        const lastLoginAt = dbUser.lastLoginAt;
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        
        if (dbUser.organizationId && lastLoginAt) {
          // Push to pg-boss for catch-up semantic matching
          try {
            const { default: PgBoss } = await import('pg-boss');
            const connectionString = process.env.DIRECT_URL || (process.env.DATABASE_URL || '').replace(':6543/', ':5432/');
            const boss = new PgBoss(connectionString);
            
            // Connect and send
            await boss.start();
            await boss.send('impact-assessment', {
              name: 'match-catchup',
              data: {
                organizationId: dbUser.organizationId,
                lastLoginAt: lastLoginAt.toISOString()
              }
            });
            await boss.stop();
          } catch (err) {
            console.error('[NextAuth] Failed to queue match-catchup job', err);
          }
        }
      }
    },
    async signOut(message: any) {
      const token = message.token;
      if (token && token.sub) {
        // Log sign out action
        await db.insert(auditLogs).values({
          action: 'user_logged_out',
          userId: token.sub as string,
          organizationId: token.org as string || null,
          newValue: { reason: 'User initiated sign out' }
        } as any);
      }
    }
  }
});
