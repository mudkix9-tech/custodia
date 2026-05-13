"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { format } from 'date-fns';
import { RefreshCw, Check, ArrowLeft, History, FileText } from 'lucide-react';
import Link from 'next/link';

export function PolicyEditorClient({ policyId }: { policyId: string }) {
  const utils = trpc.useContext();
  const { data, isLoading } = trpc.policies.getById.useQuery({ id: policyId });
  const generateMutation = trpc.policies.generateDraft.useMutation({
    onSuccess: () => utils.policies.getById.invalidate()
  });
  const publishMutation = trpc.policies.publishVersion.useMutation({
    onSuccess: () => utils.policies.getById.invalidate()
  });

  const [activeTab, setActiveTab] = useState<'rich' | 'markdown' | 'diff'>('rich');

  if (isLoading || !data) return <div className="text-ink-500">Loading editor...</div>;

  const { policy, versions } = data;
  const currentDraft = versions[0];
  const isPublished = policy.currentVersionId === currentDraft?.id;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-ink-900/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-ink-900/10 bg-bone-50 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/policies" className="text-ink-400 hover:text-ink-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-semibold text-ink-900">{policy.name}</h2>
            <div className="text-[12px] text-ink-500 flex items-center gap-2">
              <span className="uppercase tracking-wider font-bold">{policy.type.replace('_', ' ')}</span>
              <span>•</span>
              {isPublished ? (
                <span className="text-sage-600 flex items-center gap-1 font-medium"><Check className="w-3 h-3"/> Published</span>
              ) : (
                <span className="text-amber-600 font-medium">Draft</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => generateMutation.mutate({ policyId })}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-ink-900/20 rounded-xl text-[13px] font-medium text-ink-700 hover:bg-bone-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} /> 
            {generateMutation.isPending ? 'Syncing...' : 'Sync with ROPA'}
          </button>
          
          <button 
            onClick={() => currentDraft && publishMutation.mutate({ policyId, versionId: currentDraft.id })}
            disabled={isPublished || !currentDraft || publishMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-ink-900 text-white rounded-xl text-[13px] font-medium hover:bg-ink-800 disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col border-r border-ink-900/10 min-w-0">
          <div className="border-b border-ink-900/5 bg-white px-6 py-3 flex gap-6 text-[13px] font-medium shrink-0">
            <button 
              onClick={() => setActiveTab('rich')}
              className={`pb-2 -mb-3 ${activeTab === 'rich' ? 'text-sage-600 border-b-2 border-sage-600' : 'text-ink-400 hover:text-ink-900'}`}
            >Rich Text</button>
            <button 
              onClick={() => setActiveTab('markdown')}
              className={`pb-2 -mb-3 ${activeTab === 'markdown' ? 'text-sage-600 border-b-2 border-sage-600' : 'text-ink-400 hover:text-ink-900'}`}
            >Markdown</button>
            <button 
              onClick={() => setActiveTab('diff')}
              className={`pb-2 -mb-3 ${activeTab === 'diff' ? 'text-sage-600 border-b-2 border-sage-600' : 'text-ink-400 hover:text-ink-900'}`}
            >Diff View</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-bone-50/30">
            {currentDraft ? (
              <div className="max-w-3xl mx-auto bg-white border border-ink-900/10 rounded-2xl p-10 shadow-sm min-h-full">
                {activeTab === 'rich' && (
                  <div 
                    className="prose prose-sm prose-ink max-w-none"
                    dangerouslySetInnerHTML={{ __html: currentDraft.contentHtml || currentDraft.contentMarkdown }}
                  />
                )}
                {activeTab === 'markdown' && (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                    {currentDraft.contentMarkdown}
                  </pre>
                )}
                {activeTab === 'diff' ? (
                  currentDraft.diffFromPrevious && Array.isArray(currentDraft.diffFromPrevious) ? (
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
                      {(currentDraft.diffFromPrevious as any[]).map((part, i) => (
                        <span key={i} className={part.added ? 'bg-green-100 text-green-900' : part.removed ? 'bg-red-100 text-red-900 line-through' : 'text-gray-600'}>
                          {part.value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No tracked changes available for this version. Generate a new draft to see AI diffs against the previous version.</div>
                  )
                ) : null}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-ink-400 flex-col">
                <FileText className="w-12 h-12 mb-4 text-ink-200" />
                <p>No content yet. Click "Sync with ROPA" to generate the first draft.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar History */}
        <div className="w-80 bg-bone-50 shrink-0 flex flex-col min-h-0">
          <div className="p-4 border-b border-ink-900/10 font-medium text-sm flex items-center gap-2">
            <History className="w-4 h-4" /> Version History
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {versions.map(v => (
              <button 
                key={v.id} 
                className={`w-full text-left p-3 rounded-xl border ${currentDraft?.id === v.id ? 'bg-white border-[var(--org-primary,#2c3e38)] shadow-sm' : 'border-ink-900/10 hover:bg-white'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-ink-900 text-[13px]">v{v.versionNumber}.0</span>
                  <span className="text-[11px] text-ink-500 font-mono">{format(new Date(v.createdAt!), 'MMM d, h:mm a')}</span>
                </div>
                <div className="text-[12px] text-ink-600 line-clamp-2">
                  {v.changeSummary || 'Manual update'}
                </div>
                {v.changeType === 'auto_generated' && (
                  <span className="inline-block mt-2 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    Auto-generated
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
