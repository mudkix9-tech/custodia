// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Code, Settings, Cookie, BarChart3, Globe, Copy, Check, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';

export function ConsentWorkspaceClient({ domainId }: { domainId: string }) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'install';
  
  const [activeTab, setActiveTab] = useState<'install' | 'customize' | 'cookies' | 'analytics'>(initialTab);
  const [copied, setCopied] = useState(false);
  
  const utils = trpc.useContext();
  const { data, isLoading } = trpc.consent.getDomain.useQuery({ id: domainId });
  const { setContext } = useAiGuidanceStore();
  const scanMutation = trpc.consent.scanCookies.useMutation({
    onSuccess: () => alert('Scan queued successfully! Check back in a few minutes.')
  });

  if (isLoading || !data) return <div className="text-[#6E747A]">Loading CMP Workspace...</div>;

  const { domain, cookies, stats } = data;

  // Set AI guidance context when consent data is available
  useEffect(() => {
    if (domain) {
      setContext({
        module: 'consent',
        entityId: domainId,
        formData: {
          domain: domain.domain,
          cookies: cookies?.map((c: any) => ({
            cookieName: c.cookieName,
            cookieDomain: c.cookieDomain,
            category: c.category,
            provider: c.provider,
          })) || [],
        }
      });
    }
  }, [domainId, cookies?.length]);

  const scriptTag = `<script src="https://api.custodia.io/api/cmp/${domain.scriptId}/banner.js" async></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0D0F11] rounded-3xl border border-white/10 shadow-panel-elevated overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#08090A] p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/consent" className="text-[#6E747A] hover:text-[#F4F5F6] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-semibold text-[#F4F5F6] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#6E747A]" /> {domain.domain}
            </h2>
            <div className="text-[12px] text-[#6E747A] font-mono">
              Script ID: {domain.scriptId}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-[#0D0F11] px-4 shrink-0 overflow-x-auto">
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
              activeTab === tab.id ? 'border-sage-600 text-[#C9A227]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-ink-900/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#08090A]/30 p-8">
        
        {/* INSTALL TAB */}
        {activeTab === 'install' && (
          <div className="max-w-3xl fade-up space-y-8">
            <div>
              <h3 className="text-lg font-medium text-[#F4F5F6] mb-2">Install Consent Banner</h3>
              <p className="text-sm text-[#9BA1A6] mb-6">
                Copy and paste this snippet into the <code>&lt;head&gt;</code> of your website. It must be the very first script to properly intercept and block other tracking scripts.
              </p>
              
              <div className="relative bg-[#1e1e1e] rounded-xl overflow-hidden border border-white/10 shadow-inner">
                <div className="flex items-center justify-between px-4 py-2 bg-[#0D0F11]/5 border-b border-white/5">
                  <span className="text-xs font-mono text-white/50">index.html</span>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors bg-[#0D0F11]/10 px-2 py-1 rounded"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy</>}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-[13px] font-mono leading-relaxed text-blue-300">
                    <span className="text-[#6E747A]">&lt;!-- Custodia Consent Management Platform --&gt;</span>{'\n'}
                    <span className="text-blue-400">&lt;script</span> <span className="text-amber-200">src</span>=<span className="text-sage-300">"https://api.custodia.io/api/cmp/{domain.scriptId}/banner.js"</span> <span className="text-amber-200">async</span><span className="text-blue-400">&gt;&lt;/script&gt;</span>
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-[#0D0F11] border border-white/10 p-6 rounded-2xl shadow-panel-elevated">
              <h4 className="font-medium text-[#F4F5F6] mb-2">Google Consent Mode v2</h4>
              <p className="text-[13px] text-[#9BA1A6] mb-4">
                This script natively supports Google Consent Mode v2. If you are using Google Tag Manager or Google Analytics, simply ensure this script loads <strong>before</strong> the Google tags. The banner will automatically signal consent updates to Google.
              </p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${domain.gcmV2Enabled ? 'bg-sage-100 text-[#C9A227]' : 'bg-white/5 text-[#6E747A]'}`}>
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
              <div className="bg-[#0D0F11] border border-white/10 p-6 rounded-2xl shadow-panel-elevated">
                <h3 className="font-medium text-[#F4F5F6] mb-4">Theme Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[13px] font-medium text-[#E6E8EA]">Primary Color</label>
                    <div className="flex gap-2 mt-1">
                      <input type="color" defaultValue="#2c3e38" className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                      <input type="text" defaultValue="#2c3e38" className="flex-1 bg-[#08090A] border border-white/10 rounded-lg px-3 text-[13px]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-[#E6E8EA] block mb-1">Banner Position</label>
                    <select className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13px]">
                      <option>Bottom Modal</option>
                      <option>Center Modal</option>
                      <option>Bottom Bar</option>
                    </select>
                  </div>
                </div>
                <button className="mt-4 bg-ink-900 text-white px-4 py-2 rounded-lg text-sm font-medium w-full">Save Changes</button>
              </div>
            </div>
            
            <div className="bg-ink-100 rounded-2xl flex items-center justify-center p-8 border border-white/10">
              {/* Preview */}
              <div className="w-full max-w-sm bg-[#0D0F11] rounded-xl shadow-2xl overflow-hidden border border-white/5">
                <div className="p-5">
                  <h4 className="font-bold text-[#F4F5F6] mb-1">We value your privacy</h4>
                  <p className="text-[13px] text-[#9BA1A6] mb-4">We use cookies to enhance your browsing experience and analyze our traffic.</p>
                  <div className="flex flex-col gap-2">
                    <button className="w-full bg-[#2c3e38] text-white py-2.5 rounded-lg text-sm font-medium">Accept All</button>
                    <button className="w-full bg-[#0D0F11] border border-white/20 text-[#F4F5F6] py-2.5 rounded-lg text-sm font-medium">Reject All</button>
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
                <h3 className="font-medium text-[#F4F5F6]">Discovered Cookies</h3>
                <p className="text-sm text-[#6E747A]">
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

            <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#08090A] border-b border-white/10 text-[#6E747A] text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Domain</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/5">
                  {cookies.map(cookie => (
                    <tr key={cookie.id} className="hover:bg-[#08090A]/50">
                      <td className="px-6 py-4 font-mono text-[12px] text-[#F4F5F6] font-bold">{cookie.cookieName}</td>
                      <td className="px-6 py-4 font-mono text-[12px] text-[#9BA1A6]">{cookie.cookieDomain}</td>
                      <td className="px-6 py-4">
                        <select 
                          className="bg-[#08090A] border border-white/10 rounded px-2 py-1 text-[12px]"
                          defaultValue={cookie.category}
                        >
                          <option value="necessary">Necessary</option>
                          <option value="analytics">Analytics</option>
                          <option value="marketing">Marketing</option>
                          <option value="functional">Functional</option>
                          <option value="uncategorized">Uncategorized</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-[#9BA1A6] text-[13px]">{cookie.provider || 'Unknown'}</td>
                    </tr>
                  ))}
                  {cookies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[#6E747A]">
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
              <div className="bg-[#0D0F11] border border-white/10 p-6 rounded-2xl shadow-panel-elevated">
                <div className="text-[12px] font-bold text-[#6E747A] uppercase tracking-wider mb-2">Total Pageviews</div>
                <div className="text-3xl font-serif text-[#F4F5F6]">{stats.total.toLocaleString()}</div>
              </div>
              <div className="bg-[#0D0F11] border border-white/10 p-6 rounded-2xl shadow-panel-elevated">
                <div className="text-[12px] font-bold text-[#6E747A] uppercase tracking-wider mb-2">Accept All Rate</div>
                <div className="text-3xl font-serif text-[#C9A227]">--%</div>
                <div className="text-[12px] text-[#6E747A] mt-1">Awaiting data</div>
              </div>
              <div className="bg-[#0D0F11] border border-white/10 p-6 rounded-2xl shadow-panel-elevated">
                <div className="text-[12px] font-bold text-[#6E747A] uppercase tracking-wider mb-2">Reject All Rate</div>
                <div className="text-3xl font-serif text-amber-400">--%</div>
                <div className="text-[12px] text-[#6E747A] mt-1">Awaiting data</div>
              </div>
            </div>
            
            <div className="bg-[#0D0F11] border border-white/10 p-10 rounded-2xl shadow-panel-elevated text-center">
              <BarChart3 className="w-12 h-12 text-ink-200 mx-auto mb-4" />
              <h3 className="font-medium text-[#F4F5F6]">Advanced Analytics Available Soon</h3>
              <p className="text-sm text-[#6E747A] max-w-sm mx-auto mt-2">
                Detailed breakdowns by country, interaction type, and browser will appear here once enough consent logs are collected.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
