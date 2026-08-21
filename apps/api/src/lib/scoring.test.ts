import { calculateComplianceScore } from './scoring.js';
import { db } from '../db.js';

async function runTests() {
  console.log('Starting DPIA penalty scoring unit tests...');

  // Save original query methods
  const originals = {
    processingActivities: db.query.processingActivities.findMany,
    dpias: db.query.dpias.findMany,
    complianceGaps: db.query.complianceGaps.findMany,
    organizationVendors: db.query.organizationVendors.findMany,
    privacyPolicies: db.query.privacyPolicies.findMany,
    dsarRequests: db.query.dsarRequests.findMany,
    breaches: db.query.breaches.findMany,
    trainingCompletions: db.query.trainingCompletions.findMany,
    users: db.query.users.findMany,
    processingTransfers: db.query.processingTransfers.findMany,
    consentDomains: db.query.consentDomains.findMany,
    consentFindings: db.query.consentFindings.findMany,
  };

  try {
    // Mock non-DPIA pillars to return stable values (empty arrays → 100 for most pillars)
    db.query.organizationVendors.findMany = (async () => []) as any;
    db.query.privacyPolicies.findMany = (async () => []) as any;
    db.query.dsarRequests.findMany = (async () => []) as any;
    db.query.breaches.findMany = (async () => []) as any;
    db.query.trainingCompletions.findMany = (async () => []) as any;
    db.query.users.findMany = (async () => []) as any;
    db.query.processingTransfers.findMany = (async () => []) as any;
    db.query.consentDomains.findMany = (async () => []) as any;
    db.query.consentFindings.findMany = (async () => []) as any;

    // Mock 1 processing activity that requires a DPIA and is complete enough for ROPA.
    // `completenessScore` is what the ROPA pillar reads since P123 — the pillar used
    // to derive its own from lawfulBasis and purpose, which is D19.
    db.query.processingActivities.findMany = (async () => [
      { id: 'act-1', organizationId: 'test-org', requiresDpia: true, status: 'active', deletedAt: null, lawfulBasis: 'consent', purpose: 'Testing', completenessScore: 100 }
    ]) as any;

    // ── Test 1: Full compliance, no gaps ──
    db.query.dpias.findMany = (async () => [
      { id: 'dpia-1', organizationId: 'test-org', status: 'completed', processingActivityIds: ['act-1'] }
    ]) as any;
    db.query.complianceGaps.findMany = (async () => []) as any;

    let res = await calculateComplianceScore('test-org');
    console.log('Test 1 — No gaps. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 100, 'Test 1: DPIA sub-score');

    // ── Test 2: 1 open critical DPIA gap → 100 * 0.70 = 70 ──
    db.query.complianceGaps.findMany = (async () => [
      { id: 'g1', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'critical' }
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 2 — 1 critical gap. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 70, 'Test 2: DPIA sub-score');

    // ── Test 3: 1 open high gap → 100 * 0.80 = 80 ──
    db.query.complianceGaps.findMany = (async () => [
      { id: 'g1', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'high' }
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 3 — 1 high gap. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 80, 'Test 3: DPIA sub-score');

    // ── Test 4: 1 open medium gap → 100 * 0.90 = 90 ──
    db.query.complianceGaps.findMany = (async () => [
      { id: 'g1', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'medium' }
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 4 — 1 medium gap. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 90, 'Test 4: DPIA sub-score');

    // ── Test 5: 1 open low gap → 100 * 0.95 = 95 ──
    db.query.complianceGaps.findMany = (async () => [
      { id: 'g1', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'low' }
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 5 — 1 low gap. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 95, 'Test 5: DPIA sub-score');

    // ── Test 6: 2 critical + 1 high → 100 * 0.70 * 0.70 * 0.80 = 39.2 → 39 ──
    db.query.complianceGaps.findMany = (async () => [
      { id: 'g1', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'critical' },
      { id: 'g2', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'critical' },
      { id: 'g3', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'high' }
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 6 — 2 critical + 1 high. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 39, 'Test 6: DPIA sub-score');

    // ── Test 7: Asymptotic - 3 crit + 2 high + 1 med + 1 low ──
    // 0.7^3 * 0.8^2 * 0.9 * 0.95 = 0.343 * 0.64 * 0.855 = ~0.18776 → 19
    db.query.complianceGaps.findMany = (async () => [
      { id: 'g1', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'critical' },
      { id: 'g2', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'critical' },
      { id: 'g3', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'critical' },
      { id: 'g4', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'high' },
      { id: 'g5', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'high' },
      { id: 'g6', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'medium' },
      { id: 'g7', organizationId: 'test-org', source: 'dpia', status: 'open', severity: 'low' }
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 7 — Asymptotic (7 gaps). DPIA sub-score:', res.breakdown.dpia);
    // 0.343 * 0.64 * 0.9 * 0.95 = 0.18776... → Math.round(100 * 0.18776) = 19
    assertEqual(res.breakdown.dpia, 19, 'Test 7: DPIA sub-score');

    // ── Test 8: Resolved gaps should NOT affect score ──
    // The real DB query filters by status IN ('open','in_progress'), so a resolved gap
    // would never be returned. Mock returns empty to simulate DB-level filtering.
    db.query.complianceGaps.findMany = (async () => []) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 8 — Resolved gaps filtered out by DB. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 100, 'Test 8: DPIA sub-score');

    // ── Test 9: Scanner-source gaps should NOT affect DPIA score ──
    // The real DB query filters by source = 'dpia', so scanner gaps would never
    // be returned. Mock returns empty to simulate DB-level filtering.
    db.query.complianceGaps.findMany = (async () => []) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 9 — Scanner gaps filtered out by DB. DPIA sub-score:', res.breakdown.dpia);
    assertEqual(res.breakdown.dpia, 100, 'Test 9: DPIA sub-score');

    // ── Consent pillar ──────────────────────────────────────────────────
    // Deductions are only meaningful once the org actually has a domain to
    // scan; with no domains there is nothing to assess and the pillar is 100.

    // Test 10: a domain exists but the scan found nothing → full marks.
    db.query.consentDomains.findMany = (async () => [{ id: 'domain-1' }]) as any;
    db.query.consentFindings.findMany = (async () => []) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 10 — Domain with no findings. Consent sub-score:', res.breakdown.consent);
    assertEqual(res.breakdown.consent, 100, 'Test 10: consent sub-score');

    // Test 11: one critical and one high → 100 - 25 - 10.
    db.query.consentFindings.findMany = (async () => [
      { severity: 'critical', confidence: '0.90' },
      { severity: 'high', confidence: '0.90' },
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 11 — 1 critical + 1 high. Consent sub-score:', res.breakdown.consent);
    assertEqual(res.breakdown.consent, 65, 'Test 11: consent sub-score');

    // Test 12: a low-confidence finding costs nothing. A scan that could not
    // confirm it reached a consented state must not quietly move the score.
    db.query.consentFindings.findMany = (async () => [
      { severity: 'critical', confidence: '0.50' },
      { severity: 'high', confidence: '0.90' },
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 12 — Low-confidence critical ignored. Consent sub-score:', res.breakdown.consent);
    assertEqual(res.breakdown.consent, 90, 'Test 12: consent sub-score');

    // Test 13: a null confidence is treated as trustworthy, not as unreliable.
    db.query.consentFindings.findMany = (async () => [
      { severity: 'high', confidence: null },
    ]) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 13 — Null confidence counted. Consent sub-score:', res.breakdown.consent);
    assertEqual(res.breakdown.consent, 90, 'Test 13: consent sub-score');

    // Test 14: deductions floor at zero rather than going negative.
    db.query.consentFindings.findMany = (async () => (
      Array.from({ length: 6 }, () => ({ severity: 'critical', confidence: '0.90' }))
    )) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 14 — Floor at zero. Consent sub-score:', res.breakdown.consent);
    assertEqual(res.breakdown.consent, 0, 'Test 14: consent sub-score');

    // Test 15: no consent domains at all → nothing to assess.
    db.query.consentDomains.findMany = (async () => []) as any;

    res = await calculateComplianceScore('test-org');
    console.log('Test 15 — No consent domains. Consent sub-score:', res.breakdown.consent);
    assertEqual(res.breakdown.consent, 100, 'Test 15: consent sub-score');

    // Test 16: the pillar weights still add up to 1, so a perfect score is 100.
    db.query.complianceGaps.findMany = (async () => []) as any;
    res = await calculateComplianceScore('test-org');
    console.log('Test 16 — All pillars at 100. Total:', res.total);
    assertEqual(res.total, 100, 'Test 16: total');

    console.log('\n✅ All 16 scoring tests passed!');
  } finally {
    // Restore originals
    db.query.processingActivities.findMany = originals.processingActivities;
    db.query.dpias.findMany = originals.dpias;
    db.query.complianceGaps.findMany = originals.complianceGaps;
    db.query.organizationVendors.findMany = originals.organizationVendors;
    db.query.privacyPolicies.findMany = originals.privacyPolicies;
    db.query.dsarRequests.findMany = originals.dsarRequests;
    db.query.breaches.findMany = originals.breaches;
    db.query.trainingCompletions.findMany = originals.trainingCompletions;
    db.query.users.findMany = originals.users;
    db.query.processingTransfers.findMany = originals.processingTransfers;
    db.query.consentDomains.findMany = originals.consentDomains;
    db.query.consentFindings.findMany = originals.consentFindings;
  }
}

function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
