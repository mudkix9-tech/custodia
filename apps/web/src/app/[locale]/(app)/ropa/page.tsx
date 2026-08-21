"use client";

import React, { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { normaliseLawfulBasis, isLawfulBasisKey, isRetentionPreset } from '@/utils/ropaFormat';
import { severityClasses } from '@/utils/severity';
import { FileText, Plus, Download, Upload, AlertCircle, CheckCircle2, ChevronRight, X, ShieldAlert, Library, CalendarClock, Archive, Compass, Radar, ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toCsvRow } from '@/utils/csv';
import { ExportMenu } from '@/components/ropa/ExportMenu';
import { parseRopaCsv, type RowError } from '@/utils/ropaImport';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageShell } from '@/components/layout/PageShell';
import { CompletenessRing } from '@/components/ropa/CompletenessPanel';
import { RegisterFilterBar, EMPTY_FILTERS, activeFilterCount, type RegisterFilters } from '@/components/ropa/RegisterFilterBar';
import { BulkActionBar } from '@/components/ropa/BulkActionBar';
import { announce } from '@/components/layout/Announcer';

export default function RopaListPage() {
  const t = useTranslations('ropa');
  const router = useRouter();
  const toast = useToast();
  // C34–C36. The badge is the only thing on the register that says discovery has
  // found anything; without it the queue is a page nobody navigates to twice.
  const discoverySummary = trpc.ropa.discovery.summary.useQuery();
  const discoveryCount = discoverySummary.data?.openTotal ?? 0;
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
  
  // K102–K104. Every filter is server-side. Sprint 1 left B18's three ownership
  // options as the only one; everything else was a client-side search over the
  // twenty-five rows that happened to be loaded, so "show me every unowned
  // high-risk activity with a transfer to the US" was a question the register
  // could not answer about itself.
  const [filters, setFilters] = useState<RegisterFilters>(EMPTY_FILTERS);

  // L107. Ids, not rows, because a selection has to be able to contain records
  // that are not loaded — that is what "select all 340 matching" means.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = trpc.ropa.list.useInfiniteQuery(
    { limit: 25, ...filters },
    { getNextPageParam: (lastPage) => lastPage.pagination.next_cursor }
  );

  const processingActivities = data?.pages.flatMap((page) => page.data) || [];

  const utils = trpc.useUtils();
  const { data: orgMembers = [] } = trpc.team.list.useQuery();
  // B19. The overdue count, as a badge rather than a page of rows — "go and look"
  // is a different question from "show me", and it should not cost a page load.
  const { data: reviewSummary } = trpc.ropa.review.summary.useQuery();

  // L107. Everything matching the current filters, fetched on demand. Capped
  // server-side; past the cap the honest answer is "narrow the filter" rather than
  // a bulk write of unknown size.
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const selectAllMatching = async () => {
    setIsSelectingAll(true);
    try {
      const result = await utils.ropa.listIds.fetch(filters);
      setSelectedIds(result.ids);
      announce(
        result.truncated
          ? t('bulk.select_all_capped', { count: result.ids.length })
          : t('bulk.selected', { count: result.ids.length }),
      );
      if (result.truncated) {
        toast(t('bulk.select_all_capped', { count: result.ids.length }), {
          tone: 'info',
          description: t('bulk.select_all_capped_hint', { cap: result.cap }),
        });
      }
    } finally {
      setIsSelectingAll(false);
    }
  };

  // B25. Scored server-side in one batched call per loaded page rather than one per
  // row — 25 activities scored individually would be 125 round trips on a 512MB box
  // that also runs Chromium.
  const loadedIds = processingActivities.map((a: any) => a.id);
  const { data: completeness = {} } = trpc.ropa.completenessBatch.useQuery(
    { ids: loadedIds },
    { enabled: loadedIds.length > 0 },
  );
  const bulkCreateMutation = trpc.ropa.bulkCreate.useMutation();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  // Rejected rows are listed in the page rather than a toast: the point is that
  // the customer can fix the file, which means seeing every line that failed.
  const [importErrors, setImportErrors] = useState<RowError[] | null>(null);

  const { data: reconsentFlags, refetch: refetchFlags } = trpc.reconsent.list.useQuery({ status: flagsTab });
  const dismissFlagMutation = trpc.reconsent.dismiss.useMutation({
    onSuccess: () => refetchFlags()
  });

  // The loaded pages, and nothing more. It sits under `Export → Loaded rows` and
  // says so there: a selection exports server-side through the bulk bar (L107),
  // and the whole register exports through the menu above it (J94). This is the
  // "give me what I am looking at" case, which is a real one and a different one.
  const handleExportCSV = () => {
    if (!processingActivities || processingActivities.length === 0) return;
    
    const headers = ['Name', 'Purpose', 'Lawful Basis', 'Role', 'Controller', 'Status', 'Risk Level', 'Description'];
    // Same quoting helper the importer reads back, so a round trip is lossless. The
    // basis stays a canonical key rather than a translated label for that reason —
    // the editor's labels carry their sub-article ("Consent (Art. 6(1)(a))"), which
    // the importer would reject. Normalising still repairs the seeded plural.
    const csvContent = [
      toCsvRow(headers),
      ...processingActivities.map((a: any) =>
        toCsvRow([
          a.name, a.purpose, normaliseLawfulBasis(a.lawfulBasis), a.role || 'controller', a.controllerName || '',
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
      toast(t('import.unreadable'), { tone: 'error' });
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onload = async (e) => {
      try {
        const { activities, errors, fatal } = parseRopaCsv((e.target?.result as string) ?? '');

        if (fatal) {
          toast(t('import.failed'), { tone: 'error', description: fatal });
          return;
        }

        if (activities.length > 0) {
          await bulkCreateMutation.mutateAsync(activities);
          refetch();
        }

        // Report what happened to every row. The previous version reported
        // success unconditionally, including for files it had silently mangled.
        if (errors.length > 0) setImportErrors(errors);

        // Plurals through ICU rather than a ternary on `=== 1`: German and French
        // do not agree with English about where the boundary falls, and a hand-built
        // "row/rows" is a rule baked into the code that the catalogue cannot override.
        if (activities.length === 0) {
          toast(t('import.nothing'), {
            tone: 'error',
            description: t('import.all_rejected', { count: errors.length }),
          });
        } else if (errors.length > 0) {
          toast(t('import.partial', { imported: activities.length, total: activities.length + errors.length }), {
            tone: 'info',
            description: t('import.skipped', { count: errors.length }),
          });
        } else {
          toast(t('import.imported', { count: activities.length }));
        }
      } catch (err) {
        console.error(err);
        toast(t('import.failed'), {
          tone: 'error',
          description: err instanceof Error ? err.message : t('import.rejected'),
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };


  const columns = [
    {
      id: 'completeness',
      header: t('columns.completeness'),
      // Leads the row because it is the column that tells a DPO where to spend the
      // next hour. The register's job is to be complete; nothing else on the row
      // says whether it is.
      cell: (info: any) => {
        const score = (completeness as Record<string, number>)[info.row.original.id];
        if (score === undefined) return <span className="text-[12px] text-[#6E747A]">—</span>;
        return <CompletenessRing score={score} size={34} />;
      },
      size: 60,
    },
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
      // The column stored `legitimate_interest` and the list printed exactly that,
      // to users and into the regulator-facing exports. The catalogue has carried a
      // translation for all six bases since the Legal tab was built.
      cell: (info: any) => {
        const basis = normaliseLawfulBasis(info.getValue() as string | null);
        return (
          <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-white/5 text-[#9BA1A6] border border-white/10">
            {isLawfulBasisKey(basis) ? t(`editor.legal.${basis}`) : (basis || t('columns.unspecified'))}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: (info: any) => {
        const status = info.getValue();
        const approval = info.row.original.approvalState;
        return (
          <span className="inline-flex flex-col items-start gap-0.5">
            <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${
              status === 'active' ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/20' :
              status === 'draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-white/5 text-[#6E747A] border-white/10'
            }`}>
              {t(`status_types.${status}`) || status}
            </span>
            {/* B20. Approval is not the same fact as status, and a register where
                a record can be published and awaiting re-approval has to show
                both. Rendered as words rather than a second colour — R141. */}
            {approval && approval !== 'draft' && (
              <span className="text-[11px] text-[#6E747A]">{t(`approval.states.${approval}`)}</span>
            )}
          </span>
        );
      },
    },
    {
      id: 'review',
      header: t('columns.review'),
      // B19. The column the review cycle exists to produce. Overdue carries an
      // icon and the word as well as the colour, so it survives a colour-blind
      // reader and a greyscale print of the register.
      cell: (info: any) => {
        const next = info.row.original.nextReviewAt;
        if (!next) return <span className="text-[12px] text-[#6E747A]">{t('columns.no_review')}</span>;
        const due = new Date(next);
        const overdue = due.getTime() < Date.now();
        return (
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] ${
            overdue
              ? 'border-red-500/25 bg-red-500/10 text-red-400'
              : 'border-white/10 text-[#9BA1A6]'
          }`}>
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {overdue ? t('columns.overdue_since', { date: due.toLocaleDateString() }) : due.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      accessorKey: 'tags',
      header: t('columns.tags'),
      // K103/L108. Shown because a tag that cannot be seen on the row is a tag
      // nobody trusts the filter to be using.
      cell: (info: any) => {
        const tags = (info.getValue() as string[] | null) ?? [];
        if (tags.length === 0) return <span className="text-[12px] text-[#6E747A]">—</span>;
        return (
          <span className="inline-flex flex-wrap gap-1" title={tags.join(', ')}>
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-[#9BA1A6]">{tag}</span>
            ))}
            {tags.length > 2 && <span className="text-[11px] text-[#6E747A]">+{tags.length - 2}</span>}
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
        // A preset translates; anything else is the user's own wording and is shown
        // as written. The literal `custom` is neither — the old Custom option wrote it
        // and offered nowhere to type a period — so it counts as not recorded.
        return period && period !== 'custom' ? (
          <span className="text-[12px] text-[#9BA1A6]">
            {isRetentionPreset(period) ? t(`editor.retention.${period}`) : period}
          </span>
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
    <PageShell className="fade-up space-y-8">
        
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

            {/* Sprint 4. The four surfaces that hang off the register rather than
                sitting inside an activity. As a rail under the title rather than
                four more buttons in the action row: they are places you go, not
                things you do to what is on screen, and the action row was already
                four items wide at the point it starts wrapping on a laptop. */}
            <nav aria-label={t('nav.label')} className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
              {([
                ['/ropa/insights', Compass, t('nav.insights')],
                ['/ropa/retention', CalendarClock, t('nav.retention')],
                ['/ropa/discovery', Radar, t('nav.discovery'), discoveryCount],
                ['/ropa/intake', ClipboardList, t('nav.intake')],
              ] as const).map(([href, Icon, label, badge]) => (
                <button
                  key={href}
                  type="button"
                  onClick={() => router.push(href)}
                  className="flex items-center gap-1.5 text-[13px] text-[#9BA1A6] hover:text-[#C9A227] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60 rounded"
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                  {badge ? (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#C9A227]/15 text-[#C9A227] text-[11px]">{badge}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImportCSV} 
            />
            {/* A2/A3. The shared vocabulary the register's rows draw on — reachable
                from the register itself, because that is where someone notices the
                catalogue is missing something. */}
            <button
              onClick={() => router.push('/ropa/catalogues')}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated"
            >
              <Library className="w-4 h-4" />
              {t('catalogues')}
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] font-medium text-[13px] rounded-lg transition-colors flex items-center gap-2 border border-white/10 shadow-panel-elevated disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? t('importing') : t('import_csv')}
            </button>
            {/* J93-J98. One menu, everything built on the server from the whole
                register — or from the filter on screen, which is the same query
                with a `where`. The two buttons this replaces were an eight-column
                CSV of the loaded page and a nine-field PDF that shared nothing
                with the audit pack's Article 30 document. */}
            <ExportMenu
              filters={filters}
              isFiltered={activeFilterCount(filters) > 0}
              onExportLoaded={handleExportCSV}
            />
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

        {/* B19. The overdue queue as a badge with a way in. A count nobody can
            act on is decoration; this one applies the filter that shows the rows. */}
        {(reviewSummary?.overdue ?? 0) > 0 && !filters.reviewOverdue && (
          <button
            type="button"
            onClick={() => setFilters({ ...filters, reviewOverdue: true })}
            className="fade-up flex w-full items-center justify-between gap-4 rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-left transition-colors hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <span className="flex items-center gap-2 text-[13.5px] text-red-300">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {t('review.overdue_banner', { count: reviewSummary!.overdue })}
              {(reviewSummary?.overdueMine ?? 0) > 0 && (
                <span className="text-[12.5px] text-red-400/70">
                  {t('review.overdue_mine', { count: reviewSummary!.overdueMine })}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-[12.5px] font-medium text-red-300">
              {t('review.show_overdue')} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
        )}

        {/* Data Grid */}
        <div className="w-full space-y-4">
          <RegisterFilterBar filters={filters} onChange={setFilters} orgMembers={orgMembers as any} />

          {/* L107. The bridge between "the rows I ticked" and "all 340 matching".
              Offered whenever something is selected and there is more behind the
              current filter, which is the only moment the distinction matters. */}
          {selectedIds.length > 0 && (hasNextPage || activeFilterCount(filters) > 0) && (
            <button
              type="button"
              onClick={selectAllMatching}
              disabled={isSelectingAll}
              className="w-full rounded-lg border border-dashed border-[#C9A227]/30 px-3 py-2 text-[12.5px] text-[#C9A227] transition-colors hover:bg-[#C9A227]/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
            >
              {isSelectingAll ? t('bulk.selecting') : t('bulk.select_all_matching')}
            </button>
          )}

          <DataGrid
            mode="full"
            columns={columns as any}
            data={processingActivities || []}
            isLoading={isLoading}
            onRowClick={(row: any) => router.push(`/ropa/${row.id}`)}
            enableRowSelection
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            selectionToolbar={
              <BulkActionBar
                selectedIds={selectedIds}
                onClear={() => setSelectedIds([])}
                orgMembers={orgMembers as any}
                onDone={() => { setSelectedIds([]); refetch(); }}
              />
            }
            labels={{
              selectRow: t('bulk.select_row'),
              selectAll: t('bulk.select_page'),
              previous: t('grid.previous'),
              next: t('grid.next'),
              showing: (from, to, total) => t('grid.showing', { from, to, total }),
            }}
            emptyState={
              <EmptyState
                icon={FileText}
                title={activeFilterCount(filters) > 0 ? t('empty.filtered_title') : t('empty.title')}
                description={activeFilterCount(filters) > 0 ? t('empty.filtered_description') : t('empty.description')}
                action={
                  activeFilterCount(filters) > 0
                    ? { label: t('filters.clear'), onClick: () => setFilters(EMPTY_FILTERS) }
                    : { label: t('empty.action'), onClick: () => router.push('/ropa/new') }
                }
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
    </PageShell>
  );
}
