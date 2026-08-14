'use client';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import BreachList from '@/components/breaches/BreachList';
import ReportBreachModal from '@/components/breaches/ReportBreachModal';
import { useTranslations } from 'next-intl';

export default function BreachesPage() {
  const t = useTranslations('breaches');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const {
    data: breachesResp,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.breaches.list.useInfiniteQuery(
    { limit: 25 },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const breaches = breachesResp?.pages.flatMap((page: any) => page.data) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6]">{t('title')}</h1>
          <p className="text-sm text-[#9BA1A6] mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-panel-elevated"
        >
          {t('report_incident')}
        </button>
      </div>

      <BreachList breaches={breaches || []} isLoading={isLoading} />

      {hasNextPage && (
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

      <ReportBreachModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        onSuccess={() => {
          setIsReportModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
