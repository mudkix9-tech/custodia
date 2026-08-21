/**
 * O120/D39. The ROPA webhook events, and the one place they are emitted from.
 *
 * `ropa.created`, `ropa.updated` and `ropa.deleted` have been offered for
 * subscription since the webhooks feature shipped. `constants/webhookEventMap.ts`
 * maps the tRPC paths onto them, and **nothing in the codebase imports that file** —
 * so a customer could subscribe, see the subscription listed, and never receive
 * anything. That is worse than not offering the events: it is a documented
 * integration point that silently does nothing.
 *
 * Two decisions worth stating.
 *
 * **The emitter is explicit, not a middleware.** Wiring `TRPC_PATH_TO_EVENT` into
 * the audit middleware would have been three lines and would have fired events for
 * every mapped path in the product on the next deploy — including several the map
 * describes as "pseudo" and one that does not exist. An event is a public contract;
 * it is emitted where the code knows what happened, not where a string matched.
 *
 * **The payload is the record, not the row.** A subscriber receives the fields an
 * Article 30 record actually consists of, not whatever columns the mutation
 * happened to write, and never the fields that are internal (`deleted_at`,
 * `organization_id`, the approval pointers). A webhook payload shaped like a
 * database row is a schema promise nobody meant to make.
 */

import { dispatchWebhook } from '../utils/webhookDispatcher.js';

export const ROPA_WEBHOOK_EVENTS = {
  'ropa.created': 'A processing activity was created',
  'ropa.updated': 'A processing activity was updated',
  'ropa.deleted': 'A processing activity was deleted',
  'ropa.published': 'A processing activity was published to the register',
  'ropa.archived': 'A processing activity was archived',
  'ropa.reviewed': 'A processing activity was reviewed and attested',
  'ropa.approved': 'A processing activity was approved',
  'ropa.transfer.added': 'A third-country transfer was added to an activity',
  'ropa.retention.overdue': 'A retention disposal became due',
  'ropa.completeness.changed': 'An activity’s Article 30 completeness score changed materially',
  'ropa.material_change': 'A change to an activity was assessed as material',
} as const;

export type RopaWebhookEvent = keyof typeof ROPA_WEBHOOK_EVENTS;

/**
 * How far a completeness score has to move before it is an event.
 *
 * Every mutation on an activity recomputes the score, and most move it by a point
 * or two. A webhook on every point would be a webhook on every keystroke of an
 * autosaving editor — which is how a subscriber's endpoint gets rate-limited and
 * the integration gets switched off. Ten points is roughly "a requirement was
 * answered or stopped being answered".
 */
export const COMPLETENESS_EVENT_THRESHOLD = 10;

type ActivityLike = {
  id: string;
  name?: string | null;
  purpose?: string | null;
  status?: string | null;
  role?: string | null;
  lawfulBasis?: string | null;
  riskLevel?: string | null;
  completenessScore?: number | null;
  approvalState?: string | null;
  nextReviewAt?: Date | string | null;
  updatedAt?: Date | string | null;
  tags?: unknown;
};

/**
 * The activity as a subscriber sees it.
 *
 * Deliberately a hand-written projection rather than a spread with deletions. A
 * denylist leaks every column added after it was written; an allowlist leaks
 * nothing, and the cost is having to think once per new field about whether it is
 * part of the contract.
 */
export function activityPayload(activity: ActivityLike): Record<string, unknown> {
  return {
    id: activity.id,
    name: activity.name ?? null,
    purpose: activity.purpose ?? null,
    status: activity.status ?? null,
    role: activity.role ?? null,
    lawfulBasis: activity.lawfulBasis ?? null,
    riskLevel: activity.riskLevel ?? null,
    completenessScore: activity.completenessScore ?? null,
    approvalState: activity.approvalState ?? null,
    nextReviewAt: toIso(activity.nextReviewAt),
    updatedAt: toIso(activity.updatedAt),
    tags: Array.isArray(activity.tags) ? activity.tags : [],
    url: `/ropa/${activity.id}`,
  };
}

/**
 * Emits one ROPA event, and never lets a failure reach the mutation.
 *
 * A webhook subscriber's endpoint being down is not a reason for a DPO's save to
 * fail, and `dispatchWebhook` writes delivery rows before it enqueues — so the
 * durable part of the work has already happened by the time anything can throw.
 * Logged rather than swallowed silently: an emitter that fails quietly is D39 all
 * over again, one layer down.
 */
export async function emitRopaEvent(
  organizationId: string,
  event: RopaWebhookEvent,
  activity: ActivityLike,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await dispatchWebhook(organizationId, event, {
      activity: activityPayload(activity),
      ...extra,
    });
  } catch (error) {
    console.error(`[ropa-events] Failed to dispatch ${event} for ${activity.id}:`, error);
  }
}

/** Whether a completeness move is worth an event. */
export function completenessMoved(before: number, after: number): boolean {
  return Math.abs(after - before) >= COMPLETENESS_EVENT_THRESHOLD;
}

function toIso(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
