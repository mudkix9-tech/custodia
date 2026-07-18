"use client";

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { 
  Database, 
  Cpu, 
  AlertOctagon, 
  ThumbsUp, 
  ThumbsDown, 
  Search, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Sliders, 
  Clock, 
  Globe 
} from 'lucide-react';

export default function AiCopilotSettingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthority, setSelectedAuthority] = useState<string>('');
  
  // Queries
  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = trpc.ai.getCorpusStats.useQuery();
  const { data: metrics, refetch: refetchMetrics, isLoading: metricsLoading } = trpc.ai.getQualityMetrics.useQuery();
  const { data: documents, refetch: refetchDocs, isLoading: docsLoading } = trpc.ai.listDocuments.useQuery({
    query: searchQuery || undefined,
    authority: selectedAuthority || undefined
  });

  // Mutation
  const overrideMutation = trpc.ai.overrideSupersededStatus.useMutation();

  // Selected document to edit override
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [overrideCurrent, setOverrideCurrent] = useState(true);
  const [overrideSupersededBy, setOverrideSupersededBy] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleEditClick = (doc: any) => {
    setEditingDoc(doc);
    setOverrideCurrent(doc.isCurrent);
    setOverrideSupersededBy(doc.supersededBy || '');
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    try {
      await overrideMutation.mutateAsync({
        documentId: editingDoc.documentId,
        isCurrent: overrideCurrent,
        supersededBy: overrideSupersededBy || null,
      });

      setActionSuccess(`Successfully updated overrides for "${editingDoc.title}"`);
      setEditingDoc(null);
      refetchStats();
      refetchDocs();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to submit manual override:', err);
    }
  };

  const isRefreshing = statsLoading || metricsLoading || docsLoading;

  const triggerRefresh = () => {
    refetchStats();
    refetchMetrics();
    refetchDocs();
  };

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">AI Copilot Corpus</h1>
          <p className="text-ink-600">Monitor RAG retrieval quality, search documents, and manage guideline version supersessions.</p>
        </div>
        <button
          onClick={triggerRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 bg-white border border-ink-900/10 text-ink-900 px-3.5 py-1.5 rounded-lg text-sm font-medium hover:bg-bone-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Quality Alert Notification Banner */}
      {metrics?.triggerAlert && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900 text-sm">Action Required: Low Similarity Alert</h4>
            <p className="text-xs text-red-800 mt-1">
              More than {metrics.lowSimilarityPercentage.toFixed(1)}% of queries in the past 7 days returned similarity scores below 0.7. This indicates potential gaps in your organization's RAG knowledge base. Please review custom policies or check for missing national DPA seeds.
            </p>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-8 p-3 bg-sage-50 border border-sage-200 text-sage-800 text-sm rounded-lg">
          {actionSuccess}
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-ink-900/10 shadow-sm">
          <div className="text-ink-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-ink-400" /> Total Chunks
          </div>
          <p className="text-2xl font-serif text-ink-900 font-medium">
            {stats?.totalChunks || 0}
          </p>
          <span className="text-[10px] text-ink-400">across {stats?.totalDocuments || 0} unique docs</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-ink-900/10 shadow-sm">
          <div className="text-ink-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-sage-600" /> Avg Similarity
          </div>
          <p className="text-2xl font-serif text-ink-900 font-medium">
            {metrics ? `${(metrics.averageSimilarity * 100).toFixed(1)}%` : '0%'}
          </p>
          <span className="text-[10px] text-ink-400">average match over last 7 days</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-ink-900/10 shadow-sm">
          <div className="text-ink-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ThumbsUp className="w-4 h-4 text-amber-500" /> Helpful Ratio
          </div>
          <p className="text-2xl font-serif text-ink-900 font-medium">
            {metrics ? (
              (metrics.feedback.helpful + metrics.feedback.not_helpful) > 0 ? (
                `${((metrics.feedback.helpful / (metrics.feedback.helpful + metrics.feedback.not_helpful)) * 100).toFixed(0)}%`
              ) : '100%'
            ) : '100%'}
          </p>
          <span className="text-[10px] text-ink-400">
            {metrics?.feedback.helpful || 0} helpful / {metrics?.feedback.not_helpful || 0} not
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-ink-900/10 shadow-sm">
          <div className="text-ink-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-ink-400" /> Queries (7d)
          </div>
          <p className="text-2xl font-serif text-ink-900 font-medium">
            {metrics?.totalQueriesLast7Days || 0}
          </p>
          <span className="text-[10px] text-ink-400">
            {metrics ? `${metrics.lowSimilarityCount} low match (<70%)` : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Authorities List & Status */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-ink-900/10 shadow-sm">
            <h3 className="font-semibold text-ink-900 text-sm mb-4">Authority Coverage</h3>
            <div className="space-y-3.5">
              {stats?.authorities.map((auth: any) => (
                <div key={auth.authority} className="flex justify-between items-center text-xs">
                  <span className="font-medium text-ink-700 capitalize">{auth.authority}</span>
                  <div className="text-right">
                    <span className="text-ink-900 font-semibold">{auth.count} chunks</span>
                    <p className="text-[10px] text-ink-400">
                      Updated {auth.lastUpdated ? new Date(auth.lastUpdated).toLocaleDateString() : 'never'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-ink-900/10 shadow-sm">
            <h3 className="font-semibold text-ink-900 text-sm mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-ink-500" /> Version Status
            </h3>
            <div className="space-y-3">
              {stats?.versions.map((ver: any) => (
                <div key={ver.isCurrent ? 'current' : 'historical'} className="flex justify-between items-center text-xs">
                  <span className="text-ink-600 flex items-center gap-1.5">
                    {ver.isCurrent ? (
                      <CheckCircle className="w-3.5 h-3.5 text-sage-600" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-ink-400" />
                    )}
                    {ver.isCurrent ? 'Active Versions' : 'Superseded (Historical)'}
                  </span>
                  <span className="font-semibold text-ink-900">{ver.count} chunks</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Documents List & Override Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {editingDoc && (
            <div className="bg-bone-50 p-6 rounded-2xl border border-ink-900/20 shadow-sm">
              <h3 className="font-serif text-ink-900 text-base mb-2">Override Version Status</h3>
              <p className="text-xs text-ink-600 mb-4 font-mono truncate">{editingDoc.title}</p>
              
              <form onSubmit={handleOverrideSubmit} className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="is_current"
                    checked={overrideCurrent}
                    onChange={(e) => setOverrideCurrent(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-900/10 text-sage-600 focus:ring-sage-500"
                  />
                  <label htmlFor="is_current" className="text-xs font-medium text-ink-700">
                    This document is CURRENT (active in default retrieval)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1.5">
                    Superseded By (Optional - New Document ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. uuid-of-newer-guideline"
                    value={overrideSupersededBy}
                    onChange={(e) => setOverrideSupersededBy(e.target.value)}
                    className="w-full bg-white border border-ink-900/10 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-ink-900"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingDoc(null)}
                    className="bg-white border border-ink-900/10 text-ink-800 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-bone-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-ink-900 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-ink-850"
                  >
                    Save Overrides
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-ink-900/10 shadow-sm">
            <h3 className="font-semibold text-ink-900 text-sm mb-4">Manage Document Corpus</h3>
            
            {/* Search filters */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search documents by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bone-50 border border-ink-900/10 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-ink-900"
                />
              </div>

              <select
                value={selectedAuthority}
                onChange={(e) => setSelectedAuthority(e.target.value)}
                className="bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-xs focus:outline-none text-ink-700"
              >
                <option value="">All Authorities</option>
                <option value="edpb">EDPB</option>
                <option value="cnil">CNIL (France)</option>
                <option value="bfdi">BfDI (Germany)</option>
                <option value="ico">ICO (UK)</option>
                <option value="cjeu">CJEU</option>
              </select>
            </div>

            {/* Document list */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-ink-900/5 text-ink-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 font-medium">Document Title</th>
                    <th className="py-2.5 font-medium">Authority</th>
                    <th className="py-2.5 font-medium text-center">Lang</th>
                    <th className="py-2.5 font-medium text-center">Status</th>
                    <th className="py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/5">
                  {documents?.map((doc: any) => (
                    <tr key={doc.documentId} className="hover:bg-bone-50/50">
                      <td className="py-3 font-medium text-ink-900 pr-4">
                        <div className="truncate max-w-[280px]" title={doc.title}>
                          {doc.title}
                        </div>
                        <span className="text-[10px] text-ink-400 font-mono">
                          ID: {doc.documentId.slice(0, 8)}... ({doc.chunkCount} chunks)
                        </span>
                      </td>
                      <td className="py-3 text-ink-600 capitalize">
                        {doc.authority}
                      </td>
                      <td className="py-3 text-center text-ink-600 font-mono">
                        {doc.language}
                      </td>
                      <td className="py-3 text-center">
                        {doc.isCurrent ? (
                          <span className="inline-flex items-center gap-1 bg-sage-50 text-sage-800 text-[10px] font-medium px-2 py-0.5 rounded border border-sage-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-ink-50 text-ink-700 text-[10px] font-medium px-2 py-0.5 rounded border border-ink-900/10">
                            Superseded
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleEditClick(doc)}
                          className="text-sage-700 hover:text-sage-800 font-medium transition-colors"
                        >
                          Override
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!documents || documents.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-400 text-xs">
                        No documents found in the corpus.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
