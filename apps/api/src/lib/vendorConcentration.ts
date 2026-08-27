/**
 * Vendor Concentration & Supply Chain Graph Risk Engine (Sprint 4).
 *
 * Evaluates 4th-party sub-processor concentration, Single Points of Failure (SPOFs),
 * systemic blast radiuses, and geographic exposure across an organisation's
 * active vendor supply chain.
 *
 * Pure evaluation function `evaluateConcentrationGraph` enables unit testing
 * with fixtures, while `calculateConcentrationAnalytics` queries the live DB.
 */

import { hasSpecialCategory } from '../constants/vendorDataCategories.js';

export interface DirectVendorNode {
  id: string;
  vendorId: string;
  name: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dataCategoriesShared: string[];
  dataSubjectVolume?: string | null;
  headquartersCountry?: string | null;
  euHostingAvailable?: boolean | null;
  usingEuHosting?: boolean | null;
}

export interface SubProcessorEdge {
  parentVendorId: string;
  name: string;
  nameKey?: string;
  service?: string | null;
  country?: string | null;
  dataCategories?: string[];
  processingLocations?: string[];
}

export interface SubProcessorConcentration {
  name: string;
  nameKey: string;
  service?: string | null;
  country?: string | null;
  dependentVendorCount: number;
  dependentVendors: Array<{ id: string; vendorId: string; name: string; criticality: string }>;
  affectedDataCategories: string[];
  hasSpecialCategory: boolean;
  isSinglePointOfFailure: boolean;
  concentrationRiskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface SystemicBlastRadius {
  subProcessorName: string;
  impactedVendorCount: number;
  impactedVendorNames: string[];
  exposedDataCategories: string[];
  hasArticle9Data: boolean;
  criticalityTier: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
}

export interface JurisdictionConcentration {
  euEeaCount: number;
  euEeaPercentage: number;
  usCount: number;
  usPercentage: number;
  thirdCountryCount: number;
  thirdCountryPercentage: number;
  unspecifiedCount: number;
}

export interface ConcentrationReport {
  totalDirectVendors: number;
  totalSubProcessorDependencies: number;
  uniqueSubProcessorCount: number;
  supplyChainFragilityScore: number; // 0–100 composite index
  fragilityLevel: 'low' | 'moderate' | 'elevated' | 'critical';
  topSubProcessors: SubProcessorConcentration[];
  singlePointsOfFailure: SubProcessorConcentration[];
  systemicBlastRadiuses: SystemicBlastRadius[];
  jurisdictionBreakdown: JurisdictionConcentration;
}

const EU_EEA_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO',
]);

const CANONICAL_SPOF_ALIASES: Record<string, { canonicalName: string; canonicalKey: string; defaultCountry?: string }> = {
  aws: { canonicalName: 'Amazon Web Services', canonicalKey: 'amazonwebservices', defaultCountry: 'US' },
  amazonwebservices: { canonicalName: 'Amazon Web Services', canonicalKey: 'amazonwebservices', defaultCountry: 'US' },
  amazonwebservicesinc: { canonicalName: 'Amazon Web Services', canonicalKey: 'amazonwebservices', defaultCountry: 'US' },
  amazonwebsevices: { canonicalName: 'Amazon Web Services', canonicalKey: 'amazonwebservices', defaultCountry: 'US' },
  gcp: { canonicalName: 'Google Cloud Platform', canonicalKey: 'googlecloudplatform', defaultCountry: 'US' },
  googlecloud: { canonicalName: 'Google Cloud Platform', canonicalKey: 'googlecloudplatform', defaultCountry: 'US' },
  googlecloudplatform: { canonicalName: 'Google Cloud Platform', canonicalKey: 'googlecloudplatform', defaultCountry: 'US' },
  googlellc: { canonicalName: 'Google LLC', canonicalKey: 'googlellc', defaultCountry: 'US' },
  azure: { canonicalName: 'Microsoft Azure', canonicalKey: 'microsoftazure', defaultCountry: 'US' },
  microsoftazure: { canonicalName: 'Microsoft Azure', canonicalKey: 'microsoftazure', defaultCountry: 'US' },
  microsoftcorporation: { canonicalName: 'Microsoft Corporation', canonicalKey: 'microsoftcorporation', defaultCountry: 'US' },
  cloudflare: { canonicalName: 'Cloudflare, Inc.', canonicalKey: 'cloudflare', defaultCountry: 'US' },
  cloudflareinc: { canonicalName: 'Cloudflare, Inc.', canonicalKey: 'cloudflare', defaultCountry: 'US' },
  twilio: { canonicalName: 'Twilio Inc.', canonicalKey: 'twilio', defaultCountry: 'US' },
  twilioinc: { canonicalName: 'Twilio Inc.', canonicalKey: 'twilio', defaultCountry: 'US' },
  stripe: { canonicalName: 'Stripe Payments', canonicalKey: 'stripepayments', defaultCountry: 'IE' },
  stripeinc: { canonicalName: 'Stripe Payments', canonicalKey: 'stripepayments', defaultCountry: 'IE' },
  stripepaymentseurope: { canonicalName: 'Stripe Payments', canonicalKey: 'stripepayments', defaultCountry: 'IE' },
  stripepaymentseuropeltd: { canonicalName: 'Stripe Payments', canonicalKey: 'stripepayments', defaultCountry: 'IE' },
  snowflake: { canonicalName: 'Snowflake Inc.', canonicalKey: 'snowflake', defaultCountry: 'US' },
  snowflakeinc: { canonicalName: 'Snowflake Inc.', canonicalKey: 'snowflake', defaultCountry: 'US' },
  mongodb: { canonicalName: 'MongoDB Atlas', canonicalKey: 'mongodbatlas', defaultCountry: 'US' },
  mongodbatlas: { canonicalName: 'MongoDB Atlas', canonicalKey: 'mongodbatlas', defaultCountry: 'US' },
  datadog: { canonicalName: 'Datadog, Inc.', canonicalKey: 'datadog', defaultCountry: 'US' },
  datadoginc: { canonicalName: 'Datadog, Inc.', canonicalKey: 'datadog', defaultCountry: 'US' },
};

