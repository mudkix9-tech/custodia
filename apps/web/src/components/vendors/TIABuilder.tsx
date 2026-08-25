"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FieldError } from '@/components/ui/FieldError';
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

const tiaSchema = z.object({
  transferMechanism: z.string().min(1, 'Transfer mechanism is required'),
  destinationCountry: z.string().length(2, 'Must be a 2-letter country code'),
  // Step 1 — know your transfer (EDPB Recommendations 01/2020).
  dataExporter: z.string().optional(),
  dataImporter: z.string().optional(),
  transferPurpose: z.string().optional(),
  dataSubjectCategories: z.array(z.string()).optional(),
  transferFrequency: z.string().optional(),
  onwardTransfers: z.string().optional(),
  surveillanceLawsExist: z.boolean().nullable(),
  effectiveRemediesExist: z.boolean().nullable(),
  legalAssessmentConclusion: z.string().optional(),
  independentDpaExists: z.boolean().optional(),
  residualRiskLevel: z.string().optional(),
  residualRiskJustification: z.string().optional(),
  conditions: z.string().optional(),
  reevaluationIntervalMonths: z.string().optional(),
  reevaluationTriggers: z.string().optional(),
  technicalMeasures: z.array(z.object({
    id: z.string(),
    label: z.string(),
    implemented: z.boolean(),
    detail: z.string()
  })),
  organizationalMeasures: z.array(z.any()).optional(),
  contractualMeasures: z.array(z.any()).optional(),
  conclusion: z.enum(['proceed', 'proceed_with_conditions', 'suspend']).optional(),
  conclusionNotes: z.string().optional()
});

