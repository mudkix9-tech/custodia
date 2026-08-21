"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { Scale, Loader2, CheckCircle2, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

/**
 * F55. The Article 6(1)(f) three-part test.
 *
 * The table shipped with the schema and nothing ever wrote a row. The Legal tab
 * carried an amber panel saying an LIA was required, with a button that had no
 * handler and nothing to route to — which is the shape of finding this whole
 * sprint is about: a control that promises something the product cannot do.
 *
 * Two decisions are visible in the interface:
 *
 *   - **Gaps are shown, not enforced field by field.** Every question can be left
 *     blank and the assessment saves; what it cannot do is claim to be complete.
 *     A balancing test is written over a week, and a form that refuses to keep
 *     half an answer is a form people finish in Word instead.
 *   - **Completing is a separate act from saving.** The server checks the blocking
 *     questions and refuses with a list, so "completed" means the same thing on
 *     every record — which is what makes the register's publication gate able to
 *     read it.
 */

type Gap = { id: string; part: string; blocks: boolean };

const PARTS = ['purpose', 'necessity', 'balancing', 'outcome'] as const;

export function LiaPanel({ activityId, lawfulBasis }: { activityId: string; lawfulBasis: string | null | undefined }) {
  const t = useTranslations('ropa.lia');
  const toast = useToast();
  const utils = trpc.useUtils();

  const applies = (lawfulBasis ?? '').startsWith('legitimate_interest');

  const { data, isLoading } = trpc.ropa.lia.get.useQuery({ processingActivityId: activityId }, { enabled: applies });
  const saveMutation = trpc.ropa.lia.save.useMutation();
  const completeMutation = trpc.ropa.lia.complete.useMutation();
  const supersedeMutation = trpc.ropa.lia.supersede.useMutation();
  const deleteMutation = trpc.ropa.lia.delete.useMutation();

  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.assessment) setForm({ ...data.assessment });
  }, [data?.assessment?.id, data?.assessment?.updatedAt]);

  const gaps: Gap[] = (data?.evaluation?.gaps ?? []) as Gap[];
  const gapById = useMemo(() => new Map(gaps.map((g) => [g.id, g])), [gaps]);

  const refresh = () => {
    utils.ropa.lia.get.invalidate({ processingActivityId: activityId });
    utils.ropa.completeness.invalidate({ id: activityId });
  };

  const set = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const {
        id, organizationId, processingActivityId, status, version, createdAt, updatedAt,
        createdBy, assessedBy, assessedAt, completedAt, lastReviewedAt, ...data_
      } = form;
      await saveMutation.mutateAsync({ processingActivityId: activityId, data: data_ });
      setDirty(false);
      refresh();
      toast(t('saved'));
    } catch (err) {
      toast(t('save_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleComplete = async () => {
    if (!data?.assessment) return;
    try {
      await completeMutation.mutateAsync({ id: data.assessment.id });
      refresh();
    } catch (err) {
      toast(t('complete_blocked'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  if (!applies) {
    return (
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <p className="text-[12.5px] text-[#9BA1A6]">{t('not_applicable')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center" role="status" aria-label={t('loading')}>
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" aria-hidden="true" />
      </div>
    );
  }

  const assessment = data?.assessment;
  const evaluation = data?.evaluation;
  const isCompleted = assessment?.status === 'completed';

  const GapNote = ({ id }: { id: string }) => {
    const gap = gapById.get(id);
    if (!gap) return null;
    return (
      <p className={`mt-1 text-[11.5px] flex items-start gap-1.5 ${gap.blocks ? 'text-amber-400' : 'text-[#6E747A]'}`}>
        {gap.blocks ? <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" /> : null}
        <span>{t(`gap_${id}` as any)}</span>
      </p>
    );
  };

  const Text = ({ field, label, hint, rows = 3 }: { field: string; label: string; hint?: string; rows?: number }) => (
    <div>
      <label htmlFor={`lia-${field}`} className="text-[12.5px] font-medium text-[#E6E8EA]">{label}</label>
      {hint ? <p className="mt-0.5 mb-1.5 text-[11.5px] text-[#6E747A]">{hint}</p> : null}
      <textarea
        id={`lia-${field}`}
        rows={rows}
        value={form[field] ?? ''}
        onChange={(e) => set(field, e.target.value)}
        className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
      />
    </div>
  );

  const Check = ({ field, label }: { field: string; label: string }) => (
    <label className="flex items-start gap-2 text-[12.5px] text-[#E6E8EA]">
      <input
        type="checkbox"
        checked={!!form[field]}
        onChange={(e) => set(field, e.target.checked)}
        className="mt-0.5 accent-[#C9A227]"
      />
      <span>{label}</span>
    </label>
  );

  const Choice = ({ field, label, options }: { field: string; label: string; options: Array<[string, string]> }) => (
    <div>
      <label htmlFor={`lia-${field}`} className="text-[12.5px] font-medium text-[#E6E8EA]">{label}</label>
      <select
        id={`lia-${field}`}
        value={form[field] ?? ''}
        onChange={(e) => set(field, e.target.value || null)}
        className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
      >
        <option value="">—</option>
        {options.map(([value, labelText]) => (
          <option key={value} value={value}>{labelText}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl fade-up">
      <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-ink-900/8 pb-3">
          <div>
            <h2 className="text-[14px] font-medium text-[#F4F5F6] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
              {t('title')}
            </h2>
            <p className="mt-1 text-[12px] text-[#6E747A] max-w-xl">{t('subtitle')}</p>
          </div>

          {assessment ? (
            <div className="text-right shrink-0">
              <div className={`text-[12px] font-medium ${isCompleted ? 'text-green-400' : 'text-[#C9A227]'}`}>
                {t(`status_${assessment.status}` as any)}
              </div>
              <div className="text-[11.5px] text-[#6E747A] mt-0.5">
                {t('progress', { score: evaluation?.score ?? 0 })}
              </div>
            </div>
          ) : null}
        </div>

        {!assessment ? (
          <button
            type="button"
            onClick={() => saveMutation.mutateAsync({ processingActivityId: activityId, data: {} }).then(refresh)}
            className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A]"
          >
            {t('start')}
          </button>
        ) : (
          <>
            {isCompleted ? (
              <p className="text-[12px] text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t('completed_note', { date: new Date(assessment.completedAt!).toLocaleDateString() })}
              </p>
            ) : null}

            {/* Purpose test */}
            <section className="space-y-4">
              <div>
                <h3 className="text-[13px] font-medium text-[#F4F5F6]">{t('part_purpose')}</h3>
                <p className="text-[11.5px] text-[#6E747A]">{t('part_purpose_hint')}</p>
              </div>
              <div>
                <Text field="purposeTestLegitimateInterest" label={t('f_interest')} hint={t('f_interest_hint')} rows={4} />
                <GapNote id="purpose_interest" />
              </div>
              <Check field="purposeTestIsLawful" label={t('f_is_lawful')} />
              <GapNote id="purpose_unlawful" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Choice
                    field="purposeTestBeneficiary"
                    label={t('f_beneficiary')}
                    options={[
                      ['controller', t('beneficiary_controller')],
                      ['third_party', t('beneficiary_third_party')],
                      ['both', t('beneficiary_both')],
                    ]}
                  />
                  <GapNote id="purpose_beneficiary" />
                </div>
                <div>
                  <Choice
                    field="purposeTestImportance"
                    label={t('f_importance')}
                    options={[
                      ['compelling', t('importance_compelling')],
                      ['moderate', t('importance_moderate')],
                      ['minor', t('importance_minor')],
                    ]}
                  />
                  <GapNote id="purpose_importance" />
                </div>
              </div>
              <div>
                <Text field="purposeTestEvidence" label={t('f_evidence')} rows={2} />
                <GapNote id="purpose_evidence" />
              </div>
            </section>

            {/* Necessity test */}
            <section className="space-y-4 border-t border-ink-900/8 pt-5">
              <div>
                <h3 className="text-[13px] font-medium text-[#F4F5F6]">{t('part_necessity')}</h3>
                <p className="text-[11.5px] text-[#6E747A]">{t('part_necessity_hint')}</p>
              </div>
              <div>
                <Text field="necessityTestIsNecessary" label={t('f_necessary')} rows={4} />
                <GapNote id="necessity_statement" />
              </div>
              <div>
                <Text field="necessityTestAlternatives" label={t('f_alternatives')} />
                <GapNote id="necessity_alternatives" />
              </div>
              <Check field="necessityTestProportionate" label={t('f_proportionate')} />
              <GapNote id="necessity_proportionate" />
              <div>
                <Text field="necessityTestConclusion" label={t('f_necessity_conclusion')} rows={2} />
                <GapNote id="necessity_conclusion" />
              </div>
            </section>

            {/* Balancing test */}
            <section className="space-y-4 border-t border-ink-900/8 pt-5">
              <div>
                <h3 className="text-[13px] font-medium text-[#F4F5F6]">{t('part_balancing')}</h3>
                <p className="text-[11.5px] text-[#6E747A]">{t('part_balancing_hint')}</p>
              </div>
              <div>
                <Text field="balancingTestImpact" label={t('f_impact')} rows={4} />
                <GapNote id="balancing_impact" />
              </div>
              <div>
                <Text field="balancingTestExpectation" label={t('f_expectation')} />
                <GapNote id="balancing_expectation" />
              </div>
              <div>
                <Text field="balancingTestRelationship" label={t('f_relationship')} rows={2} />
                <GapNote id="balancing_relationship" />
              </div>
              <div className="space-y-2">
                <Check field="balancingTestInvolvesChildren" label={t('f_involves_children')} />
                <Check field="balancingTestInvolvesSpecialCategory" label={t('f_involves_special')} />
              </div>
              <div>
                <Text field="balancingTestSafeguards" label={t('f_safeguards')} />
                <GapNote id="balancing_safeguards" />
              </div>
              <div>
                <Text field="objectionMechanism" label={t('f_objection')} rows={2} />
                <GapNote id="objection_mechanism" />
              </div>
              <Check field="optOutOffered" label={t('f_opt_out')} />
              <div>
                <Text field="balancingTestOverrides" label={t('f_outcome')} rows={4} />
                <GapNote id="balancing_overrides" />
              </div>
            </section>

            {/* Outcome */}
            <section className="space-y-4 border-t border-ink-900/8 pt-5">
              <h3 className="text-[13px] font-medium text-[#F4F5F6]">{t('part_outcome')}</h3>
              <div>
                <Choice
                  field="outcome"
                  label={t('f_outcome')}
                  options={[
                    ['proceed', t('outcome_proceed')],
                    ['proceed_with_safeguards', t('outcome_proceed_with_safeguards')],
                    ['do_not_proceed', t('outcome_do_not_proceed')],
                  ]}
                />
                <GapNote id="outcome" />
              </div>
              <div>
                <Text field="outcomeRationale" label={t('f_outcome_rationale')} rows={3} />
                <GapNote id="outcome_rationale" />
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/8 pt-5">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saveMutation.isPending}
                className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
              >
                {saveMutation.isPending ? t('completing') : t('saved')}
              </button>

              {!isCompleted ? (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={!evaluation?.canComplete || completeMutation.isPending || dirty}
                  title={evaluation?.canComplete ? undefined : t('complete_blocked')}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[13px] text-[#E6E8EA] hover:border-white/20 disabled:opacity-40"
                >
                  {completeMutation.isPending ? t('completing') : t('complete')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => supersedeMutation.mutateAsync({ id: assessment.id }).then(refresh)}
                  title={t('supersede_hint')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] text-[#E6E8EA] hover:border-white/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('supersede')}
                </button>
              )}

              {!isCompleted ? (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutateAsync({ id: assessment.id }).then(refresh)}
                  className="inline-flex items-center gap-1.5 text-[12px] text-[#6E747A] hover:text-clay-600"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('delete')}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {(data?.history ?? []).length > 0 ? (
        <div className="bg-[#08090A] hairline rounded-2xl p-6">
          <h3 className="text-[13px] font-medium text-[#F4F5F6] mb-3">{t('history_title')}</h3>
          <ul className="space-y-1.5">
            {(data!.history as any[]).map((entry) => (
              <li key={entry.id} className="text-[12px] text-[#9BA1A6]">
                {t('history_entry', {
                  version: entry.version,
                  outcome: entry.outcome ? t(`outcome_${entry.outcome}` as any) : '—',
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
