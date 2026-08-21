"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { ClipboardCheck, Loader2, AlertTriangle, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

/**
 * F56. The Article 35(1) screening, with the outcome recorded either way.
 *
 * `requires_dpia` was a boolean flipped by the special-category checkbox. It could
 * not say who decided, when, against which criteria, or why — and the EDPB is
 * explicit that where the nine criteria are considered and a DPIA is judged
 * unnecessary, the reasoning has to be documented.
 *
 * Three things in the interface follow from that:
 *
 *   - **Unanswered is not "no".** A criterion with no answer is shown as
 *     unanswered and the verdict says so. "We considered whether this is
 *     large-scale and concluded it is not" and "nobody looked" are different
 *     statements, and only the first is a screening.
 *   - **The rationale is required for every decision**, including "not required" —
 *     which is the one an auditor asks about.
 *   - **Re-screening supersedes rather than overwrites**, so the March answer
 *     survives the June one.
 */

type Answers = Record<string, boolean>;

export function ScreeningPanel({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.screening');
  // The Art. 35(4) list entries are register vocabulary, under `ropa.vocab`.
  const tRopa = useTranslations('ropa');
  const toast = useToast();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.ropa.screening.current.useQuery({ processingActivityId: activityId });
  const { data: criteria } = trpc.ropa.screening.criteria.useQuery();

  const saveMutation = trpc.ropa.screening.save.useMutation();
  const decideMutation = trpc.ropa.screening.decide.useMutation();
  const rescreenMutation = trpc.ropa.screening.rescreen.useMutation();
  const createFromTemplate = trpc.dpia.createFromTemplate.useMutation();

  const [answers, setAnswers] = useState<Answers>({});
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [rationale, setRationale] = useState('');
  const [decision, setDecision] = useState<'required' | 'recommended' | 'not_required' | ''>('');

  useEffect(() => {
    if (!data) return;
    setAnswers((data.screening?.answers ?? data.prefill ?? {}) as Answers);
    setBlacklist(((data.screening?.blacklistMatches ?? []) as string[]) ?? []);
    setRationale(data.screening?.rationale ?? '');
    setDecision((data.screening?.decision as any) ?? (data.result?.verdict as any) ?? '');
  }, [data?.screening?.id, data?.screening?.updatedAt]);

  const refresh = () => {
    utils.ropa.screening.current.invalidate({ processingActivityId: activityId });
    utils.ropa.completeness.invalidate({ id: activityId });
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        processingActivityId: activityId,
        answers: answers as any,
        blacklistSelections: blacklist,
      });
      refresh();
    } catch (err) {
      toast(t('save_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDecide = async () => {
    if (!data?.screening || !decision) return;
    try {
      await decideMutation.mutateAsync({ id: data.screening.id, decision, rationale });
      refresh();
    } catch (err) {
      toast(t('save_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleOpenDpia = async () => {
    if (!data?.screening) return;
    const dpia = await createFromTemplate.mutateAsync({
      templateId: 'cctv',
      title: t('title'),
      processingActivityIds: [activityId],
      screeningId: data.screening.id,
    });
    router.push(`/dpia/${dpia.id}`);
  };

  if (isLoading || !data) {
    return (
      <div className="p-8 flex justify-center" role="status" aria-label={t('loading')}>
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" aria-hidden="true" />
      </div>
    );
  }

  const result = data.result;
  const isDecided = data.screening?.status === 'decided';
  const verdictTone =
    result.verdict === 'required' ? 'text-clay-600'
    : result.verdict === 'recommended' ? 'text-amber-400'
    : 'text-green-400';

  const Criterion = ({ id }: { id: string }) => {
    const answer = answers[id];
    return (
      <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
        <span className="text-[12.5px] text-[#E6E8EA] leading-snug">{t(`c_${id}` as any)}</span>
        <div className="flex gap-1 shrink-0" role="group" aria-label={t(`c_${id}` as any)}>
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              disabled={isDecided}
              aria-pressed={answer === value}
              onClick={() => setAnswers((a) => ({ ...a, [id]: value }))}
              className={`px-2.5 py-1 rounded text-[11.5px] border disabled:opacity-50 ${
                answer === value
                  ? value
                    ? 'bg-clay-600/20 border-clay-600/40 text-clay-600'
                    : 'bg-white/5 border-white/20 text-[#E6E8EA]'
                  : 'border-white/10 text-[#6E747A] hover:border-white/20'
              }`}
            >
              {value ? t('answer_yes') : t('answer_no')}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl fade-up">
      <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5">
        <div className="border-b border-ink-900/8 pb-3">
          <h2 className="text-[14px] font-medium text-[#F4F5F6] flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
            {t('title')}
          </h2>
          <p className="mt-1 text-[12px] text-[#6E747A] max-w-xl">{t('subtitle')}</p>
        </div>

        <section>
          <h3 className="text-[13px] font-medium text-[#F4F5F6] mb-1">{t('statutory_title')}</h3>
          <div className="mt-2">
            {(criteria?.statutory ?? []).map((id: string) => <Criterion key={id} id={id} />)}
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-medium text-[#F4F5F6]">{t('wp248_title')}</h3>
          <p className="text-[11.5px] text-[#6E747A]">{t('wp248_hint')}</p>
          <div className="mt-2">
            {(criteria?.wp248 ?? []).map((id: string) => <Criterion key={id} id={id} />)}
          </div>
        </section>

        {(criteria?.blacklist ?? []).length > 0 ? (
          <section>
            <h3 className="text-[13px] font-medium text-[#F4F5F6]">{t('blacklist_title')}</h3>
            <p className="text-[11.5px] text-[#6E747A]">
              {criteria?.jurisdiction
                ? t('blacklist_hint', { jurisdiction: criteria.jurisdiction })
                : t('blacklist_hint_eu')}
            </p>
            <div className="mt-2 space-y-1.5">
              {(criteria!.blacklist as string[]).map((entry) => (
                <label key={entry} className="flex items-start gap-2 text-[12.5px] text-[#E6E8EA]">
                  <input
                    type="checkbox"
                    disabled={isDecided}
                    checked={blacklist.includes(entry)}
                    onChange={(e) =>
                      setBlacklist((list) => (e.target.checked ? [...list, entry] : list.filter((x) => x !== entry)))
                    }
                    className="mt-0.5 accent-[#C9A227]"
                  />
                  <span>{tRopa(`vocab.blacklist.${entry}` as any)}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section className="border-t border-ink-900/8 pt-5 space-y-3">
          <div>
            <div className="text-[11.5px] text-[#6E747A]">{t('verdict')}</div>
            <div className={`text-[14px] font-medium ${verdictTone}`}>
              {t(`verdict_${result.verdict}` as any)}
            </div>
          </div>

          {result.unanswered.length > 0 ? (
            <p className="text-[12px] text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
              {t('unanswered', { count: result.unanswered.length })}
            </p>
          ) : null}

          {!isDecided ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
            >
              {saveMutation.isPending ? t('saving') : t('save')}
            </button>
          ) : null}
        </section>

        {data.screening ? (
          <section className="border-t border-ink-900/8 pt-5 space-y-3">
            {isDecided ? (
              <>
                <p className="text-[12px] text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('decided_on', {
                    user: data.screening.screenedBy ?? '—',
                    date: new Date(data.screening.screenedAt!).toLocaleDateString(),
                  })}
                </p>
                <p className="text-[12.5px] text-[#9BA1A6] whitespace-pre-wrap">{data.screening.rationale}</p>
                {data.screening.nextReviewAt ? (
                  <p className="text-[11.5px] text-[#6E747A]">
                    {t('next_review', { date: new Date(data.screening.nextReviewAt).toLocaleDateString() })}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => rescreenMutation.mutateAsync({ id: data.screening!.id }).then(refresh)}
                    title={t('rescreen_hint')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] text-[#E6E8EA] hover:border-white/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('rescreen')}
                  </button>

                  {data.screening.decision !== 'not_required' && !data.screening.dpiaId ? (
                    <button
                      type="button"
                      onClick={handleOpenDpia}
                      disabled={createFromTemplate.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] text-[#E6E8EA] hover:border-white/20 disabled:opacity-40"
                    >
                      {t('open_dpia')}
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="screening-decision" className="text-[12.5px] font-medium text-[#E6E8EA]">
                    {t('decision')}
                  </label>
                  <select
                    id="screening-decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as any)}
                    className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                  >
                    <option value="required">{t('verdict_required')}</option>
                    <option value="recommended">{t('verdict_recommended')}</option>
                    <option value="not_required">{t('verdict_not_required')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="screening-rationale" className="text-[12.5px] font-medium text-[#E6E8EA]">
                    {t('rationale')}
                  </label>
                  <p className="mt-0.5 mb-1.5 text-[11.5px] text-[#6E747A]">{t('rationale_hint')}</p>
                  <textarea
                    id="screening-rationale"
                    rows={4}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                  />
                  {rationale.trim().length > 0 && rationale.trim().length < 20 ? (
                    <p className="mt-1 text-[11.5px] text-amber-400">{t('rationale_short')}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleDecide}
                  disabled={!decision || rationale.trim().length < 20 || decideMutation.isPending}
                  className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
                >
                  {decideMutation.isPending ? t('deciding') : t('decide')}
                </button>
              </>
            )}
          </section>
        ) : null}
      </div>

      {(data.history ?? []).length > 0 ? (
        <div className="bg-[#08090A] hairline rounded-2xl p-6">
          <h3 className="text-[13px] font-medium text-[#F4F5F6] mb-3">{t('history_title')}</h3>
          <ul className="space-y-2">
            {(data.history as any[]).map((entry) => (
              <li key={entry.id} className="text-[12px] text-[#9BA1A6]">
                <span className="text-[#E6E8EA]">{t(`verdict_${entry.decision ?? entry.verdict}` as any)}</span>
                {entry.screenedAt ? ` — ${new Date(entry.screenedAt).toLocaleDateString()}` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
