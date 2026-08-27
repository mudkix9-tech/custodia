"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { 
  Gavel, 
  ExternalLink, 
  AlertCircle, 
  ShieldAlert, 
  CheckCircle2,
  Calendar,
  Euro
} from 'lucide-react';

export function VendorEnforcementFeed() {
  const t = useTranslations('vendors');
  const { data: decisions, isLoading } = trpc.vendors.getEnforcementFeed.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 flex items-center justify-center text-xs text-[#9BA1A6]">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-[#C9A227] border-t-transparent rounded-full" />
        {t('enforcement.loading')}
      </div>
    );
  }

  if (!decisions || decisions.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 flex items-center gap-3 text-xs text-[#9BA1A6]">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>{t('enforcement.no_enforcement_actions')}</span>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
            <Gavel className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F4F5F6]">
              {t('enforcement.panel_title')}
            </h4>
            <p className="text-xs text-[#9BA1A6] mt-0.5">
              {t('enforcement.panel_subtitle', { count: decisions.length })}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {decisions.map((d) => (
          <div key={d.id} className="py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#F4F5F6]">
                    {d.matchedVendorName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                    {d.authority} ({d.country})
                  </span>
                  {d.fineAmountEur && d.fineAmountEur > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20">
                      €{(d.fineAmountEur / 1000000).toFixed(1)}M
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-[#6E747A] flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {d.decisionDate} • <span className="font-mono">{d.legalBasis}</span>
                </p>
              </div>

              {d.sourceUrl && (
                <a
                  href={d.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-[#9BA1A6] hover:text-[#F4F5F6] hover:bg-white/5 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            <p className="text-xs text-[#9BA1A6] leading-relaxed">
              {d.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
