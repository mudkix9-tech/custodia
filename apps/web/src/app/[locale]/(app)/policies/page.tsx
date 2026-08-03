"use client";
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { FileText, AlertTriangle, Plus, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';

export default function PoliciesDashboard() {
  const t = useTranslations('policies');
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

  if (isLoading) return <div className="p-8 text-[#6E747A]">{t('loading')}</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-1">{t('title')}</h1>
          <p className="text-sm text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-800 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {t('new_policy')}
        </button>
      </div>

      {isCreating && (
        <div className="bg-[#0D0F11] p-6 rounded-2xl border border-white/10 mb-8 shadow-panel-elevated fade-up">
          <h3 className="font-semibold text-[#F4F5F6] mb-4">{t('create_title')}</h3>
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder={t('name_placeholder')}
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-[#08090A] border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-sage-500/20"
            />
            <select 
              value={type}
              onChange={e => setType(e.target.value)}
              className="bg-[#08090A] border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-sage-500/20"
            >
              <option value="website_visitors">{t('types.website_visitors')}</option>
              <option value="employees">{t('types.employees')}</option>
              <option value="cookie_policy">{t('types.cookie_policy')}</option>
            </select>
            <button 
              onClick={() => createMutation.mutate({ name, type })}
              disabled={!name || createMutation.isPending}
              className="bg-sage-600 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? t('creating') : t('create')}
            </button>
            <button onClick={() => setIsCreating(false)} className="px-4 text-[#6E747A]">{t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {((policies as any)?.data || [])?.map((policy: any) => {
          // Mocking out-of-sync logic for UI purposes
          const isOutOfSync = policy.syncWithRopa && (!policy.publishedAt || new Date().getTime() - new Date(policy.publishedAt).getTime() > 30 * 24 * 60 * 60 * 1000);
          
          return (
            <Link href={`/policies/${policy.id}`} key={policy.id} className="block group">
              <div className="bg-[#0D0F11] p-6 rounded-2xl border border-white/10 shadow-panel-elevated hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden">
                {isOutOfSync && (
                  <div className="absolute top-0 left-0 w-full bg-amber-500/100 text-white text-[10px] font-bold uppercase tracking-wider text-center py-0.5">
                    {t('out_of_sync')}
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className="w-12 h-12 bg-[#C9A227]/10 rounded-xl flex items-center justify-center text-[#C9A227]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-medium px-2 py-1 bg-[#08090A] text-[#6E747A] rounded uppercase tracking-wider">
                    {policy.type.replace('_', ' ')}
                  </span>
                </div>
                
                <h3 className="font-semibold text-[#F4F5F6] text-lg mb-2 group-hover:text-[#C9A227] transition-colors">{policy.name}</h3>
                
                <div className="mt-auto pt-4 flex items-center justify-between text-sm">
                  {policy.publishedAt ? (
                    <div className="flex items-center gap-1.5 text-[#6E747A] text-[12px]">
                      <Clock className="w-3.5 h-3.5" /> {t('published_ago', { time: formatDistanceToNow(new Date(policy.publishedAt)) })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[12px]">
                      <AlertTriangle className="w-3.5 h-3.5" /> {t('draft')}
                    </div>
                  )}
                  {policy.syncWithRopa && <span className="w-2 h-2 rounded-full bg-[#C9A227]/100" title={t('auto_sync')}></span>}
                </div>
              </div>
            </Link>
          );
        })}
        {(policies || [])?.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 bg-[#0D0F11] rounded-2xl border border-white/10">
            <p className="text-[#6E747A]">{t('empty_state')}</p>
          </div>
        )}
      </div>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors border border-white/10 shadow-panel-elevated disabled:opacity-50"
          >
            {isFetchingNextPage ? t('loading_more') : t('load_more')}
          </button>
        </div>
      )}
    </div>
  );
}
