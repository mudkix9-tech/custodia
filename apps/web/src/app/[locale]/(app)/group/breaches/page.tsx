'use client';

import React from 'react';
import { trpc } from '@/utils/trpc';
import BreachList from '@/components/breaches/BreachList';

export default function GroupBreachesPage() {
  const {
    data: breachesResp,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.breaches.list.useInfiniteQuery(
    { limit: 25, includeChildEntities: true },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const breaches = breachesResp?.pages.flatMap((page: any) => page.data) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Group Breach Register</h1>
          <p className="text-sm text-gray-500 mt-1">Consolidated view of all incidents and breaches across your organization and subsidiaries.</p>
        </div>
      </div>

      <BreachList breaches={breaches || []} isLoading={isLoading} isGroupContext={true} />

      {hasNextPage && (
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
