"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { DataGrid } from 'ui';
import { Search, FileText, Download, ShieldAlert, CheckCircle2, Clock, Link as LinkIcon, Building2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DiscoveryTab } from '@/components/vendors/DiscoveryTab';
import { useTranslations } from 'next-intl';

export default function VendorsPage() {
  const t = useTranslations('vendors');
  const {
    data: vendorsResp,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.vendors.getOrgVendors.useInfiniteQuery(
    { limit: 25 },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const vendors = vendorsResp?.pages.flatMap((page: any) => page.data) || [];
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'register' | 'discovery'>('register');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'discovery') {
      setActiveTab('discovery');
    }
  }, [searchParams]);

  // Derived metrics
  const totalVendors = vendors.length;
  const dpasSigned = vendors.filter((v: any) => v.dpaStatus === 'signed').length;
  const dpaCoverage = totalVendors > 0 ? Math.round((dpasSigned / totalVendors) * 100) : 0;
  const missingDpas = vendors.filter((v: any) => v.dpaStatus === 'not_started' || v.dpaStatus === 'expired').length;
  const highRiskVendors = vendors.filter((v: any) => v.riskLevel === 'high' || v.riskLevel === 'critical').length;

  const columns = [
    {
      accessorKey: 'name',
      header: t('columns.vendor'),
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
            {row.original.name.charAt(0)}
          </div>
          <Link href={`/vendors/${row.original.id}`} className="font-medium text-[#F4F5F6] hover:text-[#C9A227] transition-colors">
            {row.original.name}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: t('columns.category'),
      cell: ({ getValue }: any) => <span className="text-[#9BA1A6]">{getValue() || '-'}</span>
    },
    {
      accessorKey: 'dpaStatus',
      header: t('columns.dpa_status'),
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30"><CheckCircle2 className="w-3.5 h-3.5"/> {t('dpa_status.signed')}</span>;
        if (val === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-red-500/10 text-red-400 border border-red-900/50"><Clock className="w-3.5 h-3.5"/> {t('dpa_status.expired')}</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-900/50"><FileText className="w-3.5 h-3.5"/> {t('dpa_status.missing')}</span>;
      }
    },
    {
      accessorKey: 'riskLevel',
      header: t('columns.risk_score'),
      cell: ({ row }: any) => {
        const level = row.original.riskLevel || 'low';
        const score = row.original.riskScore || 0;
        
        let colorClass = "text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/30";
        if (level === 'critical') colorClass = "text-red-400 bg-red-500/10 border-red-900/50 font-bold";
        else if (level === 'high') colorClass = "text-orange-700 bg-orange-50 border-orange-200 font-semibold";
        else if (level === 'medium') colorClass = "text-amber-400 bg-amber-500/10 border-amber-900/50";

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border ${colorClass}`}>
            {level} ({score})
          </span>
        );
      }
    },
    {
      accessorKey: 'headquartersCountry',
      header: t('columns.data_locations'),
      cell: ({ row }: any) => (
        <span className="text-[#9BA1A6] text-[13px]">
          {t('locations.hq', { country: row.original.headquartersCountry || t('locations.unknown') })} 
          {row.original.usingEuHosting && <span className="ml-2 text-[#C9A227] font-medium">{t('locations.eu_hosted')}</span>}
        </span>
      )
    }
  ];

  return (
    <div className="max-w-[1200px] mx-auto p-8 fade-up space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6] text-[15px]">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/vendors/analyzer" className="inline-flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-100 text-indigo-400 text-[14px] font-medium px-4 py-2 rounded-xl border border-indigo-900/50 transition-colors shadow-panel-elevated">
            <Sparkles className="w-4 h-4" /> {t('analyze_dpa')}
          </Link>
          <button className="inline-flex items-center gap-2 bg-[#0D0F11] hover:bg-[#08090A] text-[#E6E8EA] text-[14px] font-medium px-4 py-2 rounded-xl border border-white/10 transition-colors shadow-panel-elevated">
            <Download className="w-4 h-4" /> {t('export_register')}
          </button>
          <button onClick={() => setIsDiscoverOpen(true)} className="inline-flex items-center gap-2 bg-sage-700 hover:bg-sage-600 text-white text-[14px] font-medium px-4 py-2 rounded-xl transition-all shadow-card">
            <Search className="w-4 h-4" /> {t('discover_vendors')}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('register')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'register' ? 'border-sage-600 text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-ink-950'}`}
        >
          {t('tabs.tracked_register', { count: totalVendors })}
        </button>
        <button
          onClick={() => setActiveTab('discovery')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'discovery' ? 'border-sage-600 text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-ink-950'}`}
        >
          {t('tabs.vendor_discovery')}
        </button>
      </div>

      {activeTab === 'register' ? (
        <>
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
              <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2">{t('metrics.total_tracked')}</div>
              <div className="text-3xl font-serif text-[#F4F5F6]">{totalVendors}</div>
            </div>
            <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
              <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2">{t('metrics.dpa_coverage')}</div>
              <div className="text-3xl font-serif text-[#F4F5F6]">{dpaCoverage}%</div>
            </div>
            <div className={`bg-[#0D0F11] border rounded-2xl p-6 shadow-panel-elevated ${missingDpas > 0 ? 'border-red-900/50' : 'border-white/10'}`}>
              <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2 flex items-center gap-2">
                {t('metrics.missing_dpas')} {missingDpas > 0 && <span className="w-2 h-2 rounded-full bg-red-500/100"></span>}
              </div>
              <div className={`text-3xl font-serif ${missingDpas > 0 ? 'text-red-400' : 'text-[#F4F5F6]'}`}>{missingDpas}</div>
            </div>
            <div className={`bg-[#0D0F11] border rounded-2xl p-6 shadow-panel-elevated ${highRiskVendors > 0 ? 'border-amber-900/50' : 'border-white/10'}`}>
              <div className="text-[13px] font-medium text-[#6E747A] uppercase tracking-wider mb-2 flex items-center gap-2">
                {t('metrics.high_risk')} {highRiskVendors > 0 && <span className="w-2 h-2 rounded-full bg-amber-500/100"></span>}
              </div>
              <div className={`text-3xl font-serif ${highRiskVendors > 0 ? 'text-amber-400' : 'text-[#F4F5F6]'}`}>{highRiskVendors}</div>
            </div>
          </div>

          {/* DataGrid */}
          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-[#08090A]/50 flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E747A]" />
                <input 
                  type="text" 
                  placeholder={t('filter_placeholder')}
                  className="w-full bg-[#0D0F11] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                />
              </div>
              <button className="text-[13px] font-medium text-[#9BA1A6] hover:text-[#F4F5F6] bg-[#0D0F11] border border-white/10 px-3 py-1.5 rounded-lg shadow-panel-elevated">
                {t('add_custom_vendor')}
              </button>
            </div>
            <DataGrid 
              mode="full"
              bare
              columns={columns as any}
              data={vendors}
              isLoading={isLoading}
              emptyStateMessage={t('empty_state')}
            />
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
        </>
      ) : (
        <DiscoveryTab />
      )}

      <DiscoverModal isOpen={isDiscoverOpen} onClose={() => setIsDiscoverOpen(false)} />
    </div>
  );
}

function DiscoverModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { data: globalVendors = [] } = trpc.vendors.getAllGlobal.useQuery(undefined, { enabled: isOpen });
  const linkMutation = trpc.vendors.linkVendor.useMutation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const t = useTranslations('vendors');

  const handleLink = async (id: string) => {
    await linkMutation.mutateAsync({ vendorId: id });
    utils.vendors.getOrgVendors.invalidate();
    onClose();
  };

  const filtered = globalVendors.filter((v: any) => v.name.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
      <div className="bg-[#08090A] border-white/10 rounded-2xl w-full max-w-[600px] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10 bg-[#0D0F11] flex justify-between items-center">
          <h2 className="text-xl font-serif text-[#F4F5F6]">{t('discover_modal.title')}</h2>
          <button onClick={onClose} className="text-[#6E747A] hover:text-[#F4F5F6] text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 border-b border-white/10 bg-[#0D0F11]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6E747A]" />
            <input 
              type="text" 
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('discover_modal.search_placeholder')}
              className="w-full bg-[#08090A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            />
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2 bg-[#08090A]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[#6E747A]">{t('discover_modal.no_results', { search })}</div>
          ) : (
            filtered.map((v: any) => (
              <div key={v.id} className="bg-[#0D0F11] border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-[#C9A227]/50/30 transition-colors shadow-panel-elevated">
                <div>
                  <h4 className="font-semibold text-[#F4F5F6] flex items-center gap-2">
                    {v.name}
                    {v.category && <span className="px-2 py-0.5 bg-white/5 text-[#9BA1A6] text-[11px] rounded uppercase tracking-wider">{v.category}</span>}
                  </h4>
                  <p className="text-[13px] text-[#6E747A] mt-1">{t('discover_modal.hq', { country: v.headquartersCountry })}</p>
                </div>
                <button 
                  onClick={() => handleLink(v.id)}
                  disabled={linkMutation.isPending}
                  className="bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 hover:text-sage-800 font-medium text-[13px] px-4 py-2 rounded-lg transition-colors border border-[#C9A227]/30"
                >
                  {t('discover_modal.add_to_register')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
