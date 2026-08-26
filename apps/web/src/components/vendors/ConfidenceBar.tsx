/**
 * Compact confidence bar.
 *
 * The number is one digit, but the colour makes it readable at a glance. The
 * audit's complaint was not that the bar was missing but that the *concept*
 * was: "approved" was an AND gate. A single number to scan is the cheap
 * consequence of the per-field assessment underneath.
 */
import { useTranslations } from 'next-intl';

export function ConfidenceBar({ value }: { value: number }) {
  const t = useTranslations('vendors');
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 85 ? 'bg-[#C9A227]' : v >= 50 ? 'bg-[#9BA1A6]' : 'bg-[#6E747A]';

  return (
    <div className="flex w-32 items-center gap-2" title={t('intelligence.confidence_tooltip', { value: v })}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs text-[#F4F5F6]">{v}</span>
    </div>
  );
}
