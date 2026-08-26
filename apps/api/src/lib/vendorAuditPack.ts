/**
 * Vendor Audit Pack & Article 30(1)(d) Recipient Register Generator — audit deliverables.
 *
 * Implements:
 *   1. Article 30(1)(d) Recipient Register Export: The statutory GDPR record of categories
 *      of recipients to whom personal data have been or will be disclosed.
 *   2. Article 28 Compliance Dossier: A regulator-grade evidence pack detailing a processor's
 *      contractual terms, verified clause citations, sub-processors, and transfer safeguards.
 */

import { csvDocument } from '../utils/csv.js';

export interface Article30RecipientRow {
  vendorName: string;
  category: string;
  processingRole: string; // 'Processor' | 'Joint Controller' | 'Independent Controller'
  purpose: string;
  dataCategoriesShared: string[];
  isSpecialCategory: boolean;
  headquartersCountry: string;
  dataProcessingLocations: string[];
  transferMechanisms: string[];
  dpaStatus: string;
  dpaSignedAt?: string;
  businessOwner?: string;
  criticality: string;
  status: string;
}

export interface Article28DossierData {
  organizationName: string;
  generatedAt: string;
  vendor: {
    name: string;
    website?: string;
    category?: string;
    headquartersCountry?: string;
    businessOwner?: string;
    contactEmail?: string;
    criticality?: string;
    processingRole?: string;
    dpaStatus: string;
    dpaSignedAt?: string;
    dpaExpiresAt?: string;
    deletionCertificateRef?: string;
    lastReviewedAt?: string;
    nextReviewAt?: string;
  };
  clauseCoverage: Record<string, { status: 'present' | 'weak' | 'missing'; excerpt?: string; citation?: string }>;
  subProcessors: Array<{ name: string; service?: string; country?: string; website?: string }>;
  transfers: {
    destinationCountry?: string;
    mechanisms: string[];
    tiaStatus?: string;
    tiaConclusion?: string;
  };
  provenance: Array<{ fieldName: string; sourceType: string; confidence: number; retrievedAt: string; sourceUrl?: string }>;
}

export const ARTICLE_30_RECIPIENT_CSV_HEADERS = [
  'Recipient (Vendor)',
  'Service Category',
  'Processing Role',
  'Purpose of Processing',
  'Categories of Personal Data',
  'Special Category (Art. 9)',
  'HQ Country',
  'Processing Locations',
  'Transfer Safeguards',
  'DPA Status',
  'DPA Signed Date',
  'Business Owner',
  'Criticality Tier',
  'Lifecycle Status',
] as const;

/**
 * Builds an RFC 4180 compliant CSV of the Article 30(1)(d) Recipient Register.
 */
export function buildArticle30RecipientCsv(rows: Article30RecipientRow[]): string {
  const headerRow = [...ARTICLE_30_RECIPIENT_CSV_HEADERS];
  const dataRows = rows.map((row) => [
    row.vendorName,
    row.category || 'Uncategorised',
    row.processingRole || 'Processor',
    row.purpose || 'Not specified',
    row.dataCategoriesShared.join('; ') || 'None specified',
    row.isSpecialCategory ? 'Yes (Art. 9)' : 'No',
    row.headquartersCountry || 'Unknown',
    row.dataProcessingLocations.join('; ') || row.headquartersCountry || 'Unknown',
    row.transferMechanisms.join('; ') || 'None',
    row.dpaStatus,
    row.dpaSignedAt || '',
    row.businessOwner || '',
    row.criticality || 'medium',
    row.status || 'active',
  ]);

  return csvDocument([headerRow, ...dataRows]);
}

/**
 * Builds a structured Markdown / Text report of the Article 28 Compliance Dossier.
 */
