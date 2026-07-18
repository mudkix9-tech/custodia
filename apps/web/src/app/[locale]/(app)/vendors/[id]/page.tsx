"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Globe, Lock, AlertTriangle, FileText, Upload, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { SubProcessorList } from '@/components/vendors/SubProcessorList';
import { TIABuilder } from '@/components/vendors/TIABuilder';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';

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
  const [activeTab, setActiveTab] = useState<'dpa' | 'tia' | 'sub-processors' | 'ropa'>('dpa');

  if (isLoading) return <div className="p-8 text-ink-500">Loading vendor intelligence...</div>;
  if (!vendor) return <div className="p-8 text-ink-500">Vendor not found or not linked.</div>;

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
      <Link href="/vendors" className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-500 hover:text-ink-900 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Vendor Register
      </Link>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Left Column: Global Intelligence */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
            <div className="w-16 h-16 bg-bone-100 rounded-2xl flex items-center justify-center border border-ink-900/10 mb-4 text-2xl font-bold text-ink-900">
              {vendor.vendor.name.charAt(0)}
            </div>
            <h1 className="text-2xl font-serif text-ink-900 mb-1">{vendor.vendor.name}</h1>
            <a href={vendor.vendor.website || '#'} target="_blank" className="text-[14px] text-sage-600 hover:underline">{vendor.vendor.website}</a>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-ink-400 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-ink-900">Headquarters</div>
                  <div className="text-[14px] text-ink-600">{vendor.vendor.headquartersCountry}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-ink-400 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-ink-900">Certifications</div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {(vendor.vendor.securityCertifications as string[])?.map((c: string) => (
                      <span key={c} className="bg-sage-50 border border-sage-200 text-sage-700 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        {c.replace('_', ' ')}
                      </span>
                    )) || <span className="text-[13px] text-ink-500">None detected</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-ink-400 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-ink-900">EU Data Residency</div>
                  <div className="text-[14px] text-ink-600 mb-2">{vendor.vendor.euHostingAvailable ? 'Available' : 'Not Available'}</div>
                  {vendor.vendor.euHostingAvailable && (
                    <label className="flex items-center gap-2 cursor-pointer bg-bone-50 p-2 rounded-lg border border-ink-900/10">
                      <input 
                        type="checkbox" 
                        className="rounded border-ink-300 text-sage-600 focus:ring-sage-600"
                        checked={vendor.orgVendor.usingEuHosting || false}
                        onChange={handleToggleEuHosting}
                        disabled={updateMutation.isPending}
                      />
                      <span className="text-[12px] font-medium text-ink-900">We use the EU data center</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Risk Dial */}
          <div className="bg-ink-900 border border-ink-900 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sage-500/20 rounded-full blur-[50px]"></div>
            <div className="text-[12px] font-bold uppercase tracking-widest text-bone-50/50 mb-4">Calculated Risk Score</div>
            <div className="text-5xl font-black text-white mb-2">{vendor.orgVendor.riskScore}</div>
            <div className={`inline-block px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider mb-6
              ${vendor.orgVendor.riskLevel === 'low' ? 'bg-sage-500/20 text-sage-300' : 
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
                      <div className="w-full bg-bone-100/10 h-1 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${factor.points > (factor.maxPoints / 2) ? 'bg-red-400' : factor.points > 0 ? 'bg-amber-400' : 'bg-sage-400'}`}
                          style={{ width: `${(factor.points / factor.maxPoints) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Organization Context */}
        <div className="md:col-span-2">
          <div className="bg-white border border-ink-900/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-ink-900/10 bg-bone-50/50">
              <button 
                onClick={() => setActiveTab('dpa')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'dpa' ? 'border-sage-600 text-sage-700 bg-white' : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-bone-50'}`}
              >
                DPA Management
              </button>
              <button 
                onClick={() => setActiveTab('tia')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'tia' ? 'border-sage-600 text-sage-700 bg-white' : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-bone-50'}`}
              >
                Transfer Impact
              </button>
              <button 
                onClick={() => setActiveTab('sub-processors')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'sub-processors' ? 'border-sage-600 text-sage-700 bg-white' : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-bone-50'}`}
              >
                Sub-processors
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'dpa' && (
                <div className="space-y-8 animate-in fade-in">
                  <div>
                    <h3 className="text-xl font-serif text-ink-900 mb-2">Data Processing Agreement</h3>
                    <p className="text-[14px] text-ink-600 mb-6">Track your legal relationship. A signed DPA is strictly required under GDPR Article 28.</p>
                    
                    <div className="flex flex-wrap gap-3 mb-8">
                      {['not_started', 'draft', 'sent', 'signed', 'expired'].map(status => (
                        <button
                          key={status}
                          onClick={() => handleUpdateDpa(status)}
                          className={`px-4 py-2 rounded-lg text-[13px] font-medium uppercase tracking-wider border transition-all
                            ${vendor.orgVendor.dpaStatus === status 
                              ? 'bg-sage-50 border-sage-300 text-sage-800 ring-2 ring-sage-500/20' 
                              : 'bg-white border-ink-900/10 text-ink-500 hover:border-ink-900/30'}`}
                        >
                          {status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <div className="bg-bone-50 rounded-xl border border-dashed border-ink-900/20 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <Upload className="w-5 h-5 text-sage-600" />
                      </div>
                      <h4 className="font-semibold text-ink-900 mb-1">Upload Signed Document</h4>
                      <p className="text-[13px] text-ink-500 mb-4 max-w-sm">Securely store your executed DPA. This will automatically update your risk score and schedule expiry alerts.</p>
                      <button className="bg-sage-700 text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-sage-600 transition-colors shadow-card">
                        Select PDF File
                      </button>
                    </div>

                    {vendor.orgVendor.dpaStatus === 'signed' && (
                      <div className="mt-8 border-t border-ink-900/5 pt-8 space-y-6 animate-in fade-in">
                        <div>
                          <h4 className="font-semibold text-ink-900 text-sm mb-1">Article 28 Clause Review</h4>
                          <p className="text-[13px] text-ink-500">
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
                              <div className="flex justify-between items-center text-xs font-semibold text-ink-700">
                                <span>COMPLETENESS</span>
                                <span>{covered} / 8 CLAUSES ({pct}%)</span>
                              </div>
                              <div className="w-full bg-bone-100 h-2.5 rounded-full overflow-hidden border border-ink-900/5">
                                <div 
                                  className={`h-full transition-all duration-300 ${covered === 8 ? 'bg-sage-600' : covered >= 6 ? 'bg-indigo-500' : covered >= 4 ? 'bg-amber-500' : 'bg-red-500'}`}
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
                                    ? 'bg-sage-50/30 border-sage-200 hover:border-sage-300' 
                                    : 'bg-white border-ink-900/10 hover:border-ink-900/20'}`}
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
                                  className="rounded border-ink-300 text-sage-600 focus:ring-sage-600 mt-1"
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-ink-900 text-[13px] leading-tight">{label}</span>
                                    <span className="text-[10px] font-bold text-sage-600 bg-sage-50 border border-sage-200/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{citation}</span>
                                  </div>
                                  <p className="text-[11px] text-ink-500 leading-tight">{desc}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-8 border-t border-ink-900/5 pt-8 space-y-6">
                      <h4 className="font-semibold text-ink-900 text-sm">Risk Assessment Inputs</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Data Subject Volume */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider">
                            Data Subject Volume
                          </label>
                          <select
                            value={vendor.orgVendor.dataSubjectVolume || '<1K'}
                            onChange={(e) => updateMutation.mutate({ vendorId, dataSubjectVolume: e.target.value as any })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-white border border-ink-900/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                          >
                            <option value="<1K">&lt; 1,000 subjects</option>
                            <option value="1K-10K">1,000 - 10,000 subjects</option>
                            <option value="10K-100K">10,000 - 100,000 subjects</option>
                            <option value="100K+">100,000+ subjects</option>
                          </select>
                        </div>

                        {/* Contract Renewal Date */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider">
                            Contract Renewal Date
                          </label>
                          <input
                            type="date"
                            value={vendor.orgVendor.contractRenewalDate ? new Date(vendor.orgVendor.contractRenewalDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => updateMutation.mutate({ vendorId, contractRenewalDate: e.target.value || null })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-white border border-ink-900/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                          />
                        </div>

                        {/* DPA Expiry Date */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider">
                            DPA Expiry Date
                          </label>
                          <input
                            type="date"
                            value={vendor.orgVendor.dpaExpiresAt ? new Date(vendor.orgVendor.dpaExpiresAt).toISOString().split('T')[0] : ''}
                            onChange={(e) => updateMutation.mutate({ vendorId, dpaExpiresAt: e.target.value || null })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-white border border-ink-900/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                          />
                        </div>

                        {/* Security Certifications */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider">
                            Security Certifications
                          </label>
                          <div className="flex gap-4 items-center h-10">
                            <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer">
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
                                className="rounded border-ink-300 text-sage-600 focus:ring-sage-600"
                              />
                              SOC 2
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer">
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
                                className="rounded border-ink-300 text-sage-600 focus:ring-sage-600"
                              />
                              ISO 27001
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {vendor.vendor.dpaUrl && (
                    <div className="flex items-center justify-between bg-white border border-ink-900/10 p-4 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-bone-100 rounded text-ink-600"><FileText className="w-5 h-5" /></div>
                        <div>
                          <div className="font-medium text-ink-900 text-[14px]">Vendor DPA Template</div>
                          <div className="text-[12px] text-ink-500">Publicly provided by {vendor.vendor.name}</div>
                        </div>
                      </div>
                      <a href={vendor.vendor.dpaUrl} target="_blank" className="text-[13px] font-medium text-sage-600 hover:text-sage-800">Review Template</a>
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
                  <SubProcessorList vendorId={vendorId} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
