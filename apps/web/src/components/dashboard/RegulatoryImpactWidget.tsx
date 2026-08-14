"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { AlertTriangle, Info, Bell, Check, ExternalLink, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

export function RegulatoryImpactWidget() {
  const t = useTranslations('dashboard.regulatory');
  const { data: groupedImpacts, isLoading } = trpc.regulatory.listUnacknowledgedImpacts.useQuery();
  const utils = trpc.useUtils();
  const acknowledgeMutation = trpc.regulatory.acknowledgeImpact.useMutation({
    onSuccess: () => utils.regulatory.listUnacknowledgedImpacts.invalidate()
  });

  if (isLoading || !groupedImpacts || groupedImpacts.length === 0) {
    return null; 
  }

  // Determine highest overall severity among all updates for the header
  const hasAnyHighConfidence = groupedImpacts.some(group => group.matches.some((m: any) => m.confidence === 'high'));

  return (
    <div className={`bg-[#0D0F11] border rounded-2xl overflow-hidden mb-8 shadow-panel-elevated ${
      hasAnyHighConfidence ? 'border-amber-900/50' : 'border-indigo-900/50'
    }`}>
      <div className={`px-5 py-4 border-b flex items-center justify-between ${
        hasAnyHighConfidence ? 'bg-gradient-to-r from-amber-50 to-orange-50/30 border-amber-900/50' : 'bg-gradient-to-r from-blue-50 to-indigo-500/10 border-indigo-900/50'
      }`}>
        <div className="flex items-center gap-2">
          {hasAnyHighConfidence ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : (
            <Bell className="w-5 h-5 text-indigo-400" />
          )}
          <h2 className={`font-semibold ${hasAnyHighConfidence ? 'text-amber-950' : 'text-[#F4F5F6]'}`}>{t('title')}</h2>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            hasAnyHighConfidence ? 'bg-amber-500/15 text-amber-300' : 'bg-indigo-500/15 text-indigo-400'
          }`}>{t('new_count', { count: groupedImpacts.length })}</span>
        </div>
      </div>
      
      <div className={`divide-y ${hasAnyHighConfidence ? 'divide-amber-100' : 'divide-indigo-50'}`}>
        {groupedImpacts.map((group: any) => {
          const update = group.update;
          const matches = group.matches;
          
          const hasHigh = matches.some((m: any) => m.confidence === 'high');
          
          return (
            <div key={update.id} className="p-5 hover:bg-[#08090A] transition-colors">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {hasHigh ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3" /> {t('high_impact')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <Info className="w-3 h-3" /> {t('advisory')}
                      </span>
                    )}
                    <span className="text-[12px] font-medium text-[#6E747A]">{update.sourceName}</span>
                    <span className="text-[12px] text-[#6E747A]">• {format(new Date(update.publishedAt), 'MMM d, yyyy')}</span>
                  </div>
                  
                  <h3 className="text-[15px] font-semibold text-[#F4F5F6] mb-1">{update.title}</h3>
                  <p className="text-[13px] text-[#9BA1A6] mb-4 line-clamp-2">{update.summary}</p>
                  
                  <div className={`border rounded-lg p-3 ${
                    hasHigh ? 'bg-amber-500/50 border-amber-900/50' : 'bg-indigo-500/15 border-indigo-900/50'
                  }`}>
                    <p className={`text-[12px] font-semibold mb-2 ${hasHigh ? 'text-amber-300' : 'text-indigo-300'}`}>
                      {t('affected_entities')}
                    </p>
                    <ul className="space-y-2">
                      {matches.map((match: any, i: number) => (
                        <li key={i} className="text-[12px] text-[#E6E8EA] flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 font-medium text-[#F4F5F6]">
                            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 shrink-0 ${
                              match.confidence === 'high' ? 'bg-amber-500/100' : 'bg-indigo-400'
                            }`} />
                            {match.entityName || match.entityType.replace('_', ' ')}
                          </div>
                          <span className="pl-3 text-[#9BA1A6] leading-snug line-clamp-2">{match.aiExplanation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 shrink-0">
                  <button 
                    onClick={() => acknowledgeMutation.mutate({ updateId: update.id })}
                    disabled={acknowledgeMutation.isPending}
                    className="flex items-center justify-center gap-1.5 bg-[#0D0F11] border border-white/20 hover:border-[#C9A227]/50 hover:text-[#C9A227] text-[#9BA1A6] px-4 py-2 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> {t('acknowledge')}
                  </button>
                  <a 
                    href={`/updates`} 
                    className="flex items-center justify-center gap-1 text-[12px] font-medium text-blue-400 hover:underline px-4 py-1"
                  >
                    {t('view_details')} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
