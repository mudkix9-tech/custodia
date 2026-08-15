import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Secret resolution.
//
// Every secret in this codebase used to be read as `process.env.X || '<literal>'`.
// That fallback is not a development convenience — it is a published key: the
// literal is in git, so anyone with read access to the repository could forge
// session cookies, mint DSAR identity-verification tokens, and decrypt both the
// stored TOTP seeds and the dedicated-tenant database connection strings.
//
// Worse, the deployed `.env` had been *set* to those same literals, so a check
// for "is it unset" would have passed while the key stayed public. Hence
// `KNOWN_COMPROMISED`: a value that has appeared in source is rejected on the
// same footing as no value at all.
//
// In production a missing or burned secret is fatal at boot. Refusing to start
// is the only safe failure here — the alternative is a process that looks
// healthy while signing with a key the world already has. Outside production we
// derive a per-machine value instead, so local work and the standalone test
// scripts keep running without anyone pasting a real secret onto a laptop.
// ---------------------------------------------------------------------------

/**
 * Literals that shipped in this repository's source or `.env.example`. Treated
 * as unset wherever they appear. Never remove an entry — a value that has once
 * been public stays public, and this list is what stops it coming back.
 */
const KNOWN_COMPROMISED = new Set([
  'secret',
  'default_secret_key_needs_to_be_32_bytes_long_so_this_is_it!',
  '0123456789abcdef0123456789abcdef',
  'fallback_secret_for_dev',
  'changeme',
  'your-secret-here',
]);

const warned = new Set<string>();

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Deterministic per-machine stand-in for a secret, used outside production only.
 *
 * Derived from the hostname and the secret's name so it is stable across restarts
 * — an unstable value would log every developer out on each reload — while still
 * differing between machines, so it can never become a shared de-facto key the
 * way the old hardcoded literals did.
 */
function developmentFallback(name: string): string {
  return crypto.createHash('sha256')
    .update(`custodia-dev/${process.env.HOSTNAME || 'localhost'}/${name}`)
    .digest('hex');
}

export type RequireSecretOptions = {
  /** Reject anything shorter. Defaults to 16 characters. */
  minLength?: number;
  /** Extra context for the boot-time error, e.g. how to generate a value. */
  hint?: string;
};

/**
 * Returns the named secret, or throws in production when it is missing, too
 * short, or a value that has previously been published.
 */
export function requireSecret(name: string, options: RequireSecretOptions = {}): string {
  const { minLength = 16, hint } = options;
  const value = process.env[name];

  let problem: string | null = null;
  if (!value) problem = 'is not set';
  else if (KNOWN_COMPROMISED.has(value)) problem = 'is set to a value that is published in this repository';
  else if (value.length < minLength) problem = `is shorter than the required ${minLength} characters`;

  if (!problem) return value!;

  if (isProduction()) {
    throw new Error(
      `[secrets] ${name} ${problem}. Refusing to start: this key protects ` +
      `authentication or stored credentials.${hint ? ` ${hint}` : ''}`,
    );
  }

  if (!warned.has(name)) {
    warned.add(name);
    console.warn(
      `[secrets] ${name} ${problem} — using a per-machine development value. ` +
      `This would be a fatal error under NODE_ENV=production.`,
    );
  }
  return developmentFallback(name);
}

/**
 * Resolves an encryption key plus any superseded keys still needed to read old
 * ciphertext.
 *
 * Rotation is the reason this returns a list. `ENCRYPTION_KEY` was public, so it
 * has to change — but the TOTP seeds and dedicated-tenant connection strings
 * already in the database are sealed under the old one. Setting
 * `ENCRYPTION_KEY_PREVIOUS` to the retired key keeps those readable (and
 * re-sealed on next write) instead of locking every MFA user out on deploy.
 *
 * The primary key is *not* exempt from the compromised-value check; the previous
 * keys deliberately are, since a burned key is exactly what belongs there.
 */
export function resolveEncryptionKeys(name = 'ENCRYPTION_KEY'): { current: string; previous: string[] } {
  const current = requireSecret(name, {
    minLength: 32,
    hint: `Generate one with: openssl rand -hex 32. If you are rotating, set ${name}_PREVIOUS to the old key so existing ciphertext stays readable.`,
  });

  const previous = (process.env[`${name}_PREVIOUS`] || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return { current, previous };
}

/**
 * Runs every secret check at boot rather than on first use.
 *
 * Without this the process starts happily and only fails when someone tries to
 * log in or a worker touches an encrypted column — a misconfiguration that
 * surfaces as scattered 500s in production instead of a refusal to deploy.
 */
export function assertSecretsConfigured(): void {
  requireSecret('AUTH_SECRET', { minLength: 32, hint: 'Generate one with: openssl rand -base64 32' });
  requireSecret('JWT_SECRET', { minLength: 32, hint: 'Generate one with: openssl rand -base64 32' });
  resolveEncryptionKeys();
}
