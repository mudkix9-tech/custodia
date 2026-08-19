"use client";

/**
 * K102–K104. The register's filter bar and its saved views.
 *
 * Everything here maps onto `ropa.list`'s input, which is also what `ropa.listIds`
 * and a saved view's stored `filters` blob validate against. One shape, three
 * consumers — a second copy of it in the web workspace is how a saved view would
 * come to mean something different from the list that saved it.
 *
 * The filters are kept in a single object rather than a state variable each,
 * because they travel together: to the query, into a saved view, and out of one.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search, SlidersHorizontal, X, Bookmark, BookmarkPlus, Trash2, Check, ChevronDown,
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { announce } from '@/components/layout/Announcer';

const STATUSES = ['draft', 'under_review', 'active', 'archived'] as const;
const APPROVAL_STATES = ['draft', 'in_review', 'approved', 'rejected'] as const;
const ROLES = ['controller', 'processor', 'joint_controller'] as const;
const RISKS = ['low', 'medium', 'high', 'critical'] as const;
const BASES = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interest'] as const;
const BANDS = ['low', 'medium', 'high'] as const;

/**
 * Mirrors `registerFilterSchema` in apps/api/src/routers/ropa.ts.
 *
 * The unions are spelled out rather than left as `string[]` so that a filter this
 * side cannot construct is a compile error rather than a 400 the user sees. That is
 * the whole class R146 describes — the form model, the API model and the Drizzle
 * model being three documents nobody keeps in sync.
 */
export type RegisterFilters = {
  q?: string;
  ownership: 'all' | 'mine' | 'unowned';
  ownerId?: string;
  status?: (typeof STATUSES)[number][];
  approvalState?: (typeof APPROVAL_STATES)[number][];
  role?: (typeof ROLES)[number][];
  lawfulBasis?: (typeof BASES)[number][];
  riskLevel?: (typeof RISKS)[number][];
  tags?: string[];
  hasSpecialCategory?: boolean;
  hasTransfer?: boolean;
  transferCountry?: string;
  retentionSet?: boolean;
  requiresDpia?: boolean;
  dpiaLinked?: boolean;
  reviewOverdue?: boolean;
  completenessBand?: 'low' | 'medium' | 'high';
  includeArchived: boolean;
  sort: 'updatedAt' | 'createdAt' | 'name' | 'completenessScore' | 'nextReviewAt';
  order: 'asc' | 'desc';
};

export const EMPTY_FILTERS: RegisterFilters = {
  ownership: 'all',
  includeArchived: false,
  sort: 'updatedAt',
  order: 'desc',
};

/**
 * How many filters are active, for the badge on the Filters button.
 *
 * Sort, order and ownership are excluded: they always have a value, so counting
 * them would show "3 filters active" on an untouched register and the badge would
 * mean nothing.
 */
