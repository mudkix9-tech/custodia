// @ts-nocheck
"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Building2, Activity, ShieldCheck, AlertTriangle, FileDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function GroupDashboardPage() {
  const { data: scoresData, isLoading: loadingScores } = trpc.group.getGroupComplianceScores.useQuery();
  const { data: dashboardData, isLoading: loadingDash } = trpc.group.getGroupDashboard.useQuery();

  if (loadingScores || loadingDash) return <div className="p-8">Loading Group Dashboard...</div>;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-sage-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6]">Group Management</h1>
          <p className="mt-2 text-sm text-[#6E747A] mb-4">Aggregated compliance metrics across all entities</p>
          <div className="flex gap-4 border-b border-white/10">
            <Link href="/group" className="px-1 py-2 text-sm font-medium text-[#C9A227] border-b-2 border-[#C9A227]">
              Dashboard
            </Link>
            <Link href="/group/vendors" className="px-1 py-2 text-sm font-medium text-[#6E747A] hover:text-[#F4F5F6] transition-colors">
              Cross-Entity Vendors
            </Link>
            <Link href="/group/breaches" className="px-1 py-2 text-sm font-medium text-[#6E747A] hover:text-[#F4F5F6] transition-colors">
              Breaches
            </Link>
            <Link href="/group/dsar" className="px-1 py-2 text-sm font-medium text-[#6E747A] hover:text-[#F4F5F6] transition-colors">
              DSARs
            </Link>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#E6E8EA] rounded-lg text-sm transition-colors border border-bone-300">
          <FileDown className="w-4 h-4" />
          Export Consolidated Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-panel-elevated">
          <Building2 className="w-8 h-8 text-[#6E747A] mb-2" />
          <div className="text-3xl font-medium text-[#F4F5F6]">{dashboardData?.totalEntities}</div>
          <div className="text-sm text-[#6E747A]">Entities Managed</div>
        </div>
        
        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-panel-elevated">
          <ShieldCheck className={`w-8 h-8 mb-2 ${getScoreColor(scoresData?.averageScore || 0)}`} />
          <div className={`text-3xl font-medium ${getScoreColor(scoresData?.averageScore || 0)}`}>{scoresData?.averageScore || 0}%</div>
          <div className="text-sm text-[#6E747A]">Average Score</div>
          <div className="text-xs text-[#6E747A] mt-1">(equal weighting across entities)</div>
        </div>

        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-panel-elevated border border-transparent hover:border-white/10 transition-colors">
          <AlertTriangle className={`w-8 h-8 mb-2 ${getScoreColor(scoresData?.worstScore || 0)}`} />
          <div className={`text-3xl font-medium ${getScoreColor(scoresData?.worstScore || 0)}`}>{scoresData?.worstScore || 0}%</div>
          <div className="text-sm text-[#6E747A]">Worst-Case Score</div>
          <div className="text-xs text-[#6E747A] mt-1">(lowest entity score)</div>
        </div>

        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-panel-elevated">
          <Activity className="w-8 h-8 text-[#6E747A] mb-2" />
          <div className="text-3xl font-medium text-[#F4F5F6]">{dashboardData?.totalActivities}</div>
          <div className="text-sm text-[#6E747A]">Processing Activities</div>
        </div>
        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-panel-elevated">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
          <div className="text-3xl font-medium text-[#F4F5F6]">{dashboardData?.totalGaps}</div>
          <div className="text-sm text-[#6E747A]">Total Gaps Identified</div>
        </div>
      </div>

      <div className="bg-[#0D0F11] hairline rounded-xl shadow-panel-elevated overflow-hidden mb-8">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-medium text-[#F4F5F6]">Compliance Breakdown by Entity</h2>
        </div>
        <div className="divide-y divide-white/10">
          <div className="grid grid-cols-12 gap-4 p-4 bg-[#08090A] text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            <div className="col-span-4">Entity</div>
            <div className="col-span-3 text-center">Score</div>
            <div className="col-span-2 text-center">Trend</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {scoresData?.breakdown?.map((org) => (
            <div key={org.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#08090A] transition-colors">
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#C9A227]/15 flex items-center justify-center text-[#C9A227] font-medium text-sm">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-[#F4F5F6]">{org.name}</div>
                  <div className="text-xs text-[#6E747A]">{org.slug}</div>
                </div>
              </div>
              <div className="col-span-3 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border
                  ${org.currentScore >= 80 ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30' : 
                    org.currentScore >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-900/50' : 
                    'bg-red-500/10 text-red-400 border-red-900/50'}`}>
                  {org.currentScore}%
                </span>
              </div>
              <div className="col-span-2 flex justify-center items-center">
                {org.trend === 'up' && <TrendingUp className="w-4 h-4 text-sage-500" />}
                {org.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                {org.trend === 'flat' && <Minus className="w-4 h-4 text-white/20" />}
              </div>
              <div className="col-span-3 flex justify-end">
                <Link
                  href={`/group/${org.id}`}
                  className="px-3 py-1.5 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] rounded-lg text-sm font-medium transition-colors border border-bone-300 shadow-panel-elevated"
                >
                  View Dashboard
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
