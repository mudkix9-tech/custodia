"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Clock, ShieldAlert, LayoutGrid, List } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

type ViewMode = 'kanban' | 'datagrid';

const COLUMNS = [
  { id: 'new', label: 'New' },
  { id: 'identity_verification', label: 'Verification' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'pending_review', label: 'Review' },
  { id: 'completed', label: 'Completed' },
];

export function DsarDashboardClient({ isGroupContext }: { isGroupContext?: boolean }) {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
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

  if (isLoading) return <div className="text-ink-500">Loading DSARs...</div>;

  return (
    <div>
      <div className="flex justify-end mb-6">
        <div className="bg-bone-100 p-1 rounded-lg flex gap-1">
          <button 
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('datagrid')}
            className={`p-1.5 rounded-md ${viewMode === 'datagrid' ? 'bg-white shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colRequests = ((requests as any)?.data || [])?.filter((r: any) => r.status === col.id) || [];
            return (
              <div key={col.id} className="min-w-[300px] w-[300px] flex-shrink-0 bg-bone-50/50 rounded-2xl p-4 border border-ink-900/5">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="font-semibold text-[13px] text-ink-900 uppercase tracking-wider">{col.label}</h3>
                  <span className="bg-white border border-ink-900/10 text-ink-600 text-xs px-2 py-0.5 rounded-full font-medium">
                    {colRequests.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colRequests.map((request: any) => {
                    const daysRemaining = differenceInDays(new Date(request.deadlineAt), new Date());
                    let deadlineColor = 'text-sage-600 bg-sage-50';
                    if (daysRemaining <= 14 && daysRemaining > 7) deadlineColor = 'text-amber-600 bg-amber-50';
                    if (daysRemaining <= 7) deadlineColor = 'text-red-600 bg-red-50 font-bold';
                    if (daysRemaining < 0) deadlineColor = 'text-red-600 bg-red-100 font-bold animate-pulse';

                    return (
                      <Link 
                        href={isGroupContext ? `/group/dsar/${request.id}` : `/dsar/${request.id}`} 
                        key={request.id}
                        className="block bg-white p-4 rounded-xl border border-ink-900/10 shadow-sm hover:shadow-md transition-shadow group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-mono font-medium text-ink-500">{request.referenceNumber}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${deadlineColor}`}>
                            <Clock className="w-3 h-3" />
                            {daysRemaining < 0 ? 'Overdue' : `${daysRemaining} days`}
                          </span>
                        </div>
                        <h4 className="font-medium text-ink-900 text-sm mb-1">{request.subjectName.split(' ')[0]}</h4>
                        {isGroupContext && (
                          <div className="text-[11px] text-ink-600 font-medium mb-1 truncate">{request.organizationName || 'Unknown'}</div>
                        )}
                        <div className="text-xs text-ink-500 capitalize">{request.requestType}</div>
                        {!request.subjectVerified && (
                          <div className="mt-3 flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <ShieldAlert className="w-3 h-3" /> Unverified
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
        <div className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-bone-50 border-b border-ink-900/10 text-ink-500 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                {isGroupContext && <th className="px-6 py-4">Entity</th>}
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Deadline</th>
                <th className="px-6 py-4">Verification</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {((requests as any)?.data || [])?.map((request: any) => (
                <tr key={request.id} className="hover:bg-bone-50/50">
                  {isGroupContext && (
                    <td className="px-6 py-4 text-[13px] text-ink-600 font-medium">
                      {request.organizationName || 'Unknown'}
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono text-[13px]">{request.referenceNumber}</td>
                  <td className="px-6 py-4 font-medium text-ink-900">{request.subjectName}</td>
                  <td className="px-6 py-4 capitalize">{request.requestType}</td>
                  <td className="px-6 py-4 capitalize text-ink-500">{(request.status || 'new').replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-ink-500">
                    {new Date(request.deadlineAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {request.subjectVerified ? (
                      <span className="text-sage-600 bg-sage-50 px-2 py-1 rounded-full text-xs font-medium">Verified</span>
                    ) : (
                      <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-medium">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={isGroupContext ? `/group/dsar/${request.id}` : `/dsar/${request.id}`} className="text-sage-600 hover:text-sage-700 font-medium text-[13px]">
                      View
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
            className="px-4 py-2 bg-white hover:bg-bone-100 text-ink-700 font-medium text-[13px] rounded-lg transition-colors border border-ink-900/10 shadow-sm disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
