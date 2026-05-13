"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Code, Settings, Cookie, BarChart3, Globe, Copy, Check, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export function ConsentWorkspaceClient({ domainId }: { domainId: string }) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'install';
  
  const [activeTab, setActiveTab] = useState<'install' | 'customize' | 'cookies' | 'analytics'>(initialTab);
  const [copied, setCopied] = useState(false);
  
  const utils = trpc.useContext();
  const { data, isLoading } = trpc.consent.getDomain.useQuery({ id: domainId });
  const scanMutation = trpc.consent.scanCookies.useMutation({
    onSuccess: () => alert('Scan queued successfully! Check back in a few minutes.')
  });

  if (isLoading || !data) return <div className="text-ink-500">Loading CMP Workspace...</div>;

  const { domain, cookies, stats } = data;

  const scriptTag = `<script src="https://api.privaro.io/api/cmp/${domain.scriptId}/banner.js" async></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-ink-900/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-ink-900/10 bg-bone-50 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/consent" className="text-ink-400 hover:text-ink-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-ink-400" /> {domain.domain}
            </h2>
            <div className="text-[12px] text-ink-500 font-mono">
              Script ID: {domain.scriptId}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-900/10 bg-white px-4 shrink-0 overflow-x-auto">
        {[
          { id: 'install', icon: Code, label: 'Installation' },
          { id: 'customize', icon: Settings, label: 'Customization' },
          { id: 'cookies', icon: Cookie, label: 'Cookies' },
          { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'border-sage-600 text-sage-600' : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-900/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-bone-50/30 p-8">
        
        {/* INSTALL TAB */}
        {activeTab === 'install' && (
          <div className="max-w-3xl fade-up space-y-8">
            <div>
              <h3 className="text-lg font-medium text-ink-900 mb-2">Install Consent Banner</h3>
              <p className="text-sm text-ink-600 mb-6">
                Copy and paste this snippet into the <code>&lt;head&gt;</code> of your website. It must be the very first script to properly intercept and block other tracking scripts.
              </p>
              
              <div className="relative bg-[#1e1e1e] rounded-xl overflow-hidden border border-ink-900/10 shadow-inner">
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                  <span className="text-xs font-mono text-white/50">index.html</span>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors bg-white/10 px-2 py-1 rounded"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy</>}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-[13px] font-mono leading-relaxed text-blue-300">
                    <span className="text-ink-400">&lt;!-- Privaro Consent Management Platform --&gt;</span>{'\n'}
                    <span className="text-blue-400">&lt;script</span> <span className="text-amber-200">src</span>=<span className="text-sage-300">"https://api.privaro.io/api/cmp/{domain.scriptId}/banner.js"</span> <span className="text-amber-200">async</span><span className="text-blue-400">&gt;&lt;/script&gt;</span>
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-white border border-ink-900/10 p-6 rounded-2xl shadow-sm">
              <h4 className="font-medium text-ink-900 mb-2">Google Consent Mode v2</h4>
              <p className="text-[13px] text-ink-600 mb-4">
                This script natively supports Google Consent Mode v2. If you are using Google Tag Manager or Google Analytics, simply ensure this script loads <strong>before</strong> the Google tags. The banner will automatically signal consent updates to Google.
              </p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${domain.gcmV2Enabled ? 'bg-sage-100 text-sage-700' : 'bg-bone-100 text-ink-500'}`}>
                  GCM v2 {domain.gcmV2Enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMIZE TAB */}
        {activeTab === 'customize' && (
          <div className="max-w-5xl grid md:grid-cols-2 gap-8 fade-up">
            <div className="space-y-6">
              <div className="bg-white border border-ink-900/10 p-6 rounded-2xl shadow-sm">
                <h3 className="font-medium text-ink-900 mb-4">Theme Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[13px] font-medium text-ink-700">Primary Color</label>
                    <div className="flex gap-2 mt-1">
                      <input type="color" defaultValue="#2c3e38" className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                      <input type="text" defaultValue="#2c3e38" className="flex-1 bg-bone-50 border border-ink-900/10 rounded-lg px-3 text-[13px]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-700 block mb-1">Banner Position</label>
                    <select className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-[13px]">
                      <option>Bottom Modal</option>
                      <option>Center Modal</option>
                      <option>Bottom Bar</option>
                    </select>
                  </div>
                </div>
                <button className="mt-4 bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium w-full">Save Changes</button>
              </div>
            </div>
            
            <div className="bg-ink-100 rounded-2xl flex items-center justify-center p-8 border border-ink-900/10">
              {/* Preview */}
              <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden border border-ink-900/5">
                <div className="p-5">
                  <h4 className="font-bold text-ink-900 mb-1">We value your privacy</h4>
                  <p className="text-[13px] text-ink-600 mb-4">We use cookies to enhance your browsing experience and analyze our traffic.</p>
                  <div className="flex flex-col gap-2">
                    <button className="w-full bg-[#2c3e38] text-white py-2.5 rounded-lg text-sm font-medium">Accept All</button>
                    <button className="w-full bg-white border border-ink-900/20 text-ink-900 py-2.5 rounded-lg text-sm font-medium">Reject All</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COOKIES TAB */}
        {activeTab === 'cookies' && (
          <div className="fade-up">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-medium text-ink-900">Discovered Cookies</h3>
                <p className="text-sm text-ink-500">
                  {domain.lastScanAt ? `Last scanned: ${format(new Date(domain.lastScanAt), 'MMM dd, h:mm a')}` : 'Never scanned.'}
                </p>
              </div>
              <button 
                onClick={() => scanMutation.mutate({ domainId })}
                disabled={scanMutation.isPending}
                className="flex items-center gap-2 bg-ink-900 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> {scanMutation.isPending ? 'Queuing Scan...' : 'Run Scanner Now'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-ink-900/10 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-bone-50 border-b border-ink-900/10 text-ink-500 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Domain</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/5">
                  {cookies.map(cookie => (
                    <tr key={cookie.id} className="hover:bg-bone-50/50">
                      <td className="px-6 py-4 font-mono text-[12px] text-ink-900 font-bold">{cookie.cookieName}</td>
                      <td className="px-6 py-4 font-mono text-[12px] text-ink-600">{cookie.cookieDomain}</td>
                      <td className="px-6 py-4">
                        <select 
                          className="bg-bone-50 border border-ink-900/10 rounded px-2 py-1 text-[12px]"
                          defaultValue={cookie.category}
                        >
                          <option value="necessary">Necessary</option>
                          <option value="analytics">Analytics</option>
                          <option value="marketing">Marketing</option>
                          <option value="functional">Functional</option>
                          <option value="uncategorized">Uncategorized</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-ink-600 text-[13px]">{cookie.provider || 'Unknown'}</td>
                    </tr>
                  ))}
                  {cookies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-ink-500">
                        No cookies discovered yet. Run the scanner to populate this list.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="max-w-4xl fade-up space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white border border-ink-900/10 p-6 rounded-2xl shadow-sm">
                <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wider mb-2">Total Pageviews</div>
                <div className="text-3xl font-serif text-ink-900">{stats.total.toLocaleString()}</div>
              </div>
              <div className="bg-white border border-ink-900/10 p-6 rounded-2xl shadow-sm">
                <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wider mb-2">Accept All Rate</div>
                <div className="text-3xl font-serif text-sage-600">--%</div>
                <div className="text-[12px] text-ink-500 mt-1">Awaiting data</div>
              </div>
              <div className="bg-white border border-ink-900/10 p-6 rounded-2xl shadow-sm">
                <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wider mb-2">Reject All Rate</div>
                <div className="text-3xl font-serif text-amber-600">--%</div>
                <div className="text-[12px] text-ink-500 mt-1">Awaiting data</div>
              </div>
            </div>
            
            <div className="bg-white border border-ink-900/10 p-10 rounded-2xl shadow-sm text-center">
              <BarChart3 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
              <h3 className="font-medium text-ink-900">Advanced Analytics Available Soon</h3>
              <p className="text-sm text-ink-500 max-w-sm mx-auto mt-2">
                Detailed breakdowns by country, interaction type, and browser will appear here once enough consent logs are collected.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
