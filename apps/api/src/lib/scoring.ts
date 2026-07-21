import { db } from '../db.js';
import { processingActivities, organizationVendors, privacyPolicies, dpias, dsarRequests, breaches, trainingModules, trainingCompletions, processingTransfers, complianceReports, complianceGaps } from 'db';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { users } from 'db';

const PILLAR_WEIGHTS = {
  ropa: 0.25,
  vendors: 0.20,
  dpia: 0.15,
  policies: 0.10,
  dsar: 0.10,
  breach: 0.05,
  training: 0.10,
  transfers: 0.05,
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
    }
  });

  const [ropa, vendors, dpia, policies, dsar, breach, training, transfers] = await Promise.all([
    calculateRopaScore(activities),
    calculateVendorScore(orgId),
    calculateDpiaScore(orgId, activities),
    calculatePolicyScore(orgId),
    calculateDsarScore(orgId),
    calculateBreachScore(orgId),
    calculateTrainingScore(orgId),
    calculateTransferScore(activities),
  ]);

  const total = Math.round(
    ropa * PILLAR_WEIGHTS.ropa +
    vendors * PILLAR_WEIGHTS.vendors +
    dpia * PILLAR_WEIGHTS.dpia +
    policies * PILLAR_WEIGHTS.policies +
    dsar * PILLAR_WEIGHTS.dsar +
    breach * PILLAR_WEIGHTS.breach +
    training * PILLAR_WEIGHTS.training +
    transfers * PILLAR_WEIGHTS.transfers
  );

  return {
    total,
    breakdown: { ropa, vendors, dpia, policies, dsar, breach, training, transfers },
  };
}

async function calculateRopaScore(activities: any[]) {
  const activeActivities = activities.filter(a => a.status === 'active');
  if (activeActivities.length === 0) return 100; // No data, no issues

  const getCompleteness = (a: any) => {
    let score = 100;
    if (!a.lawfulBasis) score -= 50;
    if (!a.purpose) score -= 50;
    return Math.max(0, score);
  };

  const avgCompleteness = activeActivities.reduce((sum, a) => sum + getCompleteness(a), 0) / activeActivities.length;
  return Math.round(avgCompleteness);
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
  const completions = await db.query.trainingCompletions.findMany({
    where: eq(trainingCompletions.organizationId, orgId),
  });

  const usersCountResult = await db.query.users.findMany({
    where: eq(users.organizationId, orgId),
    columns: { id: true },
  });

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
