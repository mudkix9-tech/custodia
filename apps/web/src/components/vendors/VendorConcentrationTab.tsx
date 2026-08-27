"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { 
  Network, 
  ShieldAlert, 
  Globe2, 
  AlertTriangle, 
  Layers, 
  Server, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Link } from '@/i18n/routing';

export function VendorConcentrationTab() {
  const t = useTranslations('vendors');
  const { data: report, isLoading, refetch } = trpc.vendors.getConcentrationAnalytics.useQuery();
  const [selectedSpof, setSelectedSpof] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-[#9BA1A6] text-sm">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-[#C9A227] border-t-transparent rounded-full" />
        {t('concentration.loading')}
      </div>
    );
  }

  if (!report || report.totalDirectVendors === 0) {
    return (
      <EmptyState
        icon={Network}
        title={t('concentration.empty_title')}
        description={t('concentration.empty_description')}
      />
    );
  }

  const fragilityColor =
    report.fragilityLevel === 'critical'
      ? 'text-red-400 bg-red-500/10 border-red-500/20'
      : report.fragilityLevel === 'elevated'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : report.fragilityLevel === 'moderate'
      ? 'text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20'
      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

  return (
    <div className="space-y-6">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Fragility Index */}
        <div className="p-5 rounded-2xl bg-[#0D0F11] border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">
              {t('concentration.fragility_index')}
            </span>
            <Network className="h-4 w-4 text-[#C9A227]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[#F4F5F6]">{report.supplyChainFragilityScore}</span>
            <span className="text-xs text-[#6E747A]">/ 100</span>
          </div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${fragilityColor}`}>
              {t(`concentration.fragility_${report.fragilityLevel}`)}
            </span>
          </div>
        </div>

        {/* SPOFs */}
        <div className="p-5 rounded-2xl bg-[#0D0F11] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">
              {t('concentration.spof_count')}
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[#F4F5F6]">{report.singlePointsOfFailure.length}</span>
            <span className="text-xs text-[#6E747A]">{t('concentration.entities')}</span>
          </div>
          <p className="mt-2 text-xs text-[#9BA1A6]">
            {t('concentration.spof_subtext')}
          </p>
        </div>

        {/* Total 4th-Party Dependencies */}
        <div className="p-5 rounded-2xl bg-[#0D0F11] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">
              {t('concentration.unique_subprocessors')}
            </span>
            <Server className="h-4 w-4 text-[#9BA1A6]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[#F4F5F6]">{report.uniqueSubProcessorCount}</span>
            <span className="text-xs text-[#6E747A]">{t('concentration.across_vendors', { count: report.totalDirectVendors })}</span>
          </div>
          <p className="mt-2 text-xs text-[#9BA1A6]">
            {t('concentration.total_links', { count: report.totalSubProcessorDependencies })}
          </p>
        </div>

        {/* Jurisdiction / EU Residency */}
        <div className="p-5 rounded-2xl bg-[#0D0F11] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9BA1A6] uppercase tracking-wider">
              {t('concentration.jurisdiction_exposure')}
            </span>
            <Globe2 className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[#F4F5F6]">{report.jurisdictionBreakdown.euEeaPercentage}%</span>
            <span className="text-xs text-emerald-400">{t('concentration.eu_eea')}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#9BA1A6]">
            <span>US: {report.jurisdictionBreakdown.usPercentage}%</span>
            <span>•</span>
            <span>3rd Country: {report.jurisdictionBreakdown.thirdCountryPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Systemic Single Points of Failure (SPOFs) */}
      <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-[#F4F5F6] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              {t('concentration.spof_title')}
            </h3>
            <p className="text-xs text-[#9BA1A6] mt-1">
              {t('concentration.spof_description')}
            </p>
          </div>
        </div>

        {report.singlePointsOfFailure.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#08090A] border border-white/5 text-sm text-[#9BA1A6] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {t('concentration.no_spofs')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.singlePointsOfFailure.map((spof) => (
              <div 
                key={spof.nameKey}
                className={`p-4 rounded-xl bg-[#08090A] border transition-all cursor-pointer ${
                  selectedSpof === spof.nameKey
                    ? 'border-[#C9A227] ring-1 ring-[#C9A227]/30'
                    : 'border-white/10 hover:border-white/20'
                }`}
                onClick={() => setSelectedSpof(selectedSpof === spof.nameKey ? null : spof.nameKey)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#F4F5F6] flex items-center gap-2">
                      {spof.name}
                      {spof.country && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-[#9BA1A6]">
                          {spof.country}
                        </span>
                      )}
                    </h4>
                    {spof.service && (
                      <p className="text-xs text-[#6E747A] mt-0.5">{spof.service}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    spof.concentrationRiskLevel === 'critical'
                      ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}>
                    {spof.dependentVendorCount} {t('concentration.dependent_vendors')}
                  </span>
                </div>

                <div className="mt-3 text-xs text-[#9BA1A6]">
                  <span className="text-[#6E747A]">{t('concentration.supports')}: </span>
                  {spof.dependentVendors.map((v, i) => (
                    <span key={v.id}>
                      <span className="text-[#F4F5F6]">{v.name}</span>
                      {i < spof.dependentVendors.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>

                {spof.hasSpecialCategory && (
                  <div className="mt-2.5 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3 text-red-400" />
                    {t('concentration.art9_warning')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Systemic Blast Radius Analysis */}
      <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 space-y-4">
        <div>
          <h3 className="text-base font-medium text-[#F4F5F6] flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#C9A227]" />
            {t('concentration.blast_radius_title')}
          </h3>
          <p className="text-xs text-[#9BA1A6] mt-1">
            {t('concentration.blast_radius_description')}
          </p>
        </div>

        <div className="divide-y divide-white/5">
          {report.systemicBlastRadiuses.map((blast) => (
            <div key={blast.subProcessorName} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#F4F5F6]">{blast.subProcessorName}</span>
                  <span className="text-xs text-[#6E747A]">
                    ({blast.impactedVendorCount} {t('concentration.impacted_vendors')})
                  </span>
                </div>
                <p className="text-xs text-[#9BA1A6]">{blast.summary}</p>
                {blast.exposedDataCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {blast.exposedDataCategories.slice(0, 4).map((cat) => (
                      <span key={cat} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-[#9BA1A6] border border-white/5">
                        {cat}
                      </span>
                    ))}
                    {blast.exposedDataCategories.length > 4 && (
                      <span className="text-[10px] text-[#6E747A]">
                        +{blast.exposedDataCategories.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  blast.criticalityTier === 'critical'
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : blast.criticalityTier === 'high'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/20'
                }`}>
                  {t(`concentration.tier_${blast.criticalityTier}`)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
