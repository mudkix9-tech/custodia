'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, TooltipProps
} from 'recharts';
import { SERIES, SERIES_MUTED, axisProps, gridProps, tooltipProps, LEGEND_STYLE } from '@/utils/chartTheme';
import { Download, AlertCircle, Calendar } from 'lucide-react';

export default function ConsentAnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [domainId, setDomainId] = useState<string | undefined>(undefined);

  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }, [days]);

  // Fetch domains for the filter
  const { data: domainsData } = trpc.consent.listDomains.useQuery({ limit: 100 });
  const t = useTranslations('consent.analytics_page');
  const domains = domainsData?.data || [];

  const { data: analyticsData, isLoading } = trpc.consent.getAnalytics.useQuery({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    domainId,
  });

  if (isLoading || !analyticsData) {
    return <div className="p-8 text-center text-[#6E747A] animate-pulse">{t('loading')}</div>;
  }

  const { optInRateOverTime, interactionBreakdown, domainBreakdown, categoryRejection, withdrawalMetrics, granularCategoryDistribution } = analyticsData;

  // Format data for Recharts
  const formattedOptInRates = optInRateOverTime.map((d: any) => {
    const dateObj = new Date(d.date);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    return {
      date: dateStr,
      analytics: d.totalSessions ? Math.round((d.analyticsAccepted / d.totalSessions) * 100) : 0,
      marketing: d.totalSessions ? Math.round((d.marketingAccepted / d.totalSessions) * 100) : 0,
      functional: d.totalSessions ? Math.round((d.functionalAccepted / d.totalSessions) * 100) : 0,
    };
  });

  const interactionData = [
    { name: t('interactions.accept_all'), value: interactionBreakdown.acceptAll },
    { name: t('interactions.reject_all'), value: interactionBreakdown.rejectAll },
    { name: t('interactions.customized_accepted'), value: interactionBreakdown.customizedWithAcceptance },
    { name: t('interactions.customized_rejected'), value: interactionBreakdown.customizedAllRejected },
  ];

  const formattedWithdrawals = withdrawalMetrics?.withdrawalTrend.map((d: any) => {
    const dateObj = new Date(d.date);
    return {
      date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
      withdrawals: d.withdrawals
    };
  }) || [];

  const rejectionData = [
    { name: t('categories.analytics'), value: categoryRejection.analyticsRejected },
    { name: t('categories.marketing'), value: categoryRejection.marketingRejected },
    { name: t('categories.functional'), value: categoryRejection.functionalRejected },
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6]">{t('title')}</h1>
          <p className="text-[#6E747A] mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="bg-[#0D0F11] border border-white/10 rounded-md px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            value={domainId || ''}
            onChange={e => setDomainId(e.target.value || undefined)}
          >
            <option value="">{t('all_domains')}</option>
            {domains.map((d: any) => (
              <option key={d.id} value={d.id}>{d.domain}</option>
            ))}
          </select>
          <select
            className="bg-[#0D0F11] border border-white/10 rounded-md px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>{t('range.7')}</option>
            <option value={30}>{t('range.30')}</option>
            <option value={90}>{t('range.90')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Opt-in Rate Over Time */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">{t('charts.opt_in')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedOptInRates}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} domain={[0, 100]} />
                <Tooltip {...tooltipProps} />
                <Legend iconType="circle" wrapperStyle={LEGEND_STYLE} />
                <Line type="monotone" dataKey="analytics" name={t('categories.analytics')} stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="marketing" name={t('categories.marketing')} stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="functional" name={t('categories.functional')} stroke={SERIES[2]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interaction Breakdown */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">{t('charts.interactions')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interactionData} layout="vertical" margin={{ top: 0, right: 24, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="rgba(255,255,255,0.07)" />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="name" type="category" width={170} {...axisProps} />
                <Tooltip {...tooltipProps} formatter={(value: any) => Number(value).toLocaleString()} />
                <Bar dataKey="value" name={t('series.sessions')} fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Granular Preference Combinations */}
        {granularCategoryDistribution && granularCategoryDistribution.length > 0 && interactionBreakdown.customizedWithAcceptance + interactionBreakdown.customizedAllRejected > 0 && (
          <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
            <h3 className="text-lg font-semibold text-[#F4F5F6] mb-2">{t('charts.combinations')}</h3>
            <p className="text-sm text-[#6E747A] mb-6">
              {t('combinations_description')}
            </p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={granularCategoryDistribution} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="rgba(255,255,255,0.07)" />
                  <XAxis type="number" {...axisProps} />
                  <YAxis dataKey="combination" type="category" {...axisProps} width={100} tickFormatter={(val) => val === '' ? t('none') : val} />
                  <Tooltip {...tooltipProps} formatter={(value: any) => Number(value).toLocaleString()} />
                  <Bar dataKey="count" name={t('series.sessions')} fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Category Rejection */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">{t('charts.rejections')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rejectionData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="rgba(255,255,255,0.07)" />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="name" type="category" {...axisProps} />
                <Tooltip {...tooltipProps} formatter={(value: any) => Number(value).toLocaleString()} />
                <Bar dataKey="value" name={t('series.sessions')} fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Domain Breakdown */}
        {!domainId && domainBreakdown.length > 0 && (
          <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
            <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">{t('charts.by_domain')}</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainBreakdown} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="domainName" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip {...tooltipProps} formatter={(value: any) => Number(value).toLocaleString()} />
                  <Legend wrapperStyle={LEGEND_STYLE} />
                  <Bar dataKey="totalSessions" name={t('series.total_sessions')} fill={SERIES_MUTED} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="acceptAllCount" name={t('series.accept_all')} fill={SERIES[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Consent Withdrawals */}
        {withdrawalMetrics && (
          <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
            <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">{t('charts.withdrawals')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-white/5 rounded-md border border-white/10">
                <p className="text-sm text-[#6E747A] mb-1">{t('withdrawal_rate')}</p>
                <p className="text-2xl font-bold text-[#E6E8EA]">{withdrawalMetrics.relativeVolumePercent}%</p>
              </div>
              <div className="p-4 bg-white/5 rounded-md border border-white/10">
                <p className="text-sm text-[#6E747A] mb-1">{t('time_to_withdrawal')}</p>
                <p className="text-2xl font-bold text-[#E6E8EA]">
                  {withdrawalMetrics.avgTimeToWithdrawalHours !== null 
                    ? t('hours', { count: Math.round(withdrawalMetrics.avgTimeToWithdrawalHours) })
                    : t('not_available')}
                </p>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedWithdrawals}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip {...tooltipProps} />
                  <Legend iconType="circle" wrapperStyle={LEGEND_STYLE} />
                  <Line type="monotone" dataKey="withdrawals" name={t('series.withdrawals')} stroke={SERIES[2]} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
