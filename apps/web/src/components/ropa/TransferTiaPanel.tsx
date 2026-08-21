"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { Globe2, Loader2, AlertTriangle, CheckCircle2, Circle, CircleDashed } from 'lucide-react';
import { TextField } from './fields';

/**
 * F58. The EDPB six-step transfer impact assessment, per transfer.
 *
 * `tia.ts` files an assessment against a *vendor*, which is the wrong unit twice
 * over: a vendor is a shared catalogue row (which is how D3 let one tenant's
 * completed TIA reach another's register), and an organisation sending HR data to
 * a processor under 2021 SCCs and marketing data to the same processor under a
 * derogation has two transfers with two risk pictures and one assessment.
 *
 * The interface carries two things the API decides and a browser cannot:
 *
 *   - **Step progress**, so an assessment that looks finished because the boxes
 *     are full but has never named the importer says so.
 *   - **Contradictions.** A TIA concluding the destination is not essentially
 *     equivalent, then selecting only contractual measures, has restated the
 *     problem and called it solved. That reads as complete on screen and is the
 *     one a supervisory authority would reject.
 */

const STEP_LABELS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const;

export function TransferTiaPanel({ transferId }: { transferId: string }) {
  const t = useTranslations('ropa.tia');
  // Risk levels are register vocabulary and already translated there.
  const tRopa = useTranslations('ropa');
  const toast = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.ropa.transfers.tia.get.useQuery({ transferId });
  const saveMutation = trpc.ropa.transfers.tia.save.useMutation();
  const completeMutation = trpc.ropa.transfers.tia.complete.useMutation();

  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');

  useEffect(() => {
    if (data?.assessment) setForm({ ...data.assessment });
  }, [data?.assessment?.id, data?.assessment?.updatedAt]);

  const refresh = () => {
    utils.ropa.transfers.tia.get.invalidate({ transferId });
    utils.ropa.transfers.tia.queue.invalidate();
  };

  const set = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const toggleMeasure = (field: string, value: string) => {
    const current: string[] = Array.isArray(form[field]) ? form[field] : [];
    set(field, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const handleSave = async () => {
    try {
      const {
        id, organizationId, processingTransferId, processingActivityId, vendorId, orgVendorId,
        destinationCountry, transferMechanism, status, version, documentId,
        createdAt, updatedAt, createdBy, assessedBy, approvedBy, approvedAt,
        nextReviewAt, lastReviewedAt, suspendedAt, suspendedBy, suspensionReason: _sr,
        dataCategories, ...payload
      } = form;
      await saveMutation.mutateAsync({ transferId, data: payload });
      setDirty(false);
      refresh();
      toast(t('save'));
    } catch (err) {
      toast(t('save_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleComplete = async () => {
    if (!data?.assessment) return;
    try {
      await completeMutation.mutateAsync({ id: data.assessment.id, suspensionReason: suspensionReason || undefined });
      refresh();
    } catch (err) {
      toast(t('complete_blocked'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  if (isLoading || !data) {
    return (
      <div className="p-6 flex justify-center" role="status" aria-label={t('loading')}>
        <Loader2 className="w-5 h-5 animate-spin text-[#C9A227]" aria-hidden="true" />
      </div>
    );
  }

  const evaluation = data.evaluation;
  const assessment = data.assessment;
  const isCompleted = assessment?.status === 'completed';

  // Called rather than rendered as `{Text({  })}` — see `fields.tsx`.
  const Text = (props: { field: string; label: string; rows?: number }) =>
    TextField({
      idPrefix: 'tia',
      value: form[props.field] ?? '',
      onChange: (v) => set(props.field, v),
      rows: 2,
      ...props,
    });

  const Tri = ({ field, label }: { field: string; label: string }) => (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[12.5px] text-[#E6E8EA] leading-snug">{label}</span>
      <div className="flex gap-1 shrink-0">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={form[field] === value}
            onClick={() => set(field, form[field] === value ? null : value)}
            className={`px-2.5 py-1 rounded text-[11.5px] border ${
              form[field] === value
                ? 'bg-white/10 border-white/25 text-[#F4F5F6]'
                : 'border-white/10 text-[#6E747A] hover:border-white/20'
            }`}
          >
            {value ? t('yes') : t('no')}
          </button>
        ))}
      </div>
    </div>
  );

  const MeasureGroup = ({ field, label, options }: { field: string; label: string; options: readonly string[] }) => {
    const selected: string[] = Array.isArray(form[field]) ? form[field] : [];
    const group = field === 'technicalMeasures' ? 'tia_technical'
      : field === 'organizationalMeasures' ? 'tia_organisational'
      : 'tia_contractual';
    return (
      <div>
        <div className="text-[12.5px] font-medium text-[#E6E8EA] mb-1.5">{label}</div>
        <div className="space-y-1.5">
          {options.map((value) => (
            <label key={value} className="flex items-start gap-2 text-[12.5px] text-[#E6E8EA]">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => toggleMeasure(field, value)}
                className="mt-0.5 accent-[#C9A227]"
              />
              <span>
                {tRopa(`vocab.${group}.${value}` as any)}
                {data.measures.effectiveAlone.includes(value) ? (
                  <span className="ml-1.5 text-[11px] text-[#C9A227]">· {t('effective_alone')}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-medium text-[#F4F5F6] flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
            {t('title')}
          </h3>
          <p className="mt-1 text-[11.5px] text-[#6E747A] max-w-xl">{t('subtitle')}</p>
        </div>
        {assessment ? (
          <div className="text-[11.5px] text-[#9BA1A6] shrink-0">{t('progress', { score: evaluation?.score ?? 0 })}</div>
        ) : null}
      </div>

      {data.isAdequate ? (
        <p className="text-[12px] text-green-400">{t('adequate')}</p>
      ) : null}

      {!assessment ? (
        <button
          type="button"
          onClick={() => saveMutation.mutateAsync({ transferId, data: {} }).then(refresh)}
          className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-[12.5px] font-medium text-[#0D0F11] hover:bg-[#D8B23A]"
        >
          {t('start')}
        </button>
      ) : (
        <>
          {/* Step progress. Six ticks rather than a percentage on its own: which
              step is unfinished is what the reader has to act on. */}
          <ol className="flex flex-wrap gap-x-4 gap-y-1.5">
            {(evaluation?.steps ?? []).map((step: any, i: number) => (
              <li key={step.id} className="flex items-center gap-1.5 text-[11.5px]">
                {step.status === 'met' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
                ) : step.status === 'partial' ? (
                  <CircleDashed className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#6E747A]" aria-hidden="true" />
                )}
                <span className={step.status === 'met' ? 'text-[#9BA1A6]' : 'text-[#E6E8EA]'}>
                  {t(STEP_LABELS[i]!)}
                </span>
              </li>
            ))}
          </ol>

          {(evaluation?.contradictions ?? []).length > 0 ? (
            <div className="rounded-lg border border-clay-600/30 bg-clay-600/10 p-3 space-y-2">
              {evaluation!.contradictions.map((id: string) => (
                <p key={id} className="text-[12px] text-clay-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                  <span>{t(`contradiction_${id}` as any)}</span>
                </p>
              ))}
            </div>
          ) : null}

          <section className="space-y-3 border-t border-white/5 pt-4">
            <h4 className="text-[12px] font-medium text-[#C9A227]">{t('step1')}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tia-dataExporter" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_exporter')}</label>
                <input
                  id="tia-dataExporter"
                  value={form.dataExporter ?? ''}
                  onChange={(e) => set('dataExporter', e.target.value)}
                  className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                />
              </div>
              <div>
                <label htmlFor="tia-dataImporter" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_importer')}</label>
                <input
                  id="tia-dataImporter"
                  value={form.dataImporter ?? ''}
                  onChange={(e) => set('dataImporter', e.target.value)}
                  className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                />
              </div>
            </div>
            {Text({ field: 'transferPurpose', label: t('f_purpose') })}
            <div>
              <label htmlFor="tia-transferFrequency" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_frequency')}</label>
              <select
                id="tia-transferFrequency"
                value={form.transferFrequency ?? ''}
                onChange={(e) => set('transferFrequency', e.target.value || null)}
                className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
              >
                <option value="">—</option>
                <option value="one_off">{t('frequency_one_off')}</option>
                <option value="occasional">{t('frequency_occasional')}</option>
                <option value="regular">{t('frequency_regular')}</option>
                <option value="continuous">{t('frequency_continuous')}</option>
              </select>
            </div>
            {Text({ field: 'onwardTransfers', label: t('f_onward') })}
          </section>

          <section className="space-y-3 border-t border-white/5 pt-4">
            <h4 className="text-[12px] font-medium text-[#C9A227]">{t('step2')}</h4>
            <p className="text-[12px] text-[#9BA1A6]">
              {t('f_mechanism')}: <span className="text-[#F4F5F6]">{assessment.transferMechanism}</span>
            </p>
            <p className="text-[11.5px] text-[#6E747A]">{t('f_mechanism_note')}</p>
            {Text({ field: 'mechanismDetail', label: t('f_mechanism_detail') })}
          </section>

          <section className="space-y-1 border-t border-white/5 pt-4">
            <h4 className="text-[12px] font-medium text-[#C9A227] mb-2">{t('step3')}</h4>
            {Tri({ field: 'surveillanceLawsExist', label: t('f_surveillance') })}
            {Text({ field: 'surveillanceLawsDetail', label: t('f_surveillance_detail'), rows: 3 })}
            {Tri({ field: 'independentDpaExists', label: t('f_independent_dpa') })}
            {Tri({ field: 'effectiveRemediesExist', label: t('f_remedies') })}
            {Text({ field: 'relevantCaseLaw', label: t('f_case_law') })}
            <div className="pt-2">
              <label htmlFor="tia-legalAssessmentConclusion" className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('f_legal_conclusion')}
              </label>
              <select
                id="tia-legalAssessmentConclusion"
                value={form.legalAssessmentConclusion ?? ''}
                onChange={(e) => set('legalAssessmentConclusion', e.target.value || null)}
                className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
              >
                <option value="">—</option>
                <option value="equivalent">{t('legal_equivalent')}</option>
                <option value="equivalent_with_measures">{t('legal_equivalent_with_measures')}</option>
                <option value="not_equivalent">{t('legal_not_equivalent')}</option>
              </select>
            </div>
            {Text({ field: 'legalAssessmentDetail', label: t('f_legal_detail'), rows: 3 })}
          </section>

          <section className="space-y-4 border-t border-white/5 pt-4">
            <h4 className="text-[12px] font-medium text-[#C9A227]">{t('step4')}</h4>
            {MeasureGroup({ field: 'technicalMeasures', label: t('f_technical'), options: data.measures.technical })}
            {MeasureGroup({ field: 'organizationalMeasures', label: t('f_organisational'), options: data.measures.organisational })}
            {MeasureGroup({ field: 'contractualMeasures', label: t('f_contractual'), options: data.measures.contractual })}
            {Text({ field: 'measuresDetail', label: t('f_measures_detail'), rows: 3 })}
          </section>

          <section className="space-y-3 border-t border-white/5 pt-4">
            <h4 className="text-[12px] font-medium text-[#C9A227]">{t('step5')}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tia-residualRiskLevel" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_residual_level')}</label>
                <select
                  id="tia-residualRiskLevel"
                  value={form.residualRiskLevel ?? ''}
                  onChange={(e) => set('residualRiskLevel', e.target.value || null)}
                  className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                >
                  <option value="">—</option>
                  {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                    <option key={level} value={level}>{tRopa(`risk_levels.${level}` as any)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tia-conclusion" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_conclusion')}</label>
                <select
                  id="tia-conclusion"
                  value={form.conclusion ?? ''}
                  onChange={(e) => set('conclusion', e.target.value || null)}
                  className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                >
                  <option value="">—</option>
                  <option value="proceed">{t('conclusion_proceed')}</option>
                  <option value="proceed_with_measures">{t('conclusion_proceed_with_measures')}</option>
                  <option value="suspend">{t('conclusion_suspend')}</option>
                </select>
              </div>
            </div>
            {Text({ field: 'residualRiskJustification', label: t('f_residual_justification'), rows: 3 })}
            {Text({ field: 'conditions', label: t('f_conditions') })}
          </section>

          <section className="space-y-3 border-t border-white/5 pt-4">
            <h4 className="text-[12px] font-medium text-[#C9A227]">{t('step6')}</h4>
            <div>
              <label htmlFor="tia-reevaluationIntervalMonths" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_interval')}</label>
              <input
                id="tia-reevaluationIntervalMonths"
                type="number"
                min={1}
                max={60}
                value={form.reevaluationIntervalMonths ?? ''}
                onChange={(e) => set('reevaluationIntervalMonths', e.target.value ? Number(e.target.value) : null)}
                className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
              />
            </div>
            {Text({ field: 'reevaluationTriggers', label: t('f_triggers') })}
          </section>

          {form.conclusion === 'suspend' && !isCompleted ? (
            <div className="border-t border-white/5 pt-4">
              <label htmlFor="tia-suspensionReason" className="text-[12.5px] font-medium text-[#E6E8EA]">
                {t('suspension_reason')}
              </label>
              <textarea
                id="tia-suspensionReason"
                rows={2}
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
              />
              <p className="mt-1 text-[11.5px] text-amber-400">{t('suspension_required')}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saveMutation.isPending}
              className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-[12.5px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
            >
              {saveMutation.isPending ? t('saving') : t('save')}
            </button>

            {isCompleted ? (
              <span className="text-[12px] text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t('completed_note', { date: new Date(assessment.approvedAt!).toLocaleDateString() })}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={!evaluation?.canComplete || dirty || completeMutation.isPending}
                title={evaluation?.canComplete ? undefined : t('complete_blocked')}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] text-[#E6E8EA] hover:border-white/20 disabled:opacity-40"
              >
                {completeMutation.isPending ? t('completing') : t('complete')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
