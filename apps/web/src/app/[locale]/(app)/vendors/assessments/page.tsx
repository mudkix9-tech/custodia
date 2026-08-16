"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Plus, Search, FileText, Download, CheckCircle2, Clock, Mail, ShieldAlert, Sparkles, Copy, Printer, Check, ClipboardCopy, Star, Eye, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default function AssessmentsDashboardPage() {
  const t = useTranslations('vendors');

  // 1. Fetch assessments
  const { data: assessments, isLoading: isAssessmentsLoading, refetch } = 
    trpc.assessments.getAssessments.useQuery({ limit: 100 });

  // 2. Fetch templates
  const { data: templates } = trpc.assessments.getTemplates.useQuery();

  // 3. Fetch vendors list for selection
  const { data: vendorsResp } = trpc.vendors.getOrgVendors.useInfiniteQuery({ limit: 100 });
  const vendors = vendorsResp?.pages.flatMap((page: any) => page.data) || [];

  // Mutations
  const sendAssessmentMutation = trpc.assessments.sendAssessment.useMutation();
  const reviewAssessmentMutation = trpc.assessments.reviewAssessment.useMutation();

  // State
  const [activeFilter, setActiveFilter] = useState<'all' | 'sent' | 'in_progress' | 'completed' | 'expired'>('all');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAssessmentId, setReviewAssessmentId] = useState('');
  const [reviewScoreAdj, setReviewScoreAdj] = useState(0);
  const [reviewSummary, setReviewSummary] = useState('');

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Derived metrics
  const totalCount = assessments?.length || 0;
  const completedCount = assessments?.filter(a => a.assessment.status === 'completed').length || 0;
  const pendingCount = assessments?.filter(a => a.assessment.status === 'sent' || a.assessment.status === 'in_progress').length || 0;
  const expiredCount = assessments?.filter(a => a.assessment.status === 'expired').length || 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filtered list
  const filteredAssessments = assessments?.filter(a => {
    if (activeFilter === 'all') return true;
    return a.assessment.status === activeFilter;
  }) || [];

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin;
    const link = `${origin}/public/assessments/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleSendAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedVendorId || !selectedTemplateId || !recipientEmail) {
      setErrorMsg(t('assessments.errors.required'));
      return;
    }

    try {
      await sendAssessmentMutation.mutateAsync({
        vendorId: selectedVendorId,
        templateId: selectedTemplateId,
        recipientEmail,
        recipientName
      });
      setSuccessMsg(t('assessments.success.sent'));
      setIsSendModalOpen(false);
      refetch();
      // Reset form
      setSelectedVendorId('');
      setRecipientEmail('');
      setRecipientName('');
    } catch (err: any) {
      setErrorMsg(err.message || t('assessments.errors.dispatch'));
    }
  };

  const handleOpenReviewModal = (assessmentId: string, currentAdj: number, currentSummary: string) => {
    setReviewAssessmentId(assessmentId);
    setReviewScoreAdj(currentAdj);
    setReviewSummary(currentSummary);
    setIsReviewModalOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await reviewAssessmentMutation.mutateAsync({
        assessmentId: reviewAssessmentId,
        scoreAdjustment: reviewScoreAdj,
        aiSummary: reviewSummary
      });
      setSuccessMsg(t('assessments.success.reviewed'));
      setIsReviewModalOpen(false);
      refetch();
    } catch (err: any) {
      setErrorMsg(err.message || t('assessments.errors.review'));
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-6">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6] mb-2">{t('assessments.title')}</h1>
          <p className="text-[#9BA1A6] text-[15px]">{t('assessments.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            // Select standard template by default if available
            if (templates && templates.length > 0) {
              const defaultTemplate = templates.find(tpl => tpl.isDefault) || templates[0];
              setSelectedTemplateId(defaultTemplate.id);
            }
            setIsSendModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[14px] font-medium px-5 py-2.5 rounded-xl transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> {t('assessments.send')}
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#6E747A] uppercase tracking-widest block mb-2">{t('assessments.metrics.dispatched')}</span>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl font-bold text-[#F4F5F6]">{totalCount}</span>
            <span className="text-xs text-[#6E747A]">{t('assessments.metrics.dispatched_unit')}</span>
          </div>
        </div>

        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#6E747A] uppercase tracking-widest block mb-2">{t('assessments.metrics.completion_rate')}</span>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl font-bold text-[#C9A227]">{completionRate}%</span>
            <span className="text-xs text-[#C9A227] font-semibold">{t('assessments.metrics.completed_count', { count: completedCount })}</span>
          </div>
        </div>

        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#6E747A] uppercase tracking-widest block mb-2">{t('assessments.metrics.pending')}</span>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl font-bold text-amber-400">{pendingCount}</span>
            <span className="text-xs text-amber-500">{t('assessments.metrics.pending_unit')}</span>
          </div>
        </div>

        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#6E747A] uppercase tracking-widest block mb-2">{t('assessments.metrics.expired')}</span>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl font-bold text-red-400">{expiredCount}</span>
            <span className="text-xs text-red-500">{t('assessments.metrics.expired_unit')}</span>
          </div>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] p-4 rounded-xl text-sm font-medium">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-900/50 text-red-400 p-4 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Main List Workspace */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        {/* Filters bar */}
        <div className="border-b border-white/5 px-6 py-4 flex flex-wrap gap-2 justify-between items-center bg-[#08090A]/50">
          <div className="flex gap-2">
            {(['all', 'sent', 'in_progress', 'completed', 'expired'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors border ${
                  activeFilter === filter
                    ? 'bg-[#C9A227] border-[#C9A227] text-[#08090A] shadow-panel-elevated'
                    : 'bg-[#0D0F11] border-white/10 text-[#9BA1A6] hover:bg-white/5'
                }`}
              >
                {t(`assessments.filters.${filter}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        {isAssessmentsLoading ? (
          <div className="p-12 text-center text-[#6E747A]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#C9A227]" />
            <p className="text-sm font-medium">{t('assessments.loading')}</p>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="p-16 text-center text-[#6E747A]">
            <FileText className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <p className="text-base font-medium mb-1">{t('assessments.empty.title')}</p>
            <p className="text-sm text-[#6E747A]">{t('assessments.empty.description')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#08090A]/50 border-b border-white/5 text-[#6E747A] text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">{t('assessments.columns.vendor')}</th>
                  <th className="px-6 py-4">{t('assessments.columns.recipient')}</th>
                  <th className="px-6 py-4">{t('assessments.columns.sent_at')}</th>
                  <th className="px-6 py-4">{t('assessments.columns.status')}</th>
                  <th className="px-6 py-4 text-center">{t('assessments.columns.score')}</th>
                  <th className="px-6 py-4 text-right">{t('assessments.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/5">
                {filteredAssessments.map(({ assessment, vendorName, template }) => {
                  const hasScore = assessment.score !== null;
                  const finalScore = hasScore 
                    ? Math.max(0, Math.min(100, (assessment.score || 0) + (assessment.scoreAdjustment || 0)))
                    : null;

                  return (
                    <tr key={assessment.id} className="hover:bg-[#08090A]/30 transition-colors text-[#F4F5F6] text-sm">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#F4F5F6]">{vendorName || t('assessments.unknown_vendor')}</div>
                        <div className="text-xs text-[#6E747A]">{template?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{assessment.recipientName || t('assessments.default_recipient')}</div>
                        <div className="text-xs text-[#6E747A] flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-[#6E747A]" />
                          {assessment.recipientEmail}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{assessment.sentAt ? new Date(assessment.sentAt).toLocaleDateString() : t('assessments.not_available')}</div>
                        <div className="text-[11px] text-[#6E747A]">{t('assessments.expires', { date: assessment.expiresAt ? new Date(assessment.expiresAt).toLocaleDateString() : t('assessments.never') })}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${
                          assessment.status === 'completed' 
                            ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
                            : assessment.status === 'expired'
                            ? 'bg-red-500/10 text-red-400 border-red-900/50'
                            : assessment.status === 'in_progress'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-900/50'
                            : 'bg-amber-500/10 text-amber-400 border-amber-900/50'
                        }`}>
                          {t(`assessments.filters.${assessment.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasScore ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-[#F4F5F6]">{finalScore}/100</span>
                            {assessment.scoreAdjustment !== 0 && (
                              <span className="text-[10px] text-red-500 font-medium">{t('assessments.adjustment', { value: `${assessment.scoreAdjustment > 0 ? '+' : ''}${assessment.scoreAdjustment}` })}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#6E747A] font-medium italic">{t('assessments.score_pending')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* Copy Link */}
                          <button
                            onClick={() => handleCopyLink(assessment.accessToken)}
                            title={t('assessments.copy_link')}
                            className="p-2 text-[#6E747A] hover:text-[#C9A227] border border-white/5 hover:border-[#C9A227]/30 bg-[#0D0F11] rounded-lg transition-colors shadow-panel-elevated"
                          >
                            {copiedToken === assessment.accessToken ? (
                              <Check className="w-4 h-4 text-[#C9A227]" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {/* Print/View */}
                          <Link
                            href={`/vendors/assessments/${assessment.id}/print`}
                            target="_blank"
                            title={t('assessments.print')}
                            className="p-2 text-[#6E747A] hover:text-[#C9A227] border border-white/5 hover:border-[#C9A227]/30 bg-[#0D0F11] rounded-lg transition-colors shadow-panel-elevated"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          {/* Review Override */}
                          {assessment.status === 'completed' && (
                            <button
                              onClick={() => handleOpenReviewModal(assessment.id, assessment.scoreAdjustment, assessment.aiSummary || '')}
                              title={t('assessments.review_action')}
                              className="p-2 text-indigo-400 hover:text-indigo-400 border border-indigo-900/50 hover:border-indigo-900/50 bg-indigo-500/15 rounded-lg transition-colors shadow-panel-elevated"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DISPATCH FORM MODAL */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F11] border border-ink-900/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-[#08090A] px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-serif text-lg text-[#F4F5F6] font-bold">{t('assessments.dispatch_modal.title')}</h3>
              <button 
                onClick={() => setIsSendModalOpen(false)}
                className="text-[#6E747A] hover:text-[#9BA1A6] font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendAssessment} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">{t('assessments.dispatch_modal.vendor')}</label>
                <select
                  required
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full bg-[#0D0F11] border border-ink-900/15 rounded-xl p-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
                >
                  <option value="">{t('assessments.dispatch_modal.vendor_placeholder')}</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">{t('assessments.dispatch_modal.template')}</label>
                <select
                  required
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-[#0D0F11] border border-ink-900/15 rounded-xl p-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
                >
                  {templates?.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name} {tpl.isDefault ? t('assessments.dispatch_modal.template_default') : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">{t('assessments.dispatch_modal.recipient_name')}</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t('assessments.dispatch_modal.recipient_name_placeholder')}
                    className="w-full bg-[#0D0F11] border border-ink-900/15 rounded-xl p-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">{t('assessments.dispatch_modal.recipient_email')}</label>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder={t('assessments.dispatch_modal.recipient_email_placeholder')}
                    className="w-full bg-[#0D0F11] border border-ink-900/15 rounded-xl p-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
                  />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-xs text-[#9BA1A6] leading-relaxed">
                {t('assessments.dispatch_modal.note')}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsSendModalOpen(false)}
                  className="px-4 py-2 border border-white/10 text-[#E6E8EA] rounded-xl hover:bg-[#08090A] transition-colors text-sm"
                >
                  {t('assessments.dispatch_modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={sendAssessmentMutation.isPending}
                  className="px-5 py-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-medium rounded-xl transition-all shadow-panel-elevated flex items-center gap-2 text-sm"
                >
                  {sendAssessmentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('assessments.dispatch_modal.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('assessments.dispatch_modal.submit')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLIANCE AUDIT / REVIEW OVERRIDE MODAL */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F11] border border-ink-900/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-[#08090A] px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-serif text-lg text-[#F4F5F6] font-bold">{t('assessments.review_modal.title')}</h3>
              <button 
                onClick={() => setIsReviewModalOpen(false)}
                className="text-[#6E747A] hover:text-[#9BA1A6] font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveReview} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">{t('assessments.review_modal.adjustment')}</label>
                <input
                  type="number"
                  required
                  min="-50"
                  max="50"
                  value={reviewScoreAdj}
                  onChange={(e) => setReviewScoreAdj(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0D0F11] border border-ink-900/15 rounded-xl p-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
                />
                <span className="text-[11px] text-[#6E747A] block mt-1">{t('assessments.review_modal.adjustment_help')}</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">{t('assessments.review_modal.summary')}</label>
                <textarea
                  value={reviewSummary}
                  onChange={(e) => setReviewSummary(e.target.value)}
                  placeholder={t('assessments.review_modal.summary_placeholder')}
                  className="w-full h-32 bg-[#0D0F11] border border-ink-900/15 rounded-xl p-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 border border-white/10 text-[#E6E8EA] rounded-xl hover:bg-[#08090A] transition-colors text-sm"
                >
                  {t('assessments.review_modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={reviewAssessmentMutation.isPending}
                  className="px-5 py-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-medium rounded-xl transition-all shadow-panel-elevated flex items-center gap-2 text-sm"
                >
                  {reviewAssessmentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('assessments.review_modal.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('assessments.review_modal.submit')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
