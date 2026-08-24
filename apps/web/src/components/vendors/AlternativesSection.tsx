"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { Sparkles, ArrowRight, ShieldCheck, Globe } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function AlternativesSection({ vendorId }: { vendorId: string }) {
  const t = useTranslations('vendors.alternatives');
  const { data: alternatives, isLoading } = trpc.vendors.getPrivacyAlternatives.useQuery({ vendorId });

  if (isLoading) {
    return (
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated animate-pulse space-y-4">
        <div className="h-5 bg-white/10 rounded w-1/2"></div>
        <div className="h-12 bg-white/5 rounded"></div>
        <div className="h-12 bg-white/5 rounded"></div>
      </div>
    );
  }

  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#C9A227] shrink-0" />
        <h3 className="text-base font-serif text-[#F4F5F6]">{t('title')}</h3>
      </div>
      <p className="text-[13px] text-[#6E747A] leading-relaxed">
        {t('subtitle')}
      </p>

      <div className="space-y-3">
        {alternatives.map((alt: any) => {
          let riskColor = 'text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/30';
          if (alt.riskLevel === 'medium') riskColor = 'text-amber-400 bg-amber-500/10 border-amber-900/50';
          if (alt.riskLevel === 'high' || alt.riskLevel === 'critical') riskColor = 'text-rose-300 bg-rose-500/10 border-rose-500/25';

          return (
            <div
              key={alt.id}
              className="group relative flex flex-col p-4 rounded-xl border border-white/5 bg-[#08090A]/30 hover:bg-[#08090A]/80 hover:border-white/10 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-[#F4F5F6] text-sm">{alt.name}</h4>
                  <a
                    href={alt.website || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#C9A227] hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <span>{alt.website?.replace('https://', '')}</span>
                  </a>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${riskColor}`}>
                  {t('risk', { score: alt.riskScore || 0 })}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {alt.isPrivacyFriendly && (
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                    {t('privacy_friendly')}
                  </span>
                )}
                {alt.headquartersCountry && (
                  <span className="bg-ink-900/5 text-[#9BA1A6] text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 shrink-0" />
                    {t('hq', { country: alt.headquartersCountry })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
