"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { DataGrid } from 'ui';
import { Plus, Search, FileText, Download, ShieldAlert, CheckCircle2, Clock, Link as LinkIcon, Building2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DiscoveryTab } from '@/components/vendors/DiscoveryTab';

export default function VendorsPage() {
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
      header: 'Vendor',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bone-100 rounded-lg flex items-center justify-center border border-ink-900/10">
            {row.original.name.charAt(0)}
          </div>
          <Link href={`/vendors/${row.original.id}`} className="font-medium text-ink-900 hover:text-sage-600 transition-colors">
            {row.original.name}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }: any) => <span className="text-ink-600">{getValue() || '-'}</span>
    },
    {
      accessorKey: 'dpaStatus',
      header: 'DPA Status',
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-sage-50 text-sage-700 border border-sage-200"><CheckCircle2 className="w-3.5 h-3.5"/> Signed</span>;
        if (val === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-red-50 text-red-700 border border-red-200"><Clock className="w-3.5 h-3.5"/> Expired</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-amber-50 text-amber-700 border border-amber-200"><FileText className="w-3.5 h-3.5"/> Missing</span>;
      }
    },
    {
      accessorKey: 'riskLevel',
      header: 'Risk Score & Level',
      cell: ({ row }: any) => {
        const level = row.original.riskLevel || 'low';
        const score = row.original.riskScore || 0;
        
        let colorClass = "text-sage-600 bg-sage-50 border-sage-200";
        if (level === 'critical') colorClass = "text-red-700 bg-red-50 border-red-200 font-bold";
        else if (level === 'high') colorClass = "text-orange-700 bg-orange-50 border-orange-200 font-semibold";
        else if (level === 'medium') colorClass = "text-amber-700 bg-amber-50 border-amber-200";

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border ${colorClass}`}>
            {level} ({score})
          </span>
        );
      }
    },
    {
      accessorKey: 'headquartersCountry',
      header: 'Data Locations',
      cell: ({ row }: any) => (
        <span className="text-ink-600 text-[13px]">
          HQ: {row.original.headquartersCountry || 'Unknown'} 
          {row.original.usingEuHosting && <span className="ml-2 text-sage-600 font-medium">(EU Hosted)</span>}
        </span>
      )
    }
  ];

  return (
    <div className="max-w-[1200px] mx-auto p-8 fade-up space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-ink-900 mb-2">Vendor Intelligence</h1>
          <p className="text-ink-600 text-[15px]">Automated tracking for DPAs, TIAs, and sub-processor risk.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/vendors/analyzer" className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[14px] font-medium px-4 py-2 rounded-xl border border-indigo-200 transition-colors shadow-sm">
            <Sparkles className="w-4 h-4" /> Analyze DPA
          </Link>
          <button className="inline-flex items-center gap-2 bg-white hover:bg-bone-50 text-ink-700 text-[14px] font-medium px-4 py-2 rounded-xl border border-ink-900/10 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Export Register
          </button>
          <button onClick={() => setIsDiscoverOpen(true)} className="inline-flex items-center gap-2 bg-sage-700 hover:bg-sage-600 text-white text-[14px] font-medium px-4 py-2 rounded-xl transition-all shadow-card">
            <Search className="w-4 h-4" /> Discover Vendors
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-ink-900/10">
        <button
          onClick={() => setActiveTab('register')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'register' ? 'border-sage-600 text-sage-700 font-semibold' : 'border-transparent text-ink-500 hover:text-ink-950'}`}
        >
          Tracked Register ({totalVendors})
        </button>
        <button
          onClick={() => setActiveTab('discovery')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'discovery' ? 'border-sage-600 text-sage-700 font-semibold' : 'border-transparent text-ink-500 hover:text-ink-950'}`}
        >
          Vendor Discovery &amp; Shadow IT
        </button>
      </div>

      {activeTab === 'register' ? (
        <>
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
              <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2">Total Tracked</div>
              <div className="text-3xl font-serif text-ink-900">{totalVendors}</div>
            </div>
            <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm">
              <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2">DPA Coverage</div>
              <div className="text-3xl font-serif text-ink-900">{dpaCoverage}%</div>
            </div>
            <div className={`bg-white border rounded-2xl p-6 shadow-sm ${missingDpas > 0 ? 'border-red-200' : 'border-ink-900/10'}`}>
              <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                Missing / Expired DPAs {missingDpas > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
              </div>
              <div className={`text-3xl font-serif ${missingDpas > 0 ? 'text-red-600' : 'text-ink-900'}`}>{missingDpas}</div>
            </div>
            <div className={`bg-white border rounded-2xl p-6 shadow-sm ${highRiskVendors > 0 ? 'border-amber-200' : 'border-ink-900/10'}`}>
              <div className="text-[13px] font-medium text-ink-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                High / Critical Risk {highRiskVendors > 0 && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
              </div>
              <div className={`text-3xl font-serif ${highRiskVendors > 0 ? 'text-amber-600' : 'text-ink-900'}`}>{highRiskVendors}</div>
            </div>
          </div>

          {/* DataGrid */}
          <div className="bg-white border border-ink-900/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-ink-900/5 bg-bone-50/50 flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input 
                  type="text" 
                  placeholder="Filter vendors..."
                  className="w-full bg-white border border-ink-900/10 rounded-lg pl-9 pr-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                />
              </div>
              <button className="text-[13px] font-medium text-ink-600 hover:text-ink-900 bg-white border border-ink-900/10 px-3 py-1.5 rounded-lg shadow-sm">
                Add Custom Vendor
              </button>
            </div>
            <DataGrid 
              mode="full"
              columns={columns as any}
              data={vendors}
              isLoading={isLoading}
              emptyStateMessage="No vendors tracked yet. Click 'Discover Vendors' to start building your register."
            />
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

  const handleLink = async (id: string) => {
    await linkMutation.mutateAsync({ vendorId: id });
    utils.vendors.getOrgVendors.invalidate();
    onClose();
  };

  const filtered = globalVendors.filter((v: any) => v.name.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
      <div className="bg-bone-50 border-ink-900/10 rounded-2xl w-full max-w-[600px] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-ink-900/10 bg-white flex justify-between items-center">
          <h2 className="text-xl font-serif text-ink-900">Discover Global Vendors</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 border-b border-ink-900/10 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input 
              type="text" 
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name (e.g., HubSpot, AWS)..."
              className="w-full bg-bone-50 border border-ink-900/10 rounded-xl pl-10 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
            />
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2 bg-bone-50">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-ink-500">No global vendors found matching "{search}".</div>
          ) : (
            filtered.map((v: any) => (
              <div key={v.id} className="bg-white border border-ink-900/10 rounded-xl p-4 flex items-center justify-between hover:border-sage-500/30 transition-colors shadow-sm">
                <div>
                  <h4 className="font-semibold text-ink-900 flex items-center gap-2">
                    {v.name}
                    {v.category && <span className="px-2 py-0.5 bg-bone-100 text-ink-600 text-[11px] rounded uppercase tracking-wider">{v.category}</span>}
                  </h4>
                  <p className="text-[13px] text-ink-500 mt-1">HQ: {v.headquartersCountry}</p>
                </div>
                <button 
                  onClick={() => handleLink(v.id)}
                  disabled={linkMutation.isPending}
                  className="bg-sage-50 text-sage-700 hover:bg-sage-100 hover:text-sage-800 font-medium text-[13px] px-4 py-2 rounded-lg transition-colors border border-sage-200"
                >
                  Add to Register
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
