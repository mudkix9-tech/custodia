/**
 * Mints a short-lived session token for probing, so you do not have to dig one out
 * of a browser cookie jar.
 *
 *   npm run mint-token --workspace=apps/api -- you@example.com
 *   npm run mint-token --workspace=apps/api -- you@example.com --dev
 *
 * `isAuthed` accepts a bearer token as a fallback to the cookie and decodes it with
 * AUTH_SECRET (trpc.ts). So anything encoded with the same secret and salt is a valid
 * session — which is all this does. The secret is read from the environment and never
 * printed.
 *
 * The salt must equal the cookie name the *target* service would use, because
 * @auth/core derives the encryption key from it: `__Secure-authjs.session-token` when
 * that service runs with NODE_ENV=production, `authjs.session-token` otherwise. This
 * defaults to the production name since the reason to mint one is usually to probe a
 * deployed environment; pass --dev for a local server.
 *
 * The user must really exist: isAuthed looks up `users.tokenInvalidatedAt` and rejects
 * the token if the row is missing. The org, role and custom role are read from that
 * row so the token carries the access that account actually has, and no more.
 *
 * ── The output is a live credential ──────────────────────────────────────────────
 * It grants this user's access to whoever holds it, so mint one for your own account
 * rather than a customer's, keep it out of shared logs and CI output, and leave the
 * lifetime short. It defaults to one hour.
 */
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { encode } from '@auth/core/jwt';
import { eq } from 'drizzle-orm';
import { users } from 'db';
import { db } from '../db.js';

export const PRODUCTION_COOKIE = '__Secure-authjs.session-token';
export const DEVELOPMENT_COOKIE = 'authjs.session-token';

/**
 * Shared with the probe, which mints its own token rather than having one pasted
 * through a shell variable — a static command line is far easier to grant narrowly
 * in settings.json, and the credential never reaches a terminal.
 */
export async function mintToken(email: string, salt: string, maxAge: number, secretOverride?: string) {
  const secret = secretOverride || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set. It must match the secret of the service you intend to call.');
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      organizationId: users.organizationId,
      role: users.role,
      customRoleId: users.customRoleId,
    })
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    throw new Error(
      `No user with email ${email} in the database this script is pointed at. ` +
      'Check which DATABASE_URL was loaded — .env files differ between the repo root and apps/api.'
    );
  }
  if (!user.organizationId) {
    throw new Error(`${email} has no organizationId, so isAuthed would reject the token.`);
  }

  const token = await encode({
    token: {
      sub: user.id,
      email: user.email,
      org: user.organizationId,
      role: user.role,
      customRoleId: user.customRoleId,
      // Role defaults in ROLE_PERMISSION_DEFAULTS do the work; an explicit list here
      // would grant more than the account has, which would make the probe lie.
      permissions: [],
    },
    secret,
    salt,
    maxAge,
  });

  return { token, user };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const email = args[0];
  const salt = process.argv.includes('--dev') ? DEVELOPMENT_COOKIE : PRODUCTION_COOKIE;
  const maxAge = Number(process.env.TOKEN_TTL_SECONDS || 3600);

  if (!email) {
    console.error('Usage: npm run mint-token --workspace=apps/api -- <email> [--dev]');
    process.exit(1);
  }

  const { token, user } = await mintToken(email, salt, maxAge);

  console.error(`user ${user.email} · role ${user.role} · org ${user.organizationId}`);
  console.error(`salt ${salt} · expires in ${maxAge}s\n`);
  // The token alone goes to stdout so it can be captured: TOKEN=$(npm run … | tail -1)
  console.log(token);

  process.exit(0);
}

// Only when run directly. The probe imports mintToken() from here, and without this
// guard that import would run main(), print the usage banner and exit.
const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (import.meta.url === entrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
