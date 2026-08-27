/**
 * European Regulatory Enforcement Decisions & Vendor Incident Ingestion (Sprint 4).
 *
 * Correlates statutory enforcement decisions and penalties from European Data
 * Protection Authorities (CNIL, AEPD, BfDI, ICO, DPC, EDPS, Garante) against
 * an organisation's active vendor supply chain.
 */

export interface RegulatoryDecision {
  id: string;
  authority: 'CNIL' | 'AEPD' | 'BfDI' | 'ICO' | 'DPC' | 'EDPS' | 'Garante' | 'AP';
  country: string;
  targetEntity: string;
  matchedVendorName: string;
  decisionDate: string;
  fineAmountEur?: number;
  legalBasis: string;
  summary: string;
  sourceUrl: string;
  relevance: 'direct_vendor' | 'sub_processor_chain' | 'industry_precedent';
}

/**
 * Curated European regulatory enforcement corpus against major software & cloud providers.
 */
export const EUROPEAN_ENFORCEMENT_CORPUS: RegulatoryDecision[] = [
  {
    id: 'dpc_meta_2023_transfer',
    authority: 'DPC',
    country: 'IE',
    targetEntity: 'Meta Platforms Ireland Ltd',
    matchedVendorName: 'Meta',
    decisionDate: '2023-05-22',
    fineAmountEur: 1200000000,
    legalBasis: 'Article 46(1) GDPR (Transfers to third countries)',
    summary: 'Transfer of EEA personal data to the US suspended due to inadequate government surveillance safeguards prior to DPF.',
    sourceUrl: 'https://www.dataprotection.ie/en/news-media/press-releases/dpc-announces-decision-in-meta-ireland-inquiry',
    relevance: 'direct_vendor',
  },
  {
    id: 'cnil_google_analytics_2022',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Google LLC',
    matchedVendorName: 'Google',
    decisionDate: '2022-02-10',
    fineAmountEur: 150000000,
    legalBasis: 'Article 44 GDPR (General principle for transfers)',
    summary: 'Use of Google Analytics without supplemental technical transfer safeguards ruled non-compliant with Chapter V.',
    sourceUrl: 'https://www.cnil.fr/en/use-google-analytics-and-data-transfers-united-states',
    relevance: 'direct_vendor',
  },
  {
    id: 'cnil_microsoft_advertising_2022',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Microsoft Ireland Operations Limited',
    matchedVendorName: 'Microsoft',
    decisionDate: '2022-12-22',
    fineAmountEur: 60000000,
    legalBasis: 'Article 82 French Data Protection Act & Article 6 GDPR',
    summary: 'Sanction for non-compliant cookie consent mechanisms on Bing search and tracking advertising engine.',
    sourceUrl: 'https://www.cnil.fr/en/cookies-cnil-fines-microsoft-ireland-operations-limited-60-million-euros',
    relevance: 'direct_vendor',
  },
  {
    id: 'cnil_criteo_2023',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Criteo SA',
    matchedVendorName: 'Criteo',
    decisionDate: '2023-06-15',
    fineAmountEur: 40000000,
    legalBasis: 'Articles 7(1), 12, 13, 15(1), 17(1) GDPR',
    summary: 'Failure to verify publisher consent for behavioural retargeting and failure to respect data subject erasure rights.',
    sourceUrl: 'https://www.cnil.fr/en/retargeting-advertising-criteo-fined-40-million-euros',
    relevance: 'direct_vendor',
  },
  {
    id: 'dpc_tiktok_2023_children',
    authority: 'DPC',
    country: 'IE',
    targetEntity: 'TikTok Technology Limited',
    matchedVendorName: 'TikTok',
    decisionDate: '2023-09-15',
    fineAmountEur: 345000000,
    legalBasis: 'Articles 5(1)(a), 5(1)(c), 24(1), 25(1), 25(2) GDPR',
    summary: 'Default public settings for teenage accounts and failure to enforce transparent age verification.',
    sourceUrl: 'https://www.dataprotection.ie/en/news-media/press-releases/decision-tiktok-inquiry',
    relevance: 'direct_vendor',
  },
  {
    id: 'ico_clearview_2022',
    authority: 'ICO',
    country: 'GB',
    targetEntity: 'Clearview AI Inc',
    matchedVendorName: 'Clearview AI',
    decisionDate: '2022-05-23',
    fineAmountEur: 9000000,
    legalBasis: 'Articles 5(1)(a), 6(1), 9(1) GDPR (Biometric scraping)',
    summary: 'Unlawful scraping of personal images from the internet for facial recognition matching without lawful basis.',
    sourceUrl: 'https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2022/05/ico-fines-facial-recognition-database-company-clearview-ai-inc/',
    relevance: 'direct_vendor',
  },
  {
    id: 'garante_openai_2023',
    authority: 'Garante',
    country: 'IT',
    targetEntity: 'OpenAI LLC',
    matchedVendorName: 'OpenAI',
    decisionDate: '2023-03-31',
    fineAmountEur: 0,
    legalBasis: 'Articles 5, 6, 8, 13 GDPR',
    summary: 'Temporary limitation of ChatGPT processing concerning lack of transparency and lawful basis for training dataset collection.',
    sourceUrl: 'https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9870832',
    relevance: 'direct_vendor',
  },
  {
    id: 'cnil_amazon_france_logistique_2024',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Amazon France Logistique',
    matchedVendorName: 'Amazon Web Services',
    decisionDate: '2024-01-23',
    fineAmountEur: 32000000,
    legalBasis: 'Articles 5(1)(c), 6, 12, 13 GDPR',
    summary: 'Excessively intrusive employee activity surveillance systems using real-time scanner metrics.',
    sourceUrl: 'https://www.cnil.fr/en/surveillance-warehouse-employees-cnil-imposes-fine-32-million-euros-amazon-france-logistique',
    relevance: 'direct_vendor',
  },
];