export function buildArticle28DossierMarkdown(dossier: Article28DossierData): string {
  const v = dossier.vendor;
  const lines: string[] = [
    `# Article 28 Compliance Dossier: ${v.name}`,
    '',
    `**Organisation:** ${dossier.organizationName}  `,
    `**Generated:** ${dossier.generatedAt}  `,
    `**Processor Status:** ${v.dpaStatus.toUpperCase()}  `,
    `**Criticality Tier:** ${v.criticality?.toUpperCase() || 'MEDIUM'}  `,
    '',
    '---',
    '',
    '## 1. Vendor Governance & Contractual Relationship',
    '',
    `| Attribute | Value |`,
    `|---|---|`,
    `| **Vendor Name** | ${v.name} |`,
    `| **Website** | ${v.website || 'N/A'} |`,
    `| **Category** | ${v.category || 'N/A'} |`,
    `| **Processing Role** | ${v.processingRole || 'Processor (Art. 28)'} |`,
    `| **Business Owner** | ${v.businessOwner || 'Unassigned'} |`,
    `| **Contact Email** | ${v.contactEmail || 'N/A'} |`,
    `| **DPA Signed Date** | ${v.dpaSignedAt || 'Not recorded'} |`,
    `| **DPA Expiry Date** | ${v.dpaExpiresAt || 'Perpetual / Ongoing'} |`,
    `| **Last Attested Review** | ${v.lastReviewedAt || 'Pending review'} |`,
    `| **Next Scheduled Review** | ${v.nextReviewAt || 'Annual'} |`,
    `| **Art. 28(3)(g) Deletion Certificate** | ${v.deletionCertificateRef || 'N/A (Active relationship)'} |`,
    '',
    '## 2. Article 28(3) Mandatory Terms Evaluation',
    '',
    '| Statutory Requirement | Status | Citation | Verified Excerpt / Evidence |',
    '|---|---|---|---|',
  ];

  const clauseMap: Record<string, string> = {
    documentedInstructions: 'Art. 28(3)(a) Documented Instructions',
    confidentiality: 'Art. 28(3)(b) Personnel Confidentiality',
    securityMeasures: 'Art. 28(3)(c) Security Measures (Art. 32)',
    subProcessorRestrictions: 'Art. 28(3)(d) Sub-processor Authorization',
    dataSubjectRights: 'Art. 28(3)(e) Data Subject Rights Assistance',
    securityBreachDpia: 'Art. 28(3)(f) Breach & DPIA Assistance',
    deletionOnTermination: 'Art. 28(3)(g) Deletion/Return on Termination',
    auditRights: 'Art. 28(3)(h) Audit & Inspection Rights',
  };

  for (const [key, label] of Object.entries(clauseMap)) {
    const clause = dossier.clauseCoverage[key] || { status: 'missing' };
    const statusBadge =
      clause.status === 'present'
        ? '✓ Compliant'
        : clause.status === 'weak'
        ? '⚠ Weak / Conditioned'
        : '✗ Missing';
    const excerpt = (clause.excerpt || 'No specific excerpt recorded').replace(/\|/g, '\\|');
    lines.push(`| **${label}** | ${statusBadge} | ${clause.citation || ''} | ${excerpt} |`);
  }

  lines.push(
    '',
    '## 3. Sub-Processor Chain (Art. 28(2) & 28(4))',
    '',
    dossier.subProcessors.length === 0
      ? '*No third-party sub-processors recorded.*'
      : [
          '| Sub-Processor Entity | Country | Service / Role | Website |',
          '|---|---|---|---|',
          ...dossier.subProcessors.map(
            (sp) =>
              `| **${sp.name}** | ${sp.country || 'Unknown'} | ${sp.service || 'Infrastructure / Processing'} | ${sp.website || 'N/A'} |`
          ),
        ].join('\n'),
    '',
    '## 4. International Transfers & Chapter V Safeguards',
    '',
    `| Transfer Attribute | Detail |`,
    `|---|---|`,
    `| **Destination Country** | ${dossier.transfers.destinationCountry || v.headquartersCountry || 'Unknown'} |`,
    `| **Transfer Safeguards** | ${dossier.transfers.mechanisms.join(', ') || 'None recorded'} |`,
    `| **TIA Status** | ${dossier.transfers.tiaStatus || 'Not required'} |`,
    `| **TIA Conclusion** | ${dossier.transfers.tiaConclusion || 'N/A'} |`,
    '',
    '## 5. Field-Level Provenance & Verification Log',
    '',
    dossier.provenance.length === 0
      ? '*No field-level provenance metadata recorded.*'
      : [
          '| Field | Source Type | Confidence | Retrieved At | Source URL |',
          '|---|---|---|---|---|',
          ...dossier.provenance.map(
            (p) =>
              `| ${p.fieldName} | \`${p.sourceType}\` | ${p.confidence}% | ${p.retrievedAt} | ${p.sourceUrl || 'N/A'} |`
          ),
        ].join('\n'),
    ''
  );

  return lines.join('\n');
}
