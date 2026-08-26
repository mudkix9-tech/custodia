import { EU_EEA_COUNTRIES, isAdequateDestination } from '../constants/transferDestinations.js';
import { hasSpecialCategory } from '../constants/vendorDataCategories.js';

export interface DpaClauseCoverage {
  documentedInstructions: boolean;    // Art. 28(3)(a)
  confidentiality: boolean;           // Art. 28(3)(b)
  securityMeasures: boolean;          // Art. 28(3)(c)
  subProcessorRestrictions: boolean;  // Art. 28(3)(d)
  dataSubjectRights: boolean;         // Art. 28(3)(e)
  securityBreachDpia: boolean;        // Art. 28(3)(f)
  deletionOnTermination: boolean;     // Art. 28(3)(g)
  auditRights: boolean;               // Art. 28(3)(h)
}

export interface VendorRiskInput {
  headquartersCountry?: string | null;
  securityCertifications?: string[] | null;
  transferMechanisms?: string[] | null;
  knownIncidents?: Array<{ date: string | Date; description?: string }> | null;
  dpfStatus?: 'active' | 'lapsed' | 'discontinued' | 'none' | null;
  dpfLapsedDate?: string | null;
}

export interface OrgVendorRiskInput {
  dpaStatus?: string | null;
  dpaExpiresAt?: Date | string | null;
  dataCategoriesShared?: string[] | null;
  dataSubjectVolume?: '<1K' | '1K-10K' | '10K-100K' | '100K+' | null;
  certifications?: string[] | null;
  transferMechanisms?: string[] | null;
  dpaClauseCoverage?: DpaClauseCoverage | null;
}

export interface RiskFactorDetail {
  points: number;
  maxPoints: number;
  detail: string;
}

export interface VendorRiskGap {
  id: string;
  status: string | null;
  severity: string;
  metadata?: {
    alreadyReflectedInBaseScore?: boolean;
  } | null;
}

export interface VendorRiskResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    location: RiskFactorDetail;
    dpa: RiskFactorDetail;
    categories: RiskFactorDetail;
    volume: RiskFactorDetail;
    subProcessors: RiskFactorDetail;
    certifications: RiskFactorDetail;
    safeguards: RiskFactorDetail;
    breach: RiskFactorDetail;
    dpia?: RiskFactorDetail;
  };
}

