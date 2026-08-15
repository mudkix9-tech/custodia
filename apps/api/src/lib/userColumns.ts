import { users } from 'db';

// ---------------------------------------------------------------------------
// Safe column sets for the `users` table.
//
// `users` carries three secrets alongside the ordinary profile fields:
// `password_hash`, `mfa_secret` (plaintext — see the TODO on the schema) and
// `auth_provider_id`. A bare `select().from(users)` or a relational
// `with: { assignee: true }` returns all of them, and several procedures were
// handing that straight to the client: any member could read every colleague's
// hash and TOTP seed, which is a full account-takeover primitive against
// admins and owners from an ordinary member account.
//
// Drizzle has no notion of a column being private, so the omission has to be
// written out at each call site. These constants exist so it is one spread
// rather than a list the next author has to remember in full — a new secret
// column is added here once and every consumer inherits it.
// ---------------------------------------------------------------------------

/**
 * Columns to *exclude*, for `db.query.users` relational selects.
 *
 * Drizzle reads a `columns` object as an allowlist as soon as any key is
 * `true`, so this deliberately uses only `false` keys: everything unlisted
 * stays selected, and a column added to `schema.ts` later is included by
 * default rather than silently dropped from a response.
 */
export const USER_SECRET_COLUMNS = {
  passwordHash: false,
  mfaSecret: false,
  authProviderId: false,
} as const;

/**
 * The same exclusion for `db.select()`, which takes an allowlist and therefore
 * has to name every column it wants. Keep in sync with `schema.ts`: a column
 * added there is *not* returned by these call sites until it is added here.
 *
 * Built from the real table rather than a parameter so Drizzle still infers each
 * column's type — taking `users` as `any` would have quietly widened every
 * consumer of these procedures, including the web app, to `any`.
 */
export const userPublicColumns = {
  id: users.id,
  organizationId: users.organizationId,
  email: users.email,
  emailVerified: users.emailVerified,
  name: users.name,
  avatarUrl: users.avatarUrl,
  image: users.image,
  authProvider: users.authProvider,
  mfaEnabled: users.mfaEnabled,
  customRoleId: users.customRoleId,
  role: users.role,
  organizationGroupRole: users.organizationGroupRole,
  permissions: users.permissions,
  tokenInvalidatedAt: users.tokenInvalidatedAt,
  marketingConsent: users.marketingConsent,
  lastTrainingCompletedAt: users.lastTrainingCompletedAt,
  policyAcknowledgedAt: users.policyAcknowledgedAt,
  notificationOverrides: users.notificationOverrides,
  timezone: users.timezone,
  language: users.language,
  lastLoginAt: users.lastLoginAt,
  invitedAt: users.invitedAt,
  invitedBy: users.invitedBy,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
};
