import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchResourceBeforeState, sanitizeForAuditLog } from './auditLogger.js';
import { db } from '../db.js';

// Mock DB to spy on its queries and prevent actual database connections
vi.mock('../db.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([])
        })
      })
    })
  }
}));

describe('auditLogger utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchResourceBeforeState', () => {
    it('should return null immediately for an unmapped resource path without querying the database', async () => {
      const result = await fetchResourceBeforeState('invalid.path', 'res-123', 'org-123');

      expect(result).toBeNull();
      // Verify db.select was not called
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should return null for an empty path', async () => {
      const result = await fetchResourceBeforeState('', 'res-123', 'org-123');
      expect(result).toBeNull();
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should query the database for a valid, mapped resource path', async () => {
      // 'ropa' is a valid mapping key in RESOURCE_TABLE_MAP
      await fetchResourceBeforeState('ropa', 'ropa-123', 'org-123');
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('sanitizeForAuditLog', () => {
    it('should return null or non-object values unchanged', () => {
      expect(sanitizeForAuditLog(null)).toBeNull();
      expect(sanitizeForAuditLog(undefined)).toBeUndefined();
      expect(sanitizeForAuditLog('test-string')).toBe('test-string');
      expect(sanitizeForAuditLog(42)).toBe(42);
    });

    it('should sanitize sensitive fields within objects', () => {
      const input = {
        id: 'user-123',
        email: 'user@example.com',
        password: 'super-secret-password',
        token: 'auth-token-xyz',
        profile: {
          name: 'Jane Doe',
          mfaSecret: 'mfa-secret-key'
        }
      };

      const expected = {
        id: 'user-123',
        email: 'user@example.com',
        password: '[REDACTED]',
        token: '[REDACTED]',
        profile: {
          name: 'Jane Doe',
          mfaSecret: '[REDACTED]'
        }
      };

      expect(sanitizeForAuditLog(input)).toEqual(expected);
    });

    it('should sanitize sensitive fields within arrays', () => {
      const input = [
        { id: '1', password: 'p1', name: 'Alice' },
        { id: '2', token: 't2', name: 'Bob' }
      ];

      const expected = [
        { id: '1', password: '[REDACTED]', name: 'Alice' },
        { id: '2', token: '[REDACTED]', name: 'Bob' }
      ];

      expect(sanitizeForAuditLog(input)).toEqual(expected);
    });
  });
});
