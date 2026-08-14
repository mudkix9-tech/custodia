"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { severityClasses } from '@/utils/severity';
import { FileText, Plus, Download, Upload, AlertCircle, CheckCircle2, ChevronRight, X, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toCsvRow } from '@/utils/csv';
import { parseRopaCsv, type RowError } from '@/utils/ropaImport';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';

export default function RopaListPage() {
  const t = useTranslations('ropa');
  const router = useRouter();
  const toast = useToast();
  const [globalFilter, setGlobalFilter] = useState('');
  const [flagsTab, setFlagsTab] = useState<'flagged'|'dismissed'>('flagged');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        router.push('/ropa/new');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
  
  // Use suspense for data loading in Next.js 15
  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.ropa.list.useInfiniteQuery(
    { limit: 25 },
    { getNextPageParam: (lastPage) => lastPage.pagination.next_cursor }
  );

  const processingActivities = data?.pages.flatMap((page) => page.data) || [];
  const bulkCreateMutation = trpc.ropa.bulkCreate.useMutation();
  const generatePdfMutation = trpc.export.generatePdf.useMutation();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  // Rejected rows are listed in the page rather than a toast: the point is that
  // the customer can fix the file, which means seeing every line that failed.
  const [importErrors, setImportErrors] = useState<RowError[] | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: reconsentFlags, refetch: refetchFlags } = trpc.reconsent.list.useQuery({ status: flagsTab });
  const dismissFlagMutation = trpc.reconsent.dismiss.useMutation({
    onSuccess: () => refetchFlags()
  });

  const handleExportCSV = () => {
    if (!processingActivities || processingActivities.length === 0) return;
    
    const headers = ['Name', 'Purpose', 'Lawful Basis', 'Role', 'Controller', 'Status', 'Risk Level', 'Description'];
    // Same quoting helper the importer reads back, so a round trip is lossless.
    const csvContent = [
      toCsvRow(headers),
      ...processingActivities.map((a: any) =>
        toCsvRow([
          a.name, a.purpose, a.lawfulBasis || '', a.role || 'controller', a.controllerName || '',
          a.status, a.riskLevel || 'low', a.description || '',
        ])
      )
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `ropa_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportErrors(null);
    const reader = new FileReader();

    reader.onerror = () => {
      toast('Could not read that file.', { tone: 'error' });
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onload = async (e) => {
      try {
        const { activities, errors, fatal } = parseRopaCsv((e.target?.result as string) ?? '');

        if (fatal) {
          toast('Import failed', { tone: 'error', description: fatal });
          return;
        }

        if (activities.length > 0) {
          await bulkCreateMutation.mutateAsync(activities);
          refetch();
        }

        // Report what happened to every row. The previous version reported
        // success unconditionally, including for files it had silently mangled.
        if (errors.length > 0) setImportErrors(errors);

        if (activities.length === 0) {
          toast('Nothing imported', {
            tone: 'error',
            description: `All ${errors.length} row${errors.length === 1 ? '' : 's'} were rejected.`,
          });
        } else if (errors.length > 0) {
          toast(`Imported ${activities.length} of ${activities.length + errors.length} activities`, {
            tone: 'info',
            description: `${errors.length} row${errors.length === 1 ? ' was' : 's were'} skipped — see the list below.`,
          });
        } else {
          toast(`Imported ${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}`);
        }
      } catch (err) {
        console.error(err);
        toast('Import failed', {
          tone: 'error',
          description: err instanceof Error ? err.message : 'The server rejected the file.',
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const result = await generatePdfMutation.mutateAsync({ type: 'full_audit' });
      if (result.success && result.pdfData) {
        const linkSource = `data:application/pdf;base64,${result.pdfData}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = result.filename;
        downloadLink.click();
      }
    } catch (err) {
      console.error(err);
      toast('Could not generate the audit report', {
        tone: 'error',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const columns = [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: (info: any) => <span className="font-medium text-[#F4F5F6]">{info.getValue()}</span>,
    },
    {
      accessorKey: 'purpose',
      header: t('columns.purpose'),
      cell: (info: any) => <span className="text-[#9BA1A6] truncate max-w-xs inline-block">{info.getValue()}</span>,
    },
    {
      accessorKey: 'role',
      header: t('columns.role'),
      cell: (info: any) => {
        const role = (info.getValue() as string) || 'controller';
        const controllerName = info.row.original.controllerName;
        return (
          <span className="inline-flex flex-col gap-0.5">
            <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${
              role === 'processor'
                ? 'bg-white/5 text-[#9BA1A6] border-white/10'
                : 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/25'
            }`}>
              {t(`roles.${role}`)}
            </span>
            {role === 'processor' && controllerName && (
              <span className="text-[11px] text-[#6E747A]">{t('columns.for_controller', { name: controllerName })}</span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: 'lawfulBasis',
      header: t('columns.lawful_basis'),
      cell: (info: any) => (
        <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-white/5 text-[#9BA1A6] border border-white/10">
          {info.getValue() || 'Unspecified'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: (info: any) => {
        const status = info.getValue();
        return (
          <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${
            status === 'active' ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/20' : 
            status === 'draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            'bg-white/5 text-[#6E747A] border-white/10'
          }`}>
            {t(`status_types.${status}`) || status}
          </span>
        );
      },
    },
    {
      accessorKey: 'dataSubjectCategories',
      header: t('columns.data_subjects'),
      // Art. 30(1)(c). Stored as a JSONB array; an auditor reads the count first
      // and the categories second, so lead with the count.
      cell: (info: any) => {
        const categories = (info.getValue() as string[] | null) ?? [];
        if (categories.length === 0) {
          return <span className="text-[12px] text-[#6E747A]">{t('columns.not_recorded')}</span>;
        }
        return (
          <span className="text-[12px] text-[#9BA1A6]" title={categories.join(', ')}>
            {categories.slice(0, 2).join(', ')}
            {categories.length > 2 && ` +${categories.length - 2}`}
          </span>
        );
      },
    },
    {
      accessorKey: 'retentionPeriod',
      header: t('columns.retention'),
      // Art. 30(1)(f). A blank here is the single most common Article 30 finding,
      // so it is called out rather than rendered as an empty cell.
      cell: (info: any) => {
        const period = info.getValue() as string | null;
        return period ? (
          <span className="text-[12px] text-[#9BA1A6]">{period}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[12px] text-amber-400">
            <AlertCircle className="h-3 w-3" /> {t('columns.not_recorded')}
          </span>
        );
      },
    },
    {
      accessorKey: 'riskLevel',
      header: t('columns.risk'),
      cell: (info: any) => {
        const risk = info.getValue()?.toLowerCase() || 'low';
        const special = info.row.original.involvesSpecialCategories;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${severityClasses(risk)}`}>
              {t(`risk_levels.${risk}`) || risk}
            </span>
            {special && (
              <span title={t('columns.special_categories')} className="text-[#C9A227]">
                <ShieldAlert className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        );
      },
    }
  ];

  return (
    <div className="flex-1 p-8 bg-[#08090A] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-[#F4F5F6] tracking-tight flex items-center gap-3">
              <div className="p-2 bg-[#0D0F11] rounded-xl shadow-card border border-white/10">
                <FileText className="w-5 h-5 text-[#C9A227]" />
              </div>
              {t('title')}
            </h1>
            <p className="text-[13.5px] text-[#6E747A] mt-2">
              {t('subtitle')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImportCSV} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? t('importing') : t('import_csv')}
            </button>
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated"
            >
              <Download className="w-4 h-4" />
              {t('export_csv')}
            </button>
            <button 
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {isExportingPdf ? t('generating') : t('export_pdf')}
            </button>
            <button 
              onClick={() => router.push('/ropa/new')}
              className="px-4 py-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
            >
              <Plus className="w-4 h-4" />
              {t('new_activity')}
            </button>
          </div>
        </div>

        {/* Rows the import refused. Listed in full so the file can be corrected. */}
        {importErrors && importErrors.length > 0 && (
          <div className="fade-up overflow-hidden rounded-2xl border border-red-500/30 bg-[#0D0F11] shadow-panel-elevated">
            <div className="flex items-center justify-between border-b border-white/5 bg-red-500/10 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-[#F4F5F6]">
                  {t('import_skipped', { count: importErrors.length })}
                </h3>
              </div>
              <button
                onClick={() => setImportErrors(null)}
                className="rounded p-1 text-[#6E747A] transition-colors hover:text-[#E6E8EA]"
                aria-label={t('dismiss')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[280px] divide-y divide-white/5 overflow-y-auto">
              {importErrors.map((e) => (
                <li key={e.line} className="flex gap-3 p-3 text-[13px]">
                  <span className="flex-none font-mono text-[#6E747A]">{t('import_line', { line: e.line })}</span>
                  <span className="text-[#9BA1A6]">{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Re-Consent Flags Section */}
        {(reconsentFlags?.length || 0) > 0 || flagsTab === 'dismissed' ? (
          <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden fade-up">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-amber-500/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-[#F4F5F6]">{t('reconsent_triggers')}</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlagsTab('flagged')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${flagsTab === 'flagged' ? 'bg-[#0D0F11] text-amber-400 shadow-panel-elevated border border-amber-500/20' : 'text-[#6E747A] hover:text-[#E6E8EA]'}`}
                >
                  {t('active_flags')}
                </button>
                <button
                  onClick={() => setFlagsTab('dismissed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${flagsTab === 'dismissed' ? 'bg-[#0D0F11] text-[#E6E8EA] shadow-panel-elevated border border-white/10' : 'text-[#6E747A] hover:text-[#E6E8EA]'}`}
                >
                  {t('dismissed')}
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
              {reconsentFlags?.length === 0 ? (
                <div className="p-8 text-center text-[#6E747A] text-sm">
                  {t('no_flags', { tab: flagsTab === 'flagged' ? t('active_flags').toLowerCase() : t('dismissed').toLowerCase() })}
                </div>
              ) : (
                reconsentFlags?.map((flag: any) => (
                  <div key={flag.id} className="p-4 hover:bg-[#08090A]/50 transition-colors flex items-start gap-4">
                    <div className="mt-1">
                      {flag.confidence === 'ambiguous' ? (
                        <div className="w-8 h-8 rounded-full bg-[#C9A227]/10 flex items-center justify-center text-[#C9A227]" title={t('human_review')}>
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-[#F4F5F6] text-sm">
                          {t('activity_changed', { name: flag.activity.name })}
                        </h4>
                        <div className="text-xs text-[#6E747A]">
                          {new Date(flag.detectedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm text-[#9BA1A6] mb-2">{flag.reason}</p>
                      
                      <div className="flex items-center gap-4 mt-3">
                        <button 
                          onClick={() => router.push(`/ropa/${flag.activity.id}`)}
                          className="text-xs font-medium text-[#C9A227] hover:text-[#C9A227] flex items-center gap-1"
                        >
                          {t('review_activity')} <ChevronRight className="w-3 h-3" />
                        </button>
                        {flagsTab === 'flagged' && (
                          <button
                            onClick={() => dismissFlagMutation.mutate({ id: flag.id })}
                            disabled={dismissFlagMutation.isPending}
                            className="text-xs font-medium text-[#6E747A] hover:text-[#E6E8EA] flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> {t('dismiss')}
                          </button>
                        )}
                        {flagsTab === 'dismissed' && (
                          <span className="text-xs text-[#6E747A] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t('dismissed')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* Data Grid */}
        <div className="w-full">
          <DataGrid
            mode="full"
            columns={columns as any}
            data={processingActivities || []}
            isLoading={isLoading}
            enableBulkActions={true}
            globalFilter={globalFilter}
            setGlobalFilter={setGlobalFilter}
            onRowClick={(row: any) => router.push(`/ropa/${row.id}`)}
            emptyState={
              <EmptyState
                icon={FileText}
                title={t('empty.title')}
                description={t('empty.description')}
                action={{ label: t('empty.action'), onClick: () => router.push('/ropa/new') }}
                secondaryAction={{ label: t('import_csv'), onClick: () => fileInputRef.current?.click() }}
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
      </div>
    </div>
  );
}
