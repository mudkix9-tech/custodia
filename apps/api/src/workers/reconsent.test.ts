import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconsentWorker } from './reconsent.js';
import { reconsentFlags } from 'db';
import { db } from '../db.js';

// reconsent.ts imports the drizzle instance from ../db.js, not from the "db"
// package (which exports only the schema). Mocking "db" left the real instance in
// place, so this never intercepted anything.
vi.mock('../db.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ id: 'mock-id' }])
    }))
  }
}));

// The worker calls the shared adapter, not a provider SDK. This used to mock
// '@anthropic-ai/sdk', which went on compiling after the migration while
// intercepting nothing — an inert mock that would have let the test reach the
// real client. `completeJson` resolves the PARSED object, so these fixtures are
// plain values rather than a provider's response envelope.
const mockCompleteJson = vi.fn();

vi.mock('../lib/llm.js', () => ({
  EXTRACTION_MODEL: 'test-model',
  completeJson: mockCompleteJson,
}));

describe('Reconsent Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip evaluation if oldPurpose matches newPurpose', async () => {
    const job = {
      data: {
        activityId: 'act-1',
        organizationId: 'org-1',
        oldPurpose: 'same purpose',
        newPurpose: 'same purpose',
        dataCategories: ['email'],
        lawfulBasis: 'consent',
        vendorList: []
      }
    } as any;

    // We can extract the processor function from reconsentWorker
    const processor = (reconsentWorker as any).processFn;
    const result = await processor(job);
    expect(result).toEqual({ skipped: true, reason: 'No purpose change' });
  });

  it('should flag as material when the model returns true', async () => {
    mockCompleteJson.mockResolvedValueOnce({"isMaterial": true, "confidence": "high", "reasoning": "Major scope change."});

    const job = {
      data: {
        activityId: 'act-1',
        organizationId: 'org-1',
        oldPurpose: 'Send emails',
        newPurpose: 'Send personalized emails based on tracking',
        dataCategories: ['email', 'tracking_data'],
        lawfulBasis: 'consent',
        vendorList: []
      }
    } as any;

    const processor = (reconsentWorker as any).processFn;
    const result = await processor(job);
    expect(result).toEqual({ isMaterial: true, confidence: 'high', reasoning: 'Major scope change.' });
    
    // Verify db.insert was called
    expect(db.insert).toHaveBeenCalled();
  });

  it('should flag ambiguous cases for human review', async () => {
    mockCompleteJson.mockResolvedValueOnce({"isMaterial": false, "confidence": "ambiguous", "reasoning": "Unclear wording."});

    const job = {
      data: {
        activityId: 'act-1',
        organizationId: 'org-1',
        oldPurpose: 'Analytics',
        newPurpose: 'Advanced Analytics',
        dataCategories: ['ip_address'],
        lawfulBasis: 'consent',
        vendorList: []
      }
    } as any;

    const processor = (reconsentWorker as any).processFn;
    const result = await processor(job);
    expect(result).toEqual({ isMaterial: false, confidence: 'ambiguous', reasoning: 'Unclear wording.' });
    
    // Verify db.insert was called because confidence is ambiguous
    expect(db.insert).toHaveBeenCalled();
  });

  it('should not flag when the model returns false with high confidence', async () => {
    mockCompleteJson.mockResolvedValueOnce({"isMaterial": false, "confidence": "high", "reasoning": "Just a typo fix."});

    const job = {
      data: {
        activityId: 'act-1',
        organizationId: 'org-1',
        oldPurpose: 'Send emals',
        newPurpose: 'Send emails',
        dataCategories: ['email'],
        lawfulBasis: 'consent',
        vendorList: []
      }
    } as any;

    const processor = (reconsentWorker as any).processFn;
    const result = await processor(job);
    
    // Verify db.insert was NOT called
    expect(db.insert).not.toHaveBeenCalled();
  });
});
