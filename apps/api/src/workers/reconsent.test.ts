import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconsentWorker } from './reconsent.js';
import { db, reconsentFlags } from 'db';

vi.mock('db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ id: 'mock-id' }])
    }))
  },
  reconsentFlags: {}
}));

const mockMessagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate
      }
    }))
  };
});

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

  it('should flag as material when Claude returns true', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"isMaterial": true, "confidence": "high", "reasoning": "Major scope change."}' }]
    });

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
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"isMaterial": false, "confidence": "ambiguous", "reasoning": "Unclear wording."}' }]
    });

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

  it('should not flag when Claude returns false with high confidence', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"isMaterial": false, "confidence": "high", "reasoning": "Just a typo fix."}' }]
    });

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
