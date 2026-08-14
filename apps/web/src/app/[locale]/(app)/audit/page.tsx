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
import { formatScore, scoreChipClasses } from '@/utils/score';

export default function AuditPage() {
  const t = useTranslations('audit');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger'>('dashboard');
  const { data: metrics, isLoading } = trpc.audit.getDashboardMetrics.useQuery();

  if (isLoading) {
    return <div className="p-8 text-center text-[#6E747A]">{t('loading')}</div>;
  }

  // `??`, not `||`: a genuine score of 0 is falsy and used to render as 100. And a
  // missing report is null rather than a number, so the dial can say "not yet
  // assessed" instead of claiming a perfect posture the account has not earned.
  const score = metrics?.latestReport?.scoreTotal ?? null;
  const categoryScores = (metrics?.latestReport?.categoryScores ?? null) as Record<string, number> | null;
  const pillarScore = (key: string) => categoryScores?.[key] ?? null;
  
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
            {score === null ? null : score >= 80
              ? <ShieldCheck className="w-6 h-6 text-[#C9A227]" />
              : <ShieldAlert className="w-6 h-6 text-amber-500" />}
          </div>
          <h2 className="text-sm font-medium text-[#6E747A] uppercase tracking-wider mb-6">{t('compliance_score')}</h2>
          <ComplianceScoreDial score={score} />
        </div>

        {/* Categories/Summary Card */}
        <div className="lg:col-span-2 bg-[#0D0F11] border border-white/10 rounded-3xl p-8 shadow-panel-elevated">
          <h2 className="text-lg font-serif text-[#F4F5F6] mb-6">{t('compliance_pillars')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PillarCard title={t('pillars.ropa')} score={pillarScore('ropa')} />
            <PillarCard title={t('pillars.vendors')} score={pillarScore('vendors')} />
            <PillarCard title={t('pillars.dpia')} score={pillarScore('dpia')} />
            <PillarCard title={t('pillars.policies')} score={pillarScore('policies')} />
            <PillarCard title={t('pillars.dsar')} score={pillarScore('dsar')} />
            <PillarCard title={t('pillars.breaches')} score={pillarScore('breach')} />
            <PillarCard title={t('pillars.training')} score={pillarScore('training')} />
            <PillarCard title={t('pillars.transfers')} score={pillarScore('transfers')} />
            <PillarCard title={t('pillars.consent')} score={pillarScore('consent')} />
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
              <div className="w-10 h-10 bg-[#C9A227]/15 rounded-full flex items-center justify-center">
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

function PillarCard({ title, score }: { title: string, score: number | null }) {
  return (
    <div className="p-4 bg-[#08090A] rounded-2xl border border-white/5 flex flex-col justify-between h-24">
      <span className="text-xs font-medium text-[#6E747A] uppercase tracking-wider">{title}</span>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-serif ${score === null ? 'text-[#6E747A]' : 'text-[#F4F5F6]'}`}>
          {formatScore(score)}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${scoreChipClasses(score)}`}>%</span>
      </div>
    </div>
  );
}
