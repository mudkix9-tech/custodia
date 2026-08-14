"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Globe, Lock, AlertTriangle, FileText, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { SubProcessorList } from '@/components/vendors/SubProcessorList';
import { TIABuilder } from '@/components/vendors/TIABuilder';
import { VendorIncidentFeed } from '@/components/vendors/VendorIncidentFeed';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { AlternativesSection } from '@/components/vendors/AlternativesSection';
import { QuestionnaireTab } from '@/components/vendors/QuestionnaireTab';
import { DpaAnalysisModal } from '@/components/vendors/DpaAnalysisModal';

export default function VendorDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params?.id as string;

  const { data: vendor, isLoading } = trpc.vendors.getOrgVendorDetails.useQuery({ vendorId }, { enabled: !!vendorId });
  const { setContext } = useAiGuidanceStore();
  const utils = trpc.useUtils();
  const updateMutation = trpc.vendors.updateOrgVendor.useMutation({
    onMutate: async (newUpdate) => {
      await utils.vendors.getOrgVendorDetails.cancel({ vendorId: newUpdate.vendorId });
      const previousData = utils.vendors.getOrgVendorDetails.getData({ vendorId: newUpdate.vendorId });

      if (previousData && previousData.orgVendor) {
        utils.vendors.getOrgVendorDetails.setData({ vendorId: newUpdate.vendorId }, {
          ...previousData,
          orgVendor: {
            ...previousData.orgVendor,
            ...newUpdate,
          }
        } as any);
      }
      return { previousData };
    },
    onError: (err, newUpdate, context) => {
      if (context?.previousData) {
        utils.vendors.getOrgVendorDetails.setData({ vendorId: newUpdate.vendorId }, context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      utils.vendors.getOrgVendorDetails.invalidate({ vendorId: variables.vendorId });
    }
  });
  const [activeTab, setActiveTab] = useState<'dpa' | 'tia' | 'sub-processors' | 'incidents' | 'questionnaire'>('dpa');
  
  // DPA upload and analysis states
  const [isDpaModalOpen, setIsDpaModalOpen] = useState(false);
  const [dpaAnalysisData, setDpaAnalysisData] = useState<any>(null);
  const [isAnalyzingDpa, setIsAnalyzingDpa] = useState(false);
  const [dpaUploadError, setDpaUploadError] = useState<string | null>(null);

  const analyzeDpaMutation = trpc.ai.analyzeDpa.useMutation();
  const confirmDpaMutation = trpc.vendors.confirmDpaAnalysis.useMutation();
  const draftDpaMutation = trpc.vendors.saveDpaAnalysisDraft.useMutation();
  const verifyProfileMutation = trpc.vendors.verifyVendorProfile.useMutation();

  if (isLoading) return <div className="p-8 text-[#6E747A]">Loading vendor intelligence...</div>;
  if (!vendor) return <div className="p-8 text-[#6E747A]">Vendor not found or not linked.</div>;

  // Set AI guidance context when vendor data is available
  useEffect(() => {
    if (vendor) {
      setContext({
        module: 'vendors',
        entityId: vendorId,
        formData: {
          name: vendor.vendor.name,
          headquartersCountry: vendor.vendor.headquartersCountry,
          dpaStatus: vendor.orgVendor.dpaStatus,
        }
      });
    }
  }, [vendorId, vendor?.orgVendor?.dpaStatus]);

  const handleUpdateDpa = async (status: string) => {
    await updateMutation.mutateAsync({ vendorId, dpaStatus: status });
    utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
  };

  const handleToggleEuHosting = async () => {
    await updateMutation.mutateAsync({ vendorId, usingEuHosting: !vendor.orgVendor.usingEuHosting });
    utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8 fade-up">
      <Link href="/vendors" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#6E747A] hover:text-[#F4F5F6] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Vendor Register
      </Link>
 
      {vendor.vendor.isAutoDiscovered && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-amber-300">
          <div className="flex gap-3 leading-relaxed">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block mb-0.5 text-amber-950">Auto-Discovered Vendor Profile</span>
              This vendor profile was auto-created from a website or DNS scan. Please verify and complete their Headquarters country, EU Hosting options, and Security Certifications to ensure correct risk score modeling.
            </div>
          </div>
          <button
            onClick={async () => {
              await verifyProfileMutation.mutateAsync({ vendorId });
              utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
            }}
            disabled={verifyProfileMutation.isPending}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors shrink-0 shadow-panel-elevated self-start sm:self-center"
          >
            Verify &amp; Lock Profile
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Left Column: Global Intelligence */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-4 text-2xl font-bold text-[#F4F5F6]">
              {vendor.vendor.name.charAt(0)}
            </div>
            <h1 className="text-2xl font-serif text-[#F4F5F6] mb-1">{vendor.vendor.name}</h1>
            <a href={vendor.vendor.website || '#'} target="_blank" className="text-[14px] text-[#C9A227] hover:underline">{vendor.vendor.website}</a>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-[#6E747A] shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#F4F5F6]">Headquarters</div>
                  <div className="text-[14px] text-[#9BA1A6]">{vendor.vendor.headquartersCountry}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#6E747A] shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#F4F5F6]">Certifications</div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {(vendor.vendor.securityCertifications as string[])?.map((c: string) => (
                      <span key={c} className="bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        {c.replace('_', ' ')}
                      </span>
                    )) || <span className="text-[13px] text-[#6E747A]">None detected</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#6E747A] shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#F4F5F6]">EU Data Residency</div>
                  <div className="text-[14px] text-[#9BA1A6] mb-2">{vendor.vendor.euHostingAvailable ? 'Available' : 'Not Available'}</div>
                  {vendor.vendor.euHostingAvailable && (
                    <label className="flex items-center gap-2 cursor-pointer bg-[#08090A] p-2 rounded-lg border border-white/10">
                      <input 
                        type="checkbox" 
                        className="rounded border-ink-300 text-[#C9A227] focus:ring-[#C9A227]"
                        checked={vendor.orgVendor.usingEuHosting || false}
                        onChange={handleToggleEuHosting}
                        disabled={updateMutation.isPending}
                      />
                      <span className="text-[12px] font-medium text-[#F4F5F6]">We use the EU data center</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Risk Dial */}
          <div className="bg-ink-900 border border-ink-900 rounded-2xl p-6 shadow-panel-elevated text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A227]/20 rounded-full blur-[50px]"></div>
            <div className="text-[12px] font-bold uppercase tracking-widest text-bone-50/50 mb-4">Calculated Risk Score</div>
            <div className="text-5xl font-black text-white mb-2">{vendor.orgVendor.riskScore}</div>
            <div className={`inline-block px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider mb-6
              ${vendor.orgVendor.riskLevel === 'low' ? 'bg-[#C9A227]/20 text-sage-300' : 
                vendor.orgVendor.riskLevel === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}
            `}>
              {vendor.orgVendor.riskLevel}
            </div>
            <p className="text-[12px] text-bone-50/60 leading-relaxed text-left mb-6">
              Score is dynamically calculated based on jurisdiction ({vendor.vendor.headquartersCountry}), DPAs ({vendor.orgVendor.dpaStatus}), security posture, and threat intelligence.
            </p>

            {vendor.orgVendor.riskFactors && (
              <div className="mt-6 border-t border-bone-50/20 pt-6 text-left space-y-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-bone-50/50">Risk Factors Breakdown</div>
                <div className="space-y-4">
                  {Object.entries(vendor.orgVendor.riskFactors).map(([key, factor]: [string, any]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-bone-50/80 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className={`font-semibold ${factor.points > 0 ? 'text-amber-300' : 'text-sage-300'}`}>
                          +{factor.points} / {factor.maxPoints} pts
                        </span>
                      </div>
                      <div className="text-[11px] text-bone-50/50 leading-tight">
                        {factor.detail}
                      </div>
                      {/* Visual progress bar */}
                      <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${factor.points > (factor.maxPoints / 2) ? 'bg-red-400' : factor.points > 0 ? 'bg-amber-400' : 'bg-green-500'}`}
                          style={{ width: `${(factor.points / factor.maxPoints) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AlternativesSection vendorId={vendorId} />
        </div>

        {/* Right Column: Organization Context */}
        <div className="md:col-span-2">
          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
            <div className="flex border-b border-white/10 bg-[#08090A]/50">
              <button 
                onClick={() => setActiveTab('dpa')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'dpa' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                DPA Management
              </button>
              <button 
                onClick={() => setActiveTab('tia')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'tia' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                Transfer Impact
              </button>
              <button 
                onClick={() => setActiveTab('sub-processors')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'sub-processors' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                Sub-processors
              </button>
              <button 
                onClick={() => setActiveTab('incidents')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'incidents' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                Incidents &amp; Breaches
              </button>
              <button 
                onClick={() => setActiveTab('questionnaire')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'questionnaire' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                Security Questionnaire
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'dpa' && (
                <div className="space-y-8 animate-in fade-in">
                  <div>
                    <h3 className="text-xl font-serif text-[#F4F5F6] mb-2">Data Processing Agreement</h3>
                    <p className="text-[14px] text-[#9BA1A6] mb-6">Track your legal relationship. A signed DPA is strictly required under GDPR Article 28.</p>
                    
                    <div className="flex flex-wrap gap-3 mb-8">
                      {['not_started', 'draft', 'sent', 'signed', 'expired'].map(status => (
                        <button
                          key={status}
                          onClick={() => handleUpdateDpa(status)}
                          className={`px-4 py-2 rounded-lg text-[13px] font-medium uppercase tracking-wider border transition-all
                            ${vendor.orgVendor.dpaStatus === status 
                              ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#C9A227] ring-2 ring-[#C9A227]/30' 
                              : 'bg-[#0D0F11] border-white/10 text-[#6E747A] hover:border-ink-900/30'}`}
                        >
                          {status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <div className="bg-[#08090A] rounded-xl border border-dashed border-white/20 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-[#0D0F11] rounded-full flex items-center justify-center mb-4 shadow-panel-elevated">
                        <Upload className="w-5 h-5 text-[#C9A227]" />
                      </div>
                      <h4 className="font-semibold text-[#F4F5F6] mb-1">Upload Signed Document</h4>
                      <p className="text-[13px] text-[#6E747A] mb-4 max-w-sm">Securely store your executed DPA. This will automatically update your risk score and schedule expiry alerts.</p>
                      
                      {isAnalyzingDpa ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#C9A227] animate-spin mb-2" />
                          <p className="text-xs text-[#9BA1A6] font-semibold animate-pulse">AI is parsing clauses and checking problematic language...</p>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            id="dpa-upload-input"
                            className="hidden"
                            accept=".pdf"
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                if (!file.name.endsWith('.pdf')) {
                                  setDpaUploadError("Only PDF documents are supported for AI DPA analysis.");
                                  return;
                                }
                                setDpaUploadError(null);
                                setIsAnalyzingDpa(true);
                                try {
                                  const reader = new FileReader();
                                  reader.readAsDataURL(file);
                                  reader.onload = async () => {
                                    const base64 = (reader.result as string).split(',')[1];
                                    try {
                                      const result = await analyzeDpaMutation.mutateAsync({
                                        fileBase64: base64,
                                        orgVendorId: vendor.orgVendor.id
                                      });
                                      setDpaAnalysisData(result);
                                      setIsDpaModalOpen(true);
                                    } catch (err: any) {
                                      setDpaUploadError(err.message || "Failed to analyze DPA document.");
                                    } finally {
                                      setIsAnalyzingDpa(false);
                                    }
                                  };
                                } catch (err: any) {
                                  setDpaUploadError("Failed to read DPA file.");
                                  setIsAnalyzingDpa(false);
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={() => document.getElementById('dpa-upload-input')?.click()}
                            className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#E5C463] transition-colors shadow-card"
                          >
                            Select PDF File
                          </button>
                        </>
                      )}
                      {dpaUploadError && (
                        <p className="text-xs text-rose-600 mt-2 font-medium">{dpaUploadError}</p>
                      )}
                    </div>

                    {vendor.orgVendor.dpaStatus === 'signed' && (
                      <div className="mt-8 border-t border-white/5 pt-8 space-y-6 animate-in fade-in">
                        <div>
                          <h4 className="font-semibold text-[#F4F5F6] text-sm mb-1">Article 28 Clause Review</h4>
                          <p className="text-[13px] text-[#6E747A]">
                            Verify that your contract covers all mandatory processor requirements under GDPR Article 28(3).
                          </p>
                        </div>

                        {/* Progress Indicator */}
                        {(() => {
                          const coverage = (vendor.orgVendor.dpaClauseCoverage || {}) as any;
                          const keys = [
                            'documentedInstructions',
                            'confidentiality',
                            'securityMeasures',
                            'subProcessorRestrictions',
                            'dataSubjectRights',
                            'securityBreachDpia',
                            'deletionOnTermination',
                            'auditRights'
                          ];
                          const covered = keys.filter(k => !!coverage[k]).length;
                          const pct = Math.round((covered / keys.length) * 100);

                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs font-semibold text-[#E6E8EA]">
                                <span>COMPLETENESS</span>
                                <span>{covered} / 8 CLAUSES ({pct}%)</span>
                              </div>
                              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className={`h-full transition-all duration-300 ${covered === 8 ? 'bg-[#C9A227]' : covered >= 6 ? 'bg-indigo-500/100' : covered >= 4 ? 'bg-amber-500/100' : 'bg-red-500/100'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Checklist */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            { key: 'documentedInstructions', label: 'Documented Instructions', citation: 'Art. 28(3)(a)', desc: 'Process data only on written instructions from the controller.' },
                            { key: 'confidentiality', label: 'Personnel Confidentiality', citation: 'Art. 28(3)(b)', desc: 'Ensure staff authorized to process data are committed to confidentiality.' },
                            { key: 'securityMeasures', label: 'Security Measures', citation: 'Art. 28(3)(c)', desc: 'Implement technical and organizational security measures (Art. 32).' },
                            { key: 'subProcessorRestrictions', label: 'Sub-processor Restrictions', citation: 'Art. 28(3)(d)', desc: 'Engage sub-processors only with prior specific or general authorization.' },
                            { key: 'dataSubjectRights', label: 'Data Subject Rights Assistance', citation: 'Art. 28(3)(e)', desc: 'Assist controller in responding to data subjects exercising their rights.' },
                            { key: 'securityBreachDpia', label: 'Breach & DPIA Assistance', citation: 'Art. 28(3)(f)', desc: 'Assist controller with breach notifications, security audits, and DPIAs.' },
                            { key: 'deletionOnTermination', label: 'Deletion or Return of Data', citation: 'Art. 28(3)(g)', desc: 'Delete or return all personal data at the choice of the controller after processing ends.' },
                            { key: 'auditRights', label: 'Audits and Inspections', citation: 'Art. 28(3)(h)', desc: 'Allow for and contribute to audits and inspections conducted by the controller.' }
                          ].map(({ key, label, citation, desc }) => {
                            const isChecked = !!(vendor.orgVendor.dpaClauseCoverage as any)?.[key];
                            return (
                              <label 
                                key={key}
                                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none
                                  ${isChecked 
                                    ? 'bg-[#C9A227]/10 border-[#C9A227]/30 hover:border-[#C9A227]/60' 
                                    : 'bg-[#0D0F11] border-white/10 hover:border-white/20'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const nextCoverage = {
                                      ...((vendor.orgVendor.dpaClauseCoverage as any) || {}),
                                      [key]: e.target.checked
                                    };
                                    updateMutation.mutate({ vendorId, dpaClauseCoverage: nextCoverage });
                                  }}
                                  disabled={updateMutation.isPending}
                                  className="rounded border-ink-300 text-[#C9A227] focus:ring-[#C9A227] mt-1"
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[#F4F5F6] text-[13px] leading-tight">{label}</span>
                                    <span className="text-[10px] font-bold text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{citation}</span>
                                  </div>
                                  <p className="text-[11px] text-[#6E747A] leading-tight">{desc}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-8 border-t border-white/5 pt-8 space-y-6">
                      <h4 className="font-semibold text-[#F4F5F6] text-sm">Risk Assessment Inputs</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Data Subject Volume */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            Data Subject Volume
                          </label>
                          <select
                            value={vendor.orgVendor.dataSubjectVolume || '<1K'}
                            onChange={(e) => updateMutation.mutate({ vendorId, dataSubjectVolume: e.target.value as any })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          >
                            <option value="<1K">&lt; 1,000 subjects</option>
                            <option value="1K-10K">1,000 - 10,000 subjects</option>
                            <option value="10K-100K">10,000 - 100,000 subjects</option>
                            <option value="100K+">100,000+ subjects</option>
                          </select>
                        </div>

                        {/* Contract Renewal Date */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            Contract Renewal Date
                          </label>
                          <input
                            type="date"
                            value={vendor.orgVendor.contractRenewalDate ? new Date(vendor.orgVendor.contractRenewalDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => updateMutation.mutate({ vendorId, contractRenewalDate: e.target.value || null })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          />
                        </div>

                        {/* DPA Expiry Date */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            DPA Expiry Date
                          </label>
                          <input
                            type="date"
                            value={vendor.orgVendor.dpaExpiresAt ? new Date(vendor.orgVendor.dpaExpiresAt).toISOString().split('T')[0] : ''}
                            onChange={(e) => updateMutation.mutate({ vendorId, dpaExpiresAt: e.target.value || null })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          />
                        </div>

                        {/* Security Certifications */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            Security Certifications
                          </label>
                          <div className="flex gap-4 items-center h-10">
                            <label className="flex items-center gap-2 text-xs font-medium text-[#E6E8EA] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={vendor.orgVendor.certifications?.includes('soc2') || false}
                                onChange={(e) => {
                                  const current = vendor.orgVendor.certifications || [];
                                  const next = e.target.checked 
                                    ? [...current, 'soc2']
                                    : current.filter((c: string) => c !== 'soc2');
                                  updateMutation.mutate({ vendorId, certifications: next });
                                }}
                                disabled={updateMutation.isPending}
                                className="rounded border-ink-300 text-[#C9A227] focus:ring-[#C9A227]"
                              />
                              SOC 2
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-[#E6E8EA] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={vendor.orgVendor.certifications?.includes('iso27001') || false}
                                onChange={(e) => {
                                  const current = vendor.orgVendor.certifications || [];
                                  const next = e.target.checked 
                                    ? [...current, 'iso27001']
                                    : current.filter((c: string) => c !== 'iso27001');
                                  updateMutation.mutate({ vendorId, certifications: next });
                                }}
                                disabled={updateMutation.isPending}
                                className="rounded border-ink-300 text-[#C9A227] focus:ring-[#C9A227]"
                              />
                              ISO 27001
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {vendor.vendor.dpaUrl && (
                    <div className="flex items-center justify-between bg-[#0D0F11] border border-white/10 p-4 rounded-xl shadow-panel-elevated">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded text-[#9BA1A6]"><FileText className="w-5 h-5" /></div>
                        <div>
                          <div className="font-medium text-[#F4F5F6] text-[14px]">Vendor DPA Template</div>
                          <div className="text-[12px] text-[#6E747A]">Publicly provided by {vendor.vendor.name}</div>
                        </div>
                      </div>
                      <a href={vendor.vendor.dpaUrl} target="_blank" className="text-[13px] font-medium text-[#C9A227] hover:text-[#E5C463]">Review Template</a>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tia' && (
                <div className="space-y-8 animate-in fade-in">
                  <TIABuilder vendorId={vendorId} defaultCountry={vendor.vendor.headquartersCountry || undefined} />
                </div>
              )}

              {activeTab === 'sub-processors' && (
                <div className="space-y-8 animate-in fade-in">
                  <SubProcessorList vendorId={vendorId} orgVendorId={vendor.orgVendor.id} />
                </div>
              )}

              {activeTab === 'incidents' && (
                <div className="space-y-8 animate-in fade-in">
                  <VendorIncidentFeed vendorId={vendorId} />
                </div>
              )}
 
              {activeTab === 'questionnaire' && (
                <QuestionnaireTab orgVendorId={vendor.orgVendor.id} />
              )}
            </div>
          </div>
        </div>
      </div>
 
      <DpaAnalysisModal
        isOpen={isDpaModalOpen}
        onClose={() => setIsDpaModalOpen(false)}
        analysisData={dpaAnalysisData}
        isSubmitting={confirmDpaMutation.isPending || draftDpaMutation.isPending}
        onConfirm={async (checklist) => {
          await confirmDpaMutation.mutateAsync({
            orgVendorId: vendor.orgVendor.id,
            dpaClauseCoverage: checklist
          });
          setIsDpaModalOpen(false);
          utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
        }}
        onSaveDraft={async (rawAnalysis) => {
          await draftDpaMutation.mutateAsync({
            orgVendorId: vendor.orgVendor.id,
            dpaAiAnalysis: rawAnalysis
          });
          setIsDpaModalOpen(false);
          utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
        }}
      />
    </div>
  );
}
