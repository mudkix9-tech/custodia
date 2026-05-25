'use client';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import BreachList from '@/components/breaches/BreachList';
import ReportBreachModal from '@/components/breaches/ReportBreachModal';

export default function BreachesPage() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { data: breachesResp, isLoading, refetch } = trpc.breaches.list.useQuery({} as any);
  const breaches = (breachesResp as any)?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Breach Register</h1>
          <p className="text-sm text-gray-500 mt-1">Manage incidents, risk assessments, and supervisory authority notifications.</p>
        </div>
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-sm"
        >
          Report Incident
        </button>
      </div>

      <BreachList breaches={breaches || []} isLoading={isLoading} />

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
