"use client";
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, ShieldAlert, FileText, Download, LayoutDashboard, ScrollText } from 'lucide-react';
import { ComplianceScoreDial } from '@/components/audit/ComplianceScoreDial';
import { GapRemediationList } from '@/components/audit/GapRemediationList';
import { Article30Generator } from '@/components/audit/Article30Generator';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { useTranslations } from 'next-intl';

export default function AuditPage() {
  const t = useTranslations('audit');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger'>('dashboard');
  const { data: metrics, isLoading } = trpc.audit.getDashboardMetrics.useQuery();

  if (isLoading) {
    return <div className="p-8 text-center text-[#6E747A]">{t('loading')}</div>;
  }

  // Use the latest score if available, otherwise default to a calculated representation or 100
  const score = metrics?.latestReport?.scoreTotal || 100;
  
  // Calculate total open gaps
  const totalGaps = metrics?.gapsSummary ? 
    (Object.values(metrics.gapsSummary) as number[]).reduce((a: number, b: number) => a + b, 0) : 0;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 fade-up">
      <div className="flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6] tracking-tight">{t('title')}</h1>
          <p className="text-[#9BA1A6] mt-2 text-[15px]">{t('subtitle')}</p>
        </div>
        <div className="flex p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
              activeTab === 'dashboard' ? 'bg-[#0D0F11] text-[#F4F5F6] shadow-panel-elevated border border-white/5' : 'text-[#6E747A] hover:text-[#E6E8EA]'
            }`}
          >
            <LayoutDashboard size={16} /> {t('tabs.dashboard')}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
              activeTab === 'ledger' ? 'bg-[#0D0F11] text-[#F4F5F6] shadow-panel-elevated border border-white/5' : 'text-[#6E747A] hover:text-[#E6E8EA]'
            }`}
          >
            <ScrollText size={16} /> {t('tabs.ledger')}
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Card */}
        <div className="lg:col-span-1 bg-[#0D0F11] border border-white/10 rounded-3xl p-8 shadow-panel-elevated flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            {score >= 80 ? <ShieldCheck className="w-6 h-6 text-sage-500" /> : <ShieldAlert className="w-6 h-6 text-amber-500" />}
          </div>
          <h2 className="text-sm font-medium text-[#6E747A] uppercase tracking-wider mb-6">{t('compliance_score')}</h2>
          <ComplianceScoreDial score={score} />
        </div>

        {/* Categories/Summary Card */}
        <div className="lg:col-span-2 bg-[#0D0F11] border border-white/10 rounded-3xl p-8 shadow-panel-elevated">
          <h2 className="text-lg font-serif text-[#F4F5F6] mb-6">{t('compliance_pillars')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PillarCard title={t('pillars.ropa')} score={(metrics?.latestReport?.categoryScores as any)?.ropa || 100} />
            <PillarCard title={t('pillars.vendors')} score={(metrics?.latestReport?.categoryScores as any)?.vendors || 100} />
            <PillarCard title={t('pillars.dpia')} score={(metrics?.latestReport?.categoryScores as any)?.dpia || 100} />
            <PillarCard title={t('pillars.policies')} score={(metrics?.latestReport?.categoryScores as any)?.policies || 100} />
            <PillarCard title={t('pillars.dsar')} score={(metrics?.latestReport?.categoryScores as any)?.dsar || 100} />
            <PillarCard title={t('pillars.breaches')} score={(metrics?.latestReport?.categoryScores as any)?.breach || 100} />
            <PillarCard title={t('pillars.training')} score={(metrics?.latestReport?.categoryScores as any)?.training || 100} />
            <PillarCard title={t('pillars.transfers')} score={(metrics?.latestReport?.categoryScores as any)?.transfers || 100} />
            <PillarCard title={t('pillars.consent')} score={(metrics?.latestReport?.categoryScores as any)?.consent || 100} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif text-[#F4F5F6]">{t('detected_gaps')}</h2>
            {totalGaps > 0 && (
              <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full">{t('active_gaps', { total: totalGaps })}</span>
            )}
          </div>
          <GapRemediationList />
        </div>

        <div>
          <h2 className="text-xl font-serif text-[#F4F5F6] mb-4">{t('reporting_exports')}</h2>
          <Article30Generator />
        </div>
      </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#C9A227]/10 border border-[#C9A227]/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sage-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#C9A227]" />
              </div>
              <div>
                <h3 className="text-[15px] font-medium text-[#F4F5F6]">{t('immutable_ledger.title')}</h3>
                <p className="text-sm text-[#9BA1A6]">{t('immutable_ledger.description')}</p>
              </div>
            </div>
          </div>
          
          <AuditLogTable />
        </div>
      )}
    </div>
  );
}

function PillarCard({ title, score }: { title: string, score: number }) {
  let color = 'bg-red-500/10 text-red-400';
  if (score >= 50) color = 'bg-amber-500/10 text-amber-400';
  if (score >= 80) color = 'bg-[#C9A227]/10 text-[#C9A227]';
  if (score === 100) color = 'bg-sage-100 text-sage-800 font-bold';

  return (
    <div className="p-4 bg-[#08090A] rounded-2xl border border-white/5 flex flex-col justify-between h-24">
      <span className="text-xs font-medium text-[#6E747A] uppercase tracking-wider">{title}</span>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-serif text-[#F4F5F6]">{score}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${color}`}>%</span>
      </div>
    </div>
  );
}
