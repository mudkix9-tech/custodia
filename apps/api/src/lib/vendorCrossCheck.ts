/**
 * Answer Verification & Discrepancy Cross-Check Engine (Sprint 4).
 *
 * Automatically cross-checks vendor self-attested questionnaire responses
 * against verified intelligence facts (DPA clause analyses, DPF registry statuses,
 * sub-processor entity lists, hosting regions, and encryption controls).
 */

export interface VendorDiscrepancy {
  id: string;
  type:
    | 'hosting_location_contradiction'
    | 'certification_discrepancy'
    | 'dpf_adequacy_discrepancy'
    | 'subprocessor_disclosure_discrepancy'
    | 'dpa_clause_discrepancy'
    | 'encryption_discrepancy';
  severity: 'critical' | 'high' | 'medium' | 'low';
  questionId?: string;
  claimedFact: string;
  verifiedFact: string;
  explanation: string;
  gdprArticle: string;
  recommendation: string;
}

export interface CrossCheckInput {
  vendorName: string;
  vendorCountry?: string | null;
  euHostingAvailable?: boolean | null;
  usingEuHosting?: boolean | null;
  securityCertifications?: string[];
  dpfStatus?: 'active' | 'lapsed' | 'discontinued' | 'none' | null;
  subProcessors?: Array<{ name: string; country?: string | null; service?: string | null }>;
  dpaClauseAnalysis?: {
    clauses?: Record<string, { status: 'present' | 'weak' | 'missing'; excerpt?: string }>;
  } | null;
  questionsSnapshot?: Array<{ id: string; text: string; category?: string }>;
  responses: Record<string, any>;
}

/**
 * Pure evaluation function for cross-checking vendor responses against verified facts.
 */
