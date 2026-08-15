import crypto from 'crypto';
import { resolveEncryptionKeys } from './secrets.js';

// Stored TOTP seeds are sealed with this. The key used to fall back to a literal
// that shipped in source, so anything encrypted before the rotation is readable
// by anyone holding the repository — see `secrets.ts` and rotate accordingly.
const { current: ENCRYPTION_KEY, previous: PREVIOUS_KEYS } = resolveEncryptionKeys();

const keyBytes = (key: string) => Buffer.from(key.slice(0, 32));

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string) {
  const [ivHex, authTagHex, encryptedText] = text.split(':');
  if (!ivHex || !authTagHex || !encryptedText) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // Try the retired keys after the current one so a rotation does not lock every
  // MFA user out of their account. GCM authenticates, so a wrong key throws here
  // rather than returning plausible rubbish.
  let lastError: unknown;
  for (const key of [ENCRYPTION_KEY, ...PREVIOUS_KEYS]) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(key), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Decryption failed');
}
