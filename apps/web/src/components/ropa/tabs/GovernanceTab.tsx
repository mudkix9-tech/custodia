"use client";

/**
 * B19–B21. The three things that happen *to* a record rather than in it: it gets
 * reviewed, it gets approved, and each of those moments gets kept.
 *
 * One tab rather than three, because they are one workflow read top to bottom —
 * "when is this due, who signed it off, and what did it say when they did".
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarClock, ShieldCheck, History, Check, X, Send, RotateCcw, FileClock, ArrowLeftRight, Undo2,
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { announce } from '@/components/layout/Announcer';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CADENCES = [3, 6, 12, 24] as const;

function Panel({ title, subtitle, icon: Icon, children }: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="fade-up space-y-5 rounded-2xl bg-[#08090A] p-6 hairline">
      <div className="border-b border-ink-900/8 pb-3">
        <h2 className="flex items-center gap-2 text-[14px] font-medium text-[#F4F5F6]">
          <Icon className="h-4 w-4 text-[#C9A227]" />
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[12px] text-[#6E747A]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Person({ name, email }: { name?: string | null; email?: string | null }) {
  return <span className="text-[#E6E8EA]">{name || email || '—'}</span>;
}

export function GovernanceTab({ activity, orgMembers, currentUserId, isAdmin, onChanged }: {
  activity: any;
  orgMembers: { id: string; name?: string | null; email: string }[];
  currentUserId?: string;
  /** Whether the caller may change the org-level approval requirement (B20). */
  isAdmin?: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('ropa.governance');
  const toast = useToast();
  const utils = trpc.useUtils();
  const { confirm, dialog } = useConfirm();
  const activityId = activity.id;

  const date = (value: string | Date | null | undefined) =>
    value ? new Date(value).toLocaleDateString() : '—';

  // --- B19 -----------------------------------------------------------------
  const [statement, setStatement] = useState('');
  const [customNext, setCustomNext] = useState('');

  const { data: attestations = [] } = trpc.ropa.review.attestations.useQuery({ processingActivityId: activityId });

  const attest = trpc.ropa.review.attest.useMutation({
    onSuccess: () => {
      setStatement('');
      setCustomNext('');
      utils.ropa.review.attestations.invalidate({ processingActivityId: activityId });
      utils.ropa.review.summary.invalidate();
      onChanged();
      toast(t('review.attested'));
      announce(t('review.attested'));
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });

  const updateActivity = trpc.ropa.update.useMutation({
    onSuccess: () => { onChanged(); utils.ropa.review.summary.invalidate(); },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });

  const nextReview = activity.nextReviewAt ? new Date(activity.nextReviewAt) : null;
  const overdue = !!nextReview && nextReview.getTime() < Date.now();

  // --- B20 -----------------------------------------------------------------
  const [reviewerId, setReviewerId] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  const { data: approvals = [] } = trpc.ropa.approval.list.useQuery({ processingActivityId: activityId });

  const invalidateApproval = () => {
    utils.ropa.approval.list.invalidate({ processingActivityId: activityId });
    utils.ropa.versions.list.invalidate({ processingActivityId: activityId });
    onChanged();
  };

  const submitApproval = trpc.ropa.approval.submit.useMutation({
    onSuccess: () => { setRequestNote(''); invalidateApproval(); toast(t('approval.requested')); announce(t('approval.requested')); },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const decideApproval = trpc.ropa.approval.decide.useMutation({
    onSuccess: (_d, vars) => {
      setDecisionReason('');
      invalidateApproval();
      toast(t(vars.decision === 'approved' ? 'approval.approved' : 'approval.rejected'));
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const withdrawApproval = trpc.ropa.approval.withdraw.useMutation({
    onSuccess: () => { invalidateApproval(); toast(t('approval.withdrawn')); },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });

  const approvalState: string = activity.approvalState || 'draft';
  const isReviewer = activity.currentReviewerId && activity.currentReviewerId === currentUserId;

  // B20, org-level. Everyone can see whether approval is mandatory — it changes what
  // the Publish button will do — and only an admin can change it, which the API
  // enforces and the switch below reflects.
  const { data: governance } = trpc.ropa.governance.get.useQuery();
  const setGovernance = trpc.ropa.governance.update.useMutation({
    onSuccess: () => {
      utils.ropa.governance.get.invalidate();
      utils.ropa.completeness.invalidate({ id: activityId });
      toast(t('approval.requirement_saved'));
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const canAdminister = isAdmin === true;

  // --- B21 -----------------------------------------------------------------
  const [diffFrom, setDiffFrom] = useState<string | null>(null);
  const { data: versions = [] } = trpc.ropa.versions.list.useQuery({ processingActivityId: activityId });
  const { data: diff } = trpc.ropa.versions.diff.useQuery(
    { fromId: diffFrom!, toId: null },
    { enabled: !!diffFrom },
  );
  const snapshot = trpc.ropa.versions.create.useMutation({
    onSuccess: () => {
      utils.ropa.versions.list.invalidate({ processingActivityId: activityId });
      toast(t('versions.taken'));
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });

  const restore = trpc.ropa.versions.restore.useMutation({
    onSuccess: (res: any) => {
      utils.ropa.versions.list.invalidate({ processingActivityId: activityId });
      onChanged();
      const message = t('versions.restored', { version: res.restoredFrom });
      toast(message);
      announce(message);
    },
    // A restore can be refused for a reason worth reading — a transfer in this
    // version has a TIA against it — so the message is shown rather than swallowed.
    onError: (err) => toast(t('versions.restore_failed'), { tone: 'error', description: err.message }),
  });

  const handleRestore = async (version: any) => {
    const ok = await confirm({
      title: t('versions.restore_title', { version: version.version }),
      description: t('versions.restore_body'),
      confirmText: t('versions.restore'),
    });
    if (ok) restore.mutate({ id: version.id });
  };

  return (
    <div className="max-w-4xl space-y-6">
      {dialog}
      {/* ---- B19. Review cycle and attestation ---- */}
      <Panel title={t('review.title')} subtitle={t('review.subtitle')} icon={CalendarClock}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <span className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('review.last_reviewed')}</span>
            <span className="text-[13px] text-[#E6E8EA]">{date(activity.lastReviewedAt)}</span>
          </div>
          <div className="space-y-1.5">
            <span className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('review.next_review')}</span>
            {/* Overdue is stated in words as well as colour — R141. */}
            <span className={`text-[13px] ${overdue ? 'text-red-400' : 'text-[#E6E8EA]'}`}>
              {nextReview ? date(nextReview) : t('review.not_scheduled')}
              {overdue && <span className="ml-1.5 text-[12px]">{t('review.overdue')}</span>}
            </span>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-cadence" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">
              {t('review.cadence')}
            </label>
            <Select
              value={activity.reviewCadenceMonths === null || activity.reviewCadenceMonths === undefined
                ? 'inherit'
                : String(activity.reviewCadenceMonths)}
              onValueChange={(value) =>
                updateActivity.mutate({
                  id: activityId,
                  data: { reviewCadenceMonths: value === 'inherit' ? null : Number(value) },
                })
              }
            >
              <SelectTrigger id="review-cadence"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{t('review.cadence_inherit')}</SelectItem>
                {CADENCES.map((months) => (
                  <SelectItem key={months} value={String(months)}>{t('review.cadence_months', { months })}</SelectItem>
                ))}
                {/* 0 is an exemption, which is a different statement from "nobody
                    has decided" — that is what `inherit` means. */}
                <SelectItem value="0">{t('review.cadence_exempt')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <form
          className="space-y-3 border-t border-ink-900/8 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            attest.mutate({
              processingActivityId: activityId,
              statement: statement.trim() || undefined,
              ...(customNext ? { nextReviewAt: new Date(customNext) } : {}),
            });
          }}
        >
          <div className="space-y-2">
            <label htmlFor="attest-statement" className="text-[12.5px] font-medium text-[#E6E8EA]">
              {t('review.statement')}
            </label>
            <Textarea
              id="attest-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={2}
              placeholder={t('review.statement_ph')}
            />
            <p className="text-[12px] text-[#6E747A]">{t('review.statement_hint')}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label htmlFor="attest-next" className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('review.override_next')}
              </label>
              <Input id="attest-next" type="date" value={customNext} onChange={(e) => setCustomNext(e.target.value)} className="w-44" />
            </div>
            <Button type="submit" disabled={attest.isPending} className="flex items-center gap-1.5">
              <Check className="h-4 w-4" /> {t('review.attest')}
            </Button>
          </div>
        </form>

        {attestations.length > 0 && (
          <div className="space-y-2 border-t border-ink-900/8 pt-4">
            <h3 className="text-[12.5px] font-medium text-[#E6E8EA]">{t('review.history')}</h3>
            <ul className="divide-y divide-white/5">
              {attestations.map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-[12.5px]">
                  <span className="text-[#6E747A]">{date(a.attestedAt)}</span>
                  <Person name={a.attestorName} email={a.attestorEmail} />
                  <span className="text-[#6E747A]">
                    {t('review.at_score', { score: a.scoreAtAttestation ?? 0, version: a.versionAtAttestation ?? 1 })}
                  </span>
                  {a.statement && <span className="w-full text-[#9BA1A6]">{a.statement}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* ---- B20. Approval ---- */}
      <Panel title={t('approval.title')} subtitle={t('approval.subtitle')} icon={ShieldCheck}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px] ${
            approvalState === 'approved' ? 'border-[#C9A227]/25 bg-[#C9A227]/10 text-[#C9A227]'
              : approvalState === 'in_review' ? 'border-blue-500/25 bg-blue-500/10 text-blue-300'
              : approvalState === 'rejected' ? 'border-red-500/25 bg-red-500/10 text-red-400'
              : 'border-white/10 bg-white/5 text-[#9BA1A6]'
          }`}>
            {t(`approval.states.${approvalState}`)}
          </span>
          {activity.approvedAt && (
            <span className="text-[12.5px] text-[#6E747A]">{t('approval.approved_on', { date: date(activity.approvedAt) })}</span>
          )}
        </div>

        {/* Said before the workflow rather than after it: whether approval is
            mandatory changes what the Publish button does, and finding that out from
            a refusal is the worst time to find it out. */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#0D0F11] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-[#E6E8EA]">{t('approval.requirement')}</p>
            <p className="mt-0.5 text-[12px] text-[#6E747A]">
              {governance?.approvalRequired ? t('approval.requirement_on') : t('approval.requirement_off')}
            </p>
            {!canAdminister && (
              <p className="mt-0.5 text-[12px] text-[#6E747A]">{t('approval.requirement_admin_only')}</p>
            )}
          </div>
          <Switch
            checked={governance?.approvalRequired ?? false}
            disabled={!canAdminister || setGovernance.isPending}
            aria-label={t('approval.requirement')}
            onCheckedChange={(checked) => setGovernance.mutate({ approvalRequired: checked })}
          />
        </div>

        {approvalState === 'in_review' ? (
          <div className="space-y-4 border-t border-ink-900/8 pt-4">
            <p className="text-[12.5px] text-[#9BA1A6]">
              {isReviewer ? t('approval.you_are_reviewer') : t('approval.awaiting_reviewer')}
            </p>

            {isReviewer && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  decideApproval.mutate({ processingActivityId: activityId, decision: 'approved', reason: decisionReason.trim() || undefined });
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="decision-reason" className="text-[12.5px] font-medium text-[#E6E8EA]">
                    {t('approval.reason')}
                  </label>
                  <Textarea
                    id="decision-reason"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    rows={2}
                    placeholder={t('approval.reason_ph')}
                  />
                  {/* A rejection without a reason is refused by the API. Saying so
                      here means the refusal is never a surprise. */}
                  <p className="text-[12px] text-[#6E747A]">{t('approval.reason_hint')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={decideApproval.isPending} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> {t('approval.approve')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={decideApproval.isPending || decisionReason.trim().length < 5}
                    onClick={() => decideApproval.mutate({ processingActivityId: activityId, decision: 'rejected', reason: decisionReason.trim() })}
                    className="flex items-center gap-1.5 border-red-900/50 text-red-400 hover:bg-red-500/10"
                  >
                    <X className="h-4 w-4" /> {t('approval.reject')}
                  </Button>
                </div>
              </form>
            )}

            <Button
              type="button"
              variant="ghost"
              disabled={withdrawApproval.isPending}
              onClick={() => withdrawApproval.mutate({ processingActivityId: activityId })}
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" /> {t('approval.withdraw')}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3 border-t border-ink-900/8 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reviewerId) return;
              submitApproval.mutate({ processingActivityId: activityId, reviewerId, note: requestNote.trim() || undefined });
            }}
          >
            <div className="min-w-[220px] flex-1 space-y-2">
              <label htmlFor="approval-reviewer" className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('approval.reviewer')}
              </label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger id="approval-reviewer"><SelectValue placeholder={t('approval.choose_reviewer')} /></SelectTrigger>
                <SelectContent>
                  {orgMembers.filter((m) => m.id !== currentUserId).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* The point of the workflow is that the person who wrote the record
                  is not the person who signs it off, so the author is not offered. */}
              <p className="text-[12px] text-[#6E747A]">{t('approval.reviewer_hint')}</p>
            </div>
            <div className="min-w-[220px] flex-1 space-y-2">
              <label htmlFor="approval-note" className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('approval.note')}
              </label>
              <Input id="approval-note" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder={t('approval.note_ph')} />
            </div>
            <Button type="submit" disabled={!reviewerId || submitApproval.isPending} className="flex items-center gap-1.5">
              <Send className="h-4 w-4" /> {t('approval.submit')}
            </Button>
          </form>
        )}

        {approvals.length > 0 && (
          <div className="space-y-2 border-t border-ink-900/8 pt-4">
            <h3 className="text-[12.5px] font-medium text-[#E6E8EA]">{t('approval.history')}</h3>
            <ul className="divide-y divide-white/5">
              {approvals.map((a: any) => (
                <li key={a.id} className="space-y-1 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[#6E747A]">{date(a.requestedAt)}</span>
                    <Person name={a.requesterName} email={a.requesterEmail} />
                    <span className="text-[#6E747A]">{t('approval.asked')}</span>
                    <Person name={a.reviewerName} email={a.reviewerEmail} />
                    <span className={`rounded px-1.5 py-0.5 text-[11px] ${
                      a.decision === 'approved' ? 'bg-[#C9A227]/10 text-[#C9A227]'
                        : a.decision === 'rejected' ? 'bg-red-500/10 text-red-400'
                        : 'bg-white/5 text-[#9BA1A6]'
                    }`}>
                      {t(`approval.decisions.${a.decision}`)}
                    </span>
                  </div>
                  {a.requestNote && <p className="text-[#9BA1A6]">{a.requestNote}</p>}
                  {a.decisionReason && <p className="text-[#9BA1A6]">{t('approval.because', { reason: a.decisionReason })}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* ---- B21. Versions ---- */}
      <Panel title={t('versions.title')} subtitle={t('versions.subtitle')} icon={History}>
        <Button
          type="button"
          variant="outline"
          disabled={snapshot.isPending}
          onClick={() => snapshot.mutate({ processingActivityId: activityId })}
          className="flex items-center gap-1.5"
        >
          <FileClock className="h-4 w-4" /> {t('versions.take')}
        </Button>

        {versions.length === 0 ? (
          <p className="text-[12.5px] text-[#6E747A]">{t('versions.none')}</p>
        ) : (
          <ul className="divide-y divide-white/5 border-t border-ink-900/8">
            {versions.map((v: any) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
                <span className="font-medium text-[#F4F5F6]">v{v.version}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-[#9BA1A6]">{t(`versions.reasons.${v.reason}`)}</span>
                <span className="text-[#6E747A]">{date(v.createdAt)}</span>
                <Person name={v.authorName} email={v.authorEmail} />
                {typeof v.score === 'number' && <span className="text-[#6E747A]">{t('versions.score', { score: v.score })}</span>}
                {v.note && <span className="w-full text-[#9BA1A6]">{v.note}</span>}
                <span className="ml-auto inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDiffFrom(diffFrom === v.id ? null : v.id)}
                    aria-expanded={diffFrom === v.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[12px] text-[#9BA1A6] transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                  >
                    <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                    {diffFrom === v.id ? t('versions.hide_diff') : t('versions.compare_current')}
                  </button>
                  {/* `pre_restore` snapshots are the safety net a restore leaves
                      behind. Offering to restore one is not wrong, but it is almost
                      never what somebody means, so it is not offered by default. */}
                  {v.reason !== 'pre_restore' && (
                    <button
                      type="button"
                      onClick={() => handleRestore(v)}
                      disabled={restore.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[12px] text-[#9BA1A6] transition-colors hover:text-[#C9A227] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                    >
                      <Undo2 className="h-3 w-3" aria-hidden="true" />
                      {t('versions.restore')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {diffFrom && diff && (
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0D0F11] p-4">
            <h3 className="text-[12.5px] font-medium text-[#E6E8EA]">
              {t('versions.diff_title', { from: diff.from.label, to: diff.to.label })}
            </h3>

            {diff.diff.activity.length === 0 && Object.values(diff.diff.children).every(
              (c: any) => c.added === 0 && c.removed === 0 && c.changed.length === 0,
            ) ? (
              <p className="text-[12.5px] text-[#6E747A]">{t('versions.no_changes')}</p>
            ) : (
              <>
                {diff.diff.activity.length > 0 && (
                  <ul className="space-y-1.5">
                    {diff.diff.activity.map((change: any) => (
                      <li key={change.field} className="text-[12.5px]">
                        <span className="text-[#E6E8EA]">{change.field}</span>
                        <span className="ml-2 text-red-400/80 line-through">{JSON.stringify(change.from)}</span>
                        <span className="ml-2 text-[#C9A227]">{JSON.stringify(change.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="space-y-1">
                  {Object.entries(diff.diff.children).map(([name, c]: [string, any]) => (
                    (c.added || c.removed || c.changed.length) ? (
                      <li key={name} className="text-[12.5px] text-[#9BA1A6]">
                        {t(`versions.collections.${name}`)}: {t('versions.child_summary', {
                          added: c.added, removed: c.removed, changed: c.changed.length,
                        })}
                      </li>
                    ) : null
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