export function TIABuilder({ vendorId, defaultCountry }: { vendorId: string, defaultCountry?: string }) {
  const t = useTranslations('vendors.tia');
  const [step, setStep] = useState(1);
  const { data: tia, isLoading } = trpc.tia.getForVendor.useQuery({ vendorId });
  const saveMutation = trpc.tia.save.useMutation();
  const exportMutation = trpc.tia.exportPdf.useMutation({
    onSuccess: ({ pdfData, filename }) => {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfData}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onError: () => setExportError(true),
  });
  const [exportError, setExportError] = useState(false);
  const utils = trpc.useUtils();

  // Form state
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    resolver: zodResolver(tiaSchema),
    defaultValues: {
      transferMechanism: '',
      destinationCountry: 'US',
      dataExporter: '',
      dataImporter: '',
      transferPurpose: '',
      dataSubjectCategories: [] as string[],
      transferFrequency: 'occasional',
      onwardTransfers: '',
      surveillanceLawsExist: null,
      effectiveRemediesExist: null,
      reevaluationIntervalMonths: '',
      reevaluationTriggers: '',
      technicalMeasures: [
        { id: 'e2ee', label: '', implemented: false, detail: '' },
        { id: 'pseudonymisation', label: '', implemented: false, detail: '' },
        { id: 'data_minimisation', label: '', implemented: false, detail: '' }
      ],
      conclusion: 'proceed_with_conditions',
      conclusionNotes: ''
    }
  });
  const formData = watch();

  const setFormData = (updater: any) => {
    if (typeof updater === 'function') {
      const newState = updater(formData);
      Object.keys(newState).forEach(key => setValue(key as any, newState[key]));
    } else {
      Object.keys(updater).forEach(key => setValue(key as any, updater[key]));
    }
  };

  useEffect(() => {
    if (tia && !formData.destinationCountry) {
      setFormData((prev: any) => ({
        ...prev,
        destinationCountry: tia.destinationCountry,
        transferMechanism: tia.transferMechanism,
        dataExporter: tia.dataExporter ?? '',
        dataImporter: tia.dataImporter ?? '',
        transferPurpose: tia.transferPurpose ?? '',
        dataSubjectCategories: Array.isArray(tia.dataSubjectCategories) ? tia.dataSubjectCategories : [],
        transferFrequency: tia.transferFrequency ?? 'occasional',
        onwardTransfers: tia.onwardTransfers ?? '',
        surveillanceLawsExist: tia.surveillanceLawsExist,
        independentDpaExists: tia.independentDpaExists,
        effectiveRemediesExist: tia.effectiveRemediesExist,
        legalAssessmentConclusion: tia.legalAssessmentConclusion,
        technicalMeasures: Array.isArray(tia.technicalMeasures) && tia.technicalMeasures.length > 0 ? tia.technicalMeasures : prev.technicalMeasures,
        organizationalMeasures: Array.isArray(tia.organizationalMeasures) && tia.organizationalMeasures.length > 0 ? tia.organizationalMeasures : prev.organizationalMeasures,
        contractualMeasures: Array.isArray(tia.contractualMeasures) && tia.contractualMeasures.length > 0 ? tia.contractualMeasures : prev.contractualMeasures,
        residualRiskLevel: tia.residualRiskLevel,
        residualRiskJustification: tia.residualRiskJustification,
        conclusion: tia.conclusion,
        reevaluationIntervalMonths: tia.reevaluationIntervalMonths ? String(tia.reevaluationIntervalMonths) : '',
        reevaluationTriggers: tia.reevaluationTriggers ?? '',
      }));
    }
  }, [tia]); // Only run when tia loads

  const handleSave = async (status: string) => {
    await saveMutation.mutateAsync({
      vendorId,
      id: tia?.id,
      ...formData,
      // The API takes a number; the form holds the interval as a string.
      reevaluationIntervalMonths: formData.reevaluationIntervalMonths
        ? Number(formData.reevaluationIntervalMonths)
        : null,
      status,
    });
    utils.tia.getForVendor.invalidate({ vendorId });
  };

  const handleExport = () => {
    setExportError(false);
    exportMutation.mutate({ vendorId });
  };

  if (isLoading) return <div className="p-8 text-[#6E747A]">{t('loading')}</div>;

  const isUS = formData.destinationCountry === 'US';
  const requiresMeasures = formData.legalAssessmentConclusion === 'not_equivalent' || formData.legalAssessmentConclusion === 'uncertain';

  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl overflow-hidden shadow-panel-elevated flex flex-col md:flex-row min-h-[600px]">
      {/* Sidebar Wizard Steps */}
      <div className="w-full md:w-64 bg-[#08090A] border-r border-white/10 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#F4F5F6] mb-4">{t('process')}</h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {[
              { id: 1, name: t('steps.1') },
              { id: 2, name: t('steps.2') },
              { id: 3, name: t('steps.3') },
              { id: 4, name: t('steps.4') },
              { id: 5, name: t('steps.5') }
            ].map((s) => (
              <Button
                variant="ghost" 
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-full flex items-center justify-start gap-3 p-2 h-auto rounded-xl transition-colors relative z-10 ${step === s.id ? 'bg-[#0D0F11] shadow-panel-elevated border border-white/10 text-[#C9A227] hover:bg-[#0D0F11] hover:text-[#C9A227]' : 'text-[#6E747A] hover:bg-white/5 hover:text-[#F4F5F6]'}`}
              >
                <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${step === s.id ? 'bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A]' : 'bg-white/10 text-[#6E747A]'}`}>
                  {tia?.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-[#C9A227] bg-[#0D0F11] rounded-full" /> : s.id}
                </div>
                <span className="text-sm font-medium text-left">{s.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {tia?.status === 'completed' && (
          <div className="pt-6 border-t border-white/10 space-y-3">
            <div className="bg-[#C9A227]/10 text-[#C9A227] p-4 rounded-xl border border-[#C9A227]/30 text-sm">
              <ShieldCheck className="w-5 h-5 mb-2 text-[#C9A227]" />
              <div className="font-bold mb-1">{t('completed')}</div>
              <div className="text-xs opacity-80">{t('approved_on', { when: format(new Date(tia.approvedAt!), 'MMM d, yyyy') })}</div>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="w-full bg-[#0D0F11] border-white/10 hover:bg-white/5 text-[#E6E8EA]"
            >
              <FileText className="w-4 h-4 mr-2" />
              {exportMutation.isPending ? t('exporting') : t('export_pdf')}
            </Button>
            {exportError && (
              <p className="text-xs text-red-400">{t('export_failed')}</p>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">{t('step1.title')}</h2>
            <p className="text-sm text-[#9BA1A6]">{t('step1.subtitle')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.destination')}</label>
                <Input 
                  type="text" 
                  maxLength={2}
                  className="w-full max-w-xs uppercase"
                  value={formData.destinationCountry}
                  onChange={e => setFormData({...formData, destinationCountry: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.mechanism')}</label>
                <div className="w-full max-w-xs">
                  <Select 
                    value={formData.transferMechanism || 'sccs'}
                    onValueChange={val => setFormData({...formData, transferMechanism: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('step1.mechanism_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sccs">{t('mechanisms.sccs')}</SelectItem>
                      <SelectItem value="bcrs">{t('mechanisms.bcrs')}</SelectItem>
                      <SelectItem value="derogation">{t('mechanisms.derogation')}</SelectItem>
                      <SelectItem value="adequacy">{t('mechanisms.adequacy')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* D25 -- Step 1 "know your transfer". The schema carried these
                  fields; the wizard never asked for them, so the saved TIA
                  assessed a transfer it could not describe. */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-white/10 mt-2">
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.exporter')}</label>
                  <Input
                    type="text"
                    value={formData.dataExporter}
                    onChange={e => setFormData({ ...formData, dataExporter: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.importer')}</label>
                  <Input
                    type="text"
                    value={formData.dataImporter}
                    onChange={e => setFormData({ ...formData, dataImporter: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.purpose')}</label>
                  <Textarea
                    value={formData.transferPurpose}
                    onChange={e => setFormData({ ...formData, transferPurpose: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.frequency')}</label>
                  <Select
                    value={formData.transferFrequency || 'occasional'}
                    onValueChange={val => setFormData({ ...formData, transferFrequency: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_off">{t('step1.frequency_one_off')}</SelectItem>
                      <SelectItem value="occasional">{t('step1.frequency_occasional')}</SelectItem>
                      <SelectItem value="continuous">{t('step1.frequency_continuous')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step1.onward')}</label>
                  <Input
                    type="text"
                    value={formData.onwardTransfers}
                    onChange={e => setFormData({ ...formData, onwardTransfers: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {isUS && (
              <div className="bg-amber-500/10 border border-amber-900/50 rounded-xl p-4 flex gap-3 text-sm text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <strong>{t('step1.us_context_label')}</strong> {t('step1.us_context')}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">{t('step2.title')}</h2>
            <p className="text-sm text-[#9BA1A6]">{t('step2.subtitle')}</p>
            
            <div className="space-y-6">
              <div className="bg-[#08090A] p-5 rounded-xl border border-white/10 space-y-4">
                <div>
                  <div className="font-medium text-sm text-[#F4F5F6] mb-2">{t('step2.surveillance')}</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="true" {...register('surveillanceLawsExist')} className="text-[#C9A227]" /> {t('yes')}</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="false" {...register('surveillanceLawsExist')} className="text-[#C9A227]" /> {t('no')}</label>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm text-[#F4F5F6] mb-2">{t('step2.remedies')}</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="true" {...register('effectiveRemediesExist')} className="text-[#C9A227]" /> {t('yes')}</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="false" {...register('effectiveRemediesExist')} className="text-[#C9A227]" /> {t('no')}</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-2">{t('step2.conclusion')}</label>
                <Select 
                  value={formData.legalAssessmentConclusion || 'none'}
                  onValueChange={val => setFormData({...formData, legalAssessmentConclusion: val === 'none' ? '' : val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('step2.select_conclusion')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>{t('step2.select_conclusion')}</SelectItem>
                    <SelectItem value="equivalent">{t('step2.equivalent')}</SelectItem>
                    <SelectItem value="not_equivalent">{t('step2.not_equivalent')}</SelectItem>
                    <SelectItem value="uncertain">{t('step2.uncertain')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">{t('step3.title')}</h2>
            {!requiresMeasures ? (
              <div className="bg-[#C9A227]/10 text-[#C9A227] p-6 rounded-xl border border-[#C9A227]/30 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-sage-500" />
                <p>{t('step3.not_required')}</p>
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-sm text-[#9BA1A6]">{t('step3.subtitle')}</p>
                
                {/* Technical Measures */}
                <div>
                  <h4 className="font-medium text-[#F4F5F6] mb-3 border-b border-white/10 pb-2">{t('step3.technical')}</h4>
                  <div className="space-y-3">
                    {formData.technicalMeasures.map((m: any, i: number) => (
                      <div key={m.measure} className="flex gap-4 items-start bg-[#08090A] p-3 rounded-lg border border-white/5">
                        <input type="checkbox" checked={m.implemented} onChange={e => {
                          const newM = [...formData.technicalMeasures];
                          newM[i].implemented = e.target.checked;
                          setFormData({...formData, technicalMeasures: newM});
                        }} className="mt-1 text-[#C9A227] rounded" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{t(`step3.measures.${m.id}`)}</div>
                          {m.implemented && (
                            <Input type="text" placeholder={t('step3.details_placeholder')} className="w-full mt-2 text-xs" {...register(`technicalMeasures.${i}.detail` as const)} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">{t('step4.title')}</h2>
            <p className="text-sm text-[#9BA1A6]">{t('step4.subtitle')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-2">{t('step4.level')}</label>
                <div className="flex gap-3">
                  {['low', 'medium', 'high', 'critical'].map(level => (
                    <Button 
                      key={level}
                      variant="outline"
                      onClick={() => setFormData({...formData, residualRiskLevel: level})}
                      className={`uppercase tracking-wider transition-all ${formData.residualRiskLevel === level ? 'bg-ink-900 text-white border-ink-900 hover:bg-ink-900 hover:text-white' : 'bg-[#0D0F11] text-[#6E747A] border-white/20 hover:border-white/50 hover:bg-[#0D0F11] hover:text-[#6E747A]'}`}
                    >
                      {t(`step4.levels.${level}`)}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step4.justification')}</label>
                <Textarea 
                  placeholder={t('step4.justification_placeholder')}
                  value={formData.residualRiskJustification}
                  onChange={e => setFormData({...formData, residualRiskJustification: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">{t('step5.title')}</h2>
            
            <div className="bg-[#08090A] p-6 rounded-xl border border-white/10 space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-3">{t('step5.decision')}</label>
                <div className="space-y-2">
                  {[
                    { value: 'proceed', label: t('step5.proceed'), color: 'text-[#C9A227]' },
                    { value: 'proceed_with_conditions', label: t('step5.proceed_with_conditions'), color: 'text-amber-400' },
                    { value: 'suspend', label: t('step5.suspend'), color: 'text-red-400' }
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${formData.conclusion === opt.value ? 'bg-[#0D0F11] border-[#C9A227]/50 shadow-panel-elevated' : 'bg-[#0D0F11]/50 border-white/10 hover:bg-[#0D0F11]'}`}>
                      <input 
                        type="radio" 
                        name="conclusion" 
                        checked={formData.conclusion === opt.value} 
                        onChange={() => setFormData({...formData, conclusion: opt.value})}
                        className="text-[#C9A227] focus:ring-[#C9A227]/40"
                      />
                      <span className={`font-medium ${opt.color}`}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {formData.conclusion === 'proceed_with_conditions' && (
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step5.conditions')}</label>
                  <Textarea 
                    value={formData.conditions}
                    onChange={e => setFormData({...formData, conditions: e.target.value})}
                  />
                </div>
              )}

              {/* Step 6 -- re-evaluation at appropriate intervals (D25). An
                  interval rather than a date: it survives the review being done
                  and the next one being scheduled from it. */}
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step6.interval')}</label>
                  <Select
                    value={formData.reevaluationIntervalMonths || 'unset'}
                    onValueChange={val => setFormData({ ...formData, reevaluationIntervalMonths: val === 'unset' ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('step6.interval_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">{t('step6.interval_unset')}</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                      <SelectItem value="24">24</SelectItem>
                      <SelectItem value="36">36</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">{t('step6.triggers')}</label>
                  <Input
                    type="text"
                    value={formData.reevaluationTriggers}
                    onChange={e => setFormData({ ...formData, reevaluationTriggers: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
              <Button 
                variant="outline"
                onClick={() => handleSave('draft')}
                className="bg-[#08090A] border-white/10 hover:bg-white/5"
              >
                {t('save_draft')}
              </Button>
              <Button 
                onClick={() => handleSave('completed')}
                disabled={!formData.conclusion}
              >
                {t('approve')}
              </Button>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
          <Button 
            variant="ghost"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="text-[#9BA1A6]"
          >
            {t('previous')}
          </Button>
          <Button 
            disabled={step === 5}
            onClick={() => setStep(step + 1)}
            className={`${step === 5 ? 'hidden' : ''}`}
          >
            {t('next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
