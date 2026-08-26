"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { severityClasses } from '@/utils/severity';
import { DataGrid } from 'ui';
import { Search, FileText, Download, ShieldAlert, CheckCircle2, Clock, Link as LinkIcon, Building2, Sparkles, Upload } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { DiscoveryTab } from '@/components/vendors/DiscoveryTab';
import { AddCustomVendorModal } from '@/components/vendors/AddCustomVendorModal';
import { ImportVendorsModal } from '@/components/vendors/ImportVendorsModal';
import { VendorIntakeTab } from '@/components/vendors/VendorIntakeTab';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageShell } from '@/components/layout/PageShell';

/**
 * The filter's own vocabulary, mirroring the API's.
 *
 * `missing` is a *query*, not a status: it means DPA_STATUS_MISSING, which is
 * `not_started` **and** `expired`. The first version of this filter hand-wrote
 * `not_started` on the server while the metric tile beside it used the
 * constant, so the dashboard and the list gave different answers to "how many
 * DPAs do we owe" — by however many had lapsed.
 */
type DpaFilter = 'signed' | 'requested' | 'in_review' | 'not_started' | 'expired' | 'missing';
type VendorStatusFilter = 'active' | 'paused' | 'offboarded' | 'all';

export default function VendorsPage() {
  const t = useTranslations('vendors');
  // D41. Search, filters and sort are server-side: the register page previously
  // filtered the 25 loaded rows client-side, so "no results" meant "not in this
  // page" and a 60-vendor organisation searched a quarter of its own register.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'low' | 'medium' | 'high' | 'critical' | null>(null);
  const [dpaFilter, setDpaFilter] = useState<DpaFilter | null>(null);
  // D30. Offboarded relationships are out of the default list and reachable
  // through this filter -- they are history rather than inventory, but Art. 30
  // asks about the processors used during the period, not only today's.
  const [statusFilter, setStatusFilter] = useState<VendorStatusFilter | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'riskScore' | 'lastReviewedAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isImportOpen, setIsImportOpen] = useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const {
    data: vendorsResp,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.vendors.getOrgVendors.useInfiniteQuery(
    {
      limit: 25,
      search,
      riskLevel: riskFilter ?? undefined,
      dpaStatus: dpaFilter ?? undefined,
      status: statusFilter ?? undefined,
      sortBy,
      sortDir,
    },
    { getNextPageParam: (lastPage: any) => lastPage.pagination?.next_cursor }
  );

  const vendors = vendorsResp?.pages.flatMap((page: any) => page.data) || [];
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const toast = useToast();
  const utils = trpc.useUtils();

  // Whole-register figures: the tiles, tab count and DPA coverage used to be
  // computed over whichever pages of 25 rows happened to be loaded.
  const { data: riskStats } = trpc.vendors.getRiskStats.useQuery();

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'register' | 'discovery' | 'intake'>('register');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'discovery') {
      setActiveTab('discovery');
    } else if (tab === 'intake') {
      setActiveTab('intake');
    }
  }, [searchParams]);

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingArt30, setIsExportingArt30] = useState(false);

  const handleExportRegister = async () => {
    // Server-side export: the client-side version serialised only the loaded
    // pages, so an auditor received a file describing a quarter of the register.
    // That round trip can fail, and an unhandled rejection here reads to the user
    // as a button that does nothing -- worse than the bug it replaced, because a
    // truncated file at least arrives.
    if (isExporting) return;
    setIsExporting(true);
    let objectUrl: string | null = null;
    try {
      const { csv, count } = await utils.vendors.exportRegisterCsv.fetch();
      if (count === 0) {
        toast(t('export.nothing'), { tone: 'error', description: t('export.empty_register') });
        return;
      }
      objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', `vendor_register_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast(t('export.done', { count }));
    } catch (err: unknown) {
      toast(t('export.failed'), {
        tone: 'error',
        description: err instanceof Error ? err.message : t('export.failed_detail'),
      });
    } finally {
      // The blob is held alive by the object URL until it is revoked; the click
      // has already been dispatched by the time this runs.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsExporting(false);
    }
  };

  const handleExportArticle30 = async () => {
    if (isExportingArt30) return;
    setIsExportingArt30(true);
    let objectUrl: string | null = null;
    try {
      const { csv, rowCount, filename } = await utils.vendors.exportArticle30Register.fetch();
      if (rowCount === 0) {
        toast(t('export.nothing'), { tone: 'error', description: t('export.empty_register') });
        return;
      }
      objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast(t('export.done', { count: rowCount }));
    } catch (err: unknown) {
      toast(t('export.failed'), {
        tone: 'error',
        description: err instanceof Error ? err.message : t('export.failed_detail'),
      });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsExportingArt30(false);
    }
  };

  // Derived metrics -- whole-register values from getRiskStats
  const totalVendors = riskStats?.total ?? 0;
  const dpaCoverage = totalVendors > 0 ? Math.round(((riskStats?.dpasSigned ?? 0) / totalVendors) * 100) : 0;
  const missingDpas = riskStats?.missingDpas ?? 0;
  const highRiskVendors = riskStats?.highOrCritical ?? 0;

  const columns = [
    {
      accessorKey: 'name',
      header: t('columns.vendor'),
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
            {row.original.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <Link href={`/vendors/${row.original.id}`} className="font-medium text-[#F4F5F6] hover:text-[#C9A227] transition-colors">
              {row.original.name}
            </Link>
            {/* The owner is searchable, so it has to be visible: matching a row
                on a field the grid never shows reads as a wrong result. */}
            {row.original.businessOwner && (
              <div className="text-[11px] text-[#6E747A] truncate">{row.original.businessOwner}</div>
            )}
          </div>
          {row.original.status === 'offboarded' && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-[#6E747A] border border-white/10">
              {t('status.offboarded')}
            </span>
          )}
          {row.original.status === 'paused' && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-900/50">
              {t('status.paused')}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: t('columns.category'),
      cell: ({ getValue }: any) => <span className="text-[#9BA1A6]">{getValue() || '-'}</span>
    },
    {
      accessorKey: 'processingRole',
      header: t('columns.processing_role'),
      cell: ({ row }: any) => {
        const role = row.original.processingRole;
        // An unset role is a gap worth showing, not a blank: which Article
        // applies to this relationship has not been decided.
        if (!role) return <span className="text-[11px] text-[#6E747A]">{t('columns.role_unset')}</span>;
        return <span className="text-[#9BA1A6] text-[13px]">{t(`role.${role}` as any)}</span>;
      }
    },
    {
      accessorKey: 'dpaStatus',
      header: t('columns.dpa_status'),
      cell: ({ getValue }: any) => {
        const val = getValue();
        if (val === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30"><CheckCircle2 className="w-3.5 h-3.5"/> {t('dpa_status.signed')}</span>;
        if (val === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-red-500/10 text-red-400 border border-red-900/50"><Clock className="w-3.5 h-3.5"/> {t('dpa_status.expired')}</span>;
        // `requested` and `in_review` are real states in DPA_STATUSES and were
        // both rendered as "missing", so a DPA out for signature looked
        // identical to one nobody had asked for.
        if (val === 'requested') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-sky-500/10 text-sky-300 border border-sky-900/50"><Clock className="w-3.5 h-3.5"/> {t('dpa_status.requested')}</span>;
        if (val === 'in_review') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-sky-500/10 text-sky-300 border border-sky-900/50"><FileText className="w-3.5 h-3.5"/> {t('dpa_status.in_review')}</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-900/50"><FileText className="w-3.5 h-3.5"/> {t('dpa_status.missing')}</span>;
      }
    },
    {
      accessorKey: 'riskLevel',
      header: t('columns.risk_score'),
      cell: ({ row }: any) => {
        const level = row.original.riskLevel || 'low';
        const score = row.original.riskScore || 0;
        
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border ${severityClasses(level)}`}>
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
    <PageShell className="fade-up space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6] text-[15px]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/vendors/analyzer" className="inline-flex items-center gap-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] text-[13px] font-medium px-3.5 py-2 rounded-xl border border-white/10 transition-colors shadow-panel-elevated">
            <Sparkles className="w-4 h-4 text-[#C9A227]" /> {t('analyze_dpa')}
          </Link>
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] text-[13px] font-medium px-3.5 py-2 rounded-xl border border-white/10 transition-colors shadow-panel-elevated"
          >
            <Upload className="w-4 h-4 text-[#9BA1A6]" /> {t('import.button')}
          </button>
          <button
            onClick={handleExportArticle30}
            disabled={isExportingArt30}
            className="inline-flex items-center gap-2 bg-[#0D0F11] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-[#E6E8EA] text-[13px] font-medium px-3.5 py-2 rounded-xl border border-white/10 transition-colors shadow-panel-elevated"
          >
            <FileText className="w-4 h-4 text-[#C9A227]" /> {t('export_article_30')}
          </button>
          <button
            onClick={handleExportRegister}
            disabled={isExporting}
            className="inline-flex items-center gap-2 bg-[#0D0F11] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-[#E6E8EA] text-[13px] font-medium px-3.5 py-2 rounded-xl border border-white/10 transition-colors shadow-panel-elevated"
          >
            <Download className="w-4 h-4 text-[#9BA1A6]" /> {t('export_register')}
          </button>
          <button onClick={() => setIsDiscoverOpen(true)} className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[13px] font-medium px-3.5 py-2 rounded-xl transition-all shadow-card">
            <Search className="w-4 h-4" /> {t('discover_vendors')}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('register')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'register' ? 'border-[#C9A227] text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          {t('tabs.tracked_register', { count: totalVendors })}
        </button>
        <button
          onClick={() => setActiveTab('discovery')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'discovery' ? 'border-[#C9A227] text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          {t('tabs.vendor_discovery')}
        </button>
        <button
          onClick={() => setActiveTab('intake')}
          className={`px-6 py-3.5 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'intake' ? 'border-[#C9A227] text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          {t('tabs.intake')}
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
            <div className="p-4 border-b border-white/5 bg-[#08090A]/50 flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E747A]" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('filter_placeholder')}
                  className="w-full bg-[#0D0F11] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-[14px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                />
              </div>
              <select
                value={riskFilter ?? ''}
                onChange={(e) => setRiskFilter((e.target.value || null) as 'low' | 'medium' | 'high' | 'critical' | null)}
                className="bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#E6E8EA] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="">{t('filter.risk_all')}</option>
                <option value="critical">{t('risk_level.critical')}</option>
                <option value="high">{t('risk_level.high')}</option>
                <option value="medium">{t('risk_level.medium')}</option>
                <option value="low">{t('risk_level.low')}</option>
              </select>
              <select
                value={dpaFilter ?? ''}
                onChange={(e) => setDpaFilter((e.target.value || null) as DpaFilter | null)}
                aria-label={t('filter.dpa_all')}
                className="bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#E6E8EA] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="">{t('filter.dpa_all')}</option>
                <option value="signed">{t('dpa_status.signed')}</option>
                {/* "Outstanding" is not_started OR expired — the same set the
                    metric tile counts. Both remain individually selectable. */}
                <option value="missing">{t('filter.dpa_outstanding')}</option>
                <option value="not_started">{t('dpa_status.not_started')}</option>
                <option value="requested">{t('dpa_status.requested')}</option>
                <option value="in_review">{t('dpa_status.in_review')}</option>
                <option value="expired">{t('dpa_status.expired')}</option>
              </select>
              <select
                value={statusFilter ?? ''}
                onChange={(e) => setStatusFilter((e.target.value || null) as VendorStatusFilter | null)}
                aria-label={t('filter.status_live')}
                className="bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#E6E8EA] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="">{t('filter.status_live')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="paused">{t('status.paused')}</option>
                <option value="offboarded">{t('status.offboarded')}</option>
                <option value="all">{t('filter.status_all')}</option>
              </select>
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [nextBy, nextDir] = e.target.value.split(':');
                  setSortBy(nextBy as any);
                  setSortDir(nextDir as any);
                }}
                aria-label={t('filter.sort_newest')}
                className="ml-auto bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[#E6E8EA] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="createdAt:desc">{t('filter.sort_newest')}</option>
                <option value="name:asc">{t('filter.sort_name_asc')}</option>
                <option value="name:desc">{t('filter.sort_name_desc')}</option>
                <option value="riskScore:desc">{t('filter.sort_risk_high')}</option>
                <option value="riskScore:asc">{t('filter.sort_risk_low')}</option>
                <option value="lastReviewedAt:asc">{t('filter.sort_review_oldest')}</option>
              </select>
              <button
                onClick={() => setIsAddCustomOpen(true)}
                className="text-[13px] font-medium text-[#9BA1A6] hover:text-[#F4F5F6] bg-[#0D0F11] border border-white/10 px-3 py-1.5 rounded-lg shadow-panel-elevated transition-colors"
              >
                {t('add_custom_vendor')}
              </button>
            </div>
            <DataGrid
              mode="full"
              bare
              columns={columns as any}
              data={vendors}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={Building2}
                  title={t('empty.title')}
                  description={t('empty.description')}
                  action={{ label: t('discover_vendors'), onClick: () => setIsDiscoverOpen(true) }}
                  secondaryAction={{ label: t('add_custom_vendor'), onClick: () => setIsAddCustomOpen(true) }}
                />
              }
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
      ) : activeTab === 'discovery' ? (
        <DiscoveryTab />
      ) : (
        <VendorIntakeTab />
      )}

      <DiscoverModal isOpen={isDiscoverOpen} onClose={() => setIsDiscoverOpen(false)} />
      <AddCustomVendorModal
        open={isAddCustomOpen}
        onClose={() => setIsAddCustomOpen(false)}
        onCreated={() => utils.vendors.getOrgVendors.invalidate()}
      />
      <ImportVendorsModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </PageShell>
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
              <div key={v.id} className="bg-[#0D0F11] border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-[#C9A227]/30 transition-colors shadow-panel-elevated">
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
                  className="bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 hover:text-[#E5C463] font-medium text-[13px] px-4 py-2 rounded-lg transition-colors border border-[#C9A227]/30"
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
