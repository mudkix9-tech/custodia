/**
 * One severity ramp for the whole product.
 *
 * The ramps this replaces were each written against a different palette, so
 * intensity did not track severity: ROPA rendered CRITICAL as a pale pink chip
 * (`bg-clay-50`, whose text token was never defined) while LOW got the brand
 * gold, making the least urgent row the loudest thing in the column. Vendors
 * had the same inversion at `high`.
 *
 * Saturation here decreases monotonically with severity, so a DPO can scan a
 * list for the rows that matter without reading a single label.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'negligible';

const RAMP: Record<Severity, string> = {
  critical:   'bg-red-500/15 text-red-300 border-red-500/40 font-semibold',
  high:       'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium:     'bg-amber-500/10 text-amber-400 border-amber-500/25',
  low:        'bg-white/[0.06] text-[#9BA1A6] border-white/10',
  negligible: 'bg-green-500/10 text-green-400 border-green-500/20',
};

// Breach likelihood says "unlikely" where risk says "negligible"; both mean the
// quietest end of the same ramp.
const ALIASES: Record<string, Severity> = {
  unlikely: 'negligible',
  none: 'negligible',
  informational: 'negligible',
};

export function severityClasses(value?: string | null): string {
  const key = (value ?? '').toLowerCase();
  const level = (ALIASES[key] ?? key) as Severity;
  return RAMP[level] ?? RAMP.low;
}
