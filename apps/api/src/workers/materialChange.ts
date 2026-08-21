/**
 * P125. Generalised material-change evaluation.
 *
 * The re-consent worker (`workers/reconsent.ts`) stays exactly as it is and stays
 * wired to the same queue it always was. This is the generalisation beside it, and
 * the split is deliberate: the old worker answers one narrow question about purpose
 * text on consent-based activities, this one answers three questions about every
 * field that can be material, and merging them would have meant rewriting the one
 * piece of this module the audit calls its best idea.
 *
 * The shape of the work:
 *
 *   1. The router hands over the *diff between two versions*, which already exists
 *      — `buildSnapshot`/`diffSnapshots` (B21) freeze an activity and its four
 *      child tables as one document, and the version table is written on every
 *      publish, approval and restore.
 *   2. `evaluateMaterialChange` (pure, fixture-covered) decides what the change
 *      obliges: re-consent, a privacy-notice update, a DPIA re-assessment, or
 *      nothing.
 *   3. **Only if the purpose text changed** is a model asked anything, and all it
 *      may do is raise a verdict the rules already found possible. It cannot
 *      invent a consequence and it cannot clear one — a model with a veto over
 *      "a new third-country transfer was added" is a model with a veto over
 *      Chapter V.
 *
 * Dormant by default: it notifies customers, which is the checklist in CLAUDE.md.
 */
import { createWorker, createQueue, type Job } from '../lib/queue.js';
import { db } from '../db.js';
import {
  materialChangeEvents,
  processingActivities,
  processingActivityVersions,
  reconsentFlags,
  users,
} from 'db';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { Anthropic } from '@anthropic-ai/sdk';
import { WORKER_MODEL } from '../lib/anthropicModels.js';
import { trackAiUsage } from '../lib/billing.js';
import { queueNotification } from '../utils/notifications.js';
import { diffSnapshots, type VersionSnapshot } from '../lib/ropaLifecycle.js';
import {
  evaluateMaterialChange,
  applyNarrativeVerdict,
  isReportable,
  type MaterialChangeResult,
} from '../lib/materialChange.js';
import { emitRopaEvent } from '../lib/ropaEvents.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key' });

export const materialChangeQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('material-change');

type EvaluateJob = {
  organizationId: string;
  activityId: string;
  /** Optional explicit pair; otherwise the two most recent versions are used. */
  fromVersionId?: string | null;
  toVersionId?: string | null;
};

export const materialChangeWorker = createWorker('material-change', async (job: Job<EvaluateJob>) => {
  const { organizationId, activityId } = job.data ?? ({} as EvaluateJob);
  if (!organizationId || !activityId) return { skipped: true, reason: 'No activity' };

  const [activity] = await db.select().from(processingActivities).where(and(
    eq(processingActivities.id, activityId),
    eq(processingActivities.organizationId, organizationId),
  ));
  if (!activity) return { skipped: true, reason: 'Activity not found' };

  // ---- the two versions -------------------------------------------------
  const versions = job.data.fromVersionId && job.data.toVersionId
    ? await db.select().from(processingActivityVersions).where(and(
      eq(processingActivityVersions.organizationId, organizationId),
      inArray(processingActivityVersions.id, [job.data.fromVersionId, job.data.toVersionId]),
    ))
    : await db.select().from(processingActivityVersions)
      .where(and(
        eq(processingActivityVersions.organizationId, organizationId),
        eq(processingActivityVersions.processingActivityId, activityId),
      ))
      .orderBy(desc(processingActivityVersions.version))
      .limit(2);

  if (versions.length < 2) {
    // One version means the record has been snapshotted once — there is nothing to
    // compare it against, and the first snapshot of a record is not a change to it.
    return { skipped: true, reason: 'Not enough history' };
  }

  const ordered = [...versions].sort((a: any, b: any) => a.version - b.version);
  const from = ordered[0]!;
  const to = ordered[ordered.length - 1]!;

  const diff = diffSnapshots(from.snapshot as VersionSnapshot, to.snapshot as VersionSnapshot);

  let result: MaterialChangeResult = evaluateMaterialChange({
    diff,
    basisBefore: (from.snapshot as any)?.activity?.lawfulBasis ?? null,
    basisAfter: (to.snapshot as any)?.activity?.lawfulBasis ?? null,
    hasDpia: !!activity.dpiaId,
  });

  let evaluatedBy: 'rules' | 'ai' = 'rules';

  // ---- the one judgement the rules refuse to make -----------------------
  if (result.needsNarrativeReview) {
    const narrative = await judgePurposeChange({
      organizationId,
      before: (from.snapshot as any)?.activity?.purpose ?? null,
      after: (to.snapshot as any)?.activity?.purpose ?? null,
      basis: activity.lawfulBasis ?? null,
    });
    if (narrative) {
      result = applyNarrativeVerdict(result, narrative);
      evaluatedBy = 'ai';
    }
  }

  if (!isReportable(result)) {
    // D33's lesson. A queue that fills with "the description was tidied" is a queue
    // nobody opens, and every genuine finding goes down with it.
    return { skipped: true, reason: 'No consequence' };
  }

  const [event] = await db.insert(materialChangeEvents).values({
    organizationId,
    processingActivityId: activityId,
    fromVersionId: from.id,
    toVersionId: to.id,
    changes: diff as any,
    materiality: result.materiality,
    consequences: result.consequences as any,
    verdicts: result.verdicts as any,
    evaluatedBy,
    status: 'open',
  }).returning();

  // The existing re-consent queue keeps working, and the two records agree about
  // why: the flag carries the event id, so a reader landing on either can reach
  // the other.
  if (event && result.consequences.includes('reconsent')) {
    const verdict = result.verdicts.reconsent!;
    await db.insert(reconsentFlags).values({
      organizationId,
      processingActivityId: activityId,
      reason: verdict.reasoning,
      confidence: verdict.confidence,
      status: 'flagged',
      materialChangeEventId: event.id,
    });
  }

  if (event) {
    await emitRopaEvent(organizationId, 'ropa.material_change', activity, {
      materiality: result.materiality,
      consequences: result.consequences,
      eventId: event.id,
    });
    await notifyStakeholders(organizationId, activity, result);
  }

  return { eventId: event?.id, materiality: result.materiality, consequences: result.consequences };
});