/**
 * Normalise a sub-processor name into a canonical grouping key.
 */
export function foldEntityName(rawName: string): string {
  const stripped = (rawName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const alias = CANONICAL_SPOF_ALIASES[stripped];
  return alias ? alias.canonicalKey : stripped;
}

export function canonicalizeEntityName(rawName: string): string {
  const stripped = (rawName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const alias = CANONICAL_SPOF_ALIASES[stripped];
  return alias ? alias.canonicalName : (rawName || '').trim();
}

/**
 * Pure evaluation function for vendor supply-chain concentration.
 */
export function evaluateConcentrationGraph(params: {
  directVendors: DirectVendorNode[];
  subProcessors: SubProcessorEdge[];
}): ConcentrationReport {
  const { directVendors, subProcessors } = params;
  const vendorMap = new Map<string, DirectVendorNode>();
  for (const v of directVendors) {
    vendorMap.set(v.vendorId, v);
  }

  // Aggregate sub-processors by canonical folded name
  const entityMap = new Map<string, {
    name: string;
    nameKey: string;
    service?: string | null;
    country?: string | null;
    parentVendorIds: Set<string>;
    dataCategories: Set<string>;
  }>();

  for (const edge of subProcessors) {
    if (!edge.name || !edge.parentVendorId) continue;
    // Only consider edges connected to direct vendors in the organisation's active register
    if (!vendorMap.has(edge.parentVendorId)) continue;

    const key = edge.nameKey || foldEntityName(edge.name);
    if (!key) continue;

    const canonicalName = canonicalizeEntityName(edge.name);
    const aliasInfo = CANONICAL_SPOF_ALIASES[key];

    let existing = entityMap.get(key);
    if (!existing) {
      existing = {
        name: canonicalName,
        nameKey: key,
        service: edge.service || null,
        country: edge.country ? edge.country.toUpperCase() : (aliasInfo?.defaultCountry || null),
        parentVendorIds: new Set(),
        dataCategories: new Set(),
      };
      entityMap.set(key, existing);
    } else {
      if (!existing.country && edge.country) {
        existing.country = edge.country.toUpperCase();
      } else if (!existing.country && aliasInfo?.defaultCountry) {
        existing.country = aliasInfo.defaultCountry;
      }
      if (!existing.service && edge.service) {
        existing.service = edge.service;
      }
    }

    existing.parentVendorIds.add(edge.parentVendorId);

    // Collect data categories flowing through this direct vendor
    const parent = vendorMap.get(edge.parentVendorId);
    if (edge.dataCategories && edge.dataCategories.length > 0) {
      for (const cat of edge.dataCategories) {
        existing.dataCategories.add(cat);
      }
    } else if (parent?.dataCategoriesShared) {
      for (const cat of parent.dataCategoriesShared) {
        existing.dataCategories.add(cat);
      }
    }
  }

  const allEntities: SubProcessorConcentration[] = [];
  let euCount = 0;
  let usCount = 0;
  let thirdCountryCount = 0;
  let unspecifiedCount = 0;

  for (const entity of entityMap.values()) {
    const dependentVendors = Array.from(entity.parentVendorIds).map((vId) => {
      const v = vendorMap.get(vId)!;
      return {
        id: v.id,
        vendorId: v.vendorId,
        name: v.name,
        criticality: v.criticality,
      };
    });

    const affectedDataCategories = Array.from(entity.dataCategories);
    const hasArticle9 = hasSpecialCategory(affectedDataCategories);

    // Jurisdiction aggregation
    const country = entity.country;
    if (!country) {
      unspecifiedCount += 1;
    } else if (EU_EEA_COUNTRIES.has(country)) {
      euCount += 1;
    } else if (country === 'US') {
      usCount += 1;
    } else {
      thirdCountryCount += 1;
    }

    // Criticality & SPOF evaluation:
    // A sub-processor is a Single Point of Failure if:
    // 1. It serves >= 2 direct vendors that are marked 'critical' or 'high'
    // 2. OR it serves >= 3 direct vendors overall
    const criticalDirectCount = dependentVendors.filter(
      (v) => v.criticality === 'critical' || v.criticality === 'high'
    ).length;

    const isSinglePointOfFailure = criticalDirectCount >= 2 || dependentVendors.length >= 3;

    let concentrationRiskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (criticalDirectCount >= 2 && hasArticle9) {
      concentrationRiskLevel = 'critical';
    } else if (isSinglePointOfFailure || hasArticle9 || criticalDirectCount >= 1) {
      concentrationRiskLevel = 'high';
    } else if (dependentVendors.length >= 2) {
      concentrationRiskLevel = 'medium';
    }

    allEntities.push({
      name: entity.name,
      nameKey: entity.nameKey,
      service: entity.service,
      country: entity.country,
      dependentVendorCount: dependentVendors.length,
      dependentVendors,
      affectedDataCategories,
      hasSpecialCategory: hasArticle9,
      isSinglePointOfFailure,
      concentrationRiskLevel,
    });
  }

  // Sort by highest concentration first
  allEntities.sort((a, b) => b.dependentVendorCount - a.dependentVendorCount || a.name.localeCompare(b.name));

  const spofs = allEntities.filter((e) => e.isSinglePointOfFailure);

  // Compute Systemic Blast Radiuses for the top concentrated entities
  const systemicBlastRadiuses: SystemicBlastRadius[] = allEntities
    .slice(0, 10)
    .map((e) => {
      const vendorNames = e.dependentVendors.map((v) => v.name);
      return {
        subProcessorName: e.name,
        impactedVendorCount: e.dependentVendorCount,
        impactedVendorNames: vendorNames,
        exposedDataCategories: e.affectedDataCategories,
        hasArticle9Data: e.hasSpecialCategory,
        criticalityTier: e.concentrationRiskLevel,
        summary: `${e.name} supports ${e.dependentVendorCount} vendor${e.dependentVendorCount === 1 ? '' : 's'} (${vendorNames.join(', ')})${
          e.hasSpecialCategory ? ' carrying sensitive Article 9 personal data' : ''
        }.`,
      };
    });

  // Jurisdiction stats
  const totalSubs = allEntities.length;
  const jurisdictionBreakdown: JurisdictionConcentration = {
    euEeaCount: euCount,
    euEeaPercentage: totalSubs > 0 ? Math.round((euCount / totalSubs) * 100) : 0,
    usCount,
    usPercentage: totalSubs > 0 ? Math.round((usCount / totalSubs) * 100) : 0,
    thirdCountryCount,
    thirdCountryPercentage: totalSubs > 0 ? Math.round((thirdCountryCount / totalSubs) * 100) : 0,
    unspecifiedCount,
  };

  // Supply Chain Fragility Score (0–100):
  // Based on:
  // - Ratio of SPOFs to total vendors (0–40 pts)
  // - Third country / unhedged transfer ratio (0–30 pts)
  // - Article 9 exposure on shared sub-processors (0–30 pts)
  let fragilityScore = 0;
  if (directVendors.length > 0) {
    const spofRatio = Math.min(1, spofs.length / Math.max(1, directVendors.length * 0.5));
    fragilityScore += Math.round(spofRatio * 40);

    const nonEuRatio = totalSubs > 0 ? (usCount + thirdCountryCount) / totalSubs : 0;
    fragilityScore += Math.round(nonEuRatio * 30);

    const spofsWithArt9 = spofs.filter((s) => s.hasSpecialCategory).length;
    const art9Penalty = Math.min(30, spofsWithArt9 * 15);
    fragilityScore += art9Penalty;
  }

  fragilityScore = Math.min(100, Math.max(0, fragilityScore));

  let fragilityLevel: 'low' | 'moderate' | 'elevated' | 'critical' = 'low';
  if (fragilityScore >= 75) fragilityLevel = 'critical';
  else if (fragilityScore >= 50) fragilityLevel = 'elevated';
  else if (fragilityScore >= 25) fragilityLevel = 'moderate';

  return {
    totalDirectVendors: directVendors.length,
    totalSubProcessorDependencies: subProcessors.length,
    uniqueSubProcessorCount: allEntities.length,
    supplyChainFragilityScore: fragilityScore,
    fragilityLevel,
    topSubProcessors: allEntities,
    singlePointsOfFailure: spofs,
    systemicBlastRadiuses,
    jurisdictionBreakdown,
  };
}

/**
 * DB query helper for fetching and calculating an organisation's concentration report.
 */
export async function calculateConcentrationAnalytics(
  dbInstance: any,
  orgId: string,
  schema: {
    organizationVendors: any;
    vendors: any;
    vendorSubProcessors: any;
    vendorSubProcessorEntities: any;
  },
  livePredicate: any
): Promise<ConcentrationReport> {
  const { organizationVendors, vendors, vendorSubProcessors, vendorSubProcessorEntities } = schema;
  const { eq, and, inArray } = await import('drizzle-orm');

  // 1. Fetch live direct vendors for this organisation
  const orgVendors = await dbInstance
    .select({
      id: organizationVendors.id,
      vendorId: organizationVendors.vendorId,
      name: vendors.name,
      criticality: organizationVendors.criticality,
      dataCategoriesShared: organizationVendors.dataCategoriesShared,
      dataSubjectVolume: organizationVendors.dataSubjectVolume,
      headquartersCountry: vendors.headquartersCountry,
      euHostingAvailable: vendors.euHostingAvailable,
      usingEuHosting: organizationVendors.usingEuHosting,
    })
    .from(organizationVendors)
    .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
    .where(and(eq(organizationVendors.organizationId, orgId), livePredicate));

  if (!orgVendors || orgVendors.length === 0) {
    return evaluateConcentrationGraph({ directVendors: [], subProcessors: [] });
  }

  const directVendorIds = orgVendors.map((v: any) => v.vendorId);

  // 2. Fetch sub-processors from both vendorSubProcessors and vendorSubProcessorEntities
  const [legacySubs, entitySubs] = await Promise.all([
    dbInstance
      .select({
        parentVendorId: vendorSubProcessors.parentVendorId,
        name: vendorSubProcessors.name,
        service: vendorSubProcessors.service,
        country: vendorSubProcessors.country,
        dataCategories: vendorSubProcessors.dataCategories,
        processingLocations: vendorSubProcessors.processingLocations,
      })
      .from(vendorSubProcessors)
      .where(inArray(vendorSubProcessors.parentVendorId, directVendorIds)),
    dbInstance
      .select({
        parentVendorId: vendorSubProcessorEntities.parentVendorId,
        name: vendorSubProcessorEntities.name,
        nameKey: vendorSubProcessorEntities.nameKey,
        service: vendorSubProcessorEntities.service,
        country: vendorSubProcessorEntities.country,
      })
      .from(vendorSubProcessorEntities)
      .where(inArray(vendorSubProcessorEntities.parentVendorId, directVendorIds)),
  ]);

  const combinedEdges: SubProcessorEdge[] = [];
  const seenEdges = new Set<string>();

  for (const s of [...(legacySubs || []), ...(entitySubs || [])]) {
    if (!s.name || !s.parentVendorId) continue;
    const key = `${s.parentVendorId}::${foldEntityName(s.name)}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);

    combinedEdges.push({
      parentVendorId: s.parentVendorId,
      name: s.name,
      nameKey: s.nameKey,
      service: s.service,
      country: s.country,
      dataCategories: s.dataCategories || [],
      processingLocations: s.processingLocations || [],
    });
  }

  const formattedVendors: DirectVendorNode[] = orgVendors.map((v: any) => ({
    id: v.id,
    vendorId: v.vendorId,
    name: v.name,
    criticality: (v.criticality as any) || 'medium',
    dataCategoriesShared: (v.dataCategoriesShared as string[]) || [],
    dataSubjectVolume: v.dataSubjectVolume,
    headquartersCountry: v.headquartersCountry,
    euHostingAvailable: v.euHostingAvailable,
    usingEuHosting: v.usingEuHosting,
  }));

  return evaluateConcentrationGraph({
    directVendors: formattedVendors,
    subProcessors: combinedEdges,
  });
}
