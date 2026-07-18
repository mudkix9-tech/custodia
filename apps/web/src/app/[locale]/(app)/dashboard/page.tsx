"use client";

import React from 'react';
import { RegulatoryWidget } from '@/components/dashboard/RegulatoryWidget';
import { SetupProgress } from '@/components/dashboard/SetupProgress';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: riskStats } = trpc.vendors.getRiskStats.useQuery();

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Welcome back</h1>
          <p className="text-ink-600">Here's your compliance overview and pending tasks.</p>
        </div>
      </div>

      <SetupProgress />

      <RegulatoryWidget />

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <h3 className="text-ink-500 font-medium text-sm mb-2">Compliance Score</h3>
          <p className="text-3xl font-serif text-ink-900 font-bold">85%</p>
        </div>
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <h3 className="text-ink-500 font-medium text-sm mb-2">Active Processing Activities</h3>
          <p className="text-3xl font-serif text-ink-900 font-bold">12</p>
        </div>
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <h3 className="text-ink-500 font-medium text-sm mb-2">Pending DSARs</h3>
          <p className="text-3xl font-serif text-ink-900 font-bold">2</p>
        </div>
        <Link 
          href="/vendors" 
          className="bg-white border border-ink-900/10 hover:border-red-200 rounded-2xl p-6 shadow-sm block transition-all group"
        >
          <h3 className="text-ink-500 group-hover:text-red-500 font-medium text-sm mb-2 transition-colors">
            High Risk Vendors
          </h3>
          <p className={`text-3xl font-serif font-bold ${riskStats && riskStats.highOrCritical > 0 ? 'text-red-600' : 'text-ink-900'}`}>
            {riskStats !== undefined ? riskStats.highOrCritical : '...'}
          </p>
        </Link>
      </div>
    </div>
  );
}