/**
 * Whether a rewritten purpose describes different processing.
 *
 * The only question in this module a model is asked, and the reason is that it is
 * the only one that is genuinely a judgement rather than a fact about two rows.
 * Failure returns null and the rules verdict stands unchanged — a model being
 * unavailable must not silently downgrade a change the rules already flagged.
 */
async function judgePurposeChange(opts: {
  organizationId: string;
  before: string | null;
  after: string | null;
  basis: string | null;
}): Promise<{ isMaterial: boolean; confidence: string; reasoning: string } | null> {
  if (!opts.before || !opts.after || opts.before === opts.after) return null;

  try {
    await trackAiUsage(opts.organizationId, 1);

    const response = await anthropic.messages.create({
      model: WORKER_MODEL,
      max_tokens: 1024,
      system: 'You are a GDPR compliance expert. Output strictly valid JSON and nothing else.',
      messages: [{
        role: 'user',
        content: `The purpose description of a processing activity has been rewritten. Its lawful basis is "${opts.basis ?? 'unknown'}".

Before:
"${opts.before}"

After:
"${opts.after}"

Under Art. 5(1)(b) a purpose must be specified and explicit, and under Art. 6(4) further processing must be compatible with the purpose for which the data was collected. Does this rewrite describe *different processing*, or the same processing described differently? Wording changes, typo fixes and added detail about processing already covered are NOT material.

Respond with exactly:
{ "isMaterial": boolean, "confidence": "high" | "medium" | "ambiguous", "reasoning": "one or two sentences" }`,
      }],
    });

    const first = response.content[0];
    const text = first?.type === 'text' ? first.text : '';
    const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    if (typeof parsed?.isMaterial !== 'boolean') return null;
    return {
      isMaterial: parsed.isMaterial,
      confidence: typeof parsed.confidence === 'string' ? parsed.confidence : 'ambiguous',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch (error) {
    console.error('[materialChange] Purpose judgement failed; the rules verdict stands:', error);
    return null;
  }
}

/**
 * Who hears about it: the activity's two owners, or one admin if it has neither.
 *
 * Art. 13(3) requires the subject to be informed *prior to* the further processing,
 * so a verdict sitting in a queue nobody opens is a verdict that arrives too late.
 * Advisory verdicts do not notify — they are in the queue, and an email about a
 * change the rules could not settle is the kind that teaches people to filter the
 * sender.
 */
async function notifyStakeholders(orgId: string, activity: any, result: MaterialChangeResult) {
  if (result.materiality !== 'material') return;

  const recipients = [activity.businessOwnerId, activity.privacyOwnerId]
    .filter((id): id is string => !!id);

  if (recipients.length === 0) {
    const [admin] = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, orgId), inArray(users.role, ['admin', 'owner'])))
      .limit(1);
    if (admin) recipients.push(admin.id);
  }

  const what = result.consequences
    .map((c) => c === 'reconsent' ? 'fresh consent'
      : c === 'notice_update' ? 'a privacy-notice update'
      : 'the DPIA looked at again')
    .join(', ');

  for (const userId of [...new Set(recipients)]) {
    await queueNotification({
      organizationId: orgId,
      userId,
      type: 'ropa.material_change',
      title: `A material change to "${activity.name}"`,
      body: `The change needs ${what}. Article 13(3) requires data subjects to be informed before the further processing begins.`,
      actionUrl: `/ropa/${activity.id}?tab=governance`,
      metadata: { consequences: result.consequences, drivers: result.drivers },
    });
  }
}