export function crossCheckVendorResponses(input: CrossCheckInput): VendorDiscrepancy[] {
  const {
    vendorName,
    vendorCountry,
    euHostingAvailable,
    usingEuHosting,
    securityCertifications = [],
    dpfStatus = 'none',
    subProcessors = [],
    dpaClauseAnalysis,
    questionsSnapshot = [],
    responses,
  } = input;

  const discrepancies: VendorDiscrepancy[] = [];
  const certSet = new Set((securityCertifications || []).map((c) => c.toLowerCase()));

  // Map questions by id for easy lookup
  const questionMap = new Map<string, { id: string; text: string; category?: string }>();
  for (const q of questionsSnapshot) {
    questionMap.set(q.id, q);
  }

  // Iterate over response entries
  for (const [qId, rawVal] of Object.entries(responses)) {
    if (rawVal === undefined || rawVal === null) continue;
    const valStr = String(rawVal).trim();
    const valLower = valStr.toLowerCase();
    const question = questionMap.get(qId);
    const qText = (question?.text || qId).toLowerCase();

    // 1. Hosting & Data Residency Cross-Check
    if (
      /hosting|data\s+residency|where.*stored|eu\s+only|location/i.test(qText) ||
      /transfer/i.test(qText)
    ) {
      const claimsEuOnly =
        valLower.includes('eu only') ||
        valLower.includes('european union only') ||
        valLower.includes('exclusive eu') ||
        (valLower === 'yes' && /eu\s+only|solely\s+in\s+the\s+eu/i.test(qText));

      if (claimsEuOnly) {
        // Check if US/non-adequate third-country sub-processors exist
        const nonAdequateSubs = subProcessors.filter(
          (s) => s.country && s.country.toUpperCase() !== 'EU' && !isEuEeaOrAdequateCountry(s.country)
        );

        if (nonAdequateSubs.length > 0) {
          discrepancies.push({
            id: `disc_hosting_${qId}`,
            type: 'hosting_location_contradiction',
            severity: 'critical',
            questionId: qId,
            claimedFact: `${vendorName} self-attested exclusive EU data residency: "${valStr}"`,
            verifiedFact: `Sub-processor telemetry identified ${nonAdequateSubs.length} non-adequate third-country sub-processor(s): ${nonAdequateSubs
              .map((s) => `${s.name} (${s.country})`)
              .slice(0, 3)
              .join(', ')}`,
            explanation:
              'The vendor asserts that customer data is hosted exclusively within the EU/EEA, but active sub-processors operate infrastructure in non-adequate third countries.',
            gdprArticle: 'Chapter V (Articles 44–46)',
            recommendation:
              'Request explicit contractual isolation guarantees or require Standard Contractual Clauses (SCCs) covering 4th-party onward transfers.',
          });
        } else if (vendorCountry === 'US' && !euHostingAvailable && !usingEuHosting) {
          discrepancies.push({
            id: `disc_hosting_${qId}`,
            type: 'hosting_location_contradiction',
            severity: 'high',
            questionId: qId,
            claimedFact: `${vendorName} self-attested exclusive EU data residency: "${valStr}"`,
            verifiedFact: `${vendorName} headquarters is US-based and standard catalogue profile has no dedicated EU hosting isolation.`,
            explanation:
              'Self-attestation claims EU-only storage without documented dedicated EU instance configuration.',
            gdprArticle: 'Chapter V (Articles 44–46)',
            recommendation: 'Verify specific EU region tenant configuration and obtain proof of data residency.',
          });
        }
      }
    }

    // 2. Security Certification Cross-Check (ISO 27001 / SOC 2)
    if (/soc\s*2/i.test(qText)) {
      const claimsSoc2 =
        valLower === 'yes' ||
        valLower.includes('certified') ||
        valLower.includes('type ii') ||
        valLower.includes('type 2');
      const hasSoc2Verified = certSet.has('soc2_type_ii') || certSet.has('soc2_type_i') || certSet.has('soc2');

      if (claimsSoc2 && !hasSoc2Verified) {
        discrepancies.push({
          id: `disc_soc2_${qId}`,
          type: 'certification_discrepancy',
          severity: 'medium',
          questionId: qId,
          claimedFact: `Claims active SOC 2 compliance: "${valStr}"`,
          verifiedFact: 'No verified SOC 2 Type II attestation report on file or in trust centre telemetry.',
          explanation: 'The vendor claimed SOC 2 certification in the questionnaire, but no verified audit report has been supplied.',
          gdprArticle: 'Article 32 & Article 28(1)',
          recommendation: 'Request the latest SOC 2 Type II report covering the current audit period.',
        });
      }
    }

    if (/iso\s*27001/i.test(qText)) {
      const claimsIso = valLower === 'yes' || valLower.includes('certified');
      const hasIsoVerified = certSet.has('iso27001') || certSet.has('iso_27001');

      if (claimsIso && !hasIsoVerified) {
        discrepancies.push({
          id: `disc_iso27001_${qId}`,
          type: 'certification_discrepancy',
          severity: 'medium',
          questionId: qId,
          claimedFact: `Claims active ISO/IEC 27001 certification: "${valStr}"`,
          verifiedFact: 'No verified ISO 27001 certificate on file.',
          explanation: 'Self-attested ISO 27001 certification without accredited registrar certificate verification.',
          gdprArticle: 'Article 32 & Article 28(1)',
          recommendation: 'Request a copy of the ISO 27001 certificate and verify the Statement of Applicability (SoA).',
        });
      }
    }

    // 3. Data Privacy Framework (DPF) Cross-Check
    if (/data\s+privacy\s+framework|dpf|privacy\s+shield|us\s+adequacy/i.test(qText)) {
      const claimsDpf = valLower === 'yes' || valLower.includes('active') || valLower.includes('certified');
      if (claimsDpf && (dpfStatus === 'lapsed' || dpfStatus === 'discontinued' || dpfStatus === 'none')) {
        discrepancies.push({
          id: `disc_dpf_${qId}`,
          type: 'dpf_adequacy_discrepancy',
          severity: 'critical',
          questionId: qId,
          claimedFact: `Claims active EU–U.S. Data Privacy Framework certification: "${valStr}"`,
          verifiedFact:
            dpfStatus === 'lapsed'
              ? 'Department of Commerce DPF Registry records certification status as LAPSED.'
              : dpfStatus === 'discontinued'
              ? 'Department of Commerce DPF Registry records certification status as DISCONTINUED.'
              : 'Entity not found in official Department of Commerce DPF Registry.',
          explanation:
            'The vendor relies on the EU–U.S. DPF for Chapter V transfer adequacy, but the statutory registry indicates the certification is no longer in good standing.',
          gdprArticle: 'Article 45 & Article 46',
          recommendation:
            'Execute standard European Commission SCCs (Module 2/3) immediately or suspend transfers until recertification.',
        });
      }
    }

    // 4. Sub-processor Disclosures
    if (/sub-?processors?|third\s+parties|subcontractors/i.test(qText)) {
      const claimsNoSubs =
        valLower === 'no' ||
        valLower.includes('none') ||
        valLower.includes('we do not use') ||
        valLower.includes('no third parties');
      if (claimsNoSubs && subProcessors.length > 0) {
        discrepancies.push({
          id: `disc_sub_${qId}`,
          type: 'subprocessor_disclosure_discrepancy',
          severity: 'high',
          questionId: qId,
          claimedFact: `Claims no third-party sub-processors are engaged: "${valStr}"`,
          verifiedFact: `Telemetry identified ${subProcessors.length} active sub-processor(s) (${subProcessors
            .map((s) => s.name)
            .slice(0, 3)
            .join(', ')}).`,
          explanation:
            'Vendor questionnaire claims no sub-processors are used, directly contradicting verified sub-processor disclosures.',
          gdprArticle: 'Article 28(2) & Article 28(3)(d)',
          recommendation:
            'Demand an exhaustive list of all 4th-party sub-processors and enforce prior written authorisation terms.',
        });
      }
    }
  }

  // 5. Article 28 DPA Clause Analyser Cross-Check (Catalogue Telemetry)
  if (dpaClauseAnalysis?.clauses) {
    const clauses = dpaClauseAnalysis.clauses;
    if (clauses.auditRights?.status === 'missing' || clauses.auditRights?.status === 'weak') {
      discrepancies.push({
        id: 'disc_dpa_audit',
        type: 'dpa_clause_discrepancy',
        severity: 'high',
        claimedFact: 'Standard vendor terms claimed compliant with GDPR Article 28.',
        verifiedFact: `Published DPA clause analysis: Audit Rights (Art. 28(3)(h)) is ${clauses.auditRights.status.toUpperCase()}.`,
        explanation: 'The published DPA fails to grant statutory on-site audit rights or limits audits to vendor-chosen summaries.',
        gdprArticle: 'Article 28(3)(h)',
        recommendation: 'Negotiate custom DPA addendum ensuring controller audit rights under reasonable notice.',
      });
    }

    if (clauses.securityBreachDpia?.status === 'missing') {
      discrepancies.push({
        id: 'disc_dpa_breach',
        type: 'dpa_clause_discrepancy',
        severity: 'critical',
        claimedFact: 'Standard vendor terms claimed compliant with GDPR Article 28.',
        verifiedFact: 'Published DPA clause analysis: Breach Notification (Art. 28(3)(f)) is MISSING.',
        explanation: 'The contract does not establish a statutory requirement to notify the controller without undue delay after becoming aware of a personal data breach.',
        gdprArticle: 'Article 28(3)(f) & Article 33',
        recommendation: 'Mandate 48-hour or 72-hour breach notification clause in signed contract.',
      });
    }
  }

  return discrepancies;
}