export function calculateVendorRisk(
  vendor: VendorRiskInput,
  orgVendor: OrgVendorRiskInput = {} as any,
  subProcessorsCount: number = 0,
  scoreModifier: number = 0,
  dpiaGaps: VendorRiskGap[] = []
): VendorRiskResult {
  
  // 1. Headquarters Location (20%)
  let locationPoints = 20; // Default non-adequate
  let locationDetail = 'Non-adequate country (20/20 pts)';
  
  const country = vendor.headquartersCountry?.toUpperCase();
  const isEu = country ? EU_EEA_COUNTRIES.includes(country) : false;
  
  const mechanisms = [
    ...(vendor.transferMechanisms || []),
    ...(orgVendor?.transferMechanisms || [])
  ].map(m => m.toLowerCase());
  
  const hasDpfMechanism = mechanisms.includes('data_privacy_framework');
  const isDpfActive = vendor.dpfStatus === 'active' || (hasDpfMechanism && vendor.dpfStatus !== 'lapsed' && vendor.dpfStatus !== 'discontinued');
  const isDpfLapsed = vendor.dpfStatus === 'lapsed' || vendor.dpfStatus === 'discontinued';
  const isAdequate = country && isAdequateDestination(country) && (country !== 'US' || isDpfActive);

  if (isEu) {
    locationPoints = 0;
    locationDetail = `EU/EEA country (${country}) (0/20 pts)`;
  } else if (isAdequate) {
    locationPoints = 5;
    locationDetail = country === 'US' ? 'United States (DPF certified) (5/20 pts)' : `Adequate country (${country}) (5/20 pts)`;
  } else if (!country) {
    locationDetail = 'Unknown country (20/20 pts)';
  } else if (country === 'US' && isDpfLapsed) {
    locationPoints = 20;
    locationDetail = `United States (DPF certification lapsed${vendor.dpfLapsedDate ? ` on ${vendor.dpfLapsedDate}` : ''}) (20/20 pts)`;
  } else {
    locationPoints = 20;
    locationDetail = `${country === 'US' ? 'United States (conditional adequacy, no DPF certified)' : 'Non-adequate country (' + country + ')'} (20/20 pts)`;
  }

  // 2. DPA Status (20%)
  let dpaPoints = 20; // Default missing
  let dpaDetail = 'DPA missing or expired (20/20 pts)';
  
  if (orgVendor.dpaStatus === 'signed') {
    const coverage = orgVendor.dpaClauseCoverage || {};
    const clauseKeys = [
      'documentedInstructions',
      'confidentiality',
      'securityMeasures',
      'subProcessorRestrictions',
      'dataSubjectRights',
      'securityBreachDpia',
      'deletionOnTermination',
      'auditRights'
    ];
    const coveredCount = clauseKeys.filter(k => !!(coverage as any)[k]).length;
    const completenessFraction = coveredCount / clauseKeys.length;
    const percent = Math.round(completenessFraction * 100);

    if (coveredCount === 8) {
      dpaPoints = 0;
      dpaDetail = 'DPA signed and covers all 8 Article 28 clauses (0/20 pts)';
    } else if (coveredCount >= 6) { // 75%+
      dpaPoints = 5;
      dpaDetail = `DPA signed but missing ${8 - coveredCount} mandatory clauses (${percent}% covered) (5/20 pts)`;
    } else if (coveredCount >= 4) { // 50%+
      dpaPoints = 10;
      dpaDetail = `DPA signed but missing ${8 - coveredCount} mandatory clauses (${percent}% covered) (10/20 pts)`;
    } else if (coveredCount > 0) { // 1%-49%
      dpaPoints = 15;
      dpaDetail = `DPA signed but missing ${8 - coveredCount} mandatory clauses (${percent}% covered) (15/20 pts)`;
    } else {
      dpaPoints = 20;
      dpaDetail = 'DPA signed but no Article 28 clause compliance has been verified (20/20 pts)';
    }
    
    if (orgVendor.dpaExpiresAt) {
      const expiry = new Date(orgVendor.dpaExpiresAt);
      const daysToExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry > 0 && daysToExpiry <= 90) {
        dpaPoints = Math.max(dpaPoints, 10);
        dpaDetail += ` | DPA expiring soon in ${daysToExpiry} days`;
      } else if (daysToExpiry <= 0) {
        dpaPoints = 20;
        dpaDetail = 'DPA has expired (20/20 pts)';
      }
    }
  }

  // 3. Data Categories Processed (15%)
  // The Art. 9 question is answered by the controlled vocabulary in
  // constants/vendorDataCategories.ts, not by a substring scan for English
  // words. The scan is still in there as the fallback for free text -- widened
  // to German and French, because the module ships in three languages and the
  // previous version could not see `Gesundheitsdaten`.
  const categories = orgVendor.dataCategoriesShared || [];
  const processesSpecial = hasSpecialCategory(categories);

  const categoriesPoints = processesSpecial ? 15 : 0;
  const categoriesDetail = processesSpecial
    ? 'Processes special categories of data (Article 9) (15/15 pts)'
    : categories.length === 0
      ? 'No data categories recorded for this vendor (0/15 pts)'
      : 'Processes standard data categories (0/15 pts)';

  // 4. Data Subject Volume (10%)
  let volumePoints = 0;
  let volumeDetail = 'Less than 1,000 data subjects (0/10 pts)';
  
  const vol = orgVendor.dataSubjectVolume || '<1K';
  if (vol === '1K-10K') {
    volumePoints = 3;
    volumeDetail = '1,000 to 10,000 data subjects (3/10 pts)';
  } else if (vol === '10K-100K') {
    volumePoints = 6;
    volumeDetail = '10,000 to 100,000 data subjects (6/10 pts)';
  } else if (vol === '100K+') {
    volumePoints = 10;
    volumeDetail = 'Over 100,000 data subjects (10/10 pts)';
  }

  // 5. Sub-processor Chain Depth (10%)
  let subProcessorPoints = 0;
  let subProcessorDetail = `0-1 sub-processors (${subProcessorsCount}) (0/10 pts)`;
  
  if (subProcessorsCount >= 2 && subProcessorsCount <= 3) {
    subProcessorPoints = 5;
    subProcessorDetail = `2-3 sub-processors (${subProcessorsCount}) (5/10 pts)`;
  } else if (subProcessorsCount >= 4) {
    subProcessorPoints = 10;
    subProcessorDetail = `4+ sub-processors (${subProcessorsCount}) (10/10 pts)`;
  }

  // 6. Security Certifications (10%)
  const certsList = [
    ...(orgVendor.certifications || []),
    ...(vendor.securityCertifications || [])
  ].map(c => c.toLowerCase());
  
  const hasSoc2 = certsList.some(c => c.includes('soc2') || c.includes('soc 2'));
  const hasIso = certsList.some(c => c.includes('iso27001') || c.includes('iso 27001') || c.includes('iso-27001'));
  
  let certsPoints = 10;
  let certsDetail = 'No security certifications (10/10 pts)';
  
  if (hasSoc2 && hasIso) {
    certsPoints = 0;
    certsDetail = 'SOC 2 + ISO 27001 certified (0/10 pts)';
  } else if (certsList.length > 0) {
    certsPoints = 5;
    certsDetail = `Partial certifications: ${certsList.join(', ')} (5/10 pts)`;
  }

  // 7. Transfer Safeguards (10%)
  let safeguardsPoints = 0;
  let safeguardsDetail = 'No transfer safeguards required (EU/EEA or adequate country) (0/10 pts)';
  
  if (!isEu && !isAdequate) {
    const hasSafeguard = mechanisms.some(m => 
      m.includes('scc') || 
      m.includes('standard_contractual_clauses') || 
      m.includes('bcr') || 
      m.includes('binding_corporate_rules') ||
      m.includes('adequacy_decision') ||
      m.includes('data_privacy_framework')
    );
    
    if (hasSafeguard) {
      safeguardsPoints = 0;
      safeguardsDetail = 'Appropriate transfer mechanisms in place (SCCs/BCRs) (0/10 pts)';
    } else {
      safeguardsPoints = 10;
      safeguardsDetail = 'No transfer mechanisms documented for third-country transfer (10/10 pts)';
    }
  }

  // 8. Breach History (5%)
  // Time-decayed breach score:
  // - <6 months = 5
  // - 6-12 months = 3
  // - 12-24 months = 1
  // - >24 months = 0
  let breachPoints = 0;
  let breachDetail = 'No known breaches in the last 24 months (0/5 pts)';
  
  const incidents = vendor.knownIncidents || [];
  let minDiffMonths = 999;
  
  for (const incident of incidents) {
    if (!incident.date) continue;
    const diffMs = Math.abs(Date.now() - new Date(incident.date).getTime());
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    if (diffMonths < minDiffMonths) {
      minDiffMonths = diffMonths;
    }
  }
  
  if (minDiffMonths < 6) {
    breachPoints = 5;
    breachDetail = 'Breach occurred within last 6 months (5/5 pts)';
  } else if (minDiffMonths >= 6 && minDiffMonths < 12) {
    breachPoints = 3;
    breachDetail = 'Breach occurred between 6 to 12 months ago (3/5 pts)';
  } else if (minDiffMonths >= 12 && minDiffMonths < 24) {
    breachPoints = 1;
    breachDetail = 'Breach occurred between 12 to 24 months ago (1/5 pts)';
  }

  // 9. DPIA Residual Risks Modifier
  const qualifyingGaps = dpiaGaps.filter(gap => 
    (gap.status === 'open' || gap.status === 'in_progress') &&
    (gap.severity === 'high' || gap.severity === 'critical') &&
    gap.metadata?.alreadyReflectedInBaseScore !== true
  );
  
  const dpiaModifier = Math.min(30, qualifyingGaps.length * 10);
  const dpiaDetail = qualifyingGaps.length > 0
    ? `Unmitigated high/critical DPIA risks (+${dpiaModifier} pts)`
    : 'No unmitigated high/critical DPIA risks (0 pts)';

  const baseScore = locationPoints + dpaPoints + categoriesPoints + volumePoints + subProcessorPoints + certsPoints + safeguardsPoints + breachPoints;
  
  // Combined modifier ceiling: questionnaire scoreModifier + DPIA modifier, capped between -10 and +25
  const totalModifier = Math.max(-10, Math.min(25, scoreModifier + dpiaModifier));
  const score = Math.max(0, Math.min(100, baseScore + totalModifier));
  
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (score <= 25) level = 'low';
  else if (score <= 50) level = 'medium';
  else if (score <= 75) level = 'high';
  else level = 'critical';

  return {
    score,
    level,
    factors: {
      location: { points: locationPoints, maxPoints: 20, detail: locationDetail },
      dpa: { points: dpaPoints, maxPoints: 20, detail: dpaDetail },
      categories: { points: categoriesPoints, maxPoints: 15, detail: categoriesDetail },
      volume: { points: volumePoints, maxPoints: 10, detail: volumeDetail },
      subProcessors: { points: subProcessorPoints, maxPoints: 10, detail: subProcessorDetail },
      certifications: { points: certsPoints, maxPoints: 10, detail: certsDetail },
      safeguards: { points: safeguardsPoints, maxPoints: 10, detail: safeguardsDetail },
      breach: { points: breachPoints, maxPoints: 5, detail: breachDetail },
      dpia: { points: dpiaModifier, maxPoints: 30, detail: dpiaDetail }
    }
  };
}
