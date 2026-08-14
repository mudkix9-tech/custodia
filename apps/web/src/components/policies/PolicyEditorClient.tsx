// @ts-nocheck
"use client";
import DOMPurify from 'dompurify';

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

  if (isLoading || !data) return <div className="text-[#6E747A]">Loading editor...</div>;

  const { policy, versions } = data;
  const currentDraft = versions[0];
  const isPublished = policy.currentVersionId === currentDraft?.id;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0D0F11] rounded-3xl border border-white/10 shadow-panel-elevated overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#08090A] p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/policies" className="text-[#6E747A] hover:text-[#F4F5F6] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-semibold text-[#F4F5F6]">{policy.name}</h2>
            <div className="text-[12px] text-[#6E747A] flex items-center gap-2">
              <span className="uppercase tracking-wider font-bold">{policy.type.replace('_', ' ')}</span>
              <span>•</span>
              {isPublished ? (
                <span className="text-[#C9A227] flex items-center gap-1 font-medium"><Check className="w-3 h-3"/> Published</span>
              ) : (
                <span className="text-amber-400 font-medium">Draft</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => generateMutation.mutate({ policyId })}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D0F11] border border-white/20 rounded-xl text-[13px] font-medium text-[#E6E8EA] hover:bg-[#08090A] disabled:opacity-50"
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
        <div className="flex-1 flex flex-col border-r border-white/10 min-w-0">
          <div className="border-b border-white/5 bg-[#0D0F11] px-6 py-3 flex gap-6 text-[13px] font-medium shrink-0">
            <button 
              onClick={() => setActiveTab('rich')}
              className={`pb-2 -mb-3 ${activeTab === 'rich' ? 'text-[#C9A227] border-b-2 border-[#C9A227]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
            >Rich Text</button>
            <button 
              onClick={() => setActiveTab('markdown')}
              className={`pb-2 -mb-3 ${activeTab === 'markdown' ? 'text-[#C9A227] border-b-2 border-[#C9A227]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
            >Markdown</button>
            <button 
              onClick={() => setActiveTab('diff')}
              className={`pb-2 -mb-3 ${activeTab === 'diff' ? 'text-[#C9A227] border-b-2 border-[#C9A227]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
            >Diff View</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-[#08090A]/30">
            {currentDraft ? (
              <div className="max-w-3xl mx-auto bg-[#0D0F11] border border-white/10 rounded-2xl p-10 shadow-panel-elevated min-h-full">
                {activeTab === 'rich' && (
                  <div 
                    className="prose prose-sm prose-ink max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentDraft.contentHtml || currentDraft.contentMarkdown || '') }}
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
                        <span key={i} className={part.added ? 'bg-green-500/20 text-green-300' : part.removed ? 'bg-red-500/20 text-red-300 line-through' : 'text-gray-600'}>
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
              <div className="h-full flex items-center justify-center text-[#6E747A] flex-col">
                <FileText className="w-12 h-12 mb-4 text-[#6E747A]" />
                <p>No content yet. Click "Sync with ROPA" to generate the first draft.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar History */}
        <div className="w-80 bg-[#08090A] shrink-0 flex flex-col min-h-0">
          <div className="p-4 border-b border-white/10 font-medium text-sm flex items-center gap-2">
            <History className="w-4 h-4" /> Version History
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {versions.map(v => (
              <button 
                key={v.id} 
                className={`w-full text-left p-3 rounded-xl border ${currentDraft?.id === v.id ? 'bg-[#0D0F11] border-[var(--org-primary,#2c3e38)] shadow-panel-elevated' : 'border-white/10 hover:bg-[#0D0F11]'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-[#F4F5F6] text-[13px]">v{v.versionNumber}.0</span>
                  <span className="text-[11px] text-[#6E747A] font-mono">{format(new Date(v.createdAt!), 'MMM d, h:mm a')}</span>
                </div>
                <div className="text-[12px] text-[#9BA1A6] line-clamp-2">
                  {v.changeSummary || 'Manual update'}
                </div>
                {v.changeType === 'auto_generated' && (
                  <span className="inline-block mt-2 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
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
