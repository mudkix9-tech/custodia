"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { FileText, Plus, Download, Upload, AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';

export default function RopaListPage() {
  const router = useRouter();
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: reconsentFlags, refetch: refetchFlags } = trpc.reconsent.list.useQuery({ status: flagsTab });
  const dismissFlagMutation = trpc.reconsent.dismiss.useMutation({
    onSuccess: () => refetchFlags()
  });

  const handleExportCSV = () => {
    if (!processingActivities || processingActivities.length === 0) return;
    
    const headers = ['Name', 'Purpose', 'Lawful Basis', 'Status', 'Risk Level', 'Description'];
    const csvContent = [
      headers.join(','),
      ...processingActivities.map((a: any) => [
        `"${a.name.replace(/"/g, '""')}"`,
        `"${a.purpose.replace(/"/g, '""')}"`,
        `"${a.lawfulBasis || ''}"`,
        `"${a.status}"`,
        `"${a.riskLevel || 'low'}"`,
        `"${(a.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

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
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').filter(row => row.trim());
        const data = rows.slice(1).map(row => {
          // Simple CSV parsing (does not handle commas inside quotes perfectly, but sufficient for basic import)
          const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
          return {
            name: cols[0] || 'Untitled Activity',
            purpose: cols[1] || 'Imported Activity',
            lawfulBasis: cols[2] || 'legitimate_interest',
            status: cols[3] || 'draft',
            riskLevel: cols[4] || 'low',
            description: cols[5] || ''
          };
        });

        if (data.length > 0) {
          await bulkCreateMutation.mutateAsync(data);
          refetch();
          alert(`Successfully imported ${data.length} activities!`);
        }
      } catch (err) {
        console.error(err);
        alert('Failed to import CSV. Please check the format.');
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
      alert('Failed to generate PDF audit report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: (info: any) => <span className="font-medium text-[#F4F5F6]">{info.getValue()}</span>,
    },
    {
      accessorKey: 'purpose',
      header: 'Purpose',
      cell: (info: any) => <span className="text-[#9BA1A6] truncate max-w-xs inline-block">{info.getValue()}</span>,
    },
    {
      accessorKey: 'lawfulBasis',
      header: 'Lawful Basis',
      cell: (info: any) => (
        <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-white/5 text-[#9BA1A6] border border-white/10">
          {info.getValue() || 'Unspecified'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => {
        const status = info.getValue();
        return (
          <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${
            status === 'active' ? 'bg-[#C9A227]/10 text-[#C9A227] border-sage-500/20' : 
            status === 'draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            'bg-white/5 text-[#6E747A] border-white/10'
          }`}>
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'riskLevel',
      header: 'Risk',
      cell: (info: any) => {
        const risk = info.getValue()?.toLowerCase() || 'low';
        return (
          <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${
            risk === 'critical' ? 'bg-clay-50 text-clay-700 border-clay-500/20' :
            risk === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            risk === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-500/20' :
            'bg-[#C9A227]/10 text-[#C9A227] border-sage-500/20'
          }`}>
            {risk}
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
              <div className="p-2 bg-[#0D0F11] rounded-xl shadow-card border border-ink-900/8">
                <FileText className="w-5 h-5 text-[#C9A227]" />
              </div>
              Records of Processing Activities
            </h1>
            <p className="text-[13.5px] text-[#6E747A] mt-2">
              Manage your Article 30 compliance records and data processing activities.
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
              {isImporting ? 'Importing...' : 'Import CSV'}
            </button>
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button 
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {isExportingPdf ? 'Generating...' : 'Export PDF'}
            </button>
            <button 
              onClick={() => router.push('/ropa/new')}
              className="px-4 py-2 bg-sage-700 hover:bg-sage-600 text-bone-50 font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 shadow-card"
            >
              <Plus className="w-4 h-4" />
              New Activity
            </button>
          </div>
        </div>

        {/* Re-Consent Flags Section */}
        {(reconsentFlags?.length || 0) > 0 || flagsTab === 'dismissed' ? (
          <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden fade-up">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-amber-500/10/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-[#F4F5F6]">Re-Consent Triggers</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlagsTab('flagged')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${flagsTab === 'flagged' ? 'bg-[#0D0F11] text-amber-400 shadow-panel-elevated border border-amber-500/20' : 'text-[#6E747A] hover:text-[#E6E8EA]'}`}
                >
                  Active Flags
                </button>
                <button
                  onClick={() => setFlagsTab('dismissed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${flagsTab === 'dismissed' ? 'bg-[#0D0F11] text-[#E6E8EA] shadow-panel-elevated border border-white/10' : 'text-[#6E747A] hover:text-[#E6E8EA]'}`}
                >
                  Dismissed
                </button>
              </div>
            </div>
            <div className="divide-y divide-ink-900/5 max-h-[300px] overflow-y-auto">
              {reconsentFlags?.length === 0 ? (
                <div className="p-8 text-center text-[#6E747A] text-sm">
                  No {flagsTab} re-consent triggers found.
                </div>
              ) : (
                reconsentFlags?.map((flag: any) => (
                  <div key={flag.id} className="p-4 hover:bg-[#08090A]/50 transition-colors flex items-start gap-4">
                    <div className="mt-1">
                      {flag.confidence === 'ambiguous' ? (
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 tooltip" data-tip="Human review recommended">
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
                          Activity Changed: {flag.activity.name}
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
                          Review Activity <ChevronRight className="w-3 h-3" />
                        </button>
                        {flagsTab === 'flagged' && (
                          <button
                            onClick={() => dismissFlagMutation.mutate({ id: flag.id })}
                            disabled={dismissFlagMutation.isPending}
                            className="text-xs font-medium text-[#6E747A] hover:text-[#E6E8EA] flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Dismiss
                          </button>
                        )}
                        {flagsTab === 'dismissed' && (
                          <span className="text-xs text-[#6E747A] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Dismissed
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
            emptyStateMessage="No processing activities found. Create your first record to begin."
          />

          {hasNextPage && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors border border-white/10 shadow-panel-elevated disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
