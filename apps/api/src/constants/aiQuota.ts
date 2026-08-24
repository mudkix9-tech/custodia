/**
 * Plan allowances and the monthly AI usage window.
 *
 * This lives in `constants/` rather than in `lib/billing.ts` for the same reason
 * `utils/cursor.ts` lives apart from `utils/pagination.ts`: `billing.ts` imports
 * `db.js`, which throws on import without `DATABASE_URL`, and that makes
 * everything in it unreachable from the standalone fixtures. The window rules
 * are pure arithmetic over two dates and are exactly the kind of thing that
 * returns a plausible wrong answer, so they need to be testable.
 *
 * `billing.ts` re-exports `TIER_LIMITS` so existing importers are unaffected.
 */

/**
 * `ai` is the copilot query allowance, counted in `organizations.ai_queries_used`.
 * `dpaAnalyses` is the DPA-analysis allowance, counted in
 * `organizations.ai_dpas_analyzed`.
 *
 * They are separate keys because they are separate counters. Reusing `ai` for
 * both made the DPA ceiling look plan-aware when it was the same hardcoded 2000
 * it had always been, and left no way to price one without moving the other.
 */
export const TIER_LIMITS = {
  // Legacy mapping (just in case they somehow exist or sneak in)
  free: { users: Infinity, ropa: Infinity, vendors: Infinity, dpia: Infinity, domains: 50, ai: 2000, dpaAnalyses: 2000, customBranding: true, sso: false },
  starter: { users: Infinity, ropa: Infinity, vendors: Infinity, dpia: Infinity, domains: 50, ai: 2000, dpaAnalyses: 2000, customBranding: true, sso: false },
  agency: { users: Infinity, ropa: Infinity, vendors: Infinity, dpia: Infinity, domains: 50, ai: 2000, dpaAnalyses: 2000, customBranding: true, sso: false },
  // Active Tiers
  professional: { users: Infinity, ropa: Infinity, vendors: Infinity, dpia: Infinity, domains: 50, ai: 2000, dpaAnalyses: 2000, customBranding: true, sso: false },
  enterprise: { users: Infinity, ropa: Infinity, vendors: Infinity, dpia: Infinity, domains: Infinity, ai: Infinity, dpaAnalyses: Infinity, customBranding: true, sso: true },
};

/**
 * `organizations.ai_last_reset_at` is a single timestamp marking the start of the
 * current monthly AI window, and TWO counters hang off it — `ai_queries_used`
 * and `ai_dpas_analyzed`.
 *
 * That only works if whichever path notices the rollover resets *both*. The DPA
 * analyser originally kept its own lifetime counter; when it was moved onto this
 * window it read the timestamp but zeroed only its own column, so a month whose
 * first AI action was a copilot query left `ai_dpas_analyzed` carrying the
 * previous month's total forward — a lifetime counter again, which is the defect
 * the move was meant to remove. It broke the other way too: the DPA path
 * stamping the timestamp stopped the copilot counter ever resetting that month.
 *
 * So: one window, one predicate, and both counters cleared together.
 */
export function isNewAiWindow(lastReset: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastReset) return true;
  return (
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear()
  );
}

/** The columns every rollover must write. Both counters, or neither. */
export function aiWindowReset(now: Date = new Date()) {
  return { aiQueriesUsed: 0, aiDpasAnalyzed: 0, aiLastResetAt: now };
}
