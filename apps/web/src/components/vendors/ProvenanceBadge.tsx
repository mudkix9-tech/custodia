/**
 * Where a catalogue value came from, and when — Sprint 10, VD-19 and VD-21.
 *
 * "90%" and "verified on stripe.com three days ago" are the same figure and
 * different information. The register has shown the first since Sprint 5 while
 * storing everything needed for the second, so a probe from March renders
 * identically in December against a URL that may since have 404'd.
 *
 * Two rules this component exists to hold:
 *
 * **A stale field is reported by its date, not by its number.** Once the decay
 * in `vendorProvenance.ts` has taken a value to its floor, the honest claim is
 * "we last confirmed this on 3 March", and a percentage beside it reads as a
 * measurement of the vendor rather than of our own freshness.
 *
 * **Absent is a tier and renders without embarrassment.** Most catalogue fields
 * have no provenance row at all and will not have one for a long time. That is
 * "nobody has established this yet", which is a statement about us, and it must
 * not look like a finding about the vendor.
 *
 * The tier labels are reached as ``t(`provenance.${sourceType}`)``, which
 * `check:vendor-i18n` cannot verify — its key check only sees single-quoted
 * literals. All five are in `messages/{en,de,fr}/vendors.json` and were checked
 * by hand; adding a sixth source type means adding three more entries there.
 */
'use client';

import { useTranslations } from 'next-intl';

/** Mirrors `VENDOR_SOURCE_TYPES` in the API. Absent is represented by no row. */
export type ProvenanceSourceType =
  | 'registry'
  | 'http_probe'
  | 'trust_centre'
  | 'analyst'
  | 'customer';

export interface ProvenanceView {
  sourceType: ProvenanceSourceType | string;
  /** Worth today, after decay. Not the stored number. */
  confidence: number;
  /** What it was worth when gathered, for the tooltip. */
  confidenceWhenGathered?: number;
  stale?: boolean;
  reviewOverdue?: boolean;
  retrievedAt?: string | null;
  sourceUrl?: string | null;
  supersededCount?: number;
}

/** Tier colour follows the pyramid, not the number. */
const TIER_TONE: Record<string, string> = {
  registry: 'border-[#C9A227]/40 text-[#C9A227]',
  analyst: 'border-[#C9A227]/30 text-[#E6C65A]',
  customer: 'border-white/25 text-[#F4F5F6]',
  http_probe: 'border-white/15 text-[#9BA1A6]',
  trust_centre: 'border-white/10 text-[#6E747A]',
};

function formatDay(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export function ProvenanceBadge({ provenance }: { provenance?: ProvenanceView | null }) {
  const t = useTranslations('vendors');

  // No row is the sixth tier, and the most common one after Sprint 9's seed.
  if (!provenance) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-[#6E747A]"
        title={t('provenance.absent_hint')}
      >
        {t('provenance.absent')}
      </span>
    );
  }

  const day = formatDay(provenance.retrievedAt);
  const tone = TIER_TONE[provenance.sourceType] ?? TIER_TONE.trust_centre;
  const tier = t(`provenance.${provenance.sourceType}` as never);

  // The date interpolates into a translated sentence rather than being
  // concatenated onto one, so a locale that puts it first can.
  const when = provenance.reviewOverdue
    ? t('provenance.review_overdue', { date: day })
    : provenance.stale
      ? t('provenance.last_verified', { date: day })
      : t('provenance.verified_on', { date: day });

  const detail = provenance.stale
    ? t('provenance.stale_hint', { date: day })
    : provenance.confidenceWhenGathered !== undefined
      && provenance.confidenceWhenGathered !== provenance.confidence
      ? t('provenance.confidence_decayed', {
          value: provenance.confidence,
          original: provenance.confidenceWhenGathered,
        })
      : t('provenance.confidence_today', { value: provenance.confidence });

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={detail}>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
        {tier}
      </span>
      {day ? <span className="text-[11px] text-[#6E747A]">{when}</span> : null}
      {provenance.supersededCount ? (
        <span className="text-[11px] text-[#6E747A]">
          {provenance.supersededCount === 1
            ? t('provenance.superseded_by', { count: provenance.supersededCount })
            : t('provenance.superseded_by_plural', { count: provenance.supersededCount })}
        </span>
      ) : null}
    </span>
  );
}
