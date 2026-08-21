"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Clock, Loader2, Activity, PlusCircle, Trash2, Edit, Download, Filter, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

/**
 * I85–I89. The record's trail.
 *
 * Three things changed here and each is a finding the audit made about the tab
 * rather than about the log behind it:
 *
 *   - **Child rows appear.** Adding a data category, a recipient or a transfer is
 *     most of what an Article 30 record consists of, and none of it showed: those
 *     mutations file against their own row's id, and this tab queries the
 *     activity's. The API now threads a parent id (I86) and the tab shows both.
 *   - **The diff is rendered, not dumped.** Field names come back as labels and
 *     values as sentences, from one place on the server (`lib/auditTrail.ts`), so
 *     the tab, the CSV and the audit pack say the same thing about the same edit.
 *   - **It is filterable and paginated.** "What did this person change in March"
 *     is the only question anybody brings to a trail, and a register with a year
 *     of history was rendering every row it had to answer it.
 */

type Filters = {
  actorId?: string;
  field?: string;
  changeType?: 'create' | 'update' | 'delete' | 'other';
  from?: string;
  to?: string;
};

export function HistoryTab({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.history');
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const query = trpc.ropa.history.list.useInfiniteQuery(
    {
      activityId,
      actorId: filters.actorId,
      field: filters.field || undefined,
      changeType: filters.changeType,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      limit: 25,
    },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  const { data: actors } = trpc.ropa.history.actors.useQuery({ activityId });
  const exportMutation = trpc.ropa.history.export.useMutation();

  const entries = query.data?.pages.flatMap((page) => page.entries) ?? [];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        activityId,
        from: filters.from ? new Date(filters.from) : undefined,
        to: filters.to ? new Date(filters.to) : undefined,
      });
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', result.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      if (result.truncated) toast(t('export_truncated'), { tone: 'info' });
    } catch (err) {
      toast(t('export_failed'), {
        tone: 'error',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getActionIcon = (changeType: string) => {
    if (changeType === 'create') return <PlusCircle className="w-4 h-4 text-[#C9A227]" />;
    if (changeType === 'delete') return <Trash2 className="w-4 h-4 text-clay-600" />;
    return <Edit className="w-4 h-4 text-amber-400" />;
  };

  /**
   * The server sends `renderedChanges` — labelled, formatted, and with the fields
   * nobody changed already dropped. This used to read `newValue`/`details`,
   * neither of which is a column, so the guard always failed and "View diff"
   * expanded an empty box.
   */
  const renderDiff = (changes: Array<{ field: string; label: string; before: string; after: string }>) => {
    if (!changes || changes.length === 0) {
      return <div className="text-[12px] text-[#6E747A] italic mt-2">{t('no_changes')}</div>;
    }

    return (
      <div className="mt-3 space-y-2">
        {changes.map((change) => (
          <div key={change.field} className="text-[12px] bg-[#0D0F11] border border-white/10 rounded-md overflow-hidden">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 font-medium text-[#E6E8EA] flex items-center justify-between gap-2">
              <span>{change.label}</span>
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, field: change.field }))}
                className="text-[11px] text-[#C9A227] hover:underline"
              >
                {t('filter_by_field')}
              </button>
            </div>
            {/* R141. The minus and plus are the non-colour carriers of "before" and
                "after"; red-and-green alone is the one pairing a colour-blind reader
                is least likely to separate. */}
            <div className="grid grid-cols-2 divide-x divide-ink-900/10">
              <div className="p-2 bg-red-500/10 text-red-400 break-words">
                <span className="mr-2 select-none text-red-400" aria-label={t('before')}>-</span>
                {change.before}
              </div>
              <div className="p-2 bg-green-500/10 text-green-400 break-words">
                <span className="mr-2 select-none text-green-400" aria-label={t('after')}>+</span>
                {change.after}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl fade-up">
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h2 className="text-[14px] font-medium text-[#F4F5F6] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#6E747A]" aria-hidden="true" />
            {t('title')}
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="inline-flex items-center gap-1.5 text-[12px] text-[#9BA1A6] hover:text-[#F4F5F6] border border-white/10 rounded-lg px-2.5 py-1.5"
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              {t('filters')}
              {activeFilterCount > 0 ? (
                <span className="ml-1 text-[11px] text-[#C9A227]">{activeFilterCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 text-[12px] text-[#9BA1A6] hover:text-[#F4F5F6] border border-white/10 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              {isExporting ? t('exporting') : t('export')}
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border border-white/10 rounded-xl p-4 bg-[#0D0F11]">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6E747A]">{t('filter_actor')}</span>
              <select
                value={filters.actorId ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value || undefined }))}
                className="bg-[#08090A] border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-[#F4F5F6]"
              >
                <option value="">{t('filter_any')}</option>
                {(actors ?? []).map((actor: any) => (
                  <option key={actor.userId} value={actor.userId}>{actor.userEmail}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6E747A]">{t('filter_change_type')}</span>
              <select
                value={filters.changeType ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, changeType: (e.target.value || undefined) as Filters['changeType'] }))}
                className="bg-[#08090A] border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-[#F4F5F6]"
              >
                <option value="">{t('filter_any')}</option>
                <option value="create">{t('type_create')}</option>
                <option value="update">{t('type_update')}</option>
                <option value="delete">{t('type_delete')}</option>
                <option value="other">{t('type_other')}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6E747A]">{t('filter_field')}</span>
              <input
                type="text"
                value={filters.field ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, field: e.target.value || undefined }))}
                placeholder={t('filter_field_placeholder')}
                className="bg-[#08090A] border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-[#F4F5F6]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6E747A]">{t('filter_from')}</span>
              <input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
                className="bg-[#08090A] border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-[#F4F5F6]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6E747A]">{t('filter_to')}</span>
              <input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
                className="bg-[#08090A] border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-[#F4F5F6]"
              />
            </label>

            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => setFilters({})}
                className="self-end inline-flex items-center gap-1.5 text-[12px] text-[#9BA1A6] hover:text-[#F4F5F6]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                {t('clear_filters')}
              </button>
            ) : null}
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="p-8 flex justify-center" role="status" aria-label={t('loading')}>
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" aria-hidden="true" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/20 rounded-2xl bg-[#08090A]/50">
            <Clock className="w-6 h-6 text-[#6E747A] mx-auto mb-3" aria-hidden="true" />
            <p className="text-[13px] text-[#6E747A]">
              {activeFilterCount > 0 ? t('empty_filtered') : t('empty')}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {entries.map((log: any) => {
                const date = new Date(log.createdAt).toLocaleString();
                const isExpanded = expandedLogId === log.id;
                const hasDiff = (log.renderedChanges ?? []).length > 0;

                return (
                  <div key={log.id} className="relative pl-6 pb-4 border-l border-white/10 last:border-transparent last:pb-0">
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#08090A] border border-white/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                    </div>

                    <div className="bg-[#0D0F11] hairline rounded-xl p-4 shadow-panel-elevated">
                      <div
                        role={hasDiff ? 'button' : undefined}
                        tabIndex={hasDiff ? 0 : undefined}
                        aria-expanded={hasDiff ? isExpanded : undefined}
                        className={`flex items-start justify-between gap-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60 ${hasDiff ? 'cursor-pointer' : ''}`}
                        onClick={() => hasDiff && setExpandedLogId(isExpanded ? null : log.id)}
                        onKeyDown={(e) => {
                          if (!hasDiff) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedLogId(isExpanded ? null : log.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getActionIcon(log.changeType)}</div>
                          <div>
                            <div className="text-[13px] font-medium text-[#F4F5F6]">
                              {log.description || log.action}
                            </div>
                            <div className="text-[12px] text-[#6E747A] mt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>{date}</span>
                              <span aria-hidden="true">·</span>
                              <span>{log.userEmail || t('system')}</span>
                              {log.ipAddress ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{log.ipAddress}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {hasDiff ? (
                          <div className="text-[12px] text-[#C9A227] font-medium bg-[#C9A227]/10 px-2 py-1 rounded shrink-0">
                            {isExpanded ? t('hide_diff') : t('view_diff')}
                          </div>
                        ) : null}
                      </div>

                      {isExpanded && hasDiff ? (
                        <div className="mt-4 pt-4 border-t border-ink-900/8 animate-in fade-in slide-in-from-top-2 duration-200">
                          {renderDiff(log.renderedChanges)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {query.hasNextPage ? (
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="mt-6 w-full border border-white/10 rounded-lg py-2 text-[12px] text-[#9BA1A6] hover:text-[#F4F5F6] hover:border-white/20 disabled:opacity-50"
              >
                {query.isFetchingNextPage ? t('loading') : t('load_more')}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
