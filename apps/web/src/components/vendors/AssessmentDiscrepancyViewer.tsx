"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle,
  FileWarning,
  Scale
} from 'lucide-react';

export interface DiscrepancyItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  claimedFact: string;
  verifiedFact: string;
  explanation: string;
  gdprArticle: string;
  recommendation: string;
}

interface AssessmentDiscrepancyViewerProps {
  discrepancies: DiscrepancyItem[];
  riskPenalty?: number;
  vendorName: string;
}

export function AssessmentDiscrepancyViewer({
  discrepancies,
  riskPenalty = 0,
  vendorName,
}: AssessmentDiscrepancyViewerProps) {
  const t = useTranslations('vendors');

  if (!discrepancies || discrepancies.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-[#08090A] border border-white/5 flex items-center gap-3 text-xs text-[#9BA1A6]">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>{t('discrepancies.no_discrepancies', { name: vendorName })}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-amber-400" />
          <h4 className="text-sm font-semibold text-[#F4F5F6]">
            {t('discrepancies.section_title', { count: discrepancies.length })}
          </h4>
        </div>
        {riskPenalty > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20">
            +{riskPenalty} {t('discrepancies.risk_penalty')}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {discrepancies.map((d) => {
          const badgeClass =
            d.severity === 'critical'
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : d.severity === 'high'
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : d.severity === 'medium'
              ? 'text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20'
              : 'text-sky-400 bg-sky-500/10 border-sky-500/20';

          return (
            <div
              key={d.id}
              className="p-4 rounded-xl bg-[#08090A] border border-white/10 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeClass}`}>
                    {d.severity.toUpperCase()}
                  </span>
                  <span className="ml-2 text-xs font-mono text-[#6E747A]">{d.gdprArticle}</span>
                </div>
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#9BA1A6]">
                    {t('discrepancies.claimed_fact')}
                  </span>
                  <p className="text-[#F4F5F6] italic">"{d.claimedFact}"</p>
                </div>
                <div className="p-3 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/20 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#C9A227]">
                    {t('discrepancies.verified_telemetry')}
                  </span>
                  <p className="text-[#F4F5F6]">{d.verifiedFact}</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <p className="text-[#9BA1A6]">{d.explanation}</p>
                <div className="flex items-start gap-1.5 text-[#C9A227] bg-[#C9A227]/5 p-2.5 rounded-lg border border-[#C9A227]/10">
                  <Scale className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed font-medium">
                    <span className="font-semibold">{t('discrepancies.recommendation')}: </span>
                    {d.recommendation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
