import crypto from 'crypto';
import { resolveEncryptionKeys } from './secrets.js';

// Dedicated-tenant database connection strings are sealed with this. See the
// rotation note in `crypto.ts` — the two modules share ENCRYPTION_KEY.
const { current: ENCRYPTION_KEY, previous: PREVIOUS_KEYS } = resolveEncryptionKeys();
const IV_LENGTH = 16;

const keyBytes = (key: string) => Buffer.from(key.slice(0, 32));

export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBytes(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptToken(text: string): string {
  if (!text) return text;
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');

  // Retired keys are tried in turn so rotating does not orphan tenants whose
  // connection string was sealed under the old key. CBC has no authentication
  // tag, so a wrong key usually fails on the padding check — and when it does
  // not, it yields bytes that are not a valid connection URL, which the caller
  // rejects. Re-encrypting on next write is what actually retires the old key.
  let lastError: unknown;
  for (const key of [ENCRYPTION_KEY, ...PREVIOUS_KEYS]) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes(key), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Decryption failed');
}
