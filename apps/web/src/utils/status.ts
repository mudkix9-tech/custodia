/**
 * One treatment per completion state.
 *
 * Training rendered four: `bg-emerald-50 text-emerald-600` for the icon tile,
 * `bg-emerald-50 text-emerald-700` for the chip beside it, `bg-rose-50
 * text-rose-700` for a failure and a neutral for everything else — the first
 * three being light-theme steps on a `#0D0F11` card, so "passed" and "failed"
 * were near-white blocks and the two greens differed from each other by one
 * step for no reason.
 *
 * Green stays for genuine success; it is a semantic, not a brand colour, which
 * is why the gold sweep leaves it alone.
 */
export type CompletionStatus = 'passed' | 'in_progress' | 'failed' | 'not_started';

export function completionStatus(value?: string | null): CompletionStatus {
  const v = (value ?? '').toLowerCase();
  if (v === 'passed' || v === 'completed') return 'passed';
  if (v === 'in_progress') return 'in_progress';
  if (v === 'failed') return 'failed';
  return 'not_started';
}

const CHIP: Record<CompletionStatus, string> = {
  passed:      'bg-green-500/10 text-green-400 border-green-500/25',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  failed:      'bg-red-500/10 text-red-400 border-red-500/30',
  not_started: 'bg-white/[0.06] text-[#9BA1A6] border-white/10',
};

/** The larger icon tile beside the chip — same hue, no border. */
const TILE: Record<CompletionStatus, string> = {
  passed:      'bg-green-500/10 text-green-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  failed:      'bg-red-500/10 text-red-400',
  not_started: 'bg-white/[0.06] text-[#9BA1A6]',
};

export function completionChipClasses(value?: string | null): string {
  return CHIP[completionStatus(value)];
}

export function completionTileClasses(value?: string | null): string {
  return TILE[completionStatus(value)];
}
