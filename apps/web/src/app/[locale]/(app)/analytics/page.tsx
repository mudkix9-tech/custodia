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
import { SERIES, SERIES_MUTED, axisProps, gridProps, tooltipProps, LEGEND_STYLE } from '@/utils/chartTheme';

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
    return <div className="p-8 text-center text-[#6E747A] animate-pulse">Loading analytics data...</div>;
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
          <h1 className="text-3xl font-serif text-[#F4F5F6]">Advanced Analytics</h1>
          <p className="text-[#9BA1A6] mt-1">Board-ready metrics, benchmarking, and predictive insights.</p>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={generateReport.isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-[#08090A] font-medium rounded-lg hover:bg-[#E5C463] transition-colors disabled:opacity-50"
        >
          {generateReport.isLoading ? (
            <div className="h-4 w-4 border-2 border-[#08090A] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Download className="w-4 h-4" />
          )}
          Executive Report (PDF)
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-sm font-medium text-[#6E747A] uppercase tracking-wider mb-2">Overall Compliance</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-serif text-[#F4F5F6]">{benchmarkData?.yourScore}%</span>
            <span className="text-sm text-green-400 font-medium flex items-center mb-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              +4% this month
            </span>
          </div>
        </div>
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-sm font-medium text-[#6E747A] uppercase tracking-wider mb-2">Industry Average ({benchmarkData?.industry})</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-serif text-[#9BA1A6]">{benchmarkData?.industryAverage}%</span>
          </div>
        </div>
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-sm font-medium text-[#6E747A] uppercase tracking-wider mb-2">Top Quartile</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-serif text-[#C9A227]">{benchmarkData?.topQuartile}%</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Compliance Trend Line with Forecast */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">12-Month Compliance Trajectory & Forecast</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Line type="monotone" dataKey="score" name="Historical Score" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="projectedScore" name="Forecast" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pillar Trend (Bar) */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">Pillar Performance vs Previous</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={advancedMetrics?.pillarTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="pillar" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar dataKey="previous" name="Previous Quarter" fill={SERIES_MUTED} radius={[4, 4, 0, 0]} />
                <Bar dataKey="score" name="Current Score" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DSAR Response Time Histogram */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">DSAR Response Time Distribution</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={advancedMetrics?.dsarResponseTime} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="days" name="Days to Resolve" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" name="Number of DSARs" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gap Resolution Velocity */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">Gap Resolution Velocity (Past 4 Weeks)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={advancedMetrics?.gapResolutionVelocity} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="week" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="resolved" name="Issues Resolved" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Training Completion Trends */}
        <div className="bg-[#0D0F11] border border-white/10 rounded-lg p-6 shadow-panel-elevated">
          <h3 className="text-lg font-semibold text-[#F4F5F6] mb-6">Employee Training Completion</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={advancedMetrics?.trainingCompletion} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Area type="monotone" dataKey="rate" name="Completion %" fill="rgba(179,141,28,0.18)" stroke={SERIES[0]} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
