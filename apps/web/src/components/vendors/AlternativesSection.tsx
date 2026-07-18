"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { Sparkles, ArrowRight, ShieldCheck, Globe } from 'lucide-react';
import Link from 'next/link';

export function AlternativesSection({ vendorId }: { vendorId: string }) {
  const { data: alternatives, isLoading } = trpc.vendors.getPrivacyAlternatives.useQuery({ vendorId });

  if (isLoading) {
    return (
      <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm animate-pulse space-y-4">
        <div className="h-5 bg-bone-200 rounded w-1/2"></div>
        <div className="h-12 bg-bone-100 rounded"></div>
        <div className="h-12 bg-bone-100 rounded"></div>
      </div>
    );
  }

  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-sage-600 shrink-0" />
        <h3 className="text-base font-serif text-ink-900">Privacy Alternatives</h3>
      </div>
      <p className="text-[13px] text-ink-500 leading-relaxed">
        Consider these lower-risk alternative vendors within the same category:
      </p>

      <div className="space-y-3">
        {alternatives.map((alt: any) => {
          let riskColor = 'text-sage-600 bg-sage-50 border-sage-200';
          if (alt.riskLevel === 'medium') riskColor = 'text-amber-700 bg-amber-50 border-amber-200';
          if (alt.riskLevel === 'high' || alt.riskLevel === 'critical') riskColor = 'text-rose-700 bg-rose-50 border-rose-200';

          return (
            <div 
              key={alt.id} 
              className="group relative flex flex-col p-4 rounded-xl border border-ink-900/5 bg-bone-50/30 hover:bg-bone-50/80 hover:border-ink-900/10 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-ink-900 text-sm">{alt.name}</h4>
                  <a 
                    href={alt.website || '#'} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[11px] text-sage-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <span>{alt.website?.replace('https://', '')}</span>
                  </a>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${riskColor}`}>
                  Risk: {alt.riskScore || 0}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {alt.isPrivacyFriendly && (
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                    Privacy Friendly
                  </span>
                )}
                {alt.headquartersCountry && (
                  <span className="bg-ink-900/5 text-ink-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 shrink-0" />
                    HQ: {alt.headquartersCountry}
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
