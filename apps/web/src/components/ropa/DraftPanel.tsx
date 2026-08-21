"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ropa/fields';
import { Sparkles, Check, X } from 'lucide-react';

/**
 * C37. AI drafting of a full activity, with a decision per field.
 *
 * The panel this replaces returns a blob of prose and can apply two fields of it.
 * What makes drafting worth having is the opposite property: every proposed value
 * arrives separately, with the reasoning and the Article behind it, and is accepted
 * or rejected on its own.
 *
 * Two things visible in the UI are load-bearing:
 *
 *   - **Rejected fields are shown, not hidden.** When the model proposes a lawful
 *     basis the register cannot hold, the panel says so. A field silently discarded
 *     is one the reviewer believes was considered and found not to apply.
 *   - **Accepting is not applying.** Decisions are recorded first and written once,
 *     so somebody can change their mind about field four after accepting field
 *     three without the register having already moved.
 */

export function DraftPanel({ activityId }: { activityId?: string }) {
  const t = useTranslations('ropa.draft');
  const router = useRouter();
  const utils = trpc.useUtils();

  const [prompt, setPrompt] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ field: string; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = trpc.ropa.draft.generate.useMutation();
  const decide = trpc.ropa.draft.decide.useMutation();
  const acceptAll = trpc.ropa.draft.acceptAll.useMutation();
  const applyDraft = trpc.ropa.draft.applyDraft.useMutation();
  const discard = trpc.ropa.draft.discard.useMutation();

  const draft = trpc.ropa.draft.get.useQuery({ id: draftId! }, { enabled: !!draftId });

  const proposal = (draft.data?.proposal ?? {}) as Record<string, any>;
  const decisions = (draft.data?.decisions ?? {}) as Record<string, any>;
  const fields = Object.keys(proposal);
  const acceptedCount = fields.filter((f) => decisions[f]?.decision === 'accepted').length;

  const refresh = () => { if (draftId) utils.ropa.draft.get.invalidate({ id: draftId }); };

  return (
    <section className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#08090A] rounded-xl border border-white/10 shrink-0">
          <Sparkles className="w-4 h-4 text-[#C9A227]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('title')}</h2>
          <p className="text-[12px] text-[#6E747A] mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {error ? <p className="text-[12.5px] text-clay-600">{error}</p> : null}

      {!draftId ? (
        <div className="space-y-3">
          {TextField({
            idPrefix: 'draft', field: 'prompt', label: t('prompt_label'), hint: t('prompt_hint'),
            rows: 3, value: prompt, onChange: setPrompt,
          })}
          <div className="flex justify-end">
            <Button
              disabled={prompt.trim().length < 15 || generate.isPending}
              onClick={async () => {
                setError(null);
                try {
                  const created = await generate.mutateAsync({
                    prompt: prompt.trim(),
                    processingActivityId: activityId ?? null,
                  });
                  setDraftId(created.id);
                  setRejected(created.rejected ?? []);
                } catch (e: any) { setError(e?.message ?? t('generate_failed')); }
              }}
            >
              {generate.isPending ? t('generating') : t('generate')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-[#6E747A]">{t('accepted_of', { accepted: acceptedCount, total: fields.length })}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={async () => { await acceptAll.mutateAsync({ id: draftId }); refresh(); }}>
                {t('accept_all')}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => { await discard.mutateAsync({ id: draftId }); setDraftId(null); setPrompt(''); }}
              >
                {t('discard')}
              </Button>
            </div>
          </div>

          <ul className="space-y-3">
            {fields.map((field) => {
              const f = proposal[field];
              const decision = decisions[field]?.decision ?? 'pending';
              return (
                <li
                  key={field}
                  className={`bg-[#08090A] border rounded-xl p-4 transition-colors ${
                    decision === 'accepted' ? 'border-[#C9A227]/40'
                      : decision === 'rejected' ? 'border-white/5 opacity-60'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[12px] text-[#6E747A]">{f.label} · {f.article}</p>
                      <p className="text-[13px] text-[#F4F5F6] mt-1 break-words">{renderValue(f.value, t)}</p>
                      <p className="text-[12px] text-[#9BA1A6] mt-1.5">{f.rationale}</p>
                      <p className="text-[11px] text-[#6E747A] mt-1">{t(`confidence_${f.confidence}` as any)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('accept_field')}
                        onClick={async () => { await decide.mutateAsync({ id: draftId, field, decision: 'accepted' }); refresh(); }}
                        className={decision === 'accepted' ? 'text-[#C9A227]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('reject_field')}
                        onClick={async () => { await decide.mutateAsync({ id: draftId, field, decision: 'rejected' }); refresh(); }}
                        className={decision === 'rejected' ? 'text-clay-600' : 'text-[#6E747A] hover:text-[#F4F5F6]'}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {rejected.length > 0 ? (
            <div className="border-t border-white/5 pt-3">
              <p className="text-[12px] font-medium text-[#E6E8EA]">{t('not_usable')}</p>
              <p className="text-[11.5px] text-[#6E747A] mt-0.5">{t('not_usable_hint')}</p>
              <ul className="mt-2 space-y-1">
                {rejected.map((r, i) => (
                  <li key={`${r.field}-${i}`} className="text-[12px] text-[#9BA1A6]">
                    <span className="text-[#6E747A]">{r.field}</span> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              disabled={acceptedCount === 0 || applyDraft.isPending}
              onClick={async () => {
                setError(null);
                try {
                  const result = await applyDraft.mutateAsync({ id: draftId, targetActivityId: activityId ?? null });
                  setDraftId(null);
                  setPrompt('');
                  if (result.created) router.push(`/ropa/${result.activityId}`);
                  else utils.ropa.get.invalidate({ id: result.activityId! });
                } catch (e: any) { setError(e?.message ?? t('apply_failed')); }
              }}
            >
              {t('apply', { count: acceptedCount })}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** A proposed value, in one line. Rows are summarised rather than rendered as a table — the reviewer's decision is about the set, and the editor is where each row gets its own screen. */
function renderValue(value: unknown, t: (key: string) => string): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : (v as any)?.category ?? (v as any)?.name ?? (v as any)?.destinationCountry ?? ''))
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof value === 'boolean') return value ? t('yes') : t('no');
  return String(value ?? '');
}
