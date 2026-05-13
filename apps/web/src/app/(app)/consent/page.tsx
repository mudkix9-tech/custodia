"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Globe, Plus, BarChart3, Settings } from 'lucide-react';

export default function ConsentDashboard() {
  const [isCreating, setIsCreating] = useState(false);
  const [domain, setDomain] = useState('');
  
  const utils = trpc.useContext();
  const { data: domains, isLoading } = trpc.consent.listDomains.useQuery();
  const createMutation = trpc.consent.createDomain.useMutation({
    onSuccess: () => {
      utils.consent.listDomains.invalidate();
      setIsCreating(false);
      setDomain('');
    }
  });

  if (isLoading) return <div className="p-8 text-ink-500">Loading CMP...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-1">Cookie Consent Manager</h1>
          <p className="text-sm text-ink-600">Manage consent banners, scan for trackers, and monitor compliance.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-ink-800 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Domain
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-2xl border border-ink-900/10 mb-8 shadow-sm fade-up">
          <h3 className="font-semibold text-ink-900 mb-4">Add New Website</h3>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-2.5 text-ink-400">https://</span>
              <input 
                type="text" 
                placeholder="www.example.com"
                value={domain}
                onChange={e => setDomain(e.target.value.replace(/^https?:\/\//, ''))}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-xl pl-16 pr-4 py-2 focus:ring-2 focus:ring-sage-500/20"
              />
            </div>
            <button 
              onClick={() => createMutation.mutate({ domain })}
              disabled={!domain || createMutation.isPending}
              className="bg-sage-600 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Domain'}
            </button>
            <button onClick={() => setIsCreating(false)} className="px-4 text-ink-500">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {domains?.map(d => (
          <div key={d.id} className="bg-white rounded-2xl border border-ink-900/10 overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 border-b border-ink-900/5 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900">{d.domain}</h3>
                  <div className="text-xs text-ink-500 font-mono mt-0.5">Script ID: {d.scriptId}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${d.gcmV2Enabled ? 'bg-sage-100 text-sage-700' : 'bg-bone-100 text-ink-500'}`}>
                  GCM v2
                </span>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${d.tcfEnabled ? 'bg-sage-100 text-sage-700' : 'bg-bone-100 text-ink-500'}`}>
                  TCF
                </span>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-1">Pageviews (30d)</div>
                <div className="text-2xl font-medium text-ink-900">{(d.totalPageviews30d || 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-ink-400 uppercase tracking-wider mb-1">Consent Rate</div>
                <div className="text-2xl font-medium text-sage-600">{d.consentRate30d || '0.00'}%</div>
              </div>
            </div>
            
            <div className="bg-bone-50 p-4 mt-auto border-t border-ink-900/5 flex justify-between">
              <Link href={`/consent/${d.id}?tab=analytics`} className="text-sm font-medium text-ink-600 hover:text-ink-900 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Analytics
              </Link>
              <Link href={`/consent/${d.id}?tab=customize`} className="text-sm font-medium text-sage-600 hover:text-sage-700 flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> Configure Banner
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
