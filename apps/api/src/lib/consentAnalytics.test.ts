import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db.js';
import { consentRecords, consentDomains, organizations } from 'db';
import { sql } from 'drizzle-orm';
import { getWithdrawalMetrics } from './consentAnalytics.js';
import { v4 as uuidv4 } from 'uuid';

describe('consentAnalytics - getWithdrawalMetrics', () => {
  let orgId: string;
  let domainId: string;

  beforeAll(async () => {
    // Setup org and domain
    orgId = uuidv4();
    domainId = uuidv4();
    await db.insert(organizations).values({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org-' + orgId.slice(0, 8),
      countryCode: 'US'
    } as any);
    await db.insert(consentDomains).values({
      id: domainId,
      organizationId: orgId,
      domain: 'test-' + domainId.slice(0, 8) + '.com',
      scriptId: uuidv4()
    } as any);
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(consentRecords).where(
      sql`${consentRecords.domainId} = ${domainId}`
    );
    await db.delete(consentDomains).where(
      sql`${consentDomains.id} = ${domainId}`
    );
    await db.delete(organizations).where(
      sql`${organizations.id} = ${orgId}`
    );
  });

  it('should calculate time-to-withdrawal ignoring cross-window pairings', async () => {
    const startDate = new Date('2026-07-01T00:00:00Z');
    const endDate = new Date('2026-07-31T23:59:59Z');

    const consentId1 = uuidv4(); // Both in window
    const consentId2 = uuidv4(); // Initial outside window, withdrawal in window
    
    await db.insert(consentRecords).values([
      // Pair 1: In window (time difference is 48 hours)
      {
        id: uuidv4(),
        domainId,
        consentId: consentId1,
        categoriesAccepted: ['necessary', 'analytics'],
        eventType: 'initial',
        givenAt: new Date('2026-07-10T12:00:00Z')
      },
      {
        id: uuidv4(),
        domainId,
        consentId: consentId1,
        categoriesAccepted: ['necessary'],
        eventType: 'withdrawal',
        givenAt: new Date('2026-07-12T12:00:00Z') // 48 hours later
      },
      // Pair 2: Initial outside window
      {
        id: uuidv4(),
        domainId,
        consentId: consentId2,
        categoriesAccepted: ['necessary', 'marketing'],
        eventType: 'initial',
        givenAt: new Date('2026-06-15T12:00:00Z') // June, outside window
      },
      {
        id: uuidv4(),
        domainId,
        consentId: consentId2,
        categoriesAccepted: ['necessary'],
        eventType: 'withdrawal',
        givenAt: new Date('2026-07-15T12:00:00Z')
      }
    ]);

    const metrics = await getWithdrawalMetrics(db, [domainId], startDate, endDate);

    // withdrawalVolume should be 2, because two withdrawals fell in July
    expect(metrics.withdrawalVolume).toBe(2);

    // The relative Volume percent: initial acceptances in window = 1. Withdrawals in window = 2. Ratio = 200%
    expect(metrics.relativeVolumePercent).toBe(200);

    // average time-to-withdrawal should ONLY include Pair 1 (48 hours), Pair 2 is cross-window so it should be excluded from self-join
    expect(metrics.avgTimeToWithdrawalHours).toBe(48);
  });
});

describe('consentAnalytics - getGranularCategoryDistribution', () => {
  let orgId: string;
  let domainId: string;

  beforeAll(async () => {
    // Setup org and domain
    orgId = uuidv4();
    domainId = uuidv4();
    await db.insert(organizations).values({
      id: orgId,
      name: 'Test Org 2',
      slug: 'test-org-2-' + orgId.slice(0, 8),
      countryCode: 'US'
    } as any);
    await db.insert(consentDomains).values({
      id: domainId,
      organizationId: orgId,
      domain: 'test-2-' + domainId.slice(0, 8) + '.com',
      scriptId: uuidv4()
    } as any);
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(consentRecords).where(
      sql`${consentRecords.domainId} = ${domainId}`
    );
    await db.delete(consentDomains).where(
      sql`${consentDomains.id} = ${domainId}`
    );
    await db.delete(organizations).where(
      sql`${organizations.id} = ${orgId}`
    );
  });

  it('collapses the same category set regardless of array insertion order', async () => {
    const { getGranularCategoryDistribution } = await import('./consentAnalytics.js');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);

    // Insert records with different JSON array orderings
    await db.insert(consentRecords).values([
      {
        id: uuidv4(),
        domainId,
        consentId: uuidv4(),
        eventType: 'initial',
        interactionType: 'customized',
        categoriesAccepted: ['analytics', 'marketing'], // order 1
        categoriesRejected: ['functional'],
        country: 'FR',
        givenAt: new Date(),
      },
      {
        id: uuidv4(),
        domainId,
        consentId: uuidv4(),
        eventType: 'initial',
        interactionType: 'customized',
        categoriesAccepted: ['marketing', 'analytics'], // order 2 (reversed)
        categoriesRejected: ['functional'],
        country: 'FR',
        givenAt: new Date(),
      }
    ]);

    const result = await getGranularCategoryDistribution(db, [domainId], startDate, endDate);

    // Should be ONE combined bucket, not two
    const combos = result.filter((r: any) => r.combination === 'analytics,marketing');
    expect(combos).toHaveLength(1);
    expect(combos[0].count).toBe(2);
  });
});
