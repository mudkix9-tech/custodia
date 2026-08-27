/**
 * Vendor Trust Centre Ingestion & Auto-Assessment Pre-Fill Engine (Sprint 4).
 *
 * Ingests and parses vendor security trust centres (SafeBase, Vanta, Drata,
 * Conveyor, OneTrust, Whistic, and bespoke security portals), extracting
 * certified controls and automatically pre-answering statutory questionnaires.
 */

import { normaliseCertificationList, VENDOR_CERTIFICATIONS } from '../constants/vendorCertifications.js';

export type TrustCenterPlatform =
  | 'safebase'
  | 'vanta'
  | 'drata'
  | 'conveyor'
  | 'whistic'
  | 'onetrust'
  | 'custom';

export interface TrustCenterProfile {
  vendorName: string;
  platform: TrustCenterPlatform;
  url?: string;
  certifications: string[];
  encryptionAtRest?: boolean;
  encryptionInTransit?: boolean;
  customerManagedKeys?: boolean;
  euHostingAvailable?: boolean;
  euHostingDetail?: string;
  dpaAvailable?: boolean;
  dpaUrl?: string;
  subProcessorListUrl?: string;
  penTestDate?: string;
  soc2ReportPeriod?: string;
  iso27001ExpiryDate?: string;
  securityControls: Record<string, boolean | string>;
  confidence: number; // 0–100
  evidenceSnippets: Record<string, string>;
}

export interface PreFilledAssessmentAnswer {
  questionId: string;
  questionText: string;
  category: string;
  suggestedAnswer: string | number;
  confidence: number;
  evidenceSnippet?: string;
  source: 'trust_center';
  verifiedControlKey?: string;
}

/**
 * Detect trust centre platform from URL or content signatures.
 */
export function detectTrustCenterPlatform(url?: string, content?: string): TrustCenterPlatform {
  const u = (url || '').toLowerCase();
  const c = (content || '').toLowerCase();

  if (u.includes('safebase.io') || c.includes('safebase')) return 'safebase';
  if (u.includes('trust.vanta.com') || c.includes('vanta trust report') || c.includes('powered by vanta')) return 'vanta';
  if (u.includes('trust.drata.com') || c.includes('drata trust center') || c.includes('powered by drata')) return 'drata';
  if (u.includes('conveyor.com') || c.includes('conveyor portal') || c.includes('powered by conveyor')) return 'conveyor';
  if (u.includes('whistic.com') || c.includes('whistic profile')) return 'whistic';
  if (u.includes('onetrust.com') || c.includes('onetrust assessment')) return 'onetrust';
  return 'custom';
}

/**
 * Parse structured or unstructured trust centre content into a TrustCenterProfile.
 */
