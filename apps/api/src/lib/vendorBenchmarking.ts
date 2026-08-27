/**
 * Cross-Customer Anonymous Privacy Benchmarking Engine (Sprint 4).
 *
 * Computes k-anonymized aggregate privacy metrics across market peers,
 * such as Article 28(3) clause adoption rates, DPA signing rates, and
 * category risk distributions, enforcing strict k-anonymity (k >= 5).
 */

export const K_ANONYMITY_THRESHOLD = 5;

export interface OrgVendorBenchmarkSample {
  organizationId: string;
  dpaStatus?: string | null;
  riskScore: number;
  transferMechanisms?: string[] | null;
  dataCategoriesShared?: string[] | null;
  dpaClauseCoverage?: Record<string, boolean> | null;
  criticality?: string | null;
  usingEuHosting?: boolean | null;
}

export interface VendorBenchmarkStats {
  vendorId: string;
  vendorName: string;
  isKAnonymous: boolean;
  sampleOrgCount: number;
  dpaSignedRate: number; // 0–100%
  euHostingAdoptionRate: number; // 0–100%
  averageRiskScore: number;
  transferMechanismDistribution: Array<{ mechanism: string; percentage: number }>;
  topSharedDataCategories: Array<{ category: string; percentage: number }>;
  clauseAdoptionRates: Record<string, number>;
  riskPercentile: number; // percentile ranking compared to industry peers
}

/**
 * Pure evaluation function for calculating k-anonymized vendor benchmarks.
 */
