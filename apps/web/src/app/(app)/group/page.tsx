"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Building2, Activity, ShieldCheck, AlertTriangle, FileDown } from 'lucide-react';

export default function GroupDashboardPage() {
  const { data: childOrgs, isLoading: loadingOrgs } = trpc.group.listChildOrgs.useQuery();
  const { data: dashboardData, isLoading: loadingDash } = trpc.group.getGroupDashboard.useQuery();

  if (loadingOrgs || loadingDash) return <div className="p-8">Loading Group Dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900">Group Management</h1>
          <p className="mt-2 text-sm text-ink-500">Aggregated compliance metrics across all entities</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-bone-100 hover:bg-bone-200 text-ink-700 rounded-lg text-sm transition-colors border border-bone-300">
          <FileDown className="w-4 h-4" />
          Export Consolidated Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
          <Building2 className="w-8 h-8 text-ink-400 mb-2" />
          <div className="text-3xl font-medium text-ink-900">{dashboardData?.totalEntities}</div>
          <div className="text-sm text-ink-500">Entities Managed</div>
        </div>
        <div className="bg-white hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
          <ShieldCheck className="w-8 h-8 text-sage-500 mb-2" />
          <div className="text-3xl font-medium text-ink-900">{dashboardData?.aggregatedScore}%</div>
          <div className="text-sm text-ink-500">Avg Compliance Score</div>
        </div>
        <div className="bg-white hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
          <Activity className="w-8 h-8 text-ink-400 mb-2" />
          <div className="text-3xl font-medium text-ink-900">{dashboardData?.totalActivities}</div>
          <div className="text-sm text-ink-500">Processing Activities</div>
        </div>
        <div className="bg-white hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
          <div className="text-3xl font-medium text-ink-900">{dashboardData?.totalGaps}</div>
          <div className="text-sm text-ink-500">Total Gaps Identified</div>
        </div>
      </div>

      <div className="bg-white hairline rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-ink-100">
          <h2 className="text-lg font-medium text-ink-900">Child Entities</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {childOrgs?.map((org) => (
            <div key={org.id} className="p-6 flex items-center justify-between hover:bg-bone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center text-sage-700 font-medium">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-ink-900">{org.name}</div>
                  <div className="text-sm text-ink-500">{org.slug}</div>
                </div>
              </div>
              <Link
                href={`/group/${org.id}`}
                className="px-4 py-2 bg-sage-50 hover:bg-sage-100 text-sage-700 rounded-lg text-sm font-medium transition-colors border border-sage-200"
              >
                View Entity
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
