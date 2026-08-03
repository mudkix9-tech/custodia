"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export function OverdueDpiaRemediationWidget() {
  const { data: overdueData, isLoading } = trpc.dpia.getOverdueRemediationCount.useQuery();

  if (isLoading || !overdueData || overdueData.count === 0) return null;

  const count = overdueData.count;

  return (
    <div className="bg-amber-500/100/10 border border-amber-900/50 rounded-2xl p-5 shadow-panel-elevated mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-in fade-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-400 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-amber-950 text-sm">Overdue DPIA Remediations</h4>
          <p className="text-xs text-amber-800 mt-0.5 font-medium">
            {count === 1 
              ? '1 high/critical risk mitigation is past its due date' 
              : `${count} high/critical risk mitigations are past their due date`}
          </p>
        </div>
      </div>

      <Link 
        href="/audit?source=dpia" 
        className="inline-flex items-center gap-1 bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-panel-elevated self-end sm:self-auto shrink-0"
      >
        Resolve Gaps <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