export function evaluateVendorBenchmark(
  vendorId: string,
  vendorName: string,
  samples: OrgVendorBenchmarkSample[]
): VendorBenchmarkStats {
  // Deduplicate by organizationId
  const orgMap = new Map<string, OrgVendorBenchmarkSample>();
  for (const s of samples) {
    if (s.organizationId) {
      orgMap.set(s.organizationId, s);
    }
  }

  const distinctOrgs = Array.from(orgMap.values());
  const sampleCount = distinctOrgs.length;
  const isKAnonymous = sampleCount >= K_ANONYMITY_THRESHOLD;

  if (!isKAnonymous) {
    return {
      vendorId,
      vendorName,
      isKAnonymous: false,
      sampleOrgCount: 0,
      dpaSignedRate: 0,
      euHostingAdoptionRate: 0,
      averageRiskScore: 0,
      transferMechanismDistribution: [],
      topSharedDataCategories: [],
      clauseAdoptionRates: {},
      riskPercentile: 50,
    };
  }

  // 1. DPA Signed Rate
  const signedCount = distinctOrgs.filter((s) => s.dpaStatus === 'signed').length;
  const dpaSignedRate = Math.round((signedCount / sampleCount) * 100);

  // 2. EU Hosting Adoption
  const euHostingCount = distinctOrgs.filter((s) => s.usingEuHosting).length;
  const euHostingAdoptionRate = Math.round((euHostingCount / sampleCount) * 100);

  // 3. Average Risk Score
  const totalRisk = distinctOrgs.reduce((acc, s) => acc + (s.riskScore || 0), 0);
  const averageRiskScore = Math.round(totalRisk / sampleCount);

  // 4. Transfer Mechanisms Distribution
  const mechanismCounts = new Map<string, number>();
  for (const s of distinctOrgs) {
    if (s.transferMechanisms && Array.isArray(s.transferMechanisms)) {
      for (const m of s.transferMechanisms) {
        mechanismCounts.set(m, (mechanismCounts.get(m) || 0) + 1);
      }
    }
  }

  const transferMechanismDistribution = Array.from(mechanismCounts.entries())
    .map(([mechanism, count]) => ({
      mechanism,
      percentage: Math.round((count / sampleCount) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // 5. Data Categories Distribution
  const categoryCounts = new Map<string, number>();
  for (const s of distinctOrgs) {
    if (s.dataCategoriesShared && Array.isArray(s.dataCategoriesShared)) {
      for (const cat of s.dataCategoriesShared) {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    }
  }

  const topSharedDataCategories = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      percentage: Math.round((count / sampleCount) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  // 6. Article 28(3) Clause Adoption Rates
  const clauseCounts = new Map<string, number>();
  let clauseSampleTotal = 0;

  for (const s of distinctOrgs) {
    if (s.dpaClauseCoverage && typeof s.dpaClauseCoverage === 'object') {
      clauseSampleTotal += 1;
      for (const [clause, confirmed] of Object.entries(s.dpaClauseCoverage)) {
        if (confirmed) {
          clauseCounts.set(clause, (clauseCounts.get(clause) || 0) + 1);
        }
      }
    }
  }

  const clauseAdoptionRates: Record<string, number> = {};
  if (clauseSampleTotal > 0) {
    for (const [clause, count] of clauseCounts.entries()) {
      clauseAdoptionRates[clause] = Math.round((count / clauseSampleTotal) * 100);
    }
  }

  // 7. Risk percentile estimation
  let riskPercentile = 50;
  if (averageRiskScore <= 20) riskPercentile = 20;
  else if (averageRiskScore <= 40) riskPercentile = 40;
  else if (averageRiskScore <= 60) riskPercentile = 65;
  else if (averageRiskScore <= 80) riskPercentile = 85;
  else riskPercentile = 95;

  return {
    vendorId,
    vendorName,
    isKAnonymous: true,
    sampleOrgCount: sampleCount,
    dpaSignedRate,
    euHostingAdoptionRate,
    averageRiskScore,
    transferMechanismDistribution,
    topSharedDataCategories,
    clauseAdoptionRates,
    riskPercentile,
  };
}

/**
 * DB query helper for fetching k-anonymized benchmark stats for a catalogue vendor.
 */
export async function getVendorBenchmarkStats(
  dbInstance: any,
  vendorId: string,
  schema: {
    organizationVendors: any;
    vendors: any;
  },
  livePredicate: any
): Promise<VendorBenchmarkStats> {
  const { organizationVendors, vendors } = schema;
  const { eq, and } = await import('drizzle-orm');

  const [vendorRow] = await dbInstance
    .select({ name: vendors.name, organizationId: vendors.organizationId })
    .from(vendors)
    .where(eq(vendors.id, vendorId));

  if (!vendorRow) {
    return evaluateVendorBenchmark(vendorId, 'Vendor', []);
  }

  // Cross-customer benchmarking is strictly for shared global catalogue rows.
  // Private custom vendors (organizationId != null) cannot be queried across tenants.
  if (vendorRow.organizationId !== null) {
    return {
      vendorId,
      vendorName: vendorRow.name,
      isKAnonymous: false,
      sampleOrgCount: 0,
      dpaSignedRate: 0,
      euHostingAdoptionRate: 0,
      averageRiskScore: 0,
      transferMechanismDistribution: [],
      topSharedDataCategories: [],
      clauseAdoptionRates: {},
      riskPercentile: 50,
    };
  }

  const vendorName = vendorRow.name || 'Vendor';

  // Query all live org_vendor rows across all tenants for this vendor
  const rows = await dbInstance
    .select({
      organizationId: organizationVendors.organizationId,
      dpaStatus: organizationVendors.dpaStatus,
      riskScore: organizationVendors.riskScore,
      transferMechanisms: organizationVendors.transferMechanisms,
      dataCategoriesShared: organizationVendors.dataCategoriesShared,
      dpaClauseCoverage: organizationVendors.dpaClauseCoverage,
      criticality: organizationVendors.criticality,
      usingEuHosting: organizationVendors.usingEuHosting,
    })
    .from(organizationVendors)
    .where(and(eq(organizationVendors.vendorId, vendorId), livePredicate));

  return evaluateVendorBenchmark(vendorId, vendorName, rows || []);
}
