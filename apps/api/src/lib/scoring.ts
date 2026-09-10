import { db } from '../db.js';
import { processingActivities, organizationVendors, privacyPolicies, dpias, dsarRequests, breaches, trainingModules, trainingCompletions, processingTransfers, complianceReports, complianceGaps, consentDomains, consentFindings } from 'db';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { users } from 'db';

// The consent pillar was added after the fact, so its 5 points are taken from the
// four heaviest existing pillars rather than from any single one. Scores move
// slightly for every organisation on the first run after this change.
const PILLAR_WEIGHTS = {
  ropa: 0.23,
  vendors: 0.19,
  dpia: 0.14,
  policies: 0.10,
  dsar: 0.10,
  breach: 0.05,
  training: 0.09,
  transfers: 0.05,
  consent: 0.05,
};

export async function calculateComplianceScore(orgId: string) {
  const activities = await db.query.processingActivities.findMany({
    where: and(
      eq(processingActivities.organizationId, orgId),
      isNull(processingActivities.deletedAt),
    ),
    columns: {
      id: true,
      status: true,
      requiresDpia: true,
      lawfulBasis: true,
      purpose: true,
      // P123. The denormalised Article 30 completeness score, which the API keeps
      // in step after every mutation that can move it. The ROPA pillar used to be
      // computed from `lawfulBasis` and `purpose` alone; see calculateRopaScore.
      completenessScore: true,
    }
  });

  const [ropa, vendors, dpia, policies, dsar, breach, training, transfers, consent] = await Promise.all([
    calculateRopaScore(orgId, activities),
    calculateVendorScore(orgId),
    calculateDpiaScore(orgId, activities),
    calculatePolicyScore(orgId),
    calculateDsarScore(orgId),
    calculateBreachScore(orgId),
    calculateTrainingScore(orgId),
    calculateTransferScore(activities),
    calculateConsentScore(orgId),
  ]);

  const total = Math.round(
    ropa * PILLAR_WEIGHTS.ropa +
    vendors * PILLAR_WEIGHTS.vendors +
    dpia * PILLAR_WEIGHTS.dpia +
    policies * PILLAR_WEIGHTS.policies +
    dsar * PILLAR_WEIGHTS.dsar +
    breach * PILLAR_WEIGHTS.breach +
    training * PILLAR_WEIGHTS.training +
    transfers * PILLAR_WEIGHTS.transfers +
    consent * PILLAR_WEIGHTS.consent
  );

  return {
    total,
    breakdown: { ropa, vendors, dpia, policies, dsar, breach, training, transfers, consent },
  };
}

/**
 * Consent pillar: open critical and high findings from the tracker reconciliation
 * scan (apps/api/src/workers/consentScan.ts).
 *
 * Only critical and high count. Medium and low are real, but they describe
 * documentation gaps rather than trackers running without a lawful basis, and
 * letting them move a headline score would make the number noisy enough to ignore.
 *
 * Findings below 0.7 confidence are excluded for the same reason the UI refuses to
 * present them as definitive: they come from a scan that could not reliably reach a
 * consented state, so they must not silently cost an organisation points.
 *
 * An organisation with no consent domains scores 100, matching how every other
 * pillar here treats "nothing to assess". Note this also means a domain that has
 * never been scanned scores 100 — absence of findings is not evidence of
 * compliance, and the Coverage panel is where that distinction is visible.
 */
const CONSENT_FINDING_DEDUCTIONS: Record<string, number> = {
  critical: 25,
  high: 10,
};

async function calculateConsentScore(orgId: string) {
  const domains = await db.query.consentDomains.findMany({
    where: eq(consentDomains.organizationId, orgId),
    columns: { id: true },
  });

  if (domains.length === 0) return 100;

  const openFindings = await db.query.consentFindings.findMany({
    where: and(
      eq(consentFindings.organizationId, orgId),
      eq(consentFindings.state, 'open'),
      inArray(consentFindings.severity, ['critical', 'high']),
    ),
    columns: { severity: true, confidence: true },
  });

  let score = 100;
  for (const finding of openFindings) {
    if (finding.confidence !== null && Number(finding.confidence) < 0.7) continue;
    score -= CONSENT_FINDING_DEDUCTIONS[finding.severity] ?? 0;
  }

  return Math.max(0, score);
}

/**
 * P123/D19. The ROPA pillar, against Article 30 rather than against two columns.
 *
 * What this replaced scored `!lawfulBasis` and `!purpose`, at fifty points each,
 * over published activities. Twenty-three per cent of the headline number could
 * therefore not detect a register with no retention periods, no data subject
 * categories, no recipients and no transfers documented — the four findings a
 * supervisory authority raises on the first page.
 *
 * It now reads `completeness_score`, which is `scoreActivity()` over the activity
 * and its four child tables, denormalised by the API after every mutation that can
 * move it. Reading the stored column rather than recomputing is the whole reason
 * that column exists: recomputing means five queries per activity on a nightly job
 * that already runs on the same 512MB box as Chromium.
 *
 * The critical-gap multiplier is the second half, and it is doing something the
 * average cannot. A register of forty tidy activities and one that transfers
 * special-category data to a third country with no safeguard averages out at
 * roughly "fine"; a critical Chapter V finding is not something an average should
 * be able to absorb. Same mechanism the DPIA pillar already uses, and deliberately
 * capped at four multiplications so a register with thirty findings does not floor
 * the pillar to zero and stop distinguishing bad from worse.
 */
