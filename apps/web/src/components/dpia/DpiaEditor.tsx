"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { ShieldAlert, Loader2, CheckCircle2, AlertTriangle, Plus, Trash2, ShieldCheck } from 'lucide-react';

/**
 * F57. The Article 35(7) structure, in one place.
 *
 * The DPIA tab in the register renders a residual-risk grid and nothing else, so
 * the parts a supervisory authority actually reads — the systematic description
 * in 35(7)(a), the DPO's advice under 35(2), the views of data subjects under
 * 35(9), and the sign-off — had nowhere to live at all.
 *
 * Three things are refused rather than merely warned about, and each is a refusal
 * the server makes so it holds for the API as well as the screen:
 *
 *   - Signing off without a description, a risk assessment, or DPO advice where a
 *     DPO is designated. That is not a strict DPIA; it is a risk register with a
 *     title, and signing it is the act that makes it evidence.
 *   - Departing from the DPO's advice without saying why. The controller decides
 *     — that is what Art. 39 means — but silence is the gap an authority looks
 *     for first.
 *   - Recording that the views of data subjects were not sought without a reason.
 *     "Where appropriate" is a judgement and both answers are legitimate; not
 *     recording that you made one is not.
 */

const SCALE = [1, 2, 3, 4] as const;

export function DpiaEditor({ dpiaId }: { dpiaId: string }) {
  const t = useTranslations('ropa.dpia.module');
  const tRopa = useTranslations('ropa');
  const toast = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.dpia.full.useQuery({ id: dpiaId });
  const updateMutation = trpc.dpia.update.useMutation();
  const riskUpdate = trpc.dpia.risks.update.useMutation();
  const riskCreate = trpc.dpia.risks.create.useMutation();
  const riskDelete = trpc.dpia.risks.delete.useMutation();
  const dpoOpinion = trpc.dpia.recordDpoOpinion.useMutation();
  const consultation = trpc.dpia.recordConsultation.useMutation();
  const signOff = trpc.dpia.signOff.useMutation();

  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  const [opinion, setOpinion] = useState({ opinion: '', outcome: 'approve', adviceFollowed: true, departureReason: '' });
  const [views, setViews] = useState({ sought: false, method: '', summary: '', notSoughtReason: '' });
  const [decision, setDecision] = useState({ decision: 'proceed', conditions: '' });

  useEffect(() => {
    if (data?.dpia) setForm({ ...data.dpia });
  }, [data?.dpia?.id, data?.dpia?.updatedAt]);

  const refresh = () => utils.dpia.full.invalidate({ id: dpiaId });

  const set = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const {
        id, organizationId, version, createdAt, updatedAt, createdBy, deletedAt,
        approvedBy, approvedAt, signedOffBy, signedOffAt, signOffDecision, signOffConditions,
        dpoConsulted, dpoOpinion: _o, dpoOpinionOutcome, dpoOpinionBy, dpoOpinionAt,
        dpoAdviceFollowed, dpoAdviceDepartureReason, consultationSought, consultationMethod,
        consultationSummary, consultationNotSoughtReason, consultationAt,
        overallRiskLevel, residualRiskLevel, requiresPriorConsultation, residualRisks,
        lastMitigationReminderSentAt, templateId, screeningId, lastReviewedAt,
        ...payload
      } = form;
      await updateMutation.mutateAsync({ id: dpiaId, data: payload });
      setDirty(false);
      refresh();
      toast(t('saved'));
    } catch (err) {
      toast(t('save_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  const call = async (fn: () => unknown, failure: string) => {
    try {
      await fn();
      refresh();
    } catch (err) {
      toast(failure, { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  if (isLoading || !data) {
    return (
      <div className="p-12 flex justify-center" role="status" aria-label={t('loading')}>
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" aria-hidden="true" />
      </div>
    );
  }

  const dpia = data.dpia;
  const isSignedOff = !!dpia.signedOffAt;

  const Text = ({ field, label, hint, rows = 3 }: { field: string; label: string; hint?: string; rows?: number }) => (
    <div>
      <label htmlFor={`dpia-${field}`} className="text-[12.5px] font-medium text-[#E6E8EA]">{label}</label>
      {hint ? <p className="mt-0.5 mb-1 text-[11.5px] text-[#6E747A]">{hint}</p> : null}
      <textarea
        id={`dpia-${field}`}
        rows={rows}
        value={form[field] ?? ''}
        onChange={(e) => set(field, e.target.value)}
        className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
      />
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] tracking-tight flex items-center gap-3">
            <div className="p-2 bg-[#0D0F11] rounded-xl shadow-card border border-white/10">
              <ShieldAlert className="w-5 h-5 text-[#C9A227]" aria-hidden="true" />
            </div>
            {dpia.title}
          </h1>
          <p className="text-[13px] text-[#6E747A] mt-2">
            {t(`status_${dpia.status}` as any)}
            {data.template ? ` · ${data.template.title}` : ''}
          </p>
        </div>

        <div className="text-right">
          <div className="text-[11.5px] text-[#6E747A]">{t('residual_risk')}</div>
          <div className="text-[14px] font-medium text-[#F4F5F6]">
            {data.levels.residual ? tRopa(`risk_levels.${data.levels.residual}` as any) : '—'}
          </div>
          {data.levels.requiresPriorConsultation ? (
            <div className="mt-1 text-[11.5px] text-clay-600 flex items-center gap-1 justify-end">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              {t('needs_prior_consultation')}
            </div>
          ) : null}
        </div>
      </div>

      {/* 35(7)(a) */}
      <section className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('s_description')}</h2>
        <Text field="processingDescription" label={t('f_processing_description')} hint={t('f_processing_description_hint')} rows={5} />
        <Text field="purposes" label={t('f_purposes')} />
        <Text field="scopeDescription" label={t('f_scope')} />
        <Text field="contextDescription" label={t('f_context')} />
        <Text field="legitimateInterestPursued" label={t('f_legitimate_interest')} rows={2} />
        <Text field="dataFlowDescription" label={t('f_data_flow')} />
      </section>

      {/* 35(7)(b) */}
      <section className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('s_necessity')}</h2>
        <Text field="necessityAssessment" label={t('f_necessity')} rows={5} />
        <Text field="proportionalityAssessment" label={t('f_proportionality')} rows={5} />
      </section>

      {/* 35(7)(c)+(d) — the matrix */}
      <section className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-ink-900/8 pb-3">
          <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('s_risks')}</h2>
          <button
            type="button"
            onClick={() => call(() => riskCreate.mutateAsync({ dpiaId, description: t('new_risk'), likelihood: 2, severity: 2 }), t('save_failed'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] text-[#E6E8EA] hover:border-white/20"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {t('add_risk')}
          </button>
        </div>

        <p className="text-[11.5px] text-[#6E747A]">{t('matrix_hint')}</p>

        {data.risks.length === 0 ? (
          <p className="text-[12.5px] text-[#6E747A]">{t('no_risks')}</p>
        ) : (
          <div className="space-y-3">
            {data.risks.map((risk: any) => (
              <div key={risk.id} className="rounded-xl border border-white/10 bg-[#0D0F11] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <textarea
                    rows={2}
                    defaultValue={risk.description}
                    aria-label={t('f_risk_description')}
                    onBlur={(e) =>
                      e.target.value !== risk.description
                      && call(() => riskUpdate.mutateAsync({ id: risk.id, data: { description: e.target.value } }), t('save_failed'))
                    }
                    className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                  />
                  <button
                    type="button"
                    aria-label={t('delete_risk')}
                    onClick={() => call(() => riskDelete.mutateAsync({ id: risk.id }), t('save_failed'))}
                    className="p-2 text-[#6E747A] hover:text-clay-600"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  {([
                    ['likelihood', t('f_likelihood')],
                    ['severity', t('f_severity')],
                    ['residualLikelihood', t('f_residual_likelihood')],
                    ['residualSeverity', t('f_residual_severity')],
                  ] as const).map(([field, label]) => (
                    <div key={field}>
                      <label htmlFor={`risk-${risk.id}-${field}`} className="text-[11.5px] text-[#9BA1A6]">{label}</label>
                      <select
                        id={`risk-${risk.id}-${field}`}
                        value={String(risk[field] ?? '')}
                        onChange={(e) =>
                          call(
                            () => riskUpdate.mutateAsync({ id: risk.id, data: { [field]: Number(e.target.value) } as any }),
                            t('save_failed'),
                          )
                        }
                        className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-2 py-1.5 text-[12.5px] text-[#F4F5F6]"
                      >
                        <option value="">—</option>
                        {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
                  <span className="text-[#9BA1A6]">
                    {t('band_initial')}: <span className="text-[#F4F5F6]">{risk.band ? tRopa(`risk_levels.${risk.band}` as any) : '—'}</span>
                  </span>
                  <span className="text-[#9BA1A6]">
                    {t('band_residual')}: <span className="text-[#F4F5F6]">{risk.residualBand ? tRopa(`risk_levels.${risk.residualBand}` as any) : '—'}</span>
                  </span>
                </div>

                {risk.measures.length > 0 ? (
                  <ul className="space-y-1 border-t border-white/5 pt-2">
                    {risk.measures.map((measure: any) => (
                      <li key={measure.id} className="text-[12px] text-[#9BA1A6]">
                        {measure.description}
                        {measure.measureType ? <span className="text-[#6E747A]"> · {measure.measureType}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11.5px] text-amber-400 border-t border-white/5 pt-2">{t('no_measures')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 35(2) */}
      <section className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('s_dpo')}</h2>
        {dpia.dpoConsulted ? (
          <div className="space-y-1.5">
            <p className="text-[12.5px] text-[#F4F5F6] whitespace-pre-wrap">{dpia.dpoOpinion}</p>
            <p className="text-[11.5px] text-[#6E747A]">
              {t(`dpo_outcome_${dpia.dpoOpinionOutcome}` as any)}
              {dpia.dpoOpinionAt ? ` · ${new Date(dpia.dpoOpinionAt).toLocaleDateString()}` : ''}
            </p>
            {dpia.dpoAdviceFollowed === false ? (
              <p className="text-[12px] text-amber-400">
                {t('dpo_departed')}: {dpia.dpoAdviceDepartureReason}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11.5px] text-[#6E747A]">{t('s_dpo_hint')}</p>
            <textarea
              rows={4}
              aria-label={t('f_dpo_opinion')}
              value={opinion.opinion}
              onChange={(e) => setOpinion((o) => ({ ...o, opinion: e.target.value }))}
              className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="dpo-outcome" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_dpo_outcome')}</label>
                <select
                  id="dpo-outcome"
                  value={opinion.outcome}
                  onChange={(e) => setOpinion((o) => ({ ...o, outcome: e.target.value }))}
                  className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                >
                  <option value="approve">{t('dpo_outcome_approve')}</option>
                  <option value="approve_with_conditions">{t('dpo_outcome_approve_with_conditions')}</option>
                  <option value="object">{t('dpo_outcome_object')}</option>
                </select>
              </div>
              <label className="flex items-end gap-2 text-[12.5px] text-[#E6E8EA] pb-2">
                <input
                  type="checkbox"
                  checked={opinion.adviceFollowed}
                  onChange={(e) => setOpinion((o) => ({ ...o, adviceFollowed: e.target.checked }))}
                  className="accent-[#C9A227]"
                />
                {t('f_dpo_advice_followed')}
              </label>
            </div>
            {!opinion.adviceFollowed ? (
              <div>
                <label htmlFor="dpo-departure" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_dpo_departure')}</label>
                <textarea
                  id="dpo-departure"
                  rows={2}
                  value={opinion.departureReason}
                  onChange={(e) => setOpinion((o) => ({ ...o, departureReason: e.target.value }))}
                  className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={opinion.opinion.trim().length < 10 || dpoOpinion.isPending}
              onClick={() =>
                call(
                  () => dpoOpinion.mutateAsync({
                    id: dpiaId,
                    opinion: opinion.opinion,
                    outcome: opinion.outcome as any,
                    adviceFollowed: opinion.adviceFollowed,
                    departureReason: opinion.departureReason || null,
                  }),
                  t('save_failed'),
                )
              }
              className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
            >
              {t('record_dpo_opinion')}
            </button>
          </div>
        )}
      </section>

      {/* 35(9) */}
      <section className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('s_consultation')}</h2>
        {dpia.consultationAt ? (
          <div className="space-y-1.5">
            <p className="text-[12.5px] text-[#F4F5F6] whitespace-pre-wrap">
              {dpia.consultationSought ? dpia.consultationSummary : dpia.consultationNotSoughtReason}
            </p>
            <p className="text-[11.5px] text-[#6E747A]">
              {dpia.consultationSought ? t('consultation_sought') : t('consultation_not_sought')}
              {dpia.consultationMethod ? ` · ${dpia.consultationMethod}` : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11.5px] text-[#6E747A]">{t('s_consultation_hint')}</p>
            <label className="flex items-center gap-2 text-[12.5px] text-[#E6E8EA]">
              <input
                type="checkbox"
                checked={views.sought}
                onChange={(e) => setViews((v) => ({ ...v, sought: e.target.checked }))}
                className="accent-[#C9A227]"
              />
              {t('f_consultation_sought')}
            </label>

            {views.sought ? (
              <>
                <div>
                  <label htmlFor="consult-method" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_consultation_method')}</label>
                  <select
                    id="consult-method"
                    value={views.method}
                    onChange={(e) => setViews((v) => ({ ...v, method: e.target.value }))}
                    className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                  >
                    <option value="">—</option>
                    {['survey', 'focus_group', 'representative_body', 'works_council', 'public_consultation', 'existing_research'].map((m) => (
                      <option key={m} value={m}>{t(`consultation_method_${m}` as any)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="consult-summary" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_consultation_summary')}</label>
                  <textarea
                    id="consult-summary"
                    rows={3}
                    value={views.summary}
                    onChange={(e) => setViews((v) => ({ ...v, summary: e.target.value }))}
                    className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="consult-reason" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_consultation_not_sought')}</label>
                <textarea
                  id="consult-reason"
                  rows={3}
                  value={views.notSoughtReason}
                  onChange={(e) => setViews((v) => ({ ...v, notSoughtReason: e.target.value }))}
                  className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                />
              </div>
            )}

            <button
              type="button"
              disabled={consultation.isPending}
              onClick={() =>
                call(
                  () => consultation.mutateAsync({
                    id: dpiaId,
                    sought: views.sought,
                    method: (views.method || null) as any,
                    summary: views.summary || null,
                    notSoughtReason: views.notSoughtReason || null,
                  }),
                  t('save_failed'),
                )
              }
              className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
            >
              {t('record_consultation')}
            </button>
          </div>
        )}
      </section>

      {/* Sign-off */}
      <section className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] border-b border-ink-900/8 pb-3">{t('s_sign_off')}</h2>
        {isSignedOff ? (
          <div className="space-y-1.5">
            <p className="text-[12.5px] text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t(`sign_off_${dpia.signOffDecision}` as any)} · {new Date(dpia.signedOffAt!).toLocaleDateString()}
            </p>
            {dpia.signOffConditions ? (
              <p className="text-[12.5px] text-[#9BA1A6] whitespace-pre-wrap">{dpia.signOffConditions}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11.5px] text-[#6E747A]">{t('s_sign_off_hint')}</p>
            <div>
              <label htmlFor="signoff-decision" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_sign_off_decision')}</label>
              <select
                id="signoff-decision"
                value={decision.decision}
                onChange={(e) => setDecision((d) => ({ ...d, decision: e.target.value }))}
                className="mt-1 w-full max-w-md bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
              >
                <option value="proceed">{t('sign_off_proceed')}</option>
                <option value="proceed_with_conditions">{t('sign_off_proceed_with_conditions')}</option>
                <option value="do_not_proceed">{t('sign_off_do_not_proceed')}</option>
              </select>
            </div>
            {decision.decision === 'proceed_with_conditions' ? (
              <div>
                <label htmlFor="signoff-conditions" className="text-[12.5px] font-medium text-[#E6E8EA]">{t('f_sign_off_conditions')}</label>
                <textarea
                  id="signoff-conditions"
                  rows={3}
                  value={decision.conditions}
                  onChange={(e) => setDecision((d) => ({ ...d, conditions: e.target.value }))}
                  className="mt-1 w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#F4F5F6]"
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={signOff.isPending || dirty}
              onClick={() =>
                call(
                  () => signOff.mutateAsync({
                    id: dpiaId,
                    decision: decision.decision as any,
                    conditions: decision.conditions || null,
                  }),
                  t('sign_off_blocked'),
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40"
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              {t('sign_off')}
            </button>
          </div>
        )}
      </section>

      {data.versions.length > 0 ? (
        <section className="bg-[#08090A] hairline rounded-2xl p-6">
          <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-3">{t('s_versions')}</h2>
          <p className="text-[11.5px] text-[#6E747A] mb-3">{t('s_versions_hint')}</p>
          <ul className="space-y-2">
            {data.versions.map((version: any) => (
              <li key={version.id} className="text-[12px] text-[#9BA1A6] flex flex-wrap gap-x-3">
                <span className="text-[#E6E8EA]">v{version.version}</span>
                <span>{t(`version_reason_${version.reason}` as any)}</span>
                <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                {version.contentHash ? (
                  <span className="font-mono text-[11px] text-[#6E747A]">{version.contentHash.slice(0, 12)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="sticky bottom-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          className="rounded-lg bg-[#C9A227] px-5 py-2.5 text-[13px] font-medium text-[#0D0F11] hover:bg-[#D8B23A] disabled:opacity-40 shadow-card"
        >
          {updateMutation.isPending ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
