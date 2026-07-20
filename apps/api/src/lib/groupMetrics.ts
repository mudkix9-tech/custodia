import { eq, inArray, desc } from 'drizzle-orm';
import { organizations, complianceReports, organizationVendors, vendors } from 'db';

export async function computeGroupComplianceScores(dbInstance: any, parentOrgId: string, childOrgIds: string[]) {
  if (childOrgIds.length === 0) {
    return { averageScore: 0, worstScore: 0, breakdown: [] };
  }

  const childOrgs = await dbInstance.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(inArray(organizations.id, childOrgIds));

  const allReports = await dbInstance.select()
    .from(complianceReports)
    .where(inArray(complianceReports.organizationId, childOrgIds))
    .orderBy(desc(complianceReports.snapshotDate));

  const breakdown = childOrgs.map((org: any) => {
    const orgReports = allReports.filter((r: any) => r.organizationId === org.id);
    const currentScore = orgReports[0]?.scoreTotal || 0;
    const previousScore = orgReports[1]?.scoreTotal || 0;
    
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (currentScore > previousScore && orgReports.length > 1) trend = 'up';
    if (currentScore < previousScore && orgReports.length > 1) trend = 'down';

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currentScore,
      previousScore,
      trend
    };
  });

  const validScores = breakdown.map((b: any) => b.currentScore);
  const averageScore = Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / (validScores.length || 1));
  const worstScore = Math.min(...validScores);

  return {
    averageScore,
    worstScore,
    breakdown
  };
}

export async function computeGroupVendorConsistency(dbInstance: any, parentOrgId: string, childOrgIds: string[]) {
  if (childOrgIds.length === 0) return [];

  const childOrgs = await dbInstance.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(inArray(organizations.id, childOrgIds));

  const orgVendors = await dbInstance.select({
    id: organizationVendors.id,
    orgId: organizationVendors.organizationId,
    vendorId: organizationVendors.vendorId,
    vendorName: vendors.name,
    dpaStatus: organizationVendors.dpaStatus,
    riskScore: organizationVendors.riskScore,
    riskLevel: organizationVendors.riskLevel
  })
  .from(organizationVendors)
  .innerJoin(vendors, eq(vendors.id, organizationVendors.vendorId))
  .where(inArray(organizationVendors.organizationId, childOrgIds));

  // Group by vendor ID
  const grouped: Record<string, any> = {};
  orgVendors.forEach((ov: any) => {
    if (!grouped[ov.vendorId]) {
      grouped[ov.vendorId] = {
        vendorId: ov.vendorId,
        vendorName: ov.vendorName,
        usedByCount: 0,
        entityDetails: []
      };
    }
    const orgInfo = childOrgs.find((co: any) => co.id === ov.orgId);
    grouped[ov.vendorId].entityDetails.push({
      orgId: ov.orgId,
      orgName: orgInfo?.name || 'Unknown',
      dpaStatus: ov.dpaStatus,
      riskScore: ov.riskScore,
      riskLevel: ov.riskLevel
    });
    grouped[ov.vendorId].usedByCount += 1;
  });

  const results = Object.values(grouped).filter(g => g.usedByCount > 1).map((g: any) => {
    const dpaStatuses = new Set(g.entityDetails.map((ed: any) => ed.dpaStatus));
    const isInconsistent = dpaStatuses.size > 1;
    return {
      ...g,
      inconsistent: isInconsistent
    };
  });

  return results.sort((a, b) => {
    if (a.inconsistent === b.inconsistent) {
      return b.usedByCount - a.usedByCount;
    }
    return a.inconsistent ? -1 : 1;
  });
}
