/**
 * Compact confidence bar.
 *
 * The number is one digit, but the colour makes it readable at a glance. The
 * audit's complaint was not that the bar was missing but that the *concept*
 * was: "approved" was an AND gate. A single number to scan is the cheap
 * consequence of the per-field assessment underneath.
 *
 * Sprint 10 (VD-19) adds the half of it that was missing. A bare percentage is
 * two facts collapsed into one — how good the evidence was, and how long ago
 * anybody looked — and the second was invisible, so a probe verified in March
 * rendered the same in December. Pass `provenance` wherever the caller has it
 * and the bar shows the tier and the date beside the figure; the figure itself
 * is then the decayed one, which is what the value is worth today.
 */
import { useTranslations } from 'next-intl';

import { ProvenanceBadge, type ProvenanceView } from './ProvenanceBadge';

export function ConfidenceBar({
  value,
  provenance,
}: {
  value: number;
  /** Omit where the caller genuinely has no row — the badge then reads "not yet verified". */
  provenance?: ProvenanceView | null;
}) {
  const t = useTranslations('vendors');
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 85 ? 'bg-[#C9A227]' : v >= 50 ? 'bg-[#9BA1A6]' : 'bg-[#6E747A]';

  const bar = (
    <div className="flex w-32 items-center gap-2" title={t('intelligence.confidence_tooltip', { value: v })}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs text-[#F4F5F6]">{v}</span>
    </div>
  );

  // Unchanged for every existing call site: no provenance, no second row, same
  // markup as before. The tier is additive rather than a replacement, because
  // the bar is used in dense tables where a second line would not fit.
  if (provenance === undefined) return bar;

  return (
    <div className="flex flex-col gap-1">
      {bar}
      <ProvenanceBadge provenance={provenance} />
    </div>
  );
}
