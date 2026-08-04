"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FieldError } from '@/components/ui/FieldError';
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck, Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const tiaSchema = z.object({
  transferMechanism: z.string().min(1, 'Transfer mechanism is required'),
  destinationCountry: z.string().length(2, 'Must be a 2-letter country code'),
  surveillanceLawsExist: z.boolean().nullable(),
  effectiveRemediesExist: z.boolean().nullable(),
  legalAssessmentConclusion: z.string().optional(),
  independentDpaExists: z.boolean().optional(),
  residualRiskLevel: z.string().optional(),
  residualRiskJustification: z.string().optional(),
  conditions: z.string().optional(),
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
  const [step, setStep] = useState(1);
  const { data: tia, isLoading } = trpc.tia.getForVendor.useQuery({ vendorId });
  const saveMutation = trpc.tia.save.useMutation();
  const exportMutation = trpc.tia.exportPdf.useMutation();
  const utils = trpc.useUtils();

  // Form state
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    resolver: zodResolver(tiaSchema),
    defaultValues: {
      transferMechanism: '',
      destinationCountry: 'US',
      surveillanceLawsExist: null,
      effectiveRemediesExist: null,
      technicalMeasures: [
        { id: 'e2ee', label: 'End-to-End Encryption', implemented: false, detail: '' },
        { id: 'pseudonymisation', label: 'Pseudonymisation', implemented: false, detail: '' },
        { id: 'data_minimisation', label: 'Data Minimisation in Transit', implemented: false, detail: '' }
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
      }));
    }
  }, [tia]); // Only run when tia loads

  const handleSave = async (status: string) => {
    await saveMutation.mutateAsync({
      vendorId,
      id: tia?.id,
      ...formData,
      status,
    });
    utils.tia.getForVendor.invalidate({ vendorId });
  };

  const handleExport = async () => {
    if (!tia) return;
    const res = await exportMutation.mutateAsync({ tiaId: tia.id });
    window.open(res.url, '_blank');
  };

  if (isLoading) return <div className="p-8 text-[#6E747A]">Loading TIA...</div>;

  const isUS = formData.destinationCountry === 'US';
  const requiresMeasures = formData.legalAssessmentConclusion === 'not_equivalent' || formData.legalAssessmentConclusion === 'uncertain';

  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl overflow-hidden shadow-panel-elevated flex flex-col md:flex-row min-h-[600px]">
      {/* Sidebar Wizard Steps */}
      <div className="w-full md:w-64 bg-[#08090A] border-r border-white/10 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#F4F5F6] mb-4">Schrems II Process</h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {[
              { id: 1, name: 'Transfer Details' },
              { id: 2, name: 'Legal Assessment' },
              { id: 3, name: 'Supplementary Measures' },
              { id: 4, name: 'Residual Risk' },
              { id: 5, name: 'Conclusion' }
            ].map((s) => (
              <Button
                variant="ghost" 
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-full flex items-center justify-start gap-3 p-2 h-auto rounded-xl transition-colors relative z-10 ${step === s.id ? 'bg-[#0D0F11] shadow-panel-elevated border border-white/10 text-[#C9A227] hover:bg-[#0D0F11] hover:text-[#C9A227]' : 'text-[#6E747A] hover:bg-white/5 hover:text-[#F4F5F6]'}`}
              >
                <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${step === s.id ? 'bg-sage-600 text-white' : 'bg-white/10 text-[#6E747A]'}`}>
                  {tia?.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-[#C9A227] bg-[#0D0F11] rounded-full" /> : s.id}
                </div>
                <span className="text-sm font-medium text-left">{s.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {tia?.status === 'completed' && (
          <div className="pt-6 border-t border-white/10">
            <div className="bg-[#C9A227]/10 text-sage-800 p-4 rounded-xl border border-[#C9A227]/30 text-sm">
              <ShieldCheck className="w-5 h-5 mb-2 text-[#C9A227]" />
              <div className="font-bold mb-1">TIA Completed</div>
              <div className="text-xs opacity-80 mb-3">Approved on {format(new Date(tia.approvedAt!), 'MMM d, yyyy')}</div>
              <Button 
                variant="outline"
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-[#0D0F11] border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#C9A227]/20 transition-colors"
              >
                <Download className="w-4 h-4" /> Export PDF
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">Step 1: Transfer Details</h2>
            <p className="text-sm text-[#9BA1A6]">Identify the specific parameters of the international data transfer.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1">Destination Country</label>
                <Input 
                  type="text" 
                  maxLength={2}
                  className="w-full max-w-xs uppercase"
                  value={formData.destinationCountry}
                  onChange={e => setFormData({...formData, destinationCountry: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1">Transfer Mechanism</label>
                <div className="w-full max-w-xs">
                  <Select 
                    value={formData.transferMechanism || 'sccs'}
                    onValueChange={val => setFormData({...formData, transferMechanism: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transfer mechanism" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sccs">Standard Contractual Clauses (SCCs)</SelectItem>
                      <SelectItem value="bcrs">Binding Corporate Rules (BCRs)</SelectItem>
                      <SelectItem value="derogation">Article 49 Derogation</SelectItem>
                      <SelectItem value="adequacy">Adequacy Decision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {isUS && (
              <div className="bg-amber-500/10 border border-amber-900/50 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <strong>US Context:</strong> Since the invalidation of the Privacy Shield, transfers to the US using SCCs require a TIA to assess risks associated with FISA 702 and EO 12333.
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">Step 2: Legal Assessment</h2>
            <p className="text-sm text-[#9BA1A6]">Assess the laws and practices of the third country applicable to the transferred data.</p>
            
            <div className="space-y-6">
              <div className="bg-[#08090A] p-5 rounded-xl border border-white/10 space-y-4">
                <div>
                  <div className="font-medium text-sm text-[#F4F5F6] mb-2">Are there surveillance laws that compel access to the data?</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="true" {...register('surveillanceLawsExist')} className="text-[#C9A227]" /> Yes</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="false" {...register('surveillanceLawsExist')} className="text-[#C9A227]" /> No</label>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm text-[#F4F5F6] mb-2">Are there effective, enforceable legal remedies for data subjects?</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="true" {...register('effectiveRemediesExist')} className="text-[#C9A227]" /> Yes</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" value="false" {...register('effectiveRemediesExist')} className="text-[#C9A227]" /> No</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-2">Conclusion of Legal Assessment</label>
                <Select 
                  value={formData.legalAssessmentConclusion || 'none'}
                  onValueChange={val => setFormData({...formData, legalAssessmentConclusion: val === 'none' ? '' : val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select conclusion..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select conclusion...</SelectItem>
                    <SelectItem value="equivalent">Laws provide essentially equivalent protection (No supplementary measures needed)</SelectItem>
                    <SelectItem value="not_equivalent">Laws do not provide essentially equivalent protection</SelectItem>
                    <SelectItem value="uncertain">Uncertain / Problematic legislation exists</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">Step 3: Supplementary Measures</h2>
            {!requiresMeasures ? (
              <div className="bg-[#C9A227]/10 text-sage-800 p-6 rounded-xl border border-[#C9A227]/30 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-sage-500" />
                <p>Based on Step 2, supplementary measures are not strictly required. You can skip to Conclusion.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-sm text-[#9BA1A6]">Identify the supplementary measures implemented by the data importer to mitigate risks.</p>
                
                {/* Technical Measures */}
                <div>
                  <h4 className="font-medium text-[#F4F5F6] mb-3 border-b border-white/10 pb-2">Technical Measures</h4>
                  <div className="space-y-3">
                    {formData.technicalMeasures.map((m: any, i: number) => (
                      <div key={m.measure} className="flex gap-4 items-start bg-[#08090A] p-3 rounded-lg border border-white/5">
                        <input type="checkbox" checked={m.implemented} onChange={e => {
                          const newM = [...formData.technicalMeasures];
                          newM[i].implemented = e.target.checked;
                          setFormData({...formData, technicalMeasures: newM});
                        }} className="mt-1 text-[#C9A227] rounded" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{m.label}</div>
                          {m.implemented && (
                            <Input type="text" placeholder="Details..." className="w-full mt-2 text-xs" {...register(`technicalMeasures.${i}.detail` as const)} />
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
            <h2 className="text-2xl font-serif text-[#F4F5F6]">Step 4: Residual Risk</h2>
            <p className="text-sm text-[#9BA1A6]">Assess the risk level after applying all supplementary measures.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-2">Residual Risk Level</label>
                <div className="flex gap-3">
                  {['low', 'medium', 'high', 'critical'].map(level => (
                    <Button 
                      key={level}
                      variant="outline"
                      onClick={() => setFormData({...formData, residualRiskLevel: level})}
                      className={`uppercase tracking-wider transition-all ${formData.residualRiskLevel === level ? 'bg-ink-900 text-white border-ink-900 hover:bg-ink-900 hover:text-white' : 'bg-[#0D0F11] text-[#6E747A] border-white/20 hover:border-white/50 hover:bg-[#0D0F11] hover:text-[#6E747A]'}`}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1">Justification</label>
                <Textarea 
                  placeholder="Explain why the residual risk is acceptable or unacceptable..."
                  value={formData.residualRiskJustification}
                  onChange={e => setFormData({...formData, residualRiskJustification: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-[#F4F5F6]">Step 5: Conclusion</h2>
            
            <div className="bg-[#08090A] p-6 rounded-xl border border-white/10 space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-3">Final Decision</label>
                <div className="space-y-2">
                  {[
                    { value: 'proceed', label: 'Proceed with Transfer', color: 'text-[#C9A227]' },
                    { value: 'proceed_with_conditions', label: 'Proceed with Conditions', color: 'text-amber-400' },
                    { value: 'suspend', label: 'Suspend Transfer', color: 'text-red-400' }
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${formData.conclusion === opt.value ? 'bg-[#0D0F11] border-sage-500 shadow-panel-elevated' : 'bg-[#0D0F11]/50 border-white/10 hover:bg-[#0D0F11]'}`}>
                      <input 
                        type="radio" 
                        name="conclusion" 
                        checked={formData.conclusion === opt.value} 
                        onChange={() => setFormData({...formData, conclusion: opt.value})}
                        className="text-[#C9A227] focus:ring-sage-500"
                      />
                      <span className={`font-medium ${opt.color}`}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {formData.conclusion === 'proceed_with_conditions' && (
                <div>
                  <label className="block text-sm font-medium text-[#F4F5F6] mb-1">Specify Conditions</label>
                  <Textarea 
                    value={formData.conditions}
                    onChange={e => setFormData({...formData, conditions: e.target.value})}
                  />
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
              <Button 
                variant="outline"
                onClick={() => handleSave('draft')}
                className="bg-[#08090A] border-white/10 hover:bg-white/5"
              >
                Save Draft
              </Button>
              <Button 
                onClick={() => handleSave('completed')}
                disabled={!formData.conclusion}
              >
                Approve & Complete TIA
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
            ← Previous Step
          </Button>
          <Button 
            disabled={step === 5}
            onClick={() => setStep(step + 1)}
            className={`${step === 5 ? 'hidden' : ''}`}
          >
            Next Step →
          </Button>
        </div>
      </div>
    </div>
  );
}
