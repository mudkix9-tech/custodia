'use client';

import React, { useState, useMemo } from 'react';
import { trpc } from '@/utils/trpc';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, TooltipProps
} from 'recharts';
import { Download, AlertCircle, Calendar } from 'lucide-react';

const COLORS = ['#294036', '#3b82f6', '#10b981', '#ef4444', '#f59e0b'];

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
  const domains = domainsData?.data || [];

  const { data: analyticsData, isLoading } = trpc.consent.getAnalytics.useQuery({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    domainId,
  });

  if (isLoading || !analyticsData) {
    return <div className="p-8 text-center text-stone-500 animate-pulse">Loading consent analytics...</div>;
  }

  const { optInRateOverTime, interactionBreakdown, domainBreakdown, categoryRejection, withdrawalMetrics, granularCategoryDistribution } = analyticsData;

  // Format data for Recharts
  const formattedOptInRates = optInRateOverTime.map((d: any) => {
    const dateObj = new Date(d.date);
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    return {
      date: dateStr,
      Analytics: d.totalSessions ? Math.round((d.analyticsAccepted / d.totalSessions) * 100) : 0,
      Marketing: d.totalSessions ? Math.round((d.marketingAccepted / d.totalSessions) * 100) : 0,
      Functional: d.totalSessions ? Math.round((d.functionalAccepted / d.totalSessions) * 100) : 0,
    };
  });

  const interactionData = [
    { name: 'Accept All', value: interactionBreakdown.acceptAll },
    { name: 'Reject All', value: interactionBreakdown.rejectAll },
    { name: 'Customized (Accepted some)', value: interactionBreakdown.customizedWithAcceptance },
    { name: 'Customized (Rejected all)', value: interactionBreakdown.customizedAllRejected },
  ];

  const formattedWithdrawals = withdrawalMetrics?.withdrawalTrend.map((d: any) => {
    const dateObj = new Date(d.date);
    return {
      date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
      Withdrawals: d.withdrawals
    };
  }) || [];

  const rejectionData = [
    { name: 'Analytics', value: categoryRejection.analyticsRejected },
    { name: 'Marketing', value: categoryRejection.marketingRejected },
    { name: 'Functional', value: categoryRejection.functionalRejected },
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Consent Analytics</h1>
          <p className="text-stone-500 mt-1">Live tracking of consent rates, interaction types, and rejections.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#294036]"
            value={domainId || ''}
            onChange={e => setDomainId(e.target.value || undefined)}
          >
            <option value="">All Domains</option>
            {domains.map((d: any) => (
              <option key={d.id} value={d.id}>{d.domain}</option>
            ))}
          </select>
          <select
            className="border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#294036]"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Opt-in Rate Over Time */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Opt-in Rate Over Time (%)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedOptInRates}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ fontSize: '14px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="Analytics" stroke="#294036" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Marketing" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Functional" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interaction Breakdown */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Interaction Breakdown</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={interactionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {interactionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => Number(value).toLocaleString()}
                  contentStyle={{ borderRadius: '8px' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Granular Preference Combinations */}
        {granularCategoryDistribution && granularCategoryDistribution.length > 0 && interactionBreakdown.customizedWithAcceptance + interactionBreakdown.customizedAllRejected > 0 && (
          <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Customized Combinations</h3>
            <p className="text-sm text-stone-500 mb-6">
              Distribution of preferences for users who actively customized their choices (excludes Accept All / Reject All).
            </p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={granularCategoryDistribution} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="combination" type="category" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} width={100} tickFormatter={(val) => val === '' ? 'None' : val} />
                  <Tooltip
                    formatter={(value: any) => Number(value).toLocaleString()}
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" name="Sessions" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Category Rejection */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Category Rejections</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rejectionData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: any) => Number(value).toLocaleString()}
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Domain Breakdown */}
        {!domainId && domainBreakdown.length > 0 && (
          <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
            <h3 className="text-lg font-semibold text-stone-900 mb-6">Sessions by Domain</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainBreakdown} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="domainName" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: any) => Number(value).toLocaleString()}
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="totalSessions" name="Total Sessions" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="acceptAllCount" name="Accept All" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Consent Withdrawals */}
        {withdrawalMetrics && (
          <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
            <h3 className="text-lg font-semibold text-stone-900 mb-6">Consent Withdrawals</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-stone-50 rounded-md border border-stone-100">
                <p className="text-sm text-stone-500 mb-1">Withdrawals relative to new consent volume this period</p>
                <p className="text-2xl font-bold text-stone-800">{withdrawalMetrics.relativeVolumePercent}%</p>
              </div>
              <div className="p-4 bg-stone-50 rounded-md border border-stone-100">
                <p className="text-sm text-stone-500 mb-1">Average time-to-withdrawal (within queried range)</p>
                <p className="text-2xl font-bold text-stone-800">
                  {withdrawalMetrics.avgTimeToWithdrawalHours !== null 
                    ? `${Math.round(withdrawalMetrics.avgTimeToWithdrawalHours)} hours` 
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedWithdrawals}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ fontSize: '14px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="Withdrawals" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
