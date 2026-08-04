"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { 
  Sparkles, Loader2, Copy, Check, Mail, Send, HelpCircle, 
  AlertTriangle, ShieldAlert, Award, FileText, CheckCircle2, Plus, Printer, Star 
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function QuestionnaireTab({ orgVendorId }: { orgVendorId: string }) {
  const utils = trpc.useUtils();

  // 1. Fetch vendor-specific assessments
  const { data: assessments, isLoading: isListLoading, refetch } = 
    trpc.assessments.getVendorAssessments.useQuery({ vendorId: orgVendorId });

  // 2. Fetch templates
  const { data: templates } = trpc.assessments.getTemplates.useQuery();

  // Mutations
  const sendAssessmentMutation = trpc.assessments.sendAssessment.useMutation();
  const reviewAssessmentMutation = trpc.assessments.reviewAssessment.useMutation();

  // State
  const [isSendFormOpen, setIsSendFormOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewId, setReviewId] = useState('');
  const [reviewScoreAdj, setReviewScoreAdj] = useState(0);
  const [reviewSummary, setReviewSummary] = useState('');

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    // Auto-select template if not set
    let templateId = selectedTemplateId;
    if (!templateId && templates && templates.length > 0) {
      const defaultT = templates.find(t => t.isDefault) || templates[0];
      templateId = defaultT.id;
    }

    if (!templateId || !recipientEmail) {
      setErrorMsg("Please select a template and enter a valid email.");
      return;
    }

    try {
      await sendAssessmentMutation.mutateAsync({
        vendorId: orgVendorId,
        templateId,
        recipientEmail,
        recipientName
      });
      setSuccessMsg("Questionnaire dispatched successfully!");
      setIsSendFormOpen(false);
      setRecipientEmail('');
      setRecipientName('');
      refetch();
      utils.vendors.getOrgVendorDetails.invalidate();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to dispatch assessment.");
    }
  };

  const handleOpenReview = (id: string, adj: number, summary: string) => {
    setReviewId(id);
    setReviewScoreAdj(adj);
    setReviewSummary(summary);
    setIsReviewOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await reviewAssessmentMutation.mutateAsync({
        assessmentId: reviewId,
        scoreAdjustment: reviewScoreAdj,
        aiSummary: reviewSummary
      });
      setSuccessMsg("Compliance review saved successfully!");
      setIsReviewOpen(false);
      refetch();
      utils.vendors.getOrgVendorDetails.invalidate();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update review.");
    }
  };

  if (isListLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 text-[#C9A227] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Tab Title */}
      <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-xl font-serif text-[#F4F5F6] mb-1">Assessments History</h3>
          <p className="text-[13px] text-[#9BA1A6]">Track vendor questionnaires, completed audits, and compliance risk adjustments.</p>
        </div>
        {!isSendFormOpen && (
          <Button
            onClick={() => {
              if (templates && templates.length > 0) {
                const defaultT = templates.find(t => t.isDefault) || templates[0];
                setSelectedTemplateId(defaultT.id);
              }
              setIsSendFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs px-4"
          >
            <Plus className="w-3.5 h-3.5" /> Send Assessment
          </Button>
        )}
      </div>

      {/* Success/Error Notices */}
      {successMsg && (
        <div className="bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] p-4 rounded-xl text-xs font-semibold">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-900/50 text-red-400 p-4 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* INLINE DISPATCH FORM */}
      {isSendFormOpen && (
        <form onSubmit={handleSendAssessment} className="bg-[#08090A] border border-white/10 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h4 className="font-serif text-sm font-bold text-ink-950">New Questionnaire Request</h4>
            <Button 
              type="button" 
              variant="ghost"
              onClick={() => setIsSendFormOpen(false)}
              className="text-xs text-[#6E747A] hover:text-[#9BA1A6] font-bold h-auto px-2 py-1"
            >
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-[#9BA1A6] uppercase block mb-1">Assessment Template *</label>
              <Select
                value={selectedTemplateId}
                onValueChange={(val) => setSelectedTemplateId(val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#9BA1A6] uppercase block mb-1">Recipient Name</label>
              <Input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Compliance Officer"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#9BA1A6] uppercase block mb-1">Recipient Email *</label>
            <Input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. security@partner.com"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="submit"
              disabled={sendAssessmentMutation.isPending}
            >
              {sendAssessmentMutation.isPending ? "Dispatching..." : "Send Request"}
            </Button>
          </div>
        </form>
      )}

      {/* HISTORICAL LOG LIST */}
      {assessments && assessments.length === 0 ? (
        <div className="bg-[#08090A]/50 border border-white/5 rounded-2xl p-8 text-center text-[#6E747A]">
          <Mail className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <h4 className="font-semibold text-[#F4F5F6] text-sm mb-1">No Assessments Found</h4>
          <p className="text-xs text-[#6E747A] max-w-sm mx-auto">
            We haven't sent any security review requests to this vendor yet. Send one to kick off compliance audits.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assessments?.map(({ assessment, template }) => {
            const hasScore = assessment.score !== null;
            const finalScore = hasScore 
              ? Math.max(0, Math.min(100, (assessment.score || 0) + (assessment.scoreAdjustment || 0)))
              : null;

            return (
              <div key={assessment.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl p-5 shadow-panel-elevated space-y-4 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-ink-950 text-sm leading-snug">{template?.name}</h4>
                    <p className="text-xs text-[#6E747A] mt-0.5">Recipient: {assessment.recipientName || 'Security Lead'} ({assessment.recipientEmail})</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    assessment.status === 'completed' 
                      ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
                      : assessment.status === 'expired'
                      ? 'bg-red-500/10 text-red-400 border-red-900/50'
                      : assessment.status === 'in_progress'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-900/50'
                      : 'bg-amber-500/10 text-amber-400 border-amber-900/50'
                  }`}>
                    {assessment.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5 text-xs text-[#9BA1A6]">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] text-[#6E747A] block uppercase font-semibold">Sent Date</span>
                      <span className="font-medium text-[#E6E8EA]">{assessment.sentAt ? new Date(assessment.sentAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    {assessment.completedAt && (
                      <div>
                        <span className="text-[10px] text-[#6E747A] block uppercase font-semibold">Completed Date</span>
                        <span className="font-medium text-[#2d573d]">{new Date(assessment.completedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {assessment.score !== null && (
                      <div>
                        <span className="text-[10px] text-[#6E747A] block uppercase font-semibold">Score</span>
                        <span className="font-bold text-[#F4F5F6]">{finalScore}/100</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Copy Link */}
                    <Button
                      variant="outline"
                      onClick={() => handleCopyLink(assessment.accessToken)}
                      title="Copy access token link"
                      className="inline-flex items-center gap-1 bg-[#0D0F11] border-[#C9A227]/30 text-[#C9A227] h-auto px-3 py-1.5"
                    >
                      {copiedToken === assessment.accessToken ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#C9A227]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Form Link</span>
                        </>
                      )}
                    </Button>

                    {/* Print/View */}
                    <Link
                      href={`/vendors/assessments/${assessment.id}/print`}
                      target="_blank"
                      title="Print Review Report"
                      className="p-1.5 text-[#6E747A] hover:text-[#C9A227] border border-white/10 bg-[#0D0F11] rounded-lg transition-colors shadow-panel-elevated"
                    >
                      <Printer className="w-4 h-4" />
                    </Link>

                    {/* Auditor Review */}
                    {assessment.status === 'completed' && (
                      <Button
                        variant="outline"
                        onClick={() => handleOpenReview(assessment.id, assessment.scoreAdjustment, assessment.aiSummary || '')}
                        title="Audit Review & Overrides"
                        className="inline-flex items-center gap-1 bg-indigo-500/10 border-indigo-900/50 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 h-auto px-3 py-1.5"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Audit Review</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* AI / Audit Override details preview */}
                {assessment.aiSummary && (
                  <div className="bg-[#08090A]/50 border border-white/5 rounded-xl p-3.5 text-xs text-[#E6E8EA] leading-relaxed italic">
                    <strong>Audit Assessment:</strong> &ldquo;{assessment.aiSummary}&rdquo;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* REVIEW AUDIT OVERRIDE INLINE MODAL */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F11] border border-ink-900/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-[#08090A] px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-serif text-lg text-ink-950 font-bold">Auditor Review &amp; Override</h3>
              <Button
                variant="ghost" 
                onClick={() => setIsReviewOpen(false)}
                className="text-[#6E747A] hover:text-[#9BA1A6] font-bold text-sm h-auto px-2 py-1"
              >
                ✕
              </Button>
            </div>
            <form onSubmit={handleSaveReview} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">Score Adjustment Modifier (-50 to +50)</label>
                <Input
                  type="number"
                  required
                  min="-50"
                  max="50"
                  value={reviewScoreAdj}
                  onChange={(e) => setReviewScoreAdj(parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#9BA1A6] uppercase block mb-1">Auditor Review Notes</label>
                <Textarea
                  value={reviewSummary}
                  onChange={(e) => setReviewSummary(e.target.value)}
                  placeholder="Record verification notes, observations, or grounds for adjustments..."
                  className="h-32"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReviewOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={reviewAssessmentMutation.isPending}
                >
                  {reviewAssessmentMutation.isPending ? "Saving..." : "Save Review"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