export function activeFilterCount(filters: RegisterFilters): number {
  let n = 0;
  if (filters.q) n += 1;
  if (filters.ownership !== 'all') n += 1;
  if (filters.includeArchived) n += 1;
  for (const key of [
    'ownerId', 'status', 'approvalState', 'role', 'lawfulBasis', 'riskLevel', 'tags',
    'hasSpecialCategory', 'hasTransfer', 'transferCountry', 'retentionSet',
    'requiresDpia', 'dpiaLinked', 'reviewOverdue', 'completenessBand',
  ] as const) {
    const value = filters[key];
    if (Array.isArray(value) ? value.length > 0 : value !== undefined) n += 1;
  }
  return n;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60 ${
        active
          ? 'border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227]'
          : 'border-white/10 text-[#9BA1A6] hover:border-white/25 hover:text-[#F4F5F6]'
      }`}
    >
      {active && <Check className="h-3 w-3" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** A group of multi-select chips over one array field. */
function ChipGroup<T extends string>({ label, values, selected, onChange, render }: {
  label: string;
  values: readonly T[];
  selected: readonly T[] | undefined;
  onChange: (next: T[] | undefined) => void;
  render: (value: T) => string;
}) {
  const toggle = (value: T) => {
    const current = selected ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange(next.length > 0 ? next : undefined);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Chip key={value} active={(selected ?? []).includes(value)} onClick={() => toggle(value)}>
            {render(value)}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * A three-state control. "Any / yes / no" rather than a checkbox, because the
 * interesting question about retention or transfers is usually the negative one —
 * "which activities have *no* retention period" is the most common Art. 30 finding,
 * and a checkbox can only ask the positive half.
 */
function Tristate({ label, value, onChange, yes, no }: {
  label: string;
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
  yes: string;
  no: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={value === true} onClick={() => onChange(value === true ? undefined : true)}>{yes}</Chip>
        <Chip active={value === false} onClick={() => onChange(value === false ? undefined : false)}>{no}</Chip>
      </div>
    </fieldset>
  );
}

export function RegisterFilterBar({ filters, onChange, orgMembers }: {
  filters: RegisterFilters;
  onChange: (next: RegisterFilters) => void;
  orgMembers: { id: string; name?: string | null; email: string }[];
}) {
  const t = useTranslations('ropa');
  const toast = useToast();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  const [shareView, setShareView] = useState(false);

  const { data: savedViews = [] } = trpc.ropa.savedViews.list.useQuery();
  const { data: tagRows = [] } = trpc.ropa.tags.useQuery();

  const saveView = trpc.ropa.savedViews.save.useMutation({
    onSuccess: () => {
      utils.ropa.savedViews.list.invalidate();
      setSavingView(false);
      setViewName('');
      setShareView(false);
      toast(t('filters.view_saved'));
    },
    onError: (err) => toast(t('filters.view_save_failed'), { tone: 'error', description: err.message }),
  });
  const deleteView = trpc.ropa.savedViews.delete.useMutation({
    onSuccess: () => utils.ropa.savedViews.list.invalidate(),
  });

  const set = <K extends keyof RegisterFilters>(key: K, value: RegisterFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const count = activeFilterCount(filters);

  const applyView = (view: any) => {
    // Merged over the empty set rather than spread over the current filters: a saved
    // view is a complete description of a list, and leaving the previous filters
    // underneath it means the view shows something different depending on what the
    // user happened to have selected first.
    onChange({ ...EMPTY_FILTERS, ...(view.filters as Partial<RegisterFilters>) });
    announce(t('filters.view_applied', { name: view.name }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* K102. Server-side, so it searches the register rather than the page. */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E747A]" aria-hidden="true" />
          <input
            type="search"
            value={filters.q ?? ''}
            onChange={(e) => set('q', e.target.value || undefined)}
            placeholder={t('filters.search_ph')}
            aria-label={t('filters.search_label')}
            className="w-full rounded-lg border border-white/10 bg-[#08090A] py-2 pl-9 pr-3 text-[13px] text-[#F4F5F6] placeholder:text-[#6E747A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
          />
        </div>

        <div className="flex items-center gap-1" role="group" aria-label={t('ownership.label')}>
          {(['all', 'mine', 'unowned'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set('ownership', key)}
              aria-pressed={filters.ownership === key}
              className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60 ${
                filters.ownership === key
                  ? 'border-[#C9A227]/30 bg-[#C9A227]/10 text-[#C9A227]'
                  : 'border-white/10 text-[#6E747A] hover:border-white/20 hover:text-[#F4F5F6]'
              }`}
            >
              {t(`ownership.${key}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="ropa-filter-panel"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0D0F11] px-3 py-2 text-[13px] text-[#E6E8EA] transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('filters.title')}
          {count > 0 && (
            <span className="rounded-full bg-[#C9A227]/15 px-1.5 py-0.5 text-[11px] font-medium text-[#C9A227]">{count}</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-[#6E747A] transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> {t('filters.clear')}
          </button>
        )}
      </div>

      {/* K104. Saved views, one row, always visible — a view nobody can see is a
          view nobody uses. */}
      {(savedViews.length > 0 || count > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('filters.views')}</span>
          {savedViews.map((view: any) => (
            <span key={view.id} className="inline-flex items-center overflow-hidden rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => applyView(view)}
                title={view.description || undefined}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12.5px] text-[#9BA1A6] transition-colors hover:bg-white/5 hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60"
              >
                <Bookmark className="h-3 w-3" aria-hidden="true" />
                {view.name}
                {view.isShared && <span className="text-[10px] text-[#6E747A]">{t('filters.shared')}</span>}
              </button>
              <button
                type="button"
                onClick={() => deleteView.mutate({ id: view.id })}
                aria-label={t('filters.delete_view', { name: view.name })}
                className="border-l border-white/10 px-1.5 py-1 text-[#6E747A] transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}

          {count > 0 && !savingView && (
            <button
              type="button"
              onClick={() => setSavingView(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-2.5 py-1 text-[12.5px] text-[#6E747A] transition-colors hover:border-[#C9A227]/40 hover:text-[#C9A227] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
            >
              <BookmarkPlus className="h-3 w-3" aria-hidden="true" /> {t('filters.save_view')}
            </button>
          )}

          {savingView && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!viewName.trim()) return;
                saveView.mutate({ name: viewName.trim(), filters, isShared: shareView });
              }}
            >
              <label className="sr-only" htmlFor="ropa-view-name">{t('filters.view_name')}</label>
              <input
                id="ropa-view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder={t('filters.view_name_ph')}
                autoFocus
                className="w-48 rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1 text-[12.5px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              />
              <label className="inline-flex items-center gap-1.5 text-[12px] text-[#9BA1A6]">
                <input
                  type="checkbox"
                  checked={shareView}
                  onChange={(e) => setShareView(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#C9A227]"
                />
                {t('filters.share_with_team')}
              </label>
              <button
                type="submit"
                disabled={!viewName.trim() || saveView.isPending}
                className="rounded-lg bg-[#C9A227] px-2.5 py-1 text-[12.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:opacity-50"
              >
                {t('filters.save')}
              </button>
              <button
                type="button"
                onClick={() => { setSavingView(false); setViewName(''); }}
                className="px-1.5 py-1 text-[#6E747A] transition-colors hover:text-[#F4F5F6]"
                aria-label={t('dismiss')}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      )}

      {open && (
        <div
          id="ropa-filter-panel"
          className="grid grid-cols-1 gap-5 rounded-2xl border border-white/10 bg-[#0D0F11] p-5 shadow-panel-elevated sm:grid-cols-2 lg:grid-cols-3"
        >
          <ChipGroup label={t('filters.status')} values={STATUSES} selected={filters.status}
            onChange={(v) => set('status', v)} render={(v) => t(`status_types.${v}`)} />

          <ChipGroup label={t('filters.approval')} values={APPROVAL_STATES} selected={filters.approvalState}
            onChange={(v) => set('approvalState', v)} render={(v) => t(`approval.states.${v}`)} />

          <ChipGroup label={t('filters.role')} values={ROLES} selected={filters.role}
            onChange={(v) => set('role', v)} render={(v) => t(`roles.${v}`)} />

          <ChipGroup label={t('filters.risk')} values={RISKS} selected={filters.riskLevel}
            onChange={(v) => set('riskLevel', v)} render={(v) => t(`risk_levels.${v}`)} />

          <ChipGroup label={t('filters.lawful_basis')} values={BASES} selected={filters.lawfulBasis}
            onChange={(v) => set('lawfulBasis', v)} render={(v) => t(`editor.legal.${v}`)} />

          {/* One band at a time: the bands tile 0–100, so selecting two adjacent
              ones is just a wider band and selecting two apart is a question
              nobody asks. The last one clicked wins. */}
          <ChipGroup label={t('filters.completeness')} values={BANDS} selected={filters.completenessBand ? [filters.completenessBand] : undefined}
            onChange={(v) => set('completenessBand', v?.find((b) => b !== filters.completenessBand) ?? undefined)}
            render={(v) => t(`filters.band_${v}`)} />

          <Tristate label={t('filters.retention')} value={filters.retentionSet}
            onChange={(v) => set('retentionSet', v)} yes={t('filters.retention_set')} no={t('filters.retention_unset')} />

          <Tristate label={t('filters.transfers')} value={filters.hasTransfer}
            onChange={(v) => set('hasTransfer', v)} yes={t('filters.has_transfer')} no={t('filters.no_transfer')} />

          <Tristate label={t('filters.special_category')} value={filters.hasSpecialCategory}
            onChange={(v) => set('hasSpecialCategory', v)} yes={t('filters.has_special')} no={t('filters.no_special')} />

          <Tristate label={t('filters.dpia')} value={filters.dpiaLinked}
            onChange={(v) => set('dpiaLinked', v)} yes={t('filters.dpia_linked')} no={t('filters.dpia_missing')} />

          <fieldset className="space-y-2">
            <legend className="text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('filters.review')}</legend>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!!filters.reviewOverdue} onClick={() => set('reviewOverdue', filters.reviewOverdue ? undefined : true)}>
                {t('filters.review_overdue')}
              </Chip>
              <Chip active={filters.includeArchived} onClick={() => set('includeArchived', !filters.includeArchived)}>
                {t('filters.include_archived')}
              </Chip>
            </div>
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="ropa-filter-owner" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">
              {t('filters.owner')}
            </label>
            <select
              id="ropa-filter-owner"
              value={filters.ownerId ?? ''}
              onChange={(e) => set('ownerId', e.target.value || undefined)}
              className="w-full rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            >
              <option value="">{t('filters.any_owner')}</option>
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="ropa-filter-country" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">
              {t('filters.transfer_country')}
            </label>
            <input
              id="ropa-filter-country"
              value={filters.transferCountry ?? ''}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().slice(0, 2);
                set('transferCountry', value.length === 2 ? value : undefined);
              }}
              placeholder={t('filters.country_ph')}
              maxLength={2}
              className="w-full rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] uppercase text-[#F4F5F6] placeholder:normal-case placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
            />
          </div>

          {tagRows.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <ChipGroup
                label={t('filters.tags')}
                values={(tagRows as any[]).map((r) => String(r.tag))}
                selected={filters.tags}
                onChange={(v) => set('tags', v)}
                render={(tag) => tag}
              />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
            <div className="space-y-2">
              <label htmlFor="ropa-sort" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">
                {t('filters.sort')}
              </label>
              <select
                id="ropa-sort"
                value={filters.sort}
                onChange={(e) => set('sort', e.target.value as RegisterFilters['sort'])}
                className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="updatedAt">{t('filters.sort_updated')}</option>
                <option value="createdAt">{t('filters.sort_created')}</option>
                <option value="name">{t('filters.sort_name')}</option>
                <option value="completenessScore">{t('filters.sort_completeness')}</option>
                <option value="nextReviewAt">{t('filters.sort_review')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="ropa-order" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">
                {t('filters.order')}
              </label>
              <select
                id="ropa-order"
                value={filters.order}
                onChange={(e) => set('order', e.target.value as 'asc' | 'desc')}
                className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              >
                <option value="desc">{t('filters.order_desc')}</option>
                <option value="asc">{t('filters.order_asc')}</option>
              </select>
            </div>
            {/* Sorting by review date means the review queue, and the API drops
                records with no date scheduled — said here rather than left as a
                surprising empty list. */}
            {filters.sort === 'nextReviewAt' && (
              <p className="text-[12px] text-[#6E747A]">{t('filters.sort_review_note')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
