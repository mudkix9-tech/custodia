"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck, Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export function TIABuilder({ vendorId, defaultCountry }: { vendorId: string, defaultCountry?: string }) {
  const [step, setStep] = useState(1);
  const { data: tia, isLoading } = trpc.tia.getForVendor.useQuery({ vendorId });
  const saveMutation = trpc.tia.save.useMutation();
  const exportMutation = trpc.tia.exportPdf.useMutation();
  const utils = trpc.useUtils();

  // Form state
  const [formData, setFormData] = useState<any>({
    destinationCountry: defaultCountry || '',
    transferMechanism: 'sccs',
    surveillanceLawsExist: null,
    independentDpaExists: null,
    effectiveRemediesExist: null,
    legalAssessmentConclusion: '',
    technicalMeasures: [
      { measure: 'encryption_at_rest', label: 'Encryption at rest', implemented: false, detail: '' },
      { measure: 'encryption_in_transit', label: 'Encryption in transit', implemented: false, detail: '' },
    ],
    organizationalMeasures: [
      { measure: 'access_controls', label: 'Strict internal access controls', implemented: false, detail: '' },
      { measure: 'transparency', label: 'Transparency reporting on govt requests', implemented: false, detail: '' },
    ],
    contractualMeasures: [
      { measure: 'audit_rights', label: 'Enhanced audit rights', implemented: false, detail: '' },
      { measure: 'challenge_requests', label: 'Commitment to challenge govt requests', implemented: false, detail: '' },
    ],
    residualRiskLevel: '',
    residualRiskJustification: '',
    conclusion: '',
  });

  useEffect(() => {
    if (tia) {
      setFormData({
        ...formData,
        destinationCountry: tia.destinationCountry,
        transferMechanism: tia.transferMechanism,
        surveillanceLawsExist: tia.surveillanceLawsExist,
        independentDpaExists: tia.independentDpaExists,
        effectiveRemediesExist: tia.effectiveRemediesExist,
        legalAssessmentConclusion: tia.legalAssessmentConclusion,
        technicalMeasures: Array.isArray(tia.technicalMeasures) && tia.technicalMeasures.length > 0 ? tia.technicalMeasures : formData.technicalMeasures,
        organizationalMeasures: Array.isArray(tia.organizationalMeasures) && tia.organizationalMeasures.length > 0 ? tia.organizationalMeasures : formData.organizationalMeasures,
        contractualMeasures: Array.isArray(tia.contractualMeasures) && tia.contractualMeasures.length > 0 ? tia.contractualMeasures : formData.contractualMeasures,
        residualRiskLevel: tia.residualRiskLevel,
        residualRiskJustification: tia.residualRiskJustification,
        conclusion: tia.conclusion,
      });
    }
  }, [tia]);

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

  if (isLoading) return <div className="p-8 text-ink-500">Loading TIA...</div>;

  const isUS = formData.destinationCountry === 'US';
  const requiresMeasures = formData.legalAssessmentConclusion === 'not_equivalent' || formData.legalAssessmentConclusion === 'uncertain';

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[600px]">
      {/* Sidebar Wizard Steps */}
      <div className="w-full md:w-64 bg-bone-50 border-r border-ink-900/10 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-900 mb-4">Schrems II Process</h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {[
              { id: 1, name: 'Transfer Details' },
              { id: 2, name: 'Legal Assessment' },
              { id: 3, name: 'Supplementary Measures' },
              { id: 4, name: 'Residual Risk' },
              { id: 5, name: 'Conclusion' }
            ].map((s) => (
              <button 
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors relative z-10 ${step === s.id ? 'bg-white shadow-sm border border-ink-900/10 text-sage-700' : 'text-ink-500 hover:bg-bone-100 hover:text-ink-900'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.id ? 'bg-sage-600 text-white' : 'bg-bone-200 text-ink-500'}`}>
                  {tia?.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-sage-600 bg-white rounded-full" /> : s.id}
                </div>
                <span className="text-sm font-medium text-left">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {tia?.status === 'completed' && (
          <div className="pt-6 border-t border-ink-900/10">
            <div className="bg-sage-50 text-sage-800 p-4 rounded-xl border border-sage-200 text-sm">
              <ShieldCheck className="w-5 h-5 mb-2 text-sage-600" />
              <div className="font-bold mb-1">TIA Completed</div>
              <div className="text-xs opacity-80 mb-3">Approved on {format(new Date(tia.approvedAt!), 'MMM d, yyyy')}</div>
              <button 
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-white border border-sage-200 text-sage-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-sage-100 transition-colors"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-ink-900">Step 1: Transfer Details</h2>
            <p className="text-sm text-ink-600">Identify the specific parameters of the international data transfer.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1">Destination Country</label>
                <input 
                  type="text" 
                  maxLength={2}
                  className="w-full max-w-xs px-4 py-2 border border-ink-900/20 rounded-xl focus:border-sage-500 outline-none uppercase"
                  value={formData.destinationCountry}
                  onChange={e => setFormData({...formData, destinationCountry: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1">Transfer Mechanism</label>
                <select 
                  className="w-full max-w-xs px-4 py-2 border border-ink-900/20 rounded-xl focus:border-sage-500 outline-none"
                  value={formData.transferMechanism}
                  onChange={e => setFormData({...formData, transferMechanism: e.target.value})}
                >
                  <option value="sccs">Standard Contractual Clauses (SCCs)</option>
                  <option value="bcrs">Binding Corporate Rules (BCRs)</option>
                  <option value="derogation">Article 49 Derogation</option>
                  <option value="adequacy">Adequacy Decision</option>
                </select>
              </div>
            </div>

            {isUS && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
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
            <h2 className="text-2xl font-serif text-ink-900">Step 2: Legal Assessment</h2>
            <p className="text-sm text-ink-600">Assess the laws and practices of the third country applicable to the transferred data.</p>
            
            <div className="space-y-6">
              <div className="bg-bone-50 p-5 rounded-xl border border-ink-900/10 space-y-4">
                <div>
                  <div className="font-medium text-sm text-ink-900 mb-2">Are there surveillance laws that compel access to the data?</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.surveillanceLawsExist === true} onChange={() => setFormData({...formData, surveillanceLawsExist: true})} className="text-sage-600" /> Yes</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.surveillanceLawsExist === false} onChange={() => setFormData({...formData, surveillanceLawsExist: false})} className="text-sage-600" /> No</label>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-sm text-ink-900 mb-2">Are there effective, enforceable legal remedies for data subjects?</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.effectiveRemediesExist === true} onChange={() => setFormData({...formData, effectiveRemediesExist: true})} className="text-sage-600" /> Yes</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.effectiveRemediesExist === false} onChange={() => setFormData({...formData, effectiveRemediesExist: false})} className="text-sage-600" /> No</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">Conclusion of Legal Assessment</label>
                <select 
                  className="w-full px-4 py-2 border border-ink-900/20 rounded-xl focus:border-sage-500 outline-none"
                  value={formData.legalAssessmentConclusion}
                  onChange={e => setFormData({...formData, legalAssessmentConclusion: e.target.value})}
                >
                  <option value="">Select conclusion...</option>
                  <option value="equivalent">Laws provide essentially equivalent protection (No supplementary measures needed)</option>
                  <option value="not_equivalent">Laws do not provide essentially equivalent protection</option>
                  <option value="uncertain">Uncertain / Problematic legislation exists</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-ink-900">Step 3: Supplementary Measures</h2>
            {!requiresMeasures ? (
              <div className="bg-sage-50 text-sage-800 p-6 rounded-xl border border-sage-200 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-sage-500" />
                <p>Based on Step 2, supplementary measures are not strictly required. You can skip to Conclusion.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-sm text-ink-600">Identify the supplementary measures implemented by the data importer to mitigate risks.</p>
                
                {/* Technical Measures */}
                <div>
                  <h4 className="font-medium text-ink-900 mb-3 border-b border-ink-900/10 pb-2">Technical Measures</h4>
                  <div className="space-y-3">
                    {formData.technicalMeasures.map((m: any, i: number) => (
                      <div key={m.measure} className="flex gap-4 items-start bg-bone-50 p-3 rounded-lg border border-ink-900/5">
                        <input type="checkbox" checked={m.implemented} onChange={e => {
                          const newM = [...formData.technicalMeasures];
                          newM[i].implemented = e.target.checked;
                          setFormData({...formData, technicalMeasures: newM});
                        }} className="mt-1 text-sage-600 rounded" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{m.label}</div>
                          {m.implemented && (
                            <input type="text" placeholder="Details..." className="w-full mt-2 px-3 py-1.5 text-xs border border-ink-900/20 rounded" value={m.detail} onChange={e => {
                              const newM = [...formData.technicalMeasures];
                              newM[i].detail = e.target.value;
                              setFormData({...formData, technicalMeasures: newM});
                            }} />
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
            <h2 className="text-2xl font-serif text-ink-900">Step 4: Residual Risk</h2>
            <p className="text-sm text-ink-600">Assess the risk level after applying all supplementary measures.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-2">Residual Risk Level</label>
                <div className="flex gap-3">
                  {['low', 'medium', 'high', 'critical'].map(level => (
                    <button 
                      key={level}
                      onClick={() => setFormData({...formData, residualRiskLevel: level})}
                      className={`px-4 py-2 rounded-lg text-sm font-medium uppercase tracking-wider border transition-all ${formData.residualRiskLevel === level ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-500 border-ink-900/20 hover:border-ink-900/50'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1">Justification</label>
                <textarea 
                  className="w-full px-4 py-3 border border-ink-900/20 rounded-xl focus:border-sage-500 outline-none min-h-[120px] text-sm"
                  placeholder="Explain why the residual risk is acceptable or unacceptable..."
                  value={formData.residualRiskJustification}
                  onChange={e => setFormData({...formData, residualRiskJustification: e.target.value})}
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-serif text-ink-900">Step 5: Conclusion</h2>
            
            <div className="bg-bone-50 p-6 rounded-xl border border-ink-900/10 space-y-6">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-3">Final Decision</label>
                <div className="space-y-2">
                  {[
                    { value: 'proceed', label: 'Proceed with Transfer', color: 'text-sage-700' },
                    { value: 'proceed_with_conditions', label: 'Proceed with Conditions', color: 'text-amber-700' },
                    { value: 'suspend', label: 'Suspend Transfer', color: 'text-red-700' }
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${formData.conclusion === opt.value ? 'bg-white border-sage-500 shadow-sm' : 'bg-white/50 border-ink-900/10 hover:bg-white'}`}>
                      <input 
                        type="radio" 
                        name="conclusion" 
                        checked={formData.conclusion === opt.value} 
                        onChange={() => setFormData({...formData, conclusion: opt.value})}
                        className="text-sage-600 focus:ring-sage-500"
                      />
                      <span className={`font-medium ${opt.color}`}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {formData.conclusion === 'proceed_with_conditions' && (
                <div>
                  <label className="block text-sm font-medium text-ink-900 mb-1">Specify Conditions</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-ink-900/20 rounded-xl focus:border-sage-500 outline-none text-sm"
                    value={formData.conditions}
                    onChange={e => setFormData({...formData, conditions: e.target.value})}
                  ></textarea>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-ink-900/10 flex justify-end gap-3">
              <button 
                onClick={() => handleSave('draft')}
                className="px-5 py-2.5 text-sm font-medium text-ink-600 bg-bone-50 border border-ink-900/10 rounded-xl hover:bg-bone-100 transition-colors"
              >
                Save Draft
              </button>
              <button 
                onClick={() => handleSave('completed')}
                disabled={!formData.conclusion}
                className="px-5 py-2.5 text-sm font-medium text-white bg-sage-700 rounded-xl hover:bg-sage-600 transition-colors disabled:opacity-50"
              >
                Approve & Complete TIA
              </button>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="mt-8 pt-6 border-t border-ink-900/5 flex items-center justify-between">
          <button 
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 text-sm font-medium text-ink-600 disabled:opacity-0"
          >
            ← Previous Step
          </button>
          <button 
            disabled={step === 5}
            onClick={() => setStep(step + 1)}
            className="px-6 py-2 bg-ink-900 text-white rounded-lg text-sm font-medium hover:bg-ink-800 disabled:hidden"
          >
            Next Step →
          </button>
        </div>
      </div>
    </div>
  );
}