/**
 * Match regulatory decisions against a set of vendor names and domains.
 */
export function matchRegulatoryDecisions(
  vendors: Array<{ id: string; name: string; website?: string | null }>
): Array<RegulatoryDecision & { orgVendorId: string }> {
  const matches: Array<RegulatoryDecision & { orgVendorId: string }> = [];

  for (const v of vendors) {
    const vNameLower = v.name.toLowerCase().trim();
    const vFolded = vNameLower.replace(/[^a-z0-9]/g, '');
    let vHost = '';
    if (v.website) {
      try {
        const u = v.website.startsWith('http') ? new URL(v.website) : new URL(`https://${v.website}`);
        vHost = u.hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        vHost = v.website.toLowerCase().replace(/[^a-z0-9.]/g, '');
      }
    }

    for (const decision of EUROPEAN_ENFORCEMENT_CORPUS) {
      const dNameLower = decision.matchedVendorName.toLowerCase().trim();
      const dFolded = dNameLower.replace(/[^a-z0-9]/g, '');

      // 1. Exact normalized name match
      const isExactFolded = vFolded === dFolded;

      // 2. Word boundary name match (e.g., "Amazon Web Services" matches "Amazon", but "Go" does NOT match "Google")
      const wordBoundaryRegex = new RegExp(`(^|\\s|\\b)${dNameLower}(\\b|\\s|$)`, 'i');
      const isWordMatch = wordBoundaryRegex.test(vNameLower);

      // 3. Domain match (e.g., google.com, amazon.com)
      const isDomainMatch = Boolean(
        vHost &&
        dNameLower.length >= 4 &&
        (vHost === `${dNameLower}.com` || vHost.endsWith(`.${dNameLower}.com`) || vHost.startsWith(`${dNameLower}.`))
      );

      if (isExactFolded || isWordMatch || isDomainMatch) {
        matches.push({
          ...decision,
          orgVendorId: v.id,
        });
      }
    }
  }

  return matches;
}
