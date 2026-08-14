/**
 * One scale for compliance scores, shared by the dial and the pillar cards.
 *
 * Scores run the opposite way to `severity.ts` — 100 is the calm end — so they
 * need their own ramp rather than an inversion of that one. Both surfaces on the
 * audit page previously carried their own: the dial went red/amber/sage while
 * the pillar cards went red/amber/gold and then switched to an undefined
 * `sage-800` on bone at exactly 100, so the same number was two colours on one
 * screen and the best possible result was the only unreadable one.
 *
 * `null` is a real band, not a missing value to paper over. Every score on this
 * page used to fall back to `100` with `||`, which meant an account that had
 * never run an assessment read "100 — Excellent posture. Audit ready." across
 * all nine pillars, and a genuine zero rendered as 100 because `0` is falsy.
 */
export type ScoreBand = 'strong' | 'fair' | 'weak' | 'unassessed';

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score === null || score === undefined || !Number.isFinite(score)) return 'unassessed';
  if (score >= 80) return 'strong';
  if (score >= 50) return 'fair';
  return 'weak';
}

/** Chip/label classes, for the pillar cards. */
const CHIP: Record<ScoreBand, string> = {
  strong:     'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30',
  fair:       'bg-amber-500/10 text-amber-400 border-amber-500/25',
  weak:       'bg-red-500/10 text-red-400 border-red-500/30',
  unassessed: 'bg-white/[0.06] text-[#6E747A] border-white/10',
};

/**
 * Dial stroke. `stroke-current` picks the colour up from the text colour, so
 * these are text classes rather than stroke ones.
 */
const STROKE: Record<ScoreBand, string> = {
  strong:     'text-[#C9A227]',
  fair:       'text-amber-500',
  weak:       'text-red-500',
  unassessed: 'text-white/15',
};

export function scoreChipClasses(score: number | null | undefined): string {
  return CHIP[scoreBand(score)];
}

export function scoreStrokeClasses(score: number | null | undefined): string {
  return STROKE[scoreBand(score)];
}

/** Em dash rather than a number, so an unassessed pillar cannot be misread as a result. */
export function formatScore(score: number | null | undefined): string {
  return scoreBand(score) === 'unassessed' ? '—' : String(Math.round(score as number));
}
