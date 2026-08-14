// @ts-nocheck
'use client';

import React from 'react';
import { trpc } from '@/utils/trpc';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Area
} from 'recharts';
import { Download, AlertCircle, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function AnalyticsDashboard() {
  const toast = useToast();
  const { data: trendData, isLoading: isLoadingTrend } = trpc.analytics.getComplianceTrend.useQuery();
  const { data: benchmarkData, isLoading: isLoadingBenchmark } = trpc.analytics.getBenchmark.useQuery();
  const { data: advancedMetrics, isLoading: isLoadingMetrics } = trpc.analytics.getAdvancedMetrics.useQuery();

  const generateReport = trpc.export.generateExecutiveReport.useMutation({
    onSuccess: (data) => {
      // Download the base64 PDF
      const linkSource = `data:application/pdf;base64,${data.pdfData}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = linkSource;
      downloadLink.download = data.filename;
      downloadLink.click();
    },
    onError: (error) => {
      console.error("Failed to generate report:", error);
      toast('Could not generate the report', { tone: 'error', description: 'Please try again.' });
    }
  });

  const handleDownloadReport = () => {
    generateReport.mutate();
  };

  if (isLoadingTrend || isLoadingBenchmark || isLoadingMetrics) {
    return <div className="p-8 text-center text-stone-500 animate-pulse">Loading analytics data...</div>;
  }

  // Combine historical and projected data for the trend chart
  const combinedTrendData = [
    ...(trendData?.historical || []).map(d => ({ ...d, type: 'Historical' })),
    // To connect the line, we could duplicate the last historical point, but we'll keep it simple
    ...(trendData?.projected || []).map(d => ({ ...d, type: 'Projected', projectedScore: d.score, score: undefined }))
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Advanced Analytics</h1>
          <p className="text-stone-500 mt-1">Board-ready metrics, benchmarking, and predictive insights.</p>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={generateReport.isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#294036] text-white rounded-md hover:bg-[#1d2d26] transition-colors disabled:opacity-50"
        >
          {generateReport.isLoading ? (
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Download className="w-4 h-4" />
          )}
          Executive Report (PDF)
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-2">Overall Compliance</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-stone-900">{benchmarkData?.yourScore}%</span>
            <span className="text-sm text-green-400 font-medium flex items-center mb-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +4% this month
            </span>
          </div>
        </div>
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-2">Industry Average ({benchmarkData?.industry})</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-stone-700">{benchmarkData?.industryAverage}%</span>
          </div>
        </div>
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-2">Top Quartile</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-[#294036]">{benchmarkData?.topQuartile}%</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Compliance Trend Line with Forecast */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">12-Month Compliance Trajectory & Forecast</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="score" name="Historical Score" stroke="#294036" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="projectedScore" name="Forecast" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pillar Trend (Bar) */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Pillar Performance vs Previous</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={advancedMetrics?.pillarTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="pillar" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <Tooltip cursor={{ fill: '#f5f5f4' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend />
                <Bar dataKey="previous" name="Previous Quarter" fill="#d6d3d1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="score" name="Current Score" fill="#294036" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DSAR Response Time Histogram */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">DSAR Response Time Distribution</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={advancedMetrics?.dsarResponseTime} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="days" name="Days to Resolve" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <Tooltip cursor={{ fill: '#f5f5f4' }} />
                <Bar dataKey="count" name="Number of DSARs" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gap Resolution Velocity */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Gap Resolution Velocity (Past 4 Weeks)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={advancedMetrics?.gapResolutionVelocity} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <Tooltip />
                <Line type="monotone" dataKey="resolved" name="Issues Resolved" stroke="#eab308" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Training Completion Trends */}
        <div className="bg-[#0D0F11] border border-stone-200 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Employee Training Completion</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={advancedMetrics?.trainingCompletion} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" name="Completion %" fill="#dcfce7" stroke="#22c55e" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