async function calculateRopaScore(orgId: string, activities: any[]) {
  const activeActivities = activities.filter(a => a.status === 'active');
  // Consistent with every other pillar here: nothing to assess scores 100. A
  // register with no activities at all is a finding, but it belongs to the gap
  // scanner, which can say so in words rather than by moving a number nobody can
  // interpret.
  if (activeActivities.length === 0) return 100;

  const avgCompleteness = activeActivities.reduce(
    (sum, a) => sum + Math.max(0, Math.min(100, a.completenessScore ?? 0)),
    0,
  ) / activeActivities.length;

  const criticalGaps = await db.query.complianceGaps.findMany({
    where: and(
      eq(complianceGaps.organizationId, orgId),
      eq(complianceGaps.entityType, 'ropa'),
      eq(complianceGaps.severity, 'critical'),
      inArray(complianceGaps.status, ['open', 'in_progress']),
    ),
    columns: { id: true },
  });

  const multiplier = Math.pow(0.85, Math.min(criticalGaps.length, 4));
  return Math.max(0, Math.min(100, Math.round(avgCompleteness * multiplier)));
}

async function calculateVendorScore(orgId: string) {
  const vendorsList = await db.query.organizationVendors.findMany({
    where: eq(organizationVendors.organizationId, orgId),
  });
  if (vendorsList.length === 0) return 100;

  let totalScore = 0;
  for (const v of vendorsList) {
    if (v.dpaStatus === 'signed') totalScore += 100;
    else if (v.dpaStatus === 'expired') totalScore += 20;
    else totalScore += 0;
  }
  return Math.round(totalScore / vendorsList.length);
}

async function calculateDpiaScore(orgId: string, activities: any[]) {
  const dpiaActivities = activities.filter(a => a.requiresDpia === true);

  let completed = 0;
  if (dpiaActivities.length > 0) {
    const records = await db.query.dpias.findMany({
      where: eq(dpias.organizationId, orgId),
    });
    for (const a of dpiaActivities) {
      const hasCompletedDpia = records.some((d: any) =>
        d.status === 'completed' &&
        Array.isArray(d.processingActivityIds) &&
        d.processingActivityIds.includes(a.id)
      );
      if (hasCompletedDpia) completed++;
    }
  }

  const baseDpiaScore = dpiaActivities.length > 0 ? (completed / dpiaActivities.length) * 100 : 100;

  // Apply percentage-based penalties for unmitigated DPIA residual risk gaps
  const openDpiaGaps = await db.query.complianceGaps.findMany({
    where: and(
      eq(complianceGaps.organizationId, orgId),
      eq(complianceGaps.source, 'dpia'),
      inArray(complianceGaps.status, ['open', 'in_progress'])
    )
  });

  let multiplier = 1.0;
  for (const gap of openDpiaGaps) {
    if (gap.severity === 'critical') multiplier *= 0.70;
    else if (gap.severity === 'high') multiplier *= 0.80;
    else if (gap.severity === 'medium') multiplier *= 0.90;
    else if (gap.severity === 'low') multiplier *= 0.95;
  }

  return Math.max(0, Math.min(100, Math.round(baseDpiaScore * multiplier)));
}

async function calculatePolicyScore(orgId: string) {
  const policies = await db.query.privacyPolicies.findMany({
    where: eq(privacyPolicies.organizationId, orgId),
  });
  if (policies.length === 0) return 100; // if no data, no violation

  // just check if they have at least one active policy
  const hasActive = policies.some(p => p.publishedAt !== null);
  return hasActive ? 100 : 50;
}

async function calculateDsarScore(orgId: string) {
  const requests = await db.query.dsarRequests.findMany({
    where: eq(dsarRequests.organizationId, orgId),
  });
  if (requests.length === 0) return 100;

  let score = 100;
  for (const r of requests) {
    if (r.status === 'open' && r.deadlineAt && r.deadlineAt < new Date()) {
      score = Math.max(0, score - 20); // Penalty for overdue
    }
  }
  return score;
}

async function calculateBreachScore(orgId: string) {
  const breachList = await db.query.breaches.findMany({
    where: eq(breaches.organizationId, orgId),
  });
  if (breachList.length === 0) return 100;

  let score = 100;
  for (const b of breachList) {
    if (b.status === 'open') {
      score = Math.max(0, score - 20);
    }
  }
  return score;
}

async function calculateTrainingScore(orgId: string) {
  const [completions, usersCountResult] = await Promise.all([
    db.query.trainingCompletions.findMany({
      where: eq(trainingCompletions.organizationId, orgId),
    }),
    db.query.users.findMany({
      where: eq(users.organizationId, orgId),
      columns: { id: true },
    }),
  ]);

  if (usersCountResult.length === 0 || completions.length === 0) return 100;

  const passed = completions.filter(c => c.status === 'passed').length;
  // Approximation of compliance based on completions against total active users.
  const score = Math.round((passed / completions.length) * 100);
  return Math.max(0, Math.min(100, score));
}

async function calculateTransferScore(activities: any[]) {
  if (activities.length === 0) return 100;

  const orgTransfers = await db.query.processingTransfers.findMany({
    where: inArray(processingTransfers.processingActivityId, activities.map(a => a.id))
  });

  if (orgTransfers.length === 0) return 100;

  let validCount = 0;
  for (const t of orgTransfers) {
    if (t.transferMechanism && t.transferMechanism !== 'none') {
      validCount++;
    } else if (t.tiaCompleted) {
      validCount++;
    }
  }

  return Math.round((validCount / orgTransfers.length) * 100);
}
