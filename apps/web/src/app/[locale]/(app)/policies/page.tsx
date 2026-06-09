"use client";
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { FileText, AlertTriangle, Plus, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PoliciesDashboard() {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('website_visitors');
  
  const utils = trpc.useContext();
  const {
    data: policiesResp,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.policies.list.useInfiniteQuery(
    { limit: 25 },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const policies = policiesResp?.pages.flatMap((page: any) => page.data) || [];
  const createMutation = trpc.policies.create.useMutation({
    onSuccess: () => {
      utils.policies.list.invalidate({});
      setIsCreating(false);
      setName('');
    }
  });

  if (isLoading) return <div className="p-8 text-ink-500">Loading Policies...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-1">Privacy Policies</h1>
          <p className="text-sm text-ink-600">Manage and auto-generate legal policies from your ROPA.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-800 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Policy
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-2xl border border-ink-900/10 mb-8 shadow-sm fade-up">
          <h3 className="font-semibold text-ink-900 mb-4">Create New Policy</h3>
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="e.g., Main Website Privacy Policy"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-sage-500/20"
            />
            <select 
              value={type}
              onChange={e => setType(e.target.value)}
              className="bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-sage-500/20"
            >
              <option value="website_visitors">Website Visitors</option>
              <option value="employees">Employees</option>
              <option value="cookie_policy">Cookie Policy</option>
            </select>
            <button 
              onClick={() => createMutation.mutate({ name, type })}
              disabled={!name || createMutation.isPending}
              className="bg-sage-600 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setIsCreating(false)} className="px-4 text-ink-500">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {((policies as any)?.data || [])?.map((policy: any) => {
          // Mocking out-of-sync logic for UI purposes
          const isOutOfSync = policy.syncWithRopa && (!policy.publishedAt || new Date().getTime() - new Date(policy.publishedAt).getTime() > 30 * 24 * 60 * 60 * 1000);
          
          return (
            <Link href={`/policies/${policy.id}`} key={policy.id} className="block group">
              <div className="bg-white p-6 rounded-2xl border border-ink-900/10 shadow-sm hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden">
                {isOutOfSync && (
                  <div className="absolute top-0 left-0 w-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider text-center py-0.5">
                    Action Required - Out of Sync
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className="w-12 h-12 bg-sage-50 rounded-xl flex items-center justify-center text-sage-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-medium px-2 py-1 bg-bone-50 text-ink-500 rounded uppercase tracking-wider">
                    {policy.type.replace('_', ' ')}
                  </span>
                </div>
                
                <h3 className="font-semibold text-ink-900 text-lg mb-2 group-hover:text-sage-600 transition-colors">{policy.name}</h3>
                
                <div className="mt-auto pt-4 flex items-center justify-between text-sm">
                  {policy.publishedAt ? (
                    <div className="flex items-center gap-1.5 text-ink-500 text-[12px]">
                      <Clock className="w-3.5 h-3.5" /> Published {formatDistanceToNow(new Date(policy.publishedAt))} ago
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 font-medium text-[12px]">
                      <AlertTriangle className="w-3.5 h-3.5" /> Draft - Never Published
                    </div>
                  )}
                  {policy.syncWithRopa && <span className="w-2 h-2 rounded-full bg-sage-500" title="Auto-sync active"></span>}
                </div>
              </div>
            </Link>
          );
        })}
        {(policies || [])?.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-ink-900/10">
            <p className="text-ink-500">No privacy policies created yet.</p>
          </div>
        )}
      </div>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 bg-white hover:bg-bone-100 text-ink-700 font-medium text-[13px] rounded-lg transition-colors border border-ink-900/10 shadow-sm disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
