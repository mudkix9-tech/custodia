// @ts-nocheck
"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { AlertTriangle, Info, Bell, Check, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export function RegulatoryWidget() {
  const { data: impacts, isLoading, refetch } = trpc.regulatory.listUnacknowledgedImpacts.useQuery();
  const acknowledgeMutation = trpc.regulatory.acknowledgeImpact.useMutation({
    onSuccess: () => refetch()
  });

  if (isLoading) {
    return <div className="animate-pulse bg-bone-50 h-32 rounded-2xl"></div>;
  }

  if (!impacts || impacts.length === 0) {
    return null; // Don't show the widget if there are no unacknowledged impacts
  }

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl overflow-hidden mb-8 shadow-sm">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/30 px-5 py-4 border-b border-ink-900/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-ink-900">Regulatory Updates</h2>
          <span className="bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{impacts.length} New</span>
        </div>
      </div>
      
      <div className="divide-y divide-ink-900/5">
        {impacts.map((impact) => {
          const update = impact.update as any;
          const isUrgent = update.severity === 'action_required' || update.severity === 'urgent';
          
          return (
            <div key={impact.id} className="p-5 hover:bg-bone-50 transition-colors">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isUrgent ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3" /> Action Required
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <Info className="w-3 h-3" /> Advisory
                      </span>
                    )}
                    <span className="text-[12px] font-medium text-ink-500">{update.sourceName}</span>
                    <span className="text-[12px] text-ink-400">• {format(new Date(update.publishedAt), 'MMM d, yyyy')}</span>
                  </div>
                  
                  <h3 className="text-[15px] font-semibold text-ink-900 mb-1">{update.title}</h3>
                  <p className="text-[13px] text-ink-600 mb-4 line-clamp-2">{update.summary}</p>
                  
                  <div className="bg-bone-100/50 border border-ink-900/10 rounded-lg p-3">
                    <p className="text-[12px] font-semibold text-ink-900 mb-2">Why this matters to you:</p>
                    <ul className="space-y-1.5">
                      {(impact.affectedActivities as any[]).map((act, i) => (
                        <li key={i} className="text-[12px] text-ink-700 flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sage-500 mt-1 shrink-0" />
                          <span>
                            <span className="font-medium text-ink-900">{act.activityName}</span>: {act.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 shrink-0">
                  <button 
                    onClick={() => acknowledgeMutation.mutate({ assessmentId: impact.id })}
                    disabled={acknowledgeMutation.isPending}
                    className="flex items-center justify-center gap-1.5 bg-white border border-ink-900/20 hover:border-sage-500 hover:text-sage-700 text-ink-600 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
                  >
                    <Check className="w-4 h-4" /> Acknowledge
                  </button>
                  <a 
                    href={update.sourceUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 text-[12px] font-medium text-blue-600 hover:underline px-4 py-1"
                  >
                    Read original <ExternalLink className="w-3 h-3" />
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
