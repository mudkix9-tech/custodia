"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Clock, ShieldAlert, LayoutGrid, List } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { useTranslations } from 'next-intl';

type ViewMode = 'kanban' | 'datagrid';

export function DsarDashboardClient({ isGroupContext }: { isGroupContext?: boolean }) {
  const t = useTranslations('dsar');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  const COLUMNS = [
    { id: 'new', label: t('status_columns.new') },
    { id: 'identity_verification', label: t('status_columns.verification') },
    { id: 'in_progress', label: t('status_columns.in_progress') },
    { id: 'pending_review', label: t('status_columns.review') },
    { id: 'completed', label: t('status_columns.completed') },
  ];
  const {
    data: requestsResp,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.dsar.list.useInfiniteQuery(
    { limit: 25, includeChildEntities: isGroupContext },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const requests = requestsResp?.pages.flatMap((page: any) => page.data) || [];

  if (isLoading) return <div className="text-[#6E747A]">{t('loading')}</div>;

  return (
    <div>
      <div className="flex justify-end mb-6">
        <div className="bg-white/5 p-1 rounded-lg flex gap-1">
          <button 
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-[#0D0F11] shadow-panel-elevated' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('datagrid')}
            className={`p-1.5 rounded-md ${viewMode === 'datagrid' ? 'bg-[#0D0F11] shadow-panel-elevated' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colRequests = requests.filter((r: any) => r.status === col.id);
            return (
              <div key={col.id} className="min-w-[300px] w-[300px] flex-shrink-0 bg-[#08090A]/50 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="font-semibold text-[13px] text-[#F4F5F6] uppercase tracking-wider">{col.label}</h3>
                  <span className="bg-[#0D0F11] border border-white/10 text-[#9BA1A6] text-xs px-2 py-0.5 rounded-full font-medium">
                    {colRequests.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colRequests.map((request: any) => {
                    const daysRemaining = differenceInDays(new Date(request.deadlineAt), new Date());
                    let deadlineColor = 'text-[#C9A227] bg-[#C9A227]/10';
                    if (daysRemaining <= 14 && daysRemaining > 7) deadlineColor = 'text-amber-400 bg-amber-500/10';
                    if (daysRemaining <= 7) deadlineColor = 'text-red-400 bg-red-500/10 font-bold';
                    if (daysRemaining < 0) deadlineColor = 'text-red-400 bg-red-500/20 font-bold animate-pulse';

                    return (
                      <Link 
                        href={isGroupContext ? `/group/dsar/${request.id}` : `/dsar/${request.id}`} 
                        key={request.id}
                        className="block bg-[#0D0F11] p-4 rounded-xl border border-white/10 shadow-panel-elevated hover:shadow-md transition-shadow group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-mono font-medium text-[#6E747A]">{request.referenceNumber}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${deadlineColor}`}>
                            <Clock className="w-3 h-3" />
                            {daysRemaining < 0 ? t('deadline.overdue') : t('deadline.days', { count: daysRemaining })}
                          </span>
                        </div>
                        <h4 className="font-medium text-[#F4F5F6] text-sm mb-1">{request.subjectName.split(' ')[0]}</h4>
                        {isGroupContext && (
                          <div className="text-[11px] text-[#9BA1A6] font-medium mb-1 truncate">{request.organizationName || t('unknown_entity')}</div>
                        )}
                        <div className="text-xs text-[#6E747A] capitalize">{request.requestType}</div>
                        {!request.subjectVerified && (
                          <div className="mt-3 flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">
                            <ShieldAlert className="w-3 h-3" /> {t('unverified')}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 overflow-hidden shadow-panel-elevated">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#08090A] border-b border-white/10 text-[#6E747A] text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                {isGroupContext && <th className="px-6 py-4">{t('table_headers.entity')}</th>}
                <th className="px-6 py-4">{t('table_headers.reference')}</th>
                <th className="px-6 py-4">{t('table_headers.subject')}</th>
                <th className="px-6 py-4">{t('table_headers.type')}</th>
                <th className="px-6 py-4">{t('table_headers.status')}</th>
                <th className="px-6 py-4">{t('table_headers.deadline')}</th>
                <th className="px-6 py-4">{t('table_headers.verification')}</th>
                <th className="px-6 py-4">{t('table_headers.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {requests.map((request: any) => (
                <tr key={request.id} className="hover:bg-[#08090A]/50">
                  {isGroupContext && (
                    <td className="px-6 py-4 text-[13px] text-[#9BA1A6] font-medium">
                      {request.organizationName || t('unknown_entity')}
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono text-[13px]">{request.referenceNumber}</td>
                  <td className="px-6 py-4 font-medium text-[#F4F5F6]">{request.subjectName}</td>
                  <td className="px-6 py-4 capitalize">{request.requestType}</td>
                  <td className="px-6 py-4 capitalize text-[#6E747A]">{(request.status || 'new').replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-[#6E747A]">
                    {new Date(request.deadlineAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {request.subjectVerified ? (
                      <span className="text-[#C9A227] bg-[#C9A227]/10 px-2 py-1 rounded-full text-xs font-medium">{t('verified')}</span>
                    ) : (
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full text-xs font-medium">{t('pending')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={isGroupContext ? `/group/dsar/${request.id}` : `/dsar/${request.id}`} className="text-[#C9A227] hover:text-[#C9A227] font-medium text-[13px]">
                      {t('view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'datagrid' && hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors border border-white/10 shadow-panel-elevated disabled:opacity-50"
          >
            {isFetchingNextPage ? t('loading_more') : t('load_more')}
          </button>
        </div>
      )}
    </div>
  );
}
