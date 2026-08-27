"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { 
  BarChart3, 
  ShieldCheck, 
  Globe2, 
  Users, 
  Lock, 
  HelpCircle,
  TrendingDown,
  Info
} from 'lucide-react';

interface VendorBenchmarkCardProps {
  vendorId: string;
  vendorName: string;
}

export function VendorBenchmarkCard({ vendorId, vendorName }: VendorBenchmarkCardProps) {
  const t = useTranslations('vendors');
  const { data: benchmark, isLoading } = trpc.vendors.getAggregatedBenchmark.useQuery(
    { vendorId },
    { enabled: !!vendorId }
  );

  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 flex items-center justify-center text-xs text-[#9BA1A6]">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-[#C9A227] border-t-transparent rounded-full" />
        {t('benchmarks.loading')}
      </div>
    );
  }

  if (!benchmark) return null;

  return (
    <div className="p-6 rounded-2xl bg-[#0D0F11] border border-white/10 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#C9A227]/10 text-[#C9A227]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F4F5F6]">
              {t('benchmarks.card_title')}
            </h4>
            <p className="text-xs text-[#9BA1A6] mt-0.5">
              {t('benchmarks.card_subtitle', { name: vendorName })}
            </p>
          </div>
        </div>

        {benchmark.isKAnonymous ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {t('benchmarks.k_anonymous_badge', { count: benchmark.sampleOrgCount })}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-[#9BA1A6] bg-white/5 border border-white/10 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {t('benchmarks.insufficient_samples')}
          </span>
        )}
      </div>

      {!benchmark.isKAnonymous ? (
        <div className="p-4 rounded-xl bg-[#08090A] border border-white/5 space-y-2 text-xs text-[#9BA1A6]">
          <div className="flex items-center gap-1.5 text-[#F4F5F6] font-medium">
            <Info className="h-4 w-4 text-[#C9A227]" />
            {t('benchmarks.privacy_guarantee_title')}
          </div>
          <p className="leading-relaxed">
            {t('benchmarks.privacy_guarantee_description')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* DPA Signed Rate */}
            <div className="p-3.5 rounded-xl bg-[#08090A] border border-white/5">
              <span className="text-[11px] text-[#9BA1A6] uppercase tracking-wider font-medium">
                {t('benchmarks.dpa_adoption')}
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-[#F4F5F6]">{benchmark.dpaSignedRate}%</span>
                <span className="text-xs text-emerald-400 font-medium">{t('benchmarks.of_peers')}</span>
              </div>
            </div>

            {/* EU Hosting Adoption */}
            <div className="p-3.5 rounded-xl bg-[#08090A] border border-white/5">
              <span className="text-[11px] text-[#9BA1A6] uppercase tracking-wider font-medium">
                {t('benchmarks.eu_hosting_adoption')}
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-[#F4F5F6]">{benchmark.euHostingAdoptionRate}%</span>
                <span className="text-xs text-sky-400 font-medium">{t('benchmarks.of_peers')}</span>
              </div>
            </div>

            {/* Average Peer Risk */}
            <div className="p-3.5 rounded-xl bg-[#08090A] border border-white/5 col-span-2 md:col-span-1">
              <span className="text-[11px] text-[#9BA1A6] uppercase tracking-wider font-medium">
                {t('benchmarks.avg_risk_score')}
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-[#F4F5F6]">{benchmark.averageRiskScore}</span>
                <span className="text-xs text-[#6E747A]">/ 100</span>
              </div>
            </div>
          </div>

          {/* Top Transfer Mechanisms */}
          {benchmark.transferMechanismDistribution.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-[#9BA1A6]">
                {t('benchmarks.transfer_safeguards')}
              </span>
              <div className="flex flex-wrap gap-2">
                {benchmark.transferMechanismDistribution.map((m) => (
                  <span
                    key={m.mechanism}
                    className="px-2.5 py-1 rounded-lg bg-[#08090A] border border-white/10 text-xs text-[#F4F5F6] flex items-center gap-1.5"
                  >
                    <span>{m.mechanism}</span>
                    <span className="text-[#C9A227] font-semibold">{m.percentage}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Shared Data Categories */}
          {benchmark.topSharedDataCategories && benchmark.topSharedDataCategories.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-xs font-medium text-[#9BA1A6]">
                {t('benchmarks.top_shared_data_categories')}
              </span>
              <div className="flex flex-wrap gap-2">
                {benchmark.topSharedDataCategories.map((c) => (
                  <span
                    key={c.category}
                    className="px-2.5 py-1 rounded-lg bg-[#08090A] border border-white/5 text-xs text-[#E6E8EA] flex items-center gap-1.5"
                  >
                    <span>{c.category}</span>
                    <span className="text-sky-400 font-mono text-[11px] font-semibold">{c.percentage}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Article 28 Clause Adoption Across Peers */}
          {benchmark.clauseAdoptionRates && Object.keys(benchmark.clauseAdoptionRates).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-xs font-medium text-[#9BA1A6]">
                {t('benchmarks.clause_adoption_peer_benchmark')}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {Object.entries(benchmark.clauseAdoptionRates).map(([clause, rate]) => (
                  <div key={clause} className="p-2 rounded-lg bg-[#08090A] border border-white/5 text-center">
                    <span className="text-[10px] text-[#6E747A] block truncate capitalize">
                      {clause.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-semibold text-emerald-400 text-sm">{rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
