"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRopaVocabulary } from '@/utils/ropaVocabularies';
import { TextField } from '@/components/ropa/fields';
import { Gavel, Trash2, ShieldAlert, Plus, Check } from 'lucide-react';

/**
 * E47–E52. The retention workbench: schedules, the review queue, the disposal log
 * and legal holds, on one screen with four tabs.
 *
 * One screen rather than four, because they are one job. An overdue schedule, an
 * activity whose retention review date has passed and a disposal that has come due
 * are all "retention needs a decision today", and the person making it is the same
 * person — four separate screens would be four places to forget to look.
 *
 * The one thing this UI is careful never to imply: **nothing here deletes anything.**
 * "Record disposal" writes evidence that a disposal happened in the system that
 * holds the data. A button in a compliance tool that actually executed a customer's
 * retention policy would be destroying evidence on a schedule, on the strength of a
 * period somebody typed into a form.
 */

const PERIOD_UNITS = ['days', 'weeks', 'months', 'years', 'indefinite', 'until_event'] as const;
const DISPOSAL_METHODS = ['deletion', 'anonymisation', 'pseudonymisation', 'return_to_controller', 'archive'] as const;
const HOLD_TYPES = ['litigation', 'regulatory_investigation', 'audit', 'internal_investigation', 'other'] as const;

type Tab = 'schedules' | 'queue' | 'disposals' | 'holds';

