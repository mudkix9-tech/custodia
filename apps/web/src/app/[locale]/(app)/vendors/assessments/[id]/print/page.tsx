"use client";

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Loader2, Printer, ShieldCheck, Mail, Globe, Clock, FileText, CheckSquare } from 'lucide-react';

export default function AssessmentPrintPage() {
  const t = useTranslations('vendors');
  const params = useParams();
  const id = params?.id as string;

  const { data: assessment, isLoading: isQueryLoading, error: queryError } = 
    trpc.assessments.getAssessments.useQuery({ limit: 1 }) // Retrieve all and find the match
    
  // Since getAssessments returns all, let's find the matching record by id
  const record = assessmentsData()?.find(a => a.assessment.id === id);

  function assessmentsData() {
    return assessment;
  }

  // Trigger print dialog automatically when loaded (if print parameter is set) or manual button click
  const handlePrint = () => {
    window.print();
  };

  if (isQueryLoading) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-[#C9A227] animate-spin mb-3" />
        <p className="text-sm text-neutral-500 font-medium">{t('print.loading')}</p>
      </div>
    );
  }

  if (queryError || !record) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-md border border-neutral-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">{t('print.not_found')}</h2>
          <p className="text-sm text-neutral-500 mb-4">
            {t('print.not_found_description')}
          </p>
        </div>
      </div>
    );
  }

  const { assessment: a, vendorName, template } = record;
  const questions = (a.questionsSnapshot || []) as any[];
  const responses = (a.responses || {}) as Record<string, string>;

  const hasScore = a.score !== null;
  const finalScore = hasScore 
    ? Math.max(0, Math.min(100, (a.score || 0) + (a.scoreAdjustment || 0)))
    : null;

  return (
    <div className="min-h-screen bg-white text-neutral-900 p-8 sm:p-12 print:p-0 max-w-4xl mx-auto space-y-8">
      {/* Top Print Utility Bar (Hidden during print) */}
      <div className="print:hidden flex justify-between items-center bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-6 shadow-panel-elevated">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{t('print.banner')}</span>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-panel-elevated"
        >
          <Printer className="w-4 h-4" /> {t('print.print_button')}
        </button>
      </div>

      {/* Header compliance title */}
      <div className="border-b-2 border-neutral-900 pb-6 flex justify-between items-start">
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t('print.provenance')}</span>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 font-serif">{t('print.title')}</h1>
          <p className="text-sm text-neutral-500 mt-1">{t('print.vendor_line', { vendor: vendorName ?? '', template: template?.name ?? '' })}</p>
        </div>
        
        {hasScore && (
          <div className="text-right border border-neutral-300 rounded-lg p-3 bg-neutral-50/50">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t('print.score_label')}</span>
            <span className="text-3xl font-extrabold text-neutral-900">{finalScore}/100</span>
          </div>
        )}
      </div>

      {/* Provenance Metadata Table (Critical for Art. 30 Audit trails) */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500 border-b border-neutral-200 pb-1">{t('print.review_details')}</h4>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600">{t('print.completed_at')}</span>
            <span className="font-semibold text-neutral-800">{a.completedAt ? new Date(a.completedAt).toLocaleString() : t('print.pending')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600">{t('print.respondent_email')}</span>
            <span className="font-semibold text-neutral-800">{a.respondentEmail || a.recipientEmail}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500 border-b border-neutral-200 pb-1">{t('print.identity')}</h4>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600">{t('print.respondent_ip')}</span>
            <span className="font-mono text-xs font-semibold text-neutral-800">{a.respondentIp || t('print.ip_unavailable')}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600">{t('print.status')}</span>
            <span className="font-semibold text-neutral-800 uppercase tracking-wider text-xs px-2 py-0.5 bg-neutral-200 rounded">{t(`assessments.filters.${a.status}`)}</span>
          </div>
        </div>
      </div>

      {/* AI Evaluation / Auditor Override Review */}
      <div className="border border-neutral-200 rounded-xl p-6 bg-neutral-50/30 space-y-3">
        <h3 className="font-bold text-sm text-neutral-800 uppercase tracking-wider border-b border-neutral-200 pb-2">{t('print.ai_summary')}</h3>
        {a.aiSummary ? (
          <p className="text-sm text-neutral-700 leading-relaxed italic">
            &ldquo;{a.aiSummary}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-neutral-400 italic">{t('print.no_summary')}</p>
        )}
        {a.scoreAdjustment !== 0 && (
          <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 inline-block">
            {t('print.adjustment_applied', { points: a.scoreAdjustment })}
          </div>
        )}
      </div>

      {/* Question list & answer grid */}
      <div className="space-y-6">
        <h3 className="font-bold text-sm text-neutral-800 uppercase tracking-wider border-b border-neutral-300 pb-2">{t('print.responses')}</h3>
        {questions.map((q, idx) => {
          const ans = responses[q.id];
          return (
            <div key={q.id} className="border-b border-neutral-200 pb-5 last:border-b-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  {t('print.question_label', { number: idx + 1, category: q.category })}
                </span>
              </div>
              <h4 className="font-bold text-base text-neutral-900 mb-3 leading-snug">{q.text}</h4>
              
              {q.type === 'choice' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt: any) => {
                    const isSelected = ans === opt.text;
                    return (
                      <div 
                        key={opt.text}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm ${
                          isSelected 
                            ? 'bg-neutral-100 border-neutral-800 font-semibold text-neutral-900' 
                            : 'bg-white border-neutral-200 text-neutral-500'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${isSelected ? 'text-neutral-900' : 'text-neutral-300'}`} />
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-800 italic leading-relaxed whitespace-pre-wrap">
                  {ans || t('print.no_response')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Page Break styling specifically for PDF export print rendering */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 2cm !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          .page-break {
            page-break-before: always !important;
          }
        }
      `}</style>
    </div>
  );
}