/**
 * Compute an aggregated risk penalty based on active cross-check discrepancies.
 */
export function calculateDiscrepancyRiskPenalty(discrepancies: VendorDiscrepancy[]): number {
  if (!discrepancies || discrepancies.length === 0) return 0;

  let penalty = 0;
  for (const d of discrepancies) {
    if (d.severity === 'critical') penalty += 15;
    else if (d.severity === 'high') penalty += 10;
    else if (d.severity === 'medium') penalty += 5;
    else penalty += 2;
  }

  return Math.min(25, penalty);
}

export const ADEQUATE_THIRD_COUNTRIES = new Set([
  'GB', 'CH', 'CA', 'JP', 'NZ', 'IL', 'KR', 'GG', 'JE', 'IM', 'AD', 'FO', 'UY'
]);

export function isEuEeaCountry(code?: string | null): boolean {
  if (!code) return false;
  const c = code.toUpperCase();
  const euEea = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
    'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
    'SE', 'IS', 'LI', 'NO',
  ];
  return euEea.includes(c);
}

export function isEuEeaOrAdequateCountry(code?: string | null): boolean {
  if (!code) return false;
  const c = code.toUpperCase();
  return isEuEeaCountry(c) || ADEQUATE_THIRD_COUNTRIES.has(c);
}

/**
 * The cross-check penalty for one relationship, given sub-processors the caller has
 * already loaded.
 *
 * Split out so that every path scoring a vendor derives this the same way. The
 * catalogue-wide recalculation used to omit it entirely — so `recalc:vendor-risk`,
 * which the deployment runbook makes mandatory after a formula change, quietly
 * forgave every contradiction the cross-check had found. A shared function is what
 * stops the bulk path and the per-row path drifting apart again.
 */
export function discrepancyPenaltyFor(args: {
  vendor: any;
  orgVendor: any;
  latestAssessment: any | undefined | null;
  subProcessors: Array<{ name: string; country: string | null; service: string | null }>;
  dpfStatus?: string;
}): number {
  const { vendor, orgVendor, latestAssessment, subProcessors, dpfStatus } = args;
  if (!latestAssessment || latestAssessment.status !== 'completed') return 0;
  const discrepancies = crossCheckVendorResponses({
    vendorName: vendor.name,
    vendorCountry: vendor.headquartersCountry,
    euHostingAvailable: vendor.euHostingAvailable,
    usingEuHosting: orgVendor.usingEuHosting,
    securityCertifications:
      (orgVendor.certifications as string[]) || (vendor.securityCertifications as string[]) || [],
    dpfStatus: (dpfStatus as any) || 'none',
    subProcessors,
    dpaClauseAnalysis: vendor.dpaClauseAnalysis,
    questionsSnapshot: (latestAssessment.questionsSnapshot as any[]) || [],
    responses: (latestAssessment.responses as Record<string, any>) || {},
  });
  return calculateDiscrepancyRiskPenalty(discrepancies);
}