export function RetentionWorkbench() {
  const t = useTranslations('ropa.retention');
  const vocab = useRopaVocabulary();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<Tab>('queue');
  const [error, setError] = useState<string | null>(null);

  const schedules = trpc.ropa.retention.list.useQuery({ status: 'all', includeArchived: false, reviewOverdue: false });
  const queue = trpc.ropa.retention.queue.useQuery();
  const dueReport = trpc.ropa.retention.dueReport.useQuery({ horizonDays: 90 });
  const disposals = trpc.ropa.retention.disposals.list.useQuery({ status: 'all', limit: 50 });
  const holds = trpc.ropa.retention.holds.list.useQuery({ status: 'all' });

  // The register itself, for the hold's scope picker. `listIds` returns names only,
  // which is what a multi-select needs and a fraction of what `list` would carry.
  const activities = trpc.ropa.list.useQuery({ limit: 100, includeArchived: false });

  const createSchedule = trpc.ropa.retention.create.useMutation();
  const attestSchedule = trpc.ropa.retention.attest.useMutation();
  const completeDisposal = trpc.ropa.retention.disposals.complete.useMutation();
  const releaseHold = trpc.ropa.retention.holds.release.useMutation();
  const createHold = trpc.ropa.retention.holds.create.useMutation();

  const refresh = () => {
    utils.ropa.retention.list.invalidate();
    utils.ropa.retention.queue.invalidate();
    utils.ropa.retention.dueReport.invalidate();
    utils.ropa.retention.disposals.list.invalidate();
    utils.ropa.retention.holds.list.invalidate();
  };

  const counts = queue.data?.counts;

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'queue', label: t('tab_queue'), badge: counts ? counts.schedules + counts.activities + counts.disposals : undefined },
    { key: 'schedules', label: t('tab_schedules'), badge: schedules.data?.length },
    { key: 'disposals', label: t('tab_disposals'), badge: disposals.data?.length },
    { key: 'holds', label: t('tab_holds'), badge: counts?.holds },
  ];

  return (
    <div className="space-y-6">
      {error ? (
        <div className="bg-clay-600/10 border border-clay-600/25 text-clay-600 px-4 py-2.5 rounded-xl text-[13px]">{error}</div>
      ) : null}

      <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-pressed={tab === entry.key}
            className={`px-4 py-3 text-[13.5px] whitespace-nowrap transition-colors border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60 ${
              tab === entry.key
                ? 'border-[#C9A227] text-[#C9A227] font-medium'
                : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/10'
            }`}
          >
            {entry.label}
            {entry.badge ? <span className="ml-2 text-[11.5px] text-[#9BA1A6]">{entry.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'queue' ? (
        <QueuePanel
          t={t}
          queue={queue.data}
          dueReport={dueReport.data}
          onAttest={async (id: string) => {
            setError(null);
            try {
              await attestSchedule.mutateAsync({ id });
              refresh();
            } catch (e: any) { setError(e?.message ?? t('action_failed')); }
          }}
        />
      ) : null}

      {tab === 'schedules' ? (
        <SchedulesPanel
          t={t}
          vocab={vocab}
          schedules={schedules.data ?? []}
          onCreate={async (payload: any) => {
            setError(null);
            try {
              await createSchedule.mutateAsync(payload);
              refresh();
              return true;
            } catch (e: any) { setError(e?.message ?? t('action_failed')); return false; }
          }}
        />
      ) : null}

      {tab === 'disposals' ? (
        <DisposalsPanel
          t={t}
          disposals={disposals.data ?? []}
          onComplete={async (payload: any) => {
            setError(null);
            try {
              await completeDisposal.mutateAsync(payload);
              refresh();
              return true;
            } catch (e: any) { setError(e?.message ?? t('action_failed')); return false; }
          }}
        />
      ) : null}

      {tab === 'holds' ? (
        <HoldsPanel
          t={t}
          holds={holds.data ?? []}
          activities={activities.data?.data ?? []}
          onRelease={async (id: string) => {
            setError(null);
            try {
              await releaseHold.mutateAsync({ id });
              refresh();
            } catch (e: any) { setError(e?.message ?? t('action_failed')); }
          }}
          onCreate={async (payload: any) => {
            setError(null);
            try {
              await createHold.mutateAsync(payload);
              refresh();
              return true;
            } catch (e: any) { setError(e?.message ?? t('action_failed')); return false; }
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5 space-y-4">
      <div>
        <h2 className="text-[14px] font-medium text-[#F4F5F6]">{title}</h2>
        {hint ? <p className="text-[12px] text-[#6E747A] mt-1">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="text-[13px] text-[#6E747A] py-6 text-center">{message}</p>;
}

const day = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '—');

// ---------------------------------------------------------------------------
// E50 — the queue
// ---------------------------------------------------------------------------

function QueuePanel({ t, queue, dueReport, onAttest }: any) {
  if (!queue) return <Empty message={t('loading')} />;

  return (
    <div className="space-y-5">
      <Panel title={t('due_now')} hint={t('due_now_hint')}>
        {queue.disposalsDue.length === 0 ? <Empty message={t('nothing_due')} /> : (
          <ul className="divide-y divide-white/5">
            {queue.disposalsDue.map((row: any) => (
              <li key={row.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13.5px] text-[#F4F5F6]">{row.activityName}</p>
                  <p className="text-[12px] text-[#6E747A] mt-0.5">
                    {row.scheduleName ? `${row.scheduleName} · ` : ''}{t('due_on', { date: day(row.dueAt) })}
                  </p>
                </div>
                {row.status === 'on_hold' ? (
                  <span className="text-[11.5px] text-[#C9A227] flex items-center gap-1 shrink-0">
                    <Gavel className="w-3.5 h-3.5" aria-hidden="true" />{t('on_hold')}
                  </span>
                ) : (
                  <span className="text-[11.5px] text-[#9BA1A6] shrink-0">{t('awaiting_disposal')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t('schedules_due')} hint={t('schedules_due_hint')}>
        {queue.schedulesDue.length === 0 ? <Empty message={t('no_schedules_due')} /> : (
          <ul className="divide-y divide-white/5">
            {queue.schedulesDue.map((row: any) => (
              <li key={row.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13.5px] text-[#F4F5F6]">{row.name}</p>
                  <p className="text-[12px] text-[#6E747A] mt-0.5">{t('review_was_due', { date: day(row.nextReviewAt) })}</p>
                </div>
                <Button variant="ghost" onClick={() => onAttest(row.id)} className="shrink-0">
                  <Check className="w-4 h-4" aria-hidden="true" /> {t('still_correct')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t('activities_due')} hint={t('activities_due_hint')}>
        {queue.activitiesDue.length === 0 ? <Empty message={t('no_activities_due')} /> : (
          <ul className="divide-y divide-white/5">
            {queue.activitiesDue.map((row: any) => (
              <li key={row.id} className="py-3">
                <a href={`/ropa/${row.id}?tab=retention`} className="text-[13.5px] text-[#F4F5F6] hover:text-[#C9A227]">{row.name}</a>
                <p className="text-[12px] text-[#6E747A] mt-0.5">{t('retention_review_was_due', { date: day(row.retentionReviewDate) })}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {dueReport ? (
        <Panel title={t('horizon', { days: dueReport.horizonDays })} hint={t('horizon_hint')}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={t('coming_due')} value={dueReport.due.length} />
            <Stat label={t('blocked_by_hold')} value={dueReport.blocked.length} />
            {/* The interesting number. "We cannot work out when this is due" is a
                different finding from "it is due", and it is usually the more
                actionable one — an unanchored schedule or no period at all. */}
            <Stat label={t('not_computable')} value={dueReport.unresolvable.length} />
          </div>
          {dueReport.unresolvable.length > 0 ? (
            <ul className="mt-3 divide-y divide-white/5">
              {dueReport.unresolvable.slice(0, 8).map((row: any) => (
                <li key={row.activityId} className="py-2 flex items-center justify-between gap-3">
                  <a href={`/ropa/${row.activityId}?tab=retention`} className="text-[13px] text-[#F4F5F6] hover:text-[#C9A227]">{row.activityName}</a>
                  <span className="text-[11.5px] text-[#6E747A] shrink-0">{t(`reason_${row.reason}` as any)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#08090A] border border-white/10 rounded-xl px-4 py-3">
      <p className="text-[11.5px] text-[#6E747A]">{label}</p>
      <p className="text-[20px] text-[#F4F5F6] mt-1">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// E47 — schedules
// ---------------------------------------------------------------------------

function SchedulesPanel({ t, vocab, schedules, onCreate }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    name: '', periodValue: 6, periodUnit: 'years', trigger: 'collection', disposalMethod: 'deletion',
    statutoryCitation: '', justification: '', triggerDetail: '', reviewIntervalMonths: 24,
  });
  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));
  const uncounted = form.periodUnit === 'indefinite' || form.periodUnit === 'until_event';

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setOpen((v) => !v)}>
          <Plus className="w-4 h-4" aria-hidden="true" /> {t('new_schedule')}
        </Button>
      </div>

      {open ? (
        <Panel title={t('new_schedule')} hint={t('new_schedule_hint')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rs-name" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_name')}</label>
              <Input id="rs-name" value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1" />
            </div>
            <div>
              <label htmlFor="rs-citation" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_citation')}</label>
              <Input id="rs-citation" value={form.statutoryCitation} onChange={(e) => set('statutoryCitation', e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rs-value" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_period')}</label>
                <Input
                  id="rs-value"
                  type="number"
                  min={0}
                  disabled={uncounted}
                  value={uncounted ? '' : form.periodValue ?? ''}
                  onChange={(e) => set('periodValue', e.target.value === '' ? null : Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_unit')}</label>
                <Select value={form.periodUnit} onValueChange={(v) => set('periodUnit', v)}>
                  <SelectTrigger aria-label={t('field_unit')} className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_UNITS.map((u) => <SelectItem key={u} value={u}>{t(`unit_${u}` as any)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_trigger')}</label>
              <p className="mt-0.5 mb-1 text-[11.5px] text-[#6E747A]">{t('field_trigger_hint')}</p>
              <Select value={form.trigger} onValueChange={(v) => set('trigger', v)}>
                <SelectTrigger aria-label={t('field_trigger')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vocab.options('retention_trigger').map((o: any) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_method')}</label>
              <Select value={form.disposalMethod} onValueChange={(v) => set('disposalMethod', v)}>
                <SelectTrigger aria-label={t('field_method')} className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPOSAL_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`method_${m}` as any)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="rs-cadence" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_review_months')}</label>
              <p className="mt-0.5 mb-1 text-[11.5px] text-[#6E747A]">{t('field_review_months_hint')}</p>
              <Input
                id="rs-cadence"
                type="number"
                min={0}
                value={form.reviewIntervalMonths ?? ''}
                onChange={(e) => set('reviewIntervalMonths', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TextField({
              idPrefix: 'rs', field: 'justification', label: t('field_justification'), hint: t('field_justification_hint'),
              rows: 3, value: form.justification ?? '', onChange: (v: string) => set('justification', v),
            })}
            {TextField({
              idPrefix: 'rs', field: 'triggerDetail', label: t('field_trigger_detail'), rows: 3,
              value: form.triggerDetail ?? '', onChange: (v: string) => set('triggerDetail', v),
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button
              disabled={!form.name.trim()}
              onClick={async () => {
                const ok = await onCreate({
                  ...form,
                  periodValue: uncounted ? null : form.periodValue,
                  statutoryCitation: form.statutoryCitation || null,
                  justification: form.justification || null,
                  triggerDetail: form.triggerDetail || null,
                });
                if (ok) { setOpen(false); setForm({ ...form, name: '' }); }
              }}
            >
              {t('save')}
            </Button>
          </div>
        </Panel>
      ) : null}

      {schedules.length === 0 ? <Empty message={t('no_schedules')} /> : (
        <div className="space-y-3">
          {schedules.map((s: any) => (
            <div key={s.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14px] text-[#F4F5F6]">{s.name}</p>
                  <p className="text-[12.5px] text-[#9BA1A6] mt-1">
                    {s.answer.label}
                    {s.trigger ? ` · ${vocab.label('retention_trigger', s.trigger)}` : ''}
                    {s.statutoryCitation ? ` · ${s.statutoryCitation}` : ''}
                  </p>
                  <p className="text-[11.5px] text-[#6E747A] mt-1">
                    {t('governs', { activities: s.activityCount, categories: s.categoryCount })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11.5px] text-[#6E747A]">{t('next_review')}</p>
                  <p className="text-[12.5px] text-[#F4F5F6]">{day(s.nextReviewAt)}</p>
                </div>
              </div>
              {s.issues.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-white/5 pt-3">
                  {s.issues.map((issue: any) => (
                    <li key={issue.field} className="text-[12px] text-[#C9A227] flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// E51 — the disposal log
// ---------------------------------------------------------------------------

function DisposalsPanel({ t, disposals, onComplete }: any) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ method: 'deletion', recordCount: '', systems: '', note: '' });

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-[#6E747A]">{t('disposal_log_hint')}</p>

      {disposals.length === 0 ? <Empty message={t('no_disposals')} /> : disposals.map((d: any) => (
        <div key={d.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13.5px] text-[#F4F5F6]">{d.activityName}</p>
              <p className="text-[12px] text-[#6E747A] mt-0.5">
                {t('due_on', { date: day(d.dueAt) })}
                {d.scheduleName ? ` · ${d.scheduleName}` : ''}
              </p>
              {d.status === 'completed' ? (
                <p className="text-[12px] text-[#9BA1A6] mt-1">
                  {t('disposed_on', { date: day(d.performedAt), method: t(`method_${d.method}` as any) })}
                  {d.recordCount != null ? ` · ${t('records', { count: d.recordCount })}` : ''}
                </p>
              ) : null}
            </div>
            {d.status === 'completed' ? (
              <span className="text-[11.5px] text-[#9BA1A6] shrink-0">{t('status_completed')}</span>
            ) : d.status === 'on_hold' ? (
              <span className="text-[11.5px] text-[#C9A227] shrink-0">{t('on_hold')}</span>
            ) : (
              <Button variant="ghost" onClick={() => setOpenId(openId === d.id ? null : d.id)} className="shrink-0">
                <Trash2 className="w-4 h-4" aria-hidden="true" /> {t('record_disposal')}
              </Button>
            )}
          </div>

          {openId === d.id ? (
            <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_method')}</label>
                  <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                    <SelectTrigger aria-label={t('field_method')} className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISPOSAL_METHODS.map((m) => <SelectItem key={m} value={m}>{t(`method_${m}` as any)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="rd-count" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_record_count')}</label>
                  <Input id="rd-count" type="number" min={0} value={form.recordCount} onChange={(e) => setForm((f) => ({ ...f, recordCount: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="rd-systems" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_systems')}</label>
                  <Input id="rd-systems" value={form.systems} onChange={(e) => setForm((f) => ({ ...f, systems: e.target.value }))} className="mt-1" placeholder={t('field_systems_ph')} />
                </div>
              </div>
              {TextField({
                idPrefix: 'rd', field: 'note', label: t('field_evidence_note'), hint: t('field_evidence_note_hint'),
                rows: 3, value: form.note, onChange: (v: string) => setForm((f) => ({ ...f, note: v })),
              })}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenId(null)}>{t('cancel')}</Button>
                <Button
                  onClick={async () => {
                    const ok = await onComplete({
                      id: d.id,
                      method: form.method,
                      recordCount: form.recordCount === '' ? null : Number(form.recordCount),
                      systems: form.systems.split(',').map((s: string) => s.trim()).filter(Boolean),
                      note: form.note || null,
                      evidence: [],
                    });
                    if (ok) setOpenId(null);
                  }}
                >
                  {t('save')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// E52 — legal holds
// ---------------------------------------------------------------------------

function HoldsPanel({ t, holds, activities, onRelease, onCreate }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    reference: '', reason: '', holdType: 'litigation', expiresAt: '', activityIds: [] as string[],
  });
  const toggleActivity = (id: string) => setForm((f) => ({
    ...f,
    activityIds: f.activityIds.includes(id) ? f.activityIds.filter((a: string) => a !== id) : [...f.activityIds, id],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[12.5px] text-[#6E747A]">{t('holds_hint')}</p>
        <Button onClick={() => setOpen((v) => !v)} className="shrink-0">
          <Plus className="w-4 h-4" aria-hidden="true" /> {t('new_hold')}
        </Button>
      </div>

      {open ? (
        <Panel title={t('new_hold')} hint={t('new_hold_hint')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="lh-ref" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_reference')}</label>
              <Input id="lh-ref" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_hold_type')}</label>
              <Select value={form.holdType} onValueChange={(v) => setForm((f) => ({ ...f, holdType: v }))}>
                <SelectTrigger aria-label={t('field_hold_type')} className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOLD_TYPES.map((h) => <SelectItem key={h} value={h}>{t(`hold_type_${h}` as any)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="lh-expiry" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_expires')}</label>
              <p className="mt-0.5 mb-1 text-[11.5px] text-[#6E747A]">{t('field_expires_hint')}</p>
              <Input id="lh-expiry" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>

          {TextField({
            idPrefix: 'lh', field: 'reason', label: t('field_reason'), hint: t('field_reason_hint'),
            rows: 3, value: form.reason, onChange: (v: string) => setForm((f) => ({ ...f, reason: v })),
          })}

          <div>
            <p className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_scope')}</p>
            <p className="mt-0.5 mb-2 text-[11.5px] text-[#6E747A]">{t('field_scope_hint')}</p>
            <div className="max-h-56 overflow-y-auto border border-white/10 rounded-lg divide-y divide-white/5">
              {activities.map((a: any) => (
                <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#F4F5F6] cursor-pointer hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={form.activityIds.includes(a.id)}
                    onChange={() => toggleActivity(a.id)}
                    className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button
              disabled={!form.reference.trim() || form.reason.trim().length < 10}
              onClick={async () => {
                const ok = await onCreate({
                  reference: form.reference.trim(),
                  reason: form.reason.trim(),
                  holdType: form.holdType,
                  expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
                  activityIds: form.activityIds,
                });
                if (ok) { setOpen(false); setForm({ reference: '', reason: '', holdType: 'litigation', expiresAt: '', activityIds: [] }); }
              }}
            >
              {t('save')}
            </Button>
          </div>
        </Panel>
      ) : null}

      {holds.length === 0 ? <Empty message={t('no_holds')} /> : holds.map((h: any) => (
        <div key={h.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13.5px] text-[#F4F5F6] flex items-center gap-2">
                <Gavel className="w-4 h-4 text-[#C9A227]" aria-hidden="true" />
                {h.reference}
              </p>
              <p className="text-[12.5px] text-[#9BA1A6] mt-1">{h.reason}</p>
              <p className="text-[11.5px] text-[#6E747A] mt-1">
                {t(`hold_type_${h.holdType}` as any)} · {t('issued_on', { date: day(h.issuedAt) })}
                {h.expiresAt ? ` · ${t('expires_on', { date: day(h.expiresAt) })}` : ` · ${t('no_expiry')}`}
              </p>
              {h.activities.length > 0 ? (
                <p className="text-[11.5px] text-[#6E747A] mt-1">{t('covers', { count: h.activities.length })}</p>
              ) : null}
            </div>
            <div className="text-right shrink-0 space-y-2">
              {/* Evaluated, not trusted. A hold whose expiry has passed and which
                  nobody released is not suspending anything, and showing it as
                  active is how a register stops deleting altogether. */}
              {h.effectivelyActive ? (
                <span className="text-[11.5px] text-[#C9A227] block">{t('hold_active')}</span>
              ) : (
                <span className="text-[11.5px] text-[#6E747A] block">{t('hold_inactive')}</span>
              )}
              {h.status === 'active' ? (
                <Button variant="ghost" onClick={() => onRelease(h.id)}>{t('release')}</Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
