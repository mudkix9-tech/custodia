"use client";

import React, { Suspense } from 'react';
import { RegulatoryImpactWidget } from '@/components/dashboard/RegulatoryImpactWidget';
import { SetupProgress } from '@/components/dashboard/SetupProgress';
import { BreachAlertsWidget } from '@/components/dashboard/BreachAlertsWidget';
import { OverdueDpiaRemediationWidget } from '@/components/dashboard/OverdueDpiaRemediationWidget';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: riskStats } = trpc.vendors.getRiskStats.useQuery();
  const { data: undocumentedCount } = trpc.vendors.getUndocumentedCount.useQuery();

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">Welcome back</h1>
          <p className="text-[#9BA1A6]">Here's your compliance overview and pending tasks.</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <BreachAlertsWidget />
      </Suspense>

      <Suspense fallback={null}>
        <OverdueDpiaRemediationWidget />
      </Suspense>

      <SetupProgress />

      <Suspense fallback={null}>
        <RegulatoryImpactWidget />
      </Suspense>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <h3 className="text-[#6E747A] font-medium text-sm mb-2">Compliance Score</h3>
          <p className="text-3xl font-serif text-[#E6E8EA] font-bold">85%</p>
        </div>
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <h3 className="text-[#6E747A] font-medium text-sm mb-2">Active Processing Activities</h3>
          <p className="text-3xl font-serif text-[#E6E8EA] font-bold">12</p>
        </div>
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
          <h3 className="text-[#6E747A] font-medium text-sm mb-2">Pending DSARs</h3>
          <p className="text-3xl font-serif text-[#E6E8EA] font-bold">2</p>
        </div>
        <Link 
          href="/vendors" 
          className="bg-[#0D0F11] border border-white/10 hover:border-red-900/50 rounded-2xl p-6 shadow-panel-elevated block transition-all group"
        >
          <h3 className="text-[#6E747A] group-hover:text-red-400 font-medium text-sm mb-2 transition-colors">
            High Risk Vendors
          </h3>
          <p className={`text-3xl font-serif font-bold ${riskStats && riskStats.highOrCritical > 0 ? 'text-red-400' : 'text-[#E6E8EA]'}`}>
            {riskStats !== undefined ? riskStats.highOrCritical : '...'}
          </p>
        </Link>
        <Link 
          href="/vendors?tab=discovery" 
          className="bg-[#0D0F11] border border-white/10 hover:border-indigo-900/50 rounded-2xl p-6 shadow-panel-elevated block transition-all group"
        >
          <h3 className="text-[#6E747A] group-hover:text-indigo-400 font-medium text-sm mb-2 transition-colors">
            Undocumented Services
          </h3>
          <p className={`text-3xl font-serif font-bold ${undocumentedCount !== undefined && undocumentedCount > 0 ? 'text-indigo-400' : 'text-[#E6E8EA]'}`}>
            {undocumentedCount !== undefined ? undocumentedCount : '...'}
          </p>
        </Link>
      </div>
    </div>
  );
}
