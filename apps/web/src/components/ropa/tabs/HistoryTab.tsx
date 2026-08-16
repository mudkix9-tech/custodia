"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Clock, Loader2, ArrowRight, Activity, PlusCircle, Trash2, Edit } from 'lucide-react';

export function HistoryTab({ activityId }: { activityId: string }) {
  const { data: logs, isLoading } = trpc.ropa.history.list.useQuery({ activityId });
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" /></div>;
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-white/20 rounded-2xl bg-[#08090A]/50 max-w-3xl">
        <Clock className="w-6 h-6 text-[#6E747A] mx-auto mb-3" />
        <p className="text-[13px] text-[#6E747A]">No history found for this activity.</p>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return <PlusCircle className="w-4 h-4 text-[#C9A227]" />;
    if (action.includes('delete')) return <Trash2 className="w-4 h-4 text-clay-600" />;
    return <Edit className="w-4 h-4 text-amber-400" />;
  };

  const getActionText = (action: string) => {
    switch(action) {
      case 'ropa.create': return 'Created activity';
      case 'ropa.update': return 'Updated activity';
      case 'ropa.delete': return 'Deleted activity';
      default: return action;
    }
  };

  const renderDiff = (oldData: any, newData: any) => {
    if (!oldData || !newData) return null;
    
    const changes: { key: string, old: any, new: any }[] = [];
    
    // Simple flat comparison for the top level keys
    Object.keys(newData).forEach(key => {
      // ignore internal keys
      if (['updatedAt', 'createdAt'].includes(key)) return;
      
      const oldVal = JSON.stringify(oldData[key]);
      const newVal = JSON.stringify(newData[key]);
      
      if (oldVal !== newVal) {
        changes.push({
          key,
          old: oldData[key],
          new: newData[key]
        });
      }
    });

    if (changes.length === 0) return <div className="text-[12px] text-[#6E747A] italic mt-2">No structural changes detected (likely just an auto-save).</div>;

    return (
      <div className="mt-3 space-y-2">
        {changes.map(change => (
          <div key={change.key} className="text-[12px] font-mono bg-[#0D0F11] border border-white/10 rounded-md overflow-hidden">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 font-medium text-[#E6E8EA]">
              {change.key}
            </div>
            <div className="grid grid-cols-2 divide-x divide-ink-900/10">
              <div className="p-2 bg-red-500/10 text-red-400 break-all">
                <span className="text-red-400 select-none mr-2">-</span>
                {typeof change.old === 'object' ? JSON.stringify(change.old) : String(change.old || 'null')}
              </div>
              <div className="p-2 bg-green-500/10 text-green-400 break-all">
                <span className="text-green-400 select-none mr-2">+</span>
                {typeof change.new === 'object' ? JSON.stringify(change.new) : String(change.new || 'null')}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl fade-up">
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#6E747A]" />
          Audit Trail
        </h2>

        <div className="space-y-4">
          {logs.map((log) => {
            const date = new Date(log.createdAt!).toLocaleString();
            const details = (log as any).newValue || (log as any).details;
            const isExpanded = expandedLogId === log.id;

            return (
              <div key={log.id} className="relative pl-6 pb-4 border-l border-white/10 last:border-transparent last:pb-0">
                <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#08090A] border border-white/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                </div>
                
                <div className="bg-[#0D0F11] hairline rounded-xl p-4 shadow-panel-elevated">
                  <div 
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getActionIcon(log.action)}</div>
                      <div>
                        <div className="text-[13px] font-medium text-[#F4F5F6]">{getActionText(log.action)}</div>
                        <div className="text-[12px] text-[#6E747A] mt-0.5">{date}</div>
                      </div>
                    </div>
                    
                    {log.action === 'ropa.update' && (
                      <div className="text-[12px] text-[#C9A227] font-medium bg-[#C9A227]/10 px-2 py-1 rounded">
                        {isExpanded ? 'Hide Diff' : 'View Diff'}
                      </div>
                    )}
                  </div>

                  {isExpanded && log.action === 'ropa.update' && details && (
                    <div className="mt-4 pt-4 border-t border-ink-900/8 animate-in fade-in slide-in-from-top-2 duration-200">
                      {renderDiff(details.old, details.new)}
                    </div>
                  )}
                  
                  {isExpanded && log.action === 'ropa.create' && details && (
                    <div className="mt-4 pt-4 border-t border-ink-900/8 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="text-[12px] text-[#9BA1A6] bg-white/5 p-3 rounded-lg font-mono break-all">
                        {JSON.stringify(details.changes, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
