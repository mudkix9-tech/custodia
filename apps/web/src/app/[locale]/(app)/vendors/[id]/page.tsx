"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Globe, Lock, AlertTriangle, FileText, Upload, CheckCircle2, Loader2, Download, Scale, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { SubProcessorList } from '@/components/vendors/SubProcessorList';
import { TIABuilder } from '@/components/vendors/TIABuilder';
import { VendorIncidentFeed } from '@/components/vendors/VendorIncidentFeed';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { AlternativesSection } from '@/components/vendors/AlternativesSection';
import { QuestionnaireTab } from '@/components/vendors/QuestionnaireTab';
import { DpaAnalysisModal } from '@/components/vendors/DpaAnalysisModal';
import { TRANSFER_MECHANISMS } from '@/constants/transferMechanisms';
import { VendorRelationshipPanel, VendorHistory, UnlinkVendor } from '@/components/vendors/VendorRelationship';

export default function VendorDetailsPage() {
  const t = useTranslations('vendors');
  const params = useParams();
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
  const [activeTab, setActiveTab] = useState<'dpa' | 'tia' | 'sub-processors' | 'incidents' | 'questionnaire' | 'relationship'>('dpa');
  
  // DPA upload and analysis states
  const [isDpaModalOpen, setIsDpaModalOpen] = useState(false);
  const [dpaAnalysisData, setDpaAnalysisData] = useState<any>(null);
  const [isAnalyzingDpa, setIsAnalyzingDpa] = useState(false);
  const [dpaUploadError, setDpaUploadError] = useState<string | null>(null);

  const analyzeDpaMutation = trpc.ai.analyzeDpa.useMutation();
  const confirmDpaMutation = trpc.vendors.confirmDpaAnalysis.useMutation();
  const draftDpaMutation = trpc.vendors.saveDpaAnalysisDraft.useMutation();
  const verifyProfileMutation = trpc.vendors.verifyVendorProfile.useMutation();
  const applyCatalogueMutation = trpc.vendors.applyCatalogueDpaAnalysis.useMutation({
    onSuccess: () => {
      utils.vendors.getOrgVendorDetails.invalidate({ vendorId });
    },
  });

  const [isExportingDossier, setIsExportingDossier] = useState(false);
  const [isGeneratingDpa, setIsGeneratingDpa] = useState(false);

  const handleExportDossier = async () => {
    if (isExportingDossier) return;
    setIsExportingDossier(true);
    let objectUrl: string | null = null;
    try {
      const { markdown, filename } = await utils.vendors.exportArticle28Dossier.fetch({ vendorId });
      objectUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export dossier:', err);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsExportingDossier(false);
    }
  };

  const handleGenerateDpa = async () => {
    if (isGeneratingDpa) return;
    setIsGeneratingDpa(true);
    let objectUrl: string | null = null;
    try {
      const { dpaMarkdown, filename } = await utils.vendors.generateDpaAgreement.fetch({ vendorId });
      objectUrl = URL.createObjectURL(new Blob([dpaMarkdown], { type: 'text/markdown;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate DPA:', err);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsGeneratingDpa(false);
    }
  };

  // Set AI guidance context when vendor data is available.
  useEffect(() => {
    if (vendor) {
      setContext({
        module: 'vendors',
        entityId: vendorId,
        formData: {
          name: vendor.vendor.name,
          // Columns are nullable; the context takes optionals, and null is not one.
          headquartersCountry: vendor.vendor.headquartersCountry ?? undefined,
          dpaStatus: vendor.orgVendor.dpaStatus ?? undefined,
        }
      });
    }
  }, [vendorId, vendor?.orgVendor?.dpaStatus]);

  if (isLoading) return <GenericWorkspaceSkeleton />;
  if (!vendor) return <div className="p-8 text-[#6E747A]">{t('detail.not_found')}</div>;

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
        <ArrowLeft className="w-4 h-4" /> {t('detail.back')}
      </Link>
 
      {vendor.vendor.isAutoDiscovered && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-amber-300">
          <div className="flex gap-3 leading-relaxed">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block mb-0.5 text-amber-200">{t('detail.auto_discovered.title')}</span>
              {t('detail.auto_discovered.description')}
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
            {t('detail.auto_discovered.verify')}
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
                  <div className="text-[13px] font-medium text-[#F4F5F6]">{t('detail.headquarters')}</div>
                  <div className="text-[14px] text-[#9BA1A6]">{vendor.vendor.headquartersCountry}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#6E747A] shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#F4F5F6]">{t('detail.certifications')}</div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {(vendor.vendor.securityCertifications as string[])?.map((c: string) => (
                      <span key={c} className="bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        {c.replace('_', ' ')}
                      </span>
                    )) || <span className="text-[13px] text-[#6E747A]">{t('detail.none_detected')}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#6E747A] shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#F4F5F6]">{t('detail.eu_residency')}</div>
                  <div className="text-[14px] text-[#9BA1A6] mb-2">{vendor.vendor.euHostingAvailable ? t('detail.available') : t('detail.not_available')}</div>
                  {vendor.vendor.euHostingAvailable && (
                    <label className="flex items-center gap-2 cursor-pointer bg-[#08090A] p-2 rounded-lg border border-white/10">
                      <input 
                        type="checkbox" 
                        className="rounded border-ink-300 text-[#C9A227] focus:ring-[#C9A227]"
                        checked={vendor.orgVendor.usingEuHosting || false}
                        onChange={handleToggleEuHosting}
                        disabled={updateMutation.isPending}
                      />
                      <span className="text-[12px] font-medium text-[#F4F5F6]">{t('detail.use_eu_datacentre')}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Risk Dial */}
          <div className="bg-ink-900 border border-ink-900 rounded-2xl p-6 shadow-panel-elevated text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A227]/20 rounded-full blur-[50px]"></div>
            <div className="text-[12px] font-bold uppercase tracking-widest text-bone-50/50 mb-4">{t('detail.risk.title')}</div>
            <div className="text-5xl font-black text-white mb-2">{vendor.orgVendor.riskScore}</div>
            <div className={`inline-block px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider mb-6
              ${vendor.orgVendor.riskLevel === 'low' ? 'bg-[#C9A227]/20 text-sage-300' : 
                vendor.orgVendor.riskLevel === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}
            `}>
              {t(`risk_level.${vendor.orgVendor.riskLevel ?? 'unknown'}`)}
            </div>
            <p className="text-[12px] text-bone-50/60 leading-relaxed text-left mb-6">
              {t('detail.risk.explanation', {
                country: vendor.vendor.headquartersCountry ?? '—',
                dpaStatus: t(`detail.dpa.status.${vendor.orgVendor.dpaStatus ?? 'not_started'}`),
              })}
            </p>

            {Boolean(vendor.orgVendor.riskFactors) && (
              <div className="mt-6 border-t border-bone-50/20 pt-6 text-left space-y-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-bone-50/50">{t('detail.risk.factors')}</div>
                <div className="space-y-4">
                  {Object.entries(vendor.orgVendor.riskFactors as Record<string, any>).map(([key, factor]: [string, any]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-bone-50/80 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className={`font-semibold ${factor.points > 0 ? 'text-amber-300' : 'text-sage-300'}`}>
                          {t('detail.risk.points', { points: factor.points, max: factor.maxPoints })}
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
                {t('detail.tabs.dpa')}
              </button>
              <button 
                onClick={() => setActiveTab('tia')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'tia' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                {t('detail.tabs.tia')}
              </button>
              <button 
                onClick={() => setActiveTab('sub-processors')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'sub-processors' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                {t('detail.tabs.sub_processors')}
              </button>
              <button 
                onClick={() => setActiveTab('incidents')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'incidents' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                {t('detail.tabs.incidents')}
              </button>
              <button
                onClick={() => setActiveTab('questionnaire')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'questionnaire' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                {t('detail.tabs.questionnaire')}
              </button>
              <button
                onClick={() => setActiveTab('relationship')}
                className={`px-6 py-4 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'relationship' ? 'border-[#C9A227] text-[#C9A227] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-[#08090A]'}`}
              >
                {t('detail.tabs.relationship')}
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'dpa' && (
                <div className="space-y-8 animate-in fade-in">
                  <div>
                    <h3 className="text-xl font-serif text-[#F4F5F6] mb-2">{t('detail.dpa.title')}</h3>
                    <p className="text-[14px] text-[#9BA1A6] mb-6">{t('detail.dpa.description')}</p>
                    
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex flex-wrap gap-2.5">
                        {['not_started', 'draft', 'sent', 'signed', 'expired'].map(status => (
                          <button
                            key={status}
                            onClick={() => handleUpdateDpa(status)}
                            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium uppercase tracking-wider border transition-all
                              ${vendor.orgVendor.dpaStatus === status 
                                ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#C9A227] ring-2 ring-[#C9A227]/30' 
                                : 'bg-[#0D0F11] border-white/10 text-[#6E747A] hover:border-ink-900/30'}`}
                          >
                            {t(`detail.dpa.status.${status}`)}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleExportDossier}
                          disabled={isExportingDossier}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#08090A] border border-white/10 text-[#F4F5F6] hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-[#C9A227]" />
                          {t('export_article_28')}
                        </button>
                        <button
                          onClick={handleGenerateDpa}
                          disabled={isGeneratingDpa}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#08090A] border border-white/10 text-[#F4F5F6] hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Scale className="w-3.5 h-3.5 text-[#9BA1A6]" />
                          {t('generate_dpa')}
                        </button>
                        {vendor.vendor.dpaClauseAnalysis && (
                          <button
                            onClick={() => applyCatalogueMutation.mutate({ vendorId })}
                            disabled={applyCatalogueMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] hover:bg-[#C9A227]/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {t('deep_clause_analysis.apply_catalogue')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#08090A] rounded-xl border border-dashed border-white/20 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-[#0D0F11] rounded-full flex items-center justify-center mb-4 shadow-panel-elevated">
                        <Upload className="w-5 h-5 text-[#C9A227]" />
                      </div>
                      <h4 className="font-semibold text-[#F4F5F6] mb-1">{t('detail.dpa.upload.title')}</h4>
                      <p className="text-[13px] text-[#6E747A] mb-4 max-w-sm">{t('detail.dpa.upload.description')}</p>
                      
                      {isAnalyzingDpa ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#C9A227] animate-spin mb-2" />
                          <p className="text-xs text-[#9BA1A6] font-semibold animate-pulse">{t('detail.dpa.upload.analysing')}</p>
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
                                  setDpaUploadError(t('detail.dpa.upload.error_pdf_only'));
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
                                      setDpaUploadError(err.message || t('detail.dpa.upload.error_analyse'));
                                    } finally {
                                      setIsAnalyzingDpa(false);
                                    }
                                  };
                                } catch (err: any) {
                                  setDpaUploadError(t('detail.dpa.upload.error_read'));
                                  setIsAnalyzingDpa(false);
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={() => document.getElementById('dpa-upload-input')?.click()}
                            className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#E5C463] transition-colors shadow-card"
                          >
                            {t('detail.dpa.upload.select_file')}
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
                          <h4 className="font-semibold text-[#F4F5F6] text-sm mb-1">{t('detail.dpa.clause_review.title')}</h4>
                          <p className="text-[13px] text-[#6E747A]">
                            {t('detail.dpa.clause_review.description')}
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
                                <span className="uppercase tracking-wider">{t('detail.dpa.clause_review.completeness')}</span>
                                <span>{t('detail.dpa.clause_review.count', { covered, total: keys.length, percent: pct })}</span>
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
                            { key: 'documentedInstructions', message: 'documented_instructions', citation: 'Art. 28(3)(a)' },
                            { key: 'confidentiality', message: 'confidentiality', citation: 'Art. 28(3)(b)' },
                            { key: 'securityMeasures', message: 'security_measures', citation: 'Art. 28(3)(c)' },
                            { key: 'subProcessorRestrictions', message: 'sub_processor_restrictions', citation: 'Art. 28(3)(d)' },
                            { key: 'dataSubjectRights', message: 'data_subject_rights', citation: 'Art. 28(3)(e)' },
                            { key: 'securityBreachDpia', message: 'security_breach_dpia', citation: 'Art. 28(3)(f)' },
                            { key: 'deletionOnTermination', message: 'deletion_on_termination', citation: 'Art. 28(3)(g)' },
                            { key: 'auditRights', message: 'audit_rights', citation: 'Art. 28(3)(h)' }
                          ].map(({ key, message, citation }) => {
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
                                    <span className="font-semibold text-[#F4F5F6] text-[13px] leading-tight">{t(`detail.dpa.clauses.${message}.label`)}</span>
                                    <span className="text-[10px] font-bold text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{citation}</span>
                                  </div>
                                  <p className="text-[11px] text-[#6E747A] leading-tight">{t(`detail.dpa.clauses.${message}.description`)}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-8 border-t border-white/5 pt-8 space-y-6">
                      <h4 className="font-semibold text-[#F4F5F6] text-sm">{t('detail.dpa.inputs.title')}</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Data Subject Volume */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            {t('detail.dpa.inputs.volume')}
                          </label>
                          <select
                            value={vendor.orgVendor.dataSubjectVolume || '<1K'}
                            onChange={(e) => updateMutation.mutate({ vendorId, dataSubjectVolume: e.target.value as any })}
                            disabled={updateMutation.isPending}
                            className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                          >
                            <option value="<1K">{t('detail.dpa.inputs.volume_options.lt1k')}</option>
                            <option value="1K-10K">{t('detail.dpa.inputs.volume_options.1k_10k')}</option>
                            <option value="10K-100K">{t('detail.dpa.inputs.volume_options.10k_100k')}</option>
                            <option value="100K+">{t('detail.dpa.inputs.volume_options.100k_plus')}</option>
                          </select>
                        </div>

                        {/* Chapter V safeguard THIS organisation relies on, which is
                            not always the one the shared catalogue records. Until
                            migration 0050 there was no column to write it to, so the
                            risk engine and the third-country gap rule both read a
                            field that was always empty and reported an Art. 44 gap
                            an organisation had in fact closed. */}
                        <div className="space-y-2 sm:col-span-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            {t('detail.dpa.inputs.transfer_mechanisms')}
                          </label>
                          <p className="text-[12px] text-[#6E747A] leading-relaxed">
                            {t('detail.dpa.inputs.transfer_mechanisms_hint')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {TRANSFER_MECHANISMS.map((mechanism) => {
                              const selected = (vendor.orgVendor.transferMechanisms || []).includes(mechanism);
                              return (
                                <button
                                  key={mechanism}
                                  type="button"
                                  disabled={updateMutation.isPending}
                                  onClick={() => {
                                    const current: string[] = vendor.orgVendor.transferMechanisms || [];
                                    const next = selected
                                      ? current.filter((m) => m !== mechanism)
                                      : [...current, mechanism];
                                    updateMutation.mutate({ vendorId, transferMechanisms: next as any });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50 ${
                                    selected
                                      ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#C9A227]'
                                      : 'bg-[#0D0F11] border-white/10 text-[#9BA1A6] hover:border-white/20'
                                  }`}
                                >
                                  {t(`detail.dpa.inputs.mechanisms.${mechanism}`)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Contract Renewal Date */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#6E747A] uppercase tracking-wider">
                            {t('detail.dpa.inputs.renewal_date')}
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
                            {t('detail.dpa.inputs.expiry_date')}
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
                            {t('detail.dpa.inputs.certifications')}
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
                          <div className="font-medium text-[#F4F5F6] text-[14px]">{t('detail.dpa.template.title')}</div>
                          <div className="text-[12px] text-[#6E747A]">{t('detail.dpa.template.provided_by', { name: vendor.vendor.name })}</div>
                        </div>
                      </div>
                      <a href={vendor.vendor.dpaUrl} target="_blank" className="text-[13px] font-medium text-[#C9A227] hover:text-[#E5C463]">{t('detail.dpa.template.review')}</a>
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
                  {/* A null organizationId is a shared catalogue row; only a
                      vendor this org created may have its sub-processor list
                      edited here, because the table hangs off the global vendor. */}
                  <SubProcessorList
                    vendorId={vendorId}
                    orgVendorId={vendor.orgVendor.id}
                    catalogueOwned={!!vendor.vendor.organizationId}
                  />
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

              {activeTab === 'relationship' && (
                <div className="space-y-10 animate-in fade-in">
                  <VendorRelationshipPanel vendorId={vendorId} orgVendor={vendor.orgVendor as any} />
                  <div className="border-t border-white/10 pt-8">
                    <h4 className="font-semibold text-[#F4F5F6] text-sm mb-6">{t('detail.tabs.history')}</h4>
                    <VendorHistory vendorId={vendorId} />
                  </div>
                  <div className="border-t border-white/10 pt-8">
                    <UnlinkVendor vendorId={vendorId} />
                  </div>
                </div>
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
