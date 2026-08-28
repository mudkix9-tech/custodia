/**
 * Access tokens for the unauthenticated vendor assessment flow.
 *
 * The token in the invitation link is a bearer credential: whoever holds it can
 * read the assessment and submit answers on the vendor's behalf. It was stored in
 * `vendor_assessments.access_token` as plaintext, which means anyone with read
 * access to that table — a database backup, a support query, a log of a failed
 * migration — held every live invitation (D38, an acknowledged TODO in the schema).
 *
 * Stored as a SHA-256 hash now, so the column is useless to a reader. SHA-256
 * without a salt is the right choice here rather than a password KDF: the token is
 * 128 bits of `randomUUID()` entropy, so there is nothing to brute-force and
 * nothing to rainbow-table, and lookup has to stay a single indexed equality.
 */
import crypto from 'crypto';

/** A fresh token: the plaintext goes in the link, the hash goes in the database. */
export function generateAccessToken(): { token: string; tokenHash: string } {
  const token = crypto.randomUUID();
  return { token, tokenHash: hashAccessToken(token) };
}

export function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * True for a value that is one of our stored hashes rather than a legacy plaintext
 * token.
 *
 * Rows written before hashing still hold a 36-character UUID, and their invitation
 * emails are already in vendors' inboxes. Rather than invalidate every in-flight
 * assessment, lookup accepts both: hash first, then plaintext for a legacy row.
 * Once the longest assessment expiry has passed, the fallback in
 * `assessments.getAssessmentByToken` and `submitAssessmentResponses` can go, and
 * this function with it.
 */
export function isHashedToken(stored: string): boolean {
  return /^[0-9a-f]{64}$/.test(stored);
}
