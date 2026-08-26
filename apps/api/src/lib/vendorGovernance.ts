/**
 * Vendor Governance & Review Cadence Engine — audit D31.
 *
 * Implements:
 *   - Risk-based review scheduling based on vendor criticality
 *   - Attestation stamping and review lifecycle management
 *   - Overdue & upcoming review status evaluation
 */

export type ReviewCadence = 'quarterly' | 'biannual' | 'annual';
export type ReviewStatus = 'overdue' | 'due_soon' | 'scheduled' | 'not_scheduled';

export const CADENCE_DAYS: Record<ReviewCadence, number> = {
  quarterly: 90,
  biannual: 180,
  annual: 365,
};

/**
 * Calculates the next review date from an attestation timestamp, taking into
 * account either an explicit cadence or the vendor's criticality tier.
 */
export function calculateNextReviewDate(
  fromDate: Date | string = new Date(),
  criticality?: string | null,
  explicitCadence?: ReviewCadence | string | null
): Date {
  const base = typeof fromDate === 'string' ? new Date(fromDate) : new Date(fromDate.getTime());
  let days = 365; // Default annual

  if (explicitCadence === 'quarterly') {
    days = 90;
  } else if (explicitCadence === 'biannual') {
    days = 180;
  } else if (explicitCadence === 'annual') {
    days = 365;
  } else if (criticality === 'critical') {
    days = 90;
  } else if (criticality === 'high') {
    days = 180;
  } else {
    days = 365;
  }

  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Determines whether a vendor review is overdue, due soon (within 14 days),
 * or comfortably scheduled.
 */
export function evaluateReviewStatus(
  nextReviewAt: Date | string | null | undefined,
  now: Date = new Date()
): { status: ReviewStatus; daysRemaining: number | null } {
  if (!nextReviewAt) {
    return { status: 'not_scheduled', daysRemaining: null };
  }

  const target = typeof nextReviewAt === 'string' ? new Date(nextReviewAt) : nextReviewAt;
  const diffMs = target.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return { status: 'overdue', daysRemaining };
  } else if (daysRemaining <= 14) {
    return { status: 'due_soon', daysRemaining };
  }

  return { status: 'scheduled', daysRemaining };
}
