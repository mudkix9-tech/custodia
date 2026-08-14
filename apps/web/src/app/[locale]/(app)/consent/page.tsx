"use client";
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Globe, Plus, BarChart3, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ConsentDashboard() {
  const t = useTranslations('consent');
  const [isCreating, setIsCreating] = useState(false);
  const [domain, setDomain] = useState('');
  
  const utils = trpc.useContext();
  const { data: domains, isLoading } = trpc.consent.listDomains.useQuery({});
  const createMutation = trpc.consent.createDomain.useMutation({
    onSuccess: () => {
      utils.consent.listDomains.invalidate({});
      setIsCreating(false);
      setDomain('');
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
          <Plus className="w-4 h-4" /> {t('add_domain')}
        </button>
      </div>

      {isCreating && (
        <div className="bg-[#0D0F11] p-6 rounded-2xl border border-white/10 mb-8 shadow-panel-elevated fade-up">
          <h3 className="font-semibold text-[#F4F5F6] mb-4">{t('add_new_website')}</h3>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-2.5 text-[#6E747A]">https://</span>
              <input 
                type="text" 
                placeholder={t('domain_placeholder')}
                value={domain}
                onChange={e => setDomain(e.target.value.replace(/^https?:\/\//, ''))}
                className="w-full bg-[#08090A] border border-white/10 rounded-xl pl-16 pr-4 py-2 focus:ring-2 focus:ring-[#C9A227]/40"
              />
            </div>
            <button 
              onClick={() => createMutation.mutate({ domain })}
              disabled={!domain || createMutation.isPending}
              className="bg-sage-600 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? t('adding') : t('add_domain')}
            </button>
            <button onClick={() => setIsCreating(false)} className="px-4 text-[#6E747A]">{t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {((domains as any)?.data || [])?.map((d: any) => (
          <div key={d.id} className="bg-[#0D0F11] rounded-2xl border border-white/10 overflow-hidden shadow-panel-elevated flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#F4F5F6]">{d.domain}</h3>
                  <div className="text-xs text-[#6E747A] font-mono mt-0.5">{t('script_id', { id: d.scriptId })}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${d.gcmV2Enabled ? 'bg-sage-100 text-[#C9A227]' : 'bg-white/5 text-[#6E747A]'}`}>
                  {t('gcm_v2')}
                </span>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${d.tcfEnabled ? 'bg-sage-100 text-[#C9A227]' : 'bg-white/5 text-[#6E747A]'}`}>
                  {t('tcf')}
                </span>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wider mb-1">{t('pageviews')}</div>
                <div className="text-2xl font-medium text-[#F4F5F6]">{(d.totalPageviews30d || 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wider mb-1">{t('consent_rate')}</div>
                <div className="text-2xl font-medium text-[#C9A227]">{d.consentRate30d || '0.00'}%</div>
              </div>
            </div>
            
            <div className="bg-[#08090A] p-4 mt-auto border-t border-white/5 flex justify-between">
              <Link href={`/consent/${d.id}?tab=analytics`} className="text-sm font-medium text-[#9BA1A6] hover:text-[#F4F5F6] flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> {t('analytics')}
              </Link>
              <Link href={`/consent/${d.id}?tab=customize`} className="text-sm font-medium text-[#C9A227] hover:text-[#C9A227] flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> {t('configure_banner')}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
