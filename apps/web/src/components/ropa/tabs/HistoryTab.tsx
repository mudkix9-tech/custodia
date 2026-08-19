"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Clock, Loader2, Activity, PlusCircle, Trash2, Edit } from 'lucide-react';

export function HistoryTab({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.history');
  const { data: logs, isLoading } = trpc.ropa.history.list.useQuery({ activityId });
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center" role="status" aria-label={t('loading')}>
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" aria-hidden="true" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-white/20 rounded-2xl bg-[#08090A]/50 max-w-3xl">
        <Clock className="w-6 h-6 text-[#6E747A] mx-auto mb-3" />
        <p className="text-[13px] text-[#6E747A]">{t('empty')}</p>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return <PlusCircle className="w-4 h-4 text-[#C9A227]" />;
    if (action.includes('delete')) return <Trash2 className="w-4 h-4 text-clay-600" />;
    return <Edit className="w-4 h-4 text-amber-400" />;
  };

  // The server already writes a description through ACTION_DESCRIPTIONS, including
  // for the child rows that now log against their activity. This switch covered
  // three strings and rendered a raw tRPC path for everything else.
  const getActionText = (log: any) => {
    if (log.description) return log.description;
    switch (log.action) {
      case 'ropa.create': return t('created');
      case 'ropa.update': return t('updated');
      case 'ropa.delete': return t('deleted');
      default: return log.action;
    }
  };

  // audit_logs stores the diff in `changes`, as { field: { old, new } }. This read
  // `newValue`/`details`, neither of which is a column, so the guard below always
  // failed and "View Diff" expanded an empty box.
  const renderDiff = (diff: any) => {
    if (!diff || typeof diff !== 'object') return null;

    const changes = Object.entries(diff)
      .filter(([key]) => !['updatedAt', 'createdAt'].includes(key))
      .map(([key, value]: [string, any]) => ({ key, old: value?.old, new: value?.new }));

    if (changes.length === 0) return <div className="text-[12px] text-[#6E747A] italic mt-2">{t('no_changes')}</div>;

    return (
      <div className="mt-3 space-y-2">
        {changes.map(change => (
          <div key={change.key} className="text-[12px] font-mono bg-[#0D0F11] border border-white/10 rounded-md overflow-hidden">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 font-medium text-[#E6E8EA]">
              {change.key}
            </div>
            {/* R141. The minus and plus are the non-colour carriers of "before" and
                "after"; red-and-green alone is the one pairing a colour-blind reader
                is least likely to separate. */}
            <div className="grid grid-cols-2 divide-x divide-ink-900/10">
              <div className="p-2 bg-red-500/10 text-red-400 break-all">
                <span className="mr-2 select-none text-red-400" aria-label={t('before')}>-</span>
                {typeof change.old === 'object' ? JSON.stringify(change.old) : String(change.old || 'null')}
              </div>
              <div className="p-2 bg-green-500/10 text-green-400 break-all">
                <span className="mr-2 select-none text-green-400" aria-label={t('after')}>+</span>
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
          <Activity className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
          {t('title')}
        </h2>

        <div className="space-y-4">
          {logs.map((log) => {
            const date = new Date(log.createdAt!).toLocaleString();
            const diff = (log as any).changes;
            const isExpanded = expandedLogId === log.id;

            return (
              <div key={log.id} className="relative pl-6 pb-4 border-l border-white/10 last:border-transparent last:pb-0">
                <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#08090A] border border-white/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                </div>
                
                <div className="bg-[#0D0F11] hairline rounded-xl p-4 shadow-panel-elevated">
                  <div
                    role={log.action === 'ropa.update' ? 'button' : undefined}
                    tabIndex={log.action === 'ropa.update' ? 0 : undefined}
                    aria-expanded={log.action === 'ropa.update' ? isExpanded : undefined}
                    className="flex items-start justify-between cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    onKeyDown={(e) => {
                      if (log.action !== 'ropa.update') return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedLogId(isExpanded ? null : log.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getActionIcon(log.action)}</div>
                      <div>
                        <div className="text-[13px] font-medium text-[#F4F5F6]">{getActionText(log)}</div>
                        <div className="text-[12px] text-[#6E747A] mt-0.5">{date}</div>
                      </div>
                    </div>
                    
                    {log.action === 'ropa.update' && (
                      <div className="text-[12px] text-[#C9A227] font-medium bg-[#C9A227]/10 px-2 py-1 rounded">
                        {isExpanded ? t('hide_diff') : t('view_diff')}
                      </div>
                    )}
                  </div>

                  {isExpanded && log.action === 'ropa.update' && (
                    <div className="mt-4 pt-4 border-t border-ink-900/8 animate-in fade-in slide-in-from-top-2 duration-200">
                      {renderDiff(diff)}
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