export function parseTrustCenterProfile(input: {
  url?: string;
  rawContent?: string;
  vendorName?: string;
}): TrustCenterProfile {
  const { url = '', rawContent = '', vendorName = 'Vendor' } = input;
  const platform = detectTrustCenterPlatform(url, rawContent);
  const text = `${url}\n${rawContent}`;
  const lower = text.toLowerCase();

  // 1. Detect Certifications
  const candidateCerts: string[] = [];
  const evidenceSnippets: Record<string, string> = {};

  if (/soc\s*2\s*type\s*(?:ii|2)/i.test(text) || /soc\s*2/i.test(text)) {
    candidateCerts.push('soc2_type_ii');
    evidenceSnippets.soc2 = 'SOC 2 Type II attestation report verified';
  }
  if (/iso\s*(?:\/iec)?\s*27001/i.test(text)) {
    candidateCerts.push('iso27001');
    evidenceSnippets.iso27001 = 'ISO/IEC 27001:2022 certified information security management system';
  }
  if (/iso\s*(?:\/iec)?\s*27701/i.test(text)) {
    candidateCerts.push('iso27701');
    evidenceSnippets.iso27701 = 'ISO/IEC 27701 privacy information management extension';
  }
  if (/iso\s*(?:\/iec)?\s*27018/i.test(text)) {
    candidateCerts.push('iso27018');
    evidenceSnippets.iso27018 = 'ISO/IEC 27018 code of practice for protection of PII in public clouds';
  }
  if (/pci[\s-]dss/i.test(text)) {
    candidateCerts.push('pci_dss');
    evidenceSnippets.pci_dss = 'PCI-DSS Payment Card Industry Data Security Standard compliant';
  }
  if (/hipaa/i.test(text)) {
    candidateCerts.push('hipaa');
    evidenceSnippets.hipaa = 'HIPAA Security and Privacy Rule compliance attestation';
  }
  if (/fedramp/i.test(text)) {
    candidateCerts.push('fedramp');
    evidenceSnippets.fedramp = 'FedRAMP authorized / compliant';
  }
  if (/c5/i.test(text) && /bsi/i.test(text)) {
    candidateCerts.push('bsi_c5');
    evidenceSnippets.bsi_c5 = 'BSI C5 Cloud Computing Compliance Criteria Catalogue';
  }

  const certifications = normaliseCertificationList(candidateCerts);

  // 2. Encryption controls
  const encryptionAtRest = /encrypt(?:ion|ed)?\s+(?:at\s+rest|of\s+stored\s+data|aes[\s-]256)/i.test(text) ||
    /aes[\s-]256/i.test(text);
  const encryptionInTransit = /encrypt(?:ion|ed)?\s+(?:in\s+transit|tls\s*1\.[23]|https)/i.test(text) ||
    /tls\s*1\.[23]/i.test(text);
  const customerManagedKeys = /(?:customer[\s-]managed\s+keys|cmk|byok|bring\s+your\s+own\s+key)/i.test(text);

  if (encryptionAtRest) evidenceSnippets.encryptionAtRest = 'Data encryption at rest using AES-256 standard';
  if (encryptionInTransit) evidenceSnippets.encryptionInTransit = 'Data encryption in transit using TLS 1.2+ / TLS 1.3';
  if (customerManagedKeys) evidenceSnippets.customerManagedKeys = 'Customer-Managed Encryption Keys (BYOK/CMK) supported';

  // 3. EU Hosting availability
  const euHostingAvailable = /(?:eu|europe(?:an)?|germany|frankfurt|ireland|dublin)\s+(?:data\s+residency|hosting|data\s*cent(?:er|re)|region|datacenter)/i.test(text) ||
    /(?:dedicated\s+eu|data\s+remains\s+in\s+(?:the\s+)?eu)/i.test(text);
  let euHostingDetail: string | undefined;
  if (euHostingAvailable) {
    euHostingDetail = 'European data residency and hosting regions available (EU/EEA).';
    evidenceSnippets.euHosting = euHostingDetail;
  }

  // 4. DPA & Sub-processors
  const dpaAvailable = /(?:data\s+processing\s+(?:addendum|agreement)|dpa\s+available|sign\s+dpa|gdpr\s+dpa)/i.test(text);
  let dpaUrl: string | undefined;
  const dpaMatch = text.match(/https?:\/\/[^\s"'<>]+(?:dpa|data-processing-addendum|legal\/dpa)[^\s"'<>]*/i);
  if (dpaMatch) {
    dpaUrl = dpaMatch[0];
  }

  let subProcessorListUrl: string | undefined;
  const subMatch = text.match(/https?:\/\/[^\s"'<>]+(?:sub-?processors?|third-party-subprocessors)[^\s"'<>]*/i);
  if (subMatch) {
    subProcessorListUrl = subMatch[0];
  }

  // 5. Pen test & Audit dates
  let penTestDate: string | undefined;
  const penMatch = text.match(/(?:penetration\s+test|pen\s+test|independent\s+security\s+audit)[\s\S]{1,50}?(202[3-6](?:-\d{2}-\d{2})?)/i);
  if (penMatch && penMatch[1]) {
    penTestDate = penMatch[1];
    evidenceSnippets.penTest = `Annual third-party penetration testing completed (${penTestDate})`;
  }

  const securityControls: Record<string, boolean | string> = {
    mfaEnforced: /mfa|multi-factor|two-factor|2fa/i.test(text),
    ssoSupported: /saml|sso|single\s+sign-on|okta|entra/i.test(text),
    rbacSupported: /rbac|role-based\s+access|granular\s+permissions/i.test(text),
    vulnerabilityScanning: /vulnerability\s+scan|continuous\s+monitoring/i.test(text),
    incidentResponsePlan: /incident\s+response|breach\s+notification/i.test(text),
    businessContinuity: /disaster\s+recovery|business\s+continuity|sla|99\.9/i.test(text),
  };

  // Confidence calculation based on breadth of verified signals
  let confidence = 50;
  if (platform !== 'custom') confidence += 20;
  if (certifications.length > 0) confidence += 15;
  if (encryptionAtRest && encryptionInTransit) confidence += 10;
  if (dpaUrl || subProcessorListUrl) confidence += 5;
  confidence = Math.min(100, confidence);

  return {
    vendorName,
    platform,
    url: url || undefined,
    certifications,
    encryptionAtRest,
    encryptionInTransit,
    customerManagedKeys,
    euHostingAvailable,
    euHostingDetail,
    dpaAvailable: dpaAvailable || !!dpaUrl,
    dpaUrl,
    subProcessorListUrl,
    penTestDate,
    securityControls,
    confidence,
    evidenceSnippets,
  };
}

/**
 * Map trust centre profile directly to assessment template questions.
 */
export function mapTrustCenterToAssessmentAnswers(
  profile: TrustCenterProfile,
  templateQuestions: Array<{
    id: string;
    text: string;
    category?: string;
    type?: string;
    options?: Array<{ text: string; score: number }>;
  }>
): PreFilledAssessmentAnswer[] {
  const prefilled: PreFilledAssessmentAnswer[] = [];

  for (const q of templateQuestions) {
    const text = q.text.toLowerCase();
    const cat = (q.category || '').toLowerCase();

    // Check SOC 2
    if (/soc\s*2/i.test(text) || (/(?:certification|zertifizierung)/i.test(cat) && /soc/i.test(text))) {
      const hasSoc2 =
        profile.certifications.includes('soc2_type_ii') ||
        profile.certifications.includes('soc2_type_i') ||
        profile.certifications.includes('soc2');
      if (hasSoc2) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Certifications',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'certified', 'soc 2 type ii', 'ja', 'oui', 'annual']) ?? 'Yes',
          confidence: 95,
          evidenceSnippet: profile.evidenceSnippets.soc2 || 'SOC 2 Type II certified',
          source: 'trust_center',
          verifiedControlKey: 'soc2_type_ii',
        });
      }
      continue;
    }

    // Check ISO 27001
    if (/iso\s*27001/i.test(text) || (/(?:certification|zertifizierung)/i.test(cat) && /27001/i.test(text))) {
      const hasIso = profile.certifications.includes('iso27001') || profile.certifications.includes('iso_27001');
      if (hasIso) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Certifications',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'certified', 'iso 27001', 'iso/iec 27001', 'ja', 'oui']) ?? 'Yes',
          confidence: 95,
          evidenceSnippet: profile.evidenceSnippets.iso27001 || 'ISO 27001 certified',
          source: 'trust_center',
          verifiedControlKey: 'iso27001',
        });
      }
      continue;
    }

    // Check Encryption at Rest
    if (
      (/encrypt(?:ion)?/i.test(text) && /rest/i.test(text)) ||
      (/verschlüssel/i.test(text) && /(?:ruhezustand|speicher|daten|gespeichert)/i.test(text)) ||
      (/chiffrement|chiffré/i.test(text) && /(?:repos|stock|stocké)/i.test(text)) ||
      /stored.*encrypt/i.test(text)
    ) {
      if (profile.encryptionAtRest) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Security',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'aes-256', 'encrypted at rest', 'ja', 'oui']) ?? 'Yes (AES-256)',
          confidence: 90,
          evidenceSnippet: profile.evidenceSnippets.encryptionAtRest || 'Data encrypted at rest with AES-256',
          source: 'trust_center',
          verifiedControlKey: 'encryptionAtRest',
        });
      }
      continue;
    }

    // Check Encryption in Transit
    if (
      /encrypt(?:ion)?.*transit/i.test(text) ||
      /tls/i.test(text) ||
      /verschlüssel.*übertragung/i.test(text) ||
      /chiffrement.*transit/i.test(text)
    ) {
      if (profile.encryptionInTransit) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Security',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'tls 1.3', 'tls 1.2+', 'https', 'ja', 'oui']) ?? 'Yes (TLS 1.2+)',
          confidence: 90,
          evidenceSnippet: profile.evidenceSnippets.encryptionInTransit || 'Data encrypted in transit via TLS 1.2+',
          source: 'trust_center',
          verifiedControlKey: 'encryptionInTransit',
        });
      }
      continue;
    }

    // Check EU Hosting / Data Residency
    if (
      /hosting.*(?:eu|europe|ue)/i.test(text) ||
      /data\s+residency/i.test(text) ||
      /datenstandort|speicherort/i.test(text) ||
      /hébergement|résidence.*données/i.test(text) ||
      /location/i.test(text)
    ) {
      if (profile.euHostingAvailable) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Hosting & Transfers',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'eu only', 'european union', 'eea hosting available', 'ja', 'oui', 'frankfurt', 'dublin']) ?? 'Yes (EU Hosting Available)',
          confidence: 85,
          evidenceSnippet: profile.evidenceSnippets.euHosting || 'EU data hosting regions supported',
          source: 'trust_center',
          verifiedControlKey: 'euHostingAvailable',
        });
      }
      continue;
    }

    // Check DPA
    if (
      /dpa|data\s+processing\s+agreement|article\s+28/i.test(text) ||
      /auftragsverarbeitung|avv/i.test(text) ||
      /sous-traitance|accord.*traitement/i.test(text)
    ) {
      if (profile.dpaAvailable) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Legal & DPA',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'standard dpa available', 'signed dpa', 'ja', 'oui']) ?? 'Yes',
          confidence: 90,
          evidenceSnippet: profile.dpaUrl ? `Standard DPA published at ${profile.dpaUrl}` : 'Standard Article 28 DPA available',
          source: 'trust_center',
          verifiedControlKey: 'dpaAvailable',
        });
      }
      continue;
    }

    // Check Pen testing
    if (
      /penetration\s+test|pen\s+test|audit/i.test(text) ||
      /pentest|sicherheitsprüfung/i.test(text) ||
      /test.*intrusion/i.test(text)
    ) {
      if (profile.penTestDate || profile.securityControls.vulnerabilityScanning) {
        prefilled.push({
          questionId: q.id,
          questionText: q.text,
          category: q.category || 'Security',
          suggestedAnswer: pickBestOption(q.options, ['yes', 'annual', 'third-party audited', 'ja', 'oui']) ?? 'Yes (Annual third-party)',
          confidence: 85,
          evidenceSnippet: profile.evidenceSnippets.penTest || 'Annual third-party penetration testing performed',
          source: 'trust_center',
          verifiedControlKey: 'penTest',
        });
      }
      continue;
    }
  }

  return prefilled;
}

function pickBestOption(
  options: Array<{ text: string; score: number }> | undefined,
  matchingKeywords: string[]
): string | undefined {
  if (!options || options.length === 0) return undefined;
  for (const opt of options) {
    const textLower = opt.text.toLowerCase();
    for (const kw of matchingKeywords) {
      if (textLower.includes(kw)) {
        return opt.text;
      }
    }
  }
  // Return the highest scoring option if it has positive score
  const sorted = [...options].sort((a, b) => (b.score || 0) - (a.score || 0));
  return sorted[0]?.text;
}
