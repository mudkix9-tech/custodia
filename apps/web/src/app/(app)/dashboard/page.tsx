import React from 'react';
import { RegulatoryWidget } from '@/components/dashboard/RegulatoryWidget';
import { getSession } from 'next-auth/react';

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Welcome back</h1>
          <p className="text-ink-600">Here's your compliance overview and pending tasks.</p>
        </div>
      </div>

      <RegulatoryWidget />

      {/* STATS ROW (Placeholder for future phases) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <h3 className="text-ink-500 font-medium text-sm mb-2">Compliance Score</h3>
          <p className="text-3xl font-serif text-ink-900">85%</p>
        </div>
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <h3 className="text-ink-500 font-medium text-sm mb-2">Active Processing Activities</h3>
          <p className="text-3xl font-serif text-ink-900">12</p>
        </div>
        <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
          <h3 className="text-ink-500 font-medium text-sm mb-2">Pending DSARs</h3>
          <p className="text-3xl font-serif text-ink-900">2</p>
        </div>
      </div>
    </div>
  );
}
