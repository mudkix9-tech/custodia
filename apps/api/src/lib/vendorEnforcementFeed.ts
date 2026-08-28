/**
 * European Regulatory Enforcement Decisions & Vendor Incident Ingestion (Sprint 4).
 *
 * Correlates statutory enforcement decisions and penalties from European Data
 * Protection Authorities (CNIL, AEPD, BfDI, ICO, DPC, EDPS, Garante) against
 * an organisation's active vendor supply chain.
 */

/**
 * Where a decision stands today.
 *
 * A penalty that was later overturned, or is under appeal, is not the same fact as
 * one that is final, and showing the two identically is how a compliance product
 * tells a customer something untrue. The ICO's Clearview penalty is the worked
 * example: it was issued, then set aside by the First-tier Tribunal on jurisdiction,
 * then that ruling was itself appealed. A register entry with no status field can
 * only ever assert the first of those.
 */
export type DecisionStatus = 'final' | 'under_appeal' | 'overturned' | 'superseded';

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
  status: DecisionStatus;
  /** Set where the status is not `final`, so the UI can say what happened. */
  statusNote?: string;
  /** Where a later decision replaces this one. */
  supersededById?: string;
}

/**
 * Curated European regulatory enforcement corpus against major software & cloud
 * providers.
 *
 * This is a hand-maintained corpus compiled into the build, not an ingested feed:
 * there is no table behind it, no importer and no schedule, so it is exactly as
 * current as the last person to edit this file. `CORPUS_CURATED_THROUGH` is what
 * callers should surface so a reader can tell the difference between "no enforcement
 * against this vendor" and "nothing added since we last looked". Replacing it with a
 * real importer over the CNIL/AEPD/BfDI/AP/ICO/DPC sources already scraped in
 * `packages/db/src/seeds/` is the intended direction.
 */
export const CORPUS_CURATED_THROUGH = '2024-01-31';
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
    status: 'final',
  },
  /*
   * These were one entry, which conflated two separate CNIL actions: it carried the
   * Google Analytics date and Article 44 basis but attached the €150m fine, which
   * belongs to the cookie-consent decision and was issued under Article 82 of the
   * French Data Protection Act. The Analytics action carried no fine at all. A
   * compliance product that reports a penalty a decision did not impose, under a
   * legal basis it was not issued on, loses the DPO on the first one they recognise.
   */
  {
    id: 'cnil_google_analytics_2022',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Google LLC',
    matchedVendorName: 'Google',
    decisionDate: '2022-02-10',
    legalBasis: 'Article 44 GDPR (General principle for transfers)',
    summary: 'Formal notice (mise en demeure) to a website operator: use of Google Analytics transferred personal data to the US without sufficient supplementary safeguards. No financial penalty was imposed by this decision.',
    sourceUrl: 'https://www.cnil.fr/en/use-google-analytics-and-data-transfers-united-states',
    relevance: 'direct_vendor',
    status: 'final',
  },
  {
    id: 'cnil_google_cookies_2021',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Google LLC and Google Ireland Limited',
    matchedVendorName: 'Google',
    decisionDate: '2022-01-06',
    fineAmountEur: 150000000,
    legalBasis: 'Article 82 French Data Protection Act (cookies and trackers)',
    summary: 'Refusing cookies on google.fr and youtube.com was made materially harder than accepting them.',
    sourceUrl: 'https://www.cnil.fr/en/cookies-cnil-fines-google-total-150-million-euros-and-facebook-60-million-euros-non-compliance',
    relevance: 'direct_vendor',
    status: 'final',
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
    status: 'final',
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
    status: 'final',
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
    status: 'final',
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
    status: 'under_appeal',
    statusNote: 'The penalty was set aside by the First-tier Tribunal in October 2023 on the ground that the ICO lacked jurisdiction over Clearview\'s processing; the ICO appealed that ruling. Treat the penalty as contested rather than settled, and check the current position before relying on it.',
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
    status: 'final',
  },
  /*
   * This was mapped to `matchedVendorName: 'Amazon Web Services'`, so every customer
   * with AWS in their register was shown it. The decision is against Amazon France
   * Logistique — the warehouse operator — and concerns employee surveillance; it
   * says nothing about AWS as a processor and nothing a DPO could act on in a vendor
   * review. Corporate affiliation is not vendor identity, and treating it as such is
   * the false positive the matcher is otherwise careful to avoid. Kept, correctly
   * attributed, as industry precedent rather than a direct hit.
   */
  {
    id: 'cnil_amazon_france_logistique_2024',
    authority: 'CNIL',
    country: 'FR',
    targetEntity: 'Amazon France Logistique',
    matchedVendorName: 'Amazon France Logistique',
    decisionDate: '2024-01-23',
    fineAmountEur: 32000000,
    legalBasis: 'Articles 5(1)(c), 6, 12, 13 GDPR',
    summary: 'Excessively intrusive employee activity surveillance systems using real-time scanner metrics.',
    sourceUrl: 'https://www.cnil.fr/en/surveillance-warehouse-employees-cnil-imposes-fine-32-million-euros-amazon-france-logistique',
    relevance: 'industry_precedent',
    status: 'final',
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      // The name is escaped before it becomes a pattern: a corpus entry containing
      // `.`, `+`, `(` or `?` would otherwise either match the wrong vendors or throw
      // while compiling. Harmless for the names present today, and the corpus is the
      // obvious thing to move into a table, at which point the values stop being
      // ours.
      const wordBoundaryRegex = new RegExp(`(^|\\s|\\b)${escapeRegExp(dNameLower)}(\\b|\\s|$)`, 'i');
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
