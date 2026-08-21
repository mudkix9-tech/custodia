"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextField } from '@/components/ropa/fields';
import { Send, Mail, Plus } from 'lucide-react';

/**
 * C32/C33. The reviewer's side of delegated intake: send a questionnaire, watch the
 * responses come back, merge them field by field.
 *
 * The list never shows the token. Anyone holding it can answer as the recipient, so
 * it travels in the email and nowhere else — not in this response, not in `get`, not
 * in an audit log.
 */

export function IntakeConsole() {
  const t = useTranslations('ropa.intake');
  const utils = trpc.useUtils();

  const [status, setStatus] = useState<'all' | 'outstanding' | 'submitted' | 'merged'>('all');
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requests = trpc.ropa.intake.list.useQuery({ status, limit: 100 });
  const create = trpc.ropa.intake.create.useMutation();
  const remind = trpc.ropa.intake.remind.useMutation();
  const cancel = trpc.ropa.intake.cancel.useMutation();

  const refresh = () => utils.ropa.intake.list.invalidate();

  const STATUSES = [
    ['all', t('filter_all')],
    ['outstanding', t('filter_outstanding')],
    ['submitted', t('filter_submitted')],
    ['merged', t('filter_merged')],
  ] as const;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="bg-clay-600/10 border border-clay-600/25 text-clay-600 px-4 py-2.5 rounded-xl text-[13px]">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-white/10">
          {STATUSES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key as typeof status)}
              aria-pressed={status === key}
              className={`px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60 ${
                status === key
                  ? 'border-[#C9A227] text-[#C9A227] font-medium'
                  : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={() => setComposing((v) => !v)}>
          <Plus className="w-4 h-4" aria-hidden="true" /> {t('new_request')}
        </Button>
      </div>

      {composing ? (
        <Composer
          t={t}
          onSend={async (payload: any) => {
            setError(null);
            try {
              await create.mutateAsync(payload);
              refresh();
              setComposing(false);
            } catch (e: any) { setError(e?.message ?? t('action_failed')); }
          }}
          onCancel={() => setComposing(false)}
        />
      ) : null}

      {(requests.data ?? []).length === 0 ? (
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-10 text-center">
          <Mail className="w-7 h-7 text-[#6E747A] mx-auto" aria-hidden="true" />
          <p className="text-[13.5px] text-[#9BA1A6] mt-3">{t('empty')}</p>
          <p className="text-[12.5px] text-[#6E747A] mt-1 max-w-lg mx-auto">{t('empty_hint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(requests.data ?? []).map((r: any) => (
            <div key={r.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] text-[#F4F5F6]">{r.recipientName || r.recipientEmail}</p>
                  <p className="text-[12.5px] text-[#9BA1A6] mt-0.5">
                    {r.subject}
                    {r.activityName ? ` · ${r.activityName}` : ''}
                  </p>
                  <p className="text-[11.5px] text-[#6E747A] mt-1.5">
                    {t(`status_${r.status}` as any)}
                    {r.dueAt ? ` · ${t('due_on', { date: new Date(r.dueAt).toISOString().slice(0, 10) })}` : ''}
                    {r.remindersSent ? ` · ${t('reminders_sent', { count: r.remindersSent })}` : ''}
                    {` · ${t('answered', { answered: r.progress.answered, total: r.progress.required })}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'submitted' ? (
                    <Button onClick={() => setOpenId(openId === r.id ? null : r.id)}>{t('review_response')}</Button>
                  ) : null}
                  {(r.status === 'sent' || r.status === 'opened') ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={async () => { await remind.mutateAsync({ id: r.id }); refresh(); }}
                      >
                        <Send className="w-4 h-4" aria-hidden="true" /> {t('remind')}
                      </Button>
                      <Button variant="ghost" onClick={async () => { await cancel.mutateAsync({ id: r.id }); refresh(); }}>
                        {t('cancel_request')}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {openId === r.id ? <MergePanel t={t} requestId={r.id} onDone={() => { setOpenId(null); refresh(); }} /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Composer({ t, onSend, onCancel }: any) {
  const [form, setForm] = useState<Record<string, any>>({
    kind: 'interview', recipientEmail: '', recipientName: '', department: '', message: '', dueInDays: 14,
    processingActivityId: null as string | null,
  });
  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const activities = trpc.ropa.list.useQuery({ limit: 100, includeArchived: false });

  return (
    <section className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5 space-y-4">
      <div>
        <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('new_request')}</h2>
        <p className="text-[12px] text-[#6E747A] mt-1">{t('new_request_hint')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_kind')}</label>
          <Select value={form.kind} onValueChange={(v) => set('kind', v)}>
            <SelectTrigger aria-label={t('field_kind')} className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="interview">{t('kind_interview')}</SelectItem>
              <SelectItem value="review">{t('kind_review')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="ik-email" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_email')}</label>
          <Input id="ik-email" type="email" value={form.recipientEmail} onChange={(e) => set('recipientEmail', e.target.value)} className="mt-1" />
        </div>
        <div>
          <label htmlFor="ik-name" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_recipient')}</label>
          <Input id="ik-name" value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} className="mt-1" />
        </div>
      </div>

      {form.kind === 'review' ? (
        <div>
          <label className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_activity')}</label>
          <Select value={form.processingActivityId ?? 'none'} onValueChange={(v) => set('processingActivityId', v === 'none' ? null : v)}>
            <SelectTrigger aria-label={t('field_activity')} className="mt-1"><SelectValue placeholder={t('field_activity_ph')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('field_activity_ph')}</SelectItem>
              {(activities.data?.data ?? []).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {TextField({
        idPrefix: 'ik', field: 'message', label: t('field_message'), hint: t('field_message_hint'),
        rows: 3, value: form.message, onChange: (v: string) => set('message', v),
      })}

      <div className="flex items-end justify-between gap-3">
        <div className="w-40">
          <label htmlFor="ik-due" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('field_due_days')}</label>
          <Input id="ik-due" type="number" min={1} max={120} value={form.dueInDays} onChange={(e) => set('dueInDays', Number(e.target.value))} className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
          <Button
            disabled={!form.recipientEmail.includes('@')}
            onClick={() => onSend({
              kind: form.kind,
              recipientEmail: form.recipientEmail.trim(),
              recipientName: form.recipientName || null,
              department: form.department || null,
              message: form.message || null,
              dueInDays: form.dueInDays,
              processingActivityId: form.processingActivityId,
              send: true,
            })}
          >
            <Send className="w-4 h-4" aria-hidden="true" /> {t('send')}
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * C33's merge, field by field.
 *
 * Every candidate shows what the respondent actually said next to what would be
 * written, because the two are not the same thing — a free-text answer about "CVs,
 * contact details, right to work documents" becomes three rows, and the reviewer
 * has to see the split before accepting it.
 */
function MergePanel({ t, requestId, onDone }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const detail = trpc.ropa.intake.get.useQuery({ id: requestId });
  const merge = trpc.ropa.intake.merge.useMutation();

  const candidates = detail.data?.candidates ?? [];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));

  if (detail.isLoading) return <p className="mt-4 text-[13px] text-[#6E747A]">{t('loading')}</p>;

  return (
    <div className="mt-4 border-t border-white/5 pt-4 space-y-4">
      {error ? <p className="text-[12.5px] text-clay-600">{error}</p> : null}

      {candidates.length === 0 ? (
        <p className="text-[13px] text-[#6E747A]">{t('nothing_to_merge')}</p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c: any) => (
            <li key={c.questionId} className="bg-[#08090A] border border-white/10 rounded-xl p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(c.questionId)}
                  onChange={() => toggle(c.questionId)}
                  className="mt-1 rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
                />
                <div className="min-w-0">
                  <p className="text-[12px] text-[#6E747A]">{t('into_field', { field: c.field, tab: c.tab })}</p>
                  <p className="text-[13px] text-[#F4F5F6] mt-1">
                    {Array.isArray(c.proposedValue) ? c.proposedValue.join(' · ') : String(c.proposedValue)}
                  </p>
                  <p className="text-[11.5px] text-[#6E747A] mt-1">
                    {t('they_said')} {Array.isArray(c.rawAnswer) ? c.rawAnswer.join(', ') : String(c.rawAnswer)}
                  </p>
                  {c.note ? <p className="text-[11.5px] text-[#C9A227] mt-1">{c.note}</p> : null}
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>{t('close')}</Button>
        <Button
          disabled={selected.length === 0 || merge.isPending}
          onClick={async () => {
            setError(null);
            try {
              await merge.mutateAsync({ id: requestId, accept: selected, overrides: {} });
              onDone();
            } catch (e: any) { setError(e?.message ?? t('action_failed')); }
          }}
        >
          {t('merge_selected', { count: selected.length })}
        </Button>
      </div>
    </div>
  );
}
