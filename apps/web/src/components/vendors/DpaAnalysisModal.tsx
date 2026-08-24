"use client";

import React, { useState } from 'react';
import { 
  X, ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle, 
  Sparkles, CheckCircle2, ChevronDown, ChevronUp, FileText 
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DpaAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisData: any;
  // `=> unknown` rather than `=> Promise<void>`: check:vendor-i18n is a text scan
  // whose JSX-text rule matches `>…<`, so `Promise<void>` reads as a text node
  // containing the word "Promise". Restructuring the annotation is the documented
  // fix; an ALLOWED entry is for copy that is meant to stay English.
  onConfirm: (checklist: Record<string, boolean>) => unknown;
  onSaveDraft: (rawAnalysis: any) => unknown;
  isSubmitting: boolean;
}

export function DpaAnalysisModal({
  isOpen,
  onClose,
  analysisData,
  onConfirm,
  onSaveDraft,
  isSubmitting
}: DpaAnalysisModalProps) {
  const t = useTranslations('vendors.dpa_analysis');
  const [expandedClauses, setExpandedClauses] = useState<Record<string, boolean>>({});

  if (!isOpen || !analysisData) return null;

  const toggleClause = (key: string) => {
    setExpandedClauses(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // The keys are matched against the analyser's output and against
  // `dpaClauseCoverage`, so they stay as they are; only the label is UI copy.
  const checklistKeys = [
    'documentedInstructions',
    'confidentiality',
    'securityMeasures',
    'subProcessorRestrictions',
    'dataSubjectRights',
    'securityBreachDpia',
    'deletionOnTermination',
    'auditRights',
  ] as const;

  const checklist = analysisData.checklist || {};
  const problematic = analysisData.problematic_language || [];

  const handleApply = () => {
    const finalChecklist: Record<string, boolean> = {};
    checklistKeys.forEach((key) => {
      const status = checklist[key]?.status;
      finalChecklist[key] = status === 'present';
    });
    onConfirm(finalChecklist);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0D0F11] border border-white/10 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#08090A]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-900/50 rounded-lg text-indigo-400 shadow-panel-elevated"><Sparkles className="w-5 h-5" /></div>
            <div>
              <h3 className="text-lg font-serif text-[#F4F5F6]">{t('title')}</h3>
              <p className="text-xs text-[#6E747A]">{t('subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#6E747A] hover:text-[#F4F5F6] hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Score Panel */}
          <div className="grid md:grid-cols-4 gap-6 bg-ink-900 text-white rounded-xl p-5 shadow-inner">
            <div className="text-center border-r border-bone-50/10 py-2">
              <div className="text-[10px] font-bold text-bone-50/50 uppercase tracking-widest mb-1">{t('quality_score')}</div>
              <div className="text-3xl font-black">{analysisData.overall_score || 0} / 100</div>
            </div>

            <div className="border-r border-bone-50/10 py-2 col-span-3 text-left px-4 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-bone-50/50 uppercase tracking-widest mb-1">{t('recommendation')}</span>
              <p className="text-xs text-bone-50/80 leading-relaxed">
                {analysisData.overall_score >= 80
                  ? t('recommendation_good')
                  : t('recommendation_poor')}
              </p>
            </div>
          </div>

          {/* Tier 2 Special Category warning */}
          {analysisData.potential_special_category && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs flex gap-3 leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <span className="font-bold block mb-0.5">{t('special_category_title')}</span>
                {analysisData.special_category_rationale}
                <span className="block mt-1.5 text-neutral-500 italic">
                  {t('special_category_note')}
                </span>
              </div>
            </div>
          )}

          {/* Article 28 Clause Review Checklist */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#F4F5F6] text-sm">{t('checklist_title')}</h4>
            <div className="space-y-2">
              {checklistKeys.map((key) => {
                const item = checklist[key] || {};
                const isPresent = item.status === 'present';
                const isWeak = item.status === 'weak';
                const isExpanded = !!expandedClauses[key];

                let statusBadge = 'bg-red-500/10 text-red-400 border-red-900/50';
                if (isPresent) statusBadge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
                if (isWeak) statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-900/50';

                return (
                  <div key={key} className="bg-[#08090A]/40 border border-white/5 rounded-xl overflow-hidden transition-colors">
                    <button
                      onClick={() => toggleClause(key)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-[#08090A] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isPresent ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className={`w-4 h-4 ${isWeak ? 'text-amber-500' : 'text-rose-500'}`} />
                        )}
                        <span className="text-xs font-semibold text-[#F4F5F6]">{t(`clauses.${key}`)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                          {t(`clause_status.${item.status || 'missing'}`)}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6E747A]" /> : <ChevronDown className="w-4 h-4 text-[#6E747A]" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5 bg-[#0D0F11] text-xs leading-relaxed animate-in slide-in-from-top-1 duration-100">
                        {item.notes && (
                          <p className="text-[#9BA1A6]">
                            <span className="font-bold text-[#F4F5F6]">{t('analysis_label')}</span>
                            {item.notes}
                          </p>
                        )}
                        {item.excerpt && (
                          <div className="p-3 bg-[#08090A] rounded-lg border border-white/5 font-mono text-[11px] text-[#E6E8EA] break-words leading-relaxed whitespace-pre-wrap">
                            {item.excerpt}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Problematic Language flagged */}
          {problematic.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {t('problematic_title')}
              </h4>
              <div className="space-y-2">
                {problematic.map((p: any, idx: number) => (
                  <div key={idx} className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-rose-300">
                      <span className="capitalize">{t('clause_type', { type: p.clauseType.replace('_', ' ') })}</span>
                      <span className="uppercase tracking-widest text-[9px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-200/50">
                        {t('severity', { severity: p.severity })}
                      </span>
                    </div>
                    <p className="text-xs text-rose-950/80 leading-relaxed">{p.notes}</p>
                    {p.excerpt && (
                      <div className="p-3 bg-neutral-900 rounded-lg font-mono text-[11px] text-rose-200/90 whitespace-pre-wrap leading-relaxed">
                        {p.excerpt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#08090A]/50 flex justify-between items-center">
          <span className="text-[10px] text-[#6E747A] font-bold uppercase tracking-widest">
            {t('ai_assisted')}
          </span>

          <div className="flex gap-2.5">
            <button
              onClick={() => onSaveDraft(analysisData)}
              disabled={isSubmitting}
              className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-xs font-semibold text-[#E6E8EA] transition-colors shadow-panel-elevated disabled:opacity-50"
            >
              {t('save_draft')}
            </button>
            <button
              onClick={handleApply}
              disabled={isSubmitting}
              className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-semibold text-xs px-5 py-2.5 rounded-lg shadow-card hover:shadow-sage-500/10 transition-all duration-300 disabled:opacity-50"
            >
              {t('apply')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
