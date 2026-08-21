"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRopaVocabulary } from '@/utils/ropaVocabularies';
import { Map, Plane, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * D42, D43, P123 and P125 on one screen.
 *
 * The four are what the register can say *about itself*: where the data is, where
 * it goes, whether the record is getting better, and what has changed that somebody
 * now owes a data subject. They are one screen because they are one conversation —
 * the answer to "is our register healthy" is all four of them at once, and a DPO
 * asked that question in a board meeting should not be clicking between tabs.
 *
 * Everything here is a view over the Article 30 record. Nothing on this page holds
 * a fact the register does not already hold, which is the property that stops a map
 * becoming a second source of truth the record can disagree with.
 */

type Tab = 'map' | 'transfers' | 'trend' | 'changes';

export function RegisterInsights() {
  const t = useTranslations('ropa.insights');
  const [tab, setTab] = useState<Tab>('map');

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'map', label: t('tab_map'), icon: Map },
    { key: 'transfers', label: t('tab_transfers'), icon: Plane },
    { key: 'trend', label: t('tab_trend'), icon: TrendingUp },
    { key: 'changes', label: t('tab_changes'), icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`px-4 py-3 text-[13.5px] whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60 ${
              tab === key
                ? 'border-[#C9A227] text-[#C9A227] font-medium'
                : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/10'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'map' ? <DataMapPanel t={t} /> : null}
      {tab === 'transfers' ? <TransferMapPanel t={t} /> : null}
      {tab === 'trend' ? <TrendPanel t={t} /> : null}
      {tab === 'changes' ? <ChangesPanel t={t} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// D42/D44 — the org-level data map and the reverse lookups
// ---------------------------------------------------------------------------

function DataMapPanel({ t }: any) {
  const [filters, setFilters] = useState<Record<string, any>>({ specialCategoryOnly: false });
  const [search, setSearch] = useState('');
  const map = trpc.ropa.insights.dataMap.useQuery({ ...filters, includeDrafts: true });

  const set = (key: string, value: any) => setFilters((f) => ({ ...f, [key]: value === f[key] ? null : value }));
  const facets = map.data?.facets;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('map_search_ph')}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-[13px] text-[#6E747A]">
          <input
            type="checkbox"
            checked={!!filters.specialCategoryOnly}
            onChange={(e) => setFilters((f) => ({ ...f, specialCategoryOnly: e.target.checked }))}
            className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
          />
          {t('special_only')}
        </label>
        {Object.values(filters).some((v) => v && v !== false) ? (
          <Button variant="ghost" onClick={() => setFilters({ specialCategoryOnly: false })}>{t('clear_filters')}</Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-1 space-y-4">
          <FacetList
            title={t('facet_data_categories')}
            items={filterFacet(facets?.dataCategories, search)}
            active={filters.dataCategory}
            onPick={(v: string) => set('dataCategory', v)}
          />
          <FacetList
            title={t('facet_subjects')}
            items={filterFacet(facets?.subjectCategories, search)}
            active={filters.subjectCategory}
            onPick={(v: string) => set('subjectCategory', v)}
          />
          <FacetList
            title={t('facet_countries')}
            items={filterFacet(facets?.countries, search)}
            active={filters.country}
            onPick={(v: string) => set('country', v)}
          />
          <FacetList
            title={t('facet_recipients')}
            items={filterFacet(facets?.recipients, search)}
            active={filters.recipientName}
            onPick={(v: string) => set('recipientName', v)}
          />
        </div>

        <div className="lg:col-span-3 space-y-3">
          <p className="text-[12.5px] text-[#6E747A]">
            {t('showing', { shown: map.data?.rows.length ?? 0, total: map.data?.total ?? 0 })}
          </p>
          {(map.data?.rows ?? []).map((row: any) => (
            <div key={row.activityId} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-4">
              <div className="flex items-start justify-between gap-4">
                <a href={`/ropa/${row.activityId}`} className="text-[14px] text-[#F4F5F6] hover:text-[#C9A227]">{row.activityName}</a>
                <span className="text-[11.5px] text-[#6E747A] shrink-0">{row.status}</span>
              </div>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-x-6 gap-y-2">
                <Cell label={t('col_subjects')} value={row.subjectCategories.join(', ')} />
                <Cell label={t('col_data')} value={row.dataCategories.slice(0, 6).join(', ')} accent={row.specialCategories.length > 0} />
                <Cell label={t('col_recipients')} value={row.recipients.map((r: any) => r.name).join(', ')} />
                <Cell label={t('col_countries')} value={row.countries.join(', ')} accent={row.thirdCountries.length > 0} />
              </dl>
            </div>
          ))}
          {(map.data?.rows ?? []).length === 0 ? (
            <p className="text-[13px] text-[#6E747A] py-8 text-center">{t('map_empty')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function filterFacet(items: any[] | undefined, search: string) {
  if (!items) return [];
  const q = search.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.value.toLowerCase().includes(q)) : items;
  return filtered.slice(0, 12);
}

function FacetList({ title, items, active, onPick }: any) {
  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-4">
      <p className="text-[12px] font-medium text-[#E6E8EA]">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item: any) => (
          <li key={item.value}>
            <button
              type="button"
              onClick={() => onPick(item.value)}
              aria-pressed={active === item.value}
              className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-[12.5px] text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60 ${
                active === item.value ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'text-[#9BA1A6] hover:text-[#F4F5F6] hover:bg-white/5'
              }`}
            >
              <span className="truncate">{item.value}</span>
              <span className="text-[11px] text-[#6E747A] shrink-0">{item.count}</span>
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="text-[12px] text-[#6E747A] px-2 py-1">—</li> : null}
      </ul>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-[#6E747A]">{label}</dt>
      <dd className={`text-[12.5px] mt-0.5 ${accent ? 'text-[#C9A227]' : 'text-[#E6E8EA]'}`}>{value || '—'}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// D43 — the transfer map
// ---------------------------------------------------------------------------

function TransferMapPanel({ t }: any) {
  const vocab = useRopaVocabulary();
  const map = trpc.ropa.insights.transferMap.useQuery();
  const destinations = map.data?.destinations ?? [];

  if (destinations.length === 0) {
    return <p className="text-[13px] text-[#6E747A] py-10 text-center">{t('transfers_empty')}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[#6E747A]">{t('transfers_hint')}</p>
      {destinations.map((d: any) => (
        <div key={d.country} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] text-[#F4F5F6]">{d.country}</p>
              <p className="text-[12px] text-[#6E747A] mt-0.5">
                {d.adequate ? t('adequate') : t('not_adequate')}
                {d.adequacyScope ? ` · ${d.adequacyScope}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[12.5px] text-[#E6E8EA]">{t('transfer_count', { transfers: d.transferCount, activities: d.activityCount })}</p>
              {/* The number the map exists to surface. `pending_assessment` reads as
                  a mechanism in the column and is the absence of one. */}
              {d.unsafeguardedCount > 0 ? (
                <p className="text-[12px] text-clay-600 mt-1">{t('unsafeguarded', { count: d.unsafeguardedCount })}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 border-t border-white/5 pt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {d.mechanisms.map((m: any) => (
              <span key={m.mechanism} className="text-[12px] text-[#9BA1A6]">
                {m.mechanism === 'not_recorded' ? t('mechanism_not_recorded') : vocab.label('transfer_mechanism', m.mechanism)}
                <span className="text-[#6E747A]"> · {m.count}</span>
              </span>
            ))}
            {d.tiaRequired > 0 ? (
              <span className="text-[12px] text-[#9BA1A6]">{t('tia_position', { completed: d.tiaCompleted, required: d.tiaRequired })}</span>
            ) : null}
          </div>

          {d.entities.length > 0 ? (
            <p className="mt-2 text-[11.5px] text-[#6E747A]">{d.entities.join(' · ')}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// P123 — the completeness trend
// ---------------------------------------------------------------------------

function TrendPanel({ t }: any) {
  const trend = trpc.ropa.insights.trend.useQuery({ days: 90 });
  const snapshots = trend.data?.snapshots ?? [];
  const latest = trend.data?.latest;

  if (!latest) {
    return (
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-10 text-center">
        <p className="text-[13.5px] text-[#9BA1A6]">{t('trend_empty')}</p>
        <p className="text-[12.5px] text-[#6E747A] mt-1 max-w-lg mx-auto">{t('trend_empty_hint')}</p>
      </div>
    );
  }

  const max = Math.max(...snapshots.map((s: any) => s.averageScore), 100);
  const requirements = Object.entries((latest.byRequirement ?? {}) as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat label={t('average_score')} value={`${latest.averageScore}%`} />
        <Stat label={t('activities')} value={String(latest.activityCount)} />
        <Stat label={t('published')} value={String(latest.activeCount)} />
        <Stat
          label={t('change_90d')}
          // A delta rather than a direction word. "Improving" over two data points
          // on a register that gained forty activities is a story the numbers do
          // not support.
          value={trend.data?.hasHistory && trend.data.change !== null
            ? `${trend.data.change > 0 ? '+' : ''}${trend.data.change}`
            : t('not_enough_history')}
        />
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5">
        <p className="text-[13px] font-medium text-[#F4F5F6]">{t('trend_title')}</p>
        <div className="mt-4 flex items-end gap-1 h-32" role="img" aria-label={t('trend_title')}>
          {snapshots.map((s: any) => (
            <div
              key={s.id}
              className="flex-1 bg-[#C9A227]/60 rounded-t min-w-[3px]"
              style={{ height: `${Math.max(2, (s.averageScore / max) * 100)}%` }}
              title={`${s.capturedOn}: ${s.averageScore}%`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-[#6E747A]">
          <span>{snapshots[0]?.capturedOn}</span>
          <span>{snapshots[snapshots.length - 1]?.capturedOn}</span>
        </div>
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5">
        <p className="text-[13px] font-medium text-[#F4F5F6]">{t('missing_most')}</p>
        <p className="text-[12px] text-[#6E747A] mt-1">{t('missing_most_hint')}</p>
        <ul className="mt-3 divide-y divide-white/5">
          {requirements.map(([id, count]) => (
            <li key={id} className="py-2 flex items-center justify-between gap-3">
              <span className="text-[13px] text-[#E6E8EA]">{id}</span>
              <span className="text-[12.5px] text-[#9BA1A6] shrink-0">
                {t('of_activities', { count, total: latest.activityCount })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated px-4 py-3">
      <p className="text-[11.5px] text-[#6E747A]">{label}</p>
      <p className="text-[20px] text-[#F4F5F6] mt-1">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// P125 — the material-change queue
// ---------------------------------------------------------------------------

function ChangesPanel({ t }: any) {
  const utils = trpc.useUtils();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const events = trpc.ropa.insights.materialChanges.list.useQuery({ status: 'open', consequence: 'all', limit: 50 });
  const review = trpc.ropa.insights.materialChanges.review.useMutation();

  const act = async (id: string, status: 'acknowledged' | 'actioned' | 'dismissed') => {
    setError(null);
    try {
      await review.mutateAsync({ id, status, note: note || null });
      setOpenId(null);
      setNote('');
      utils.ropa.insights.materialChanges.list.invalidate();
    } catch (e: any) { setError(e?.message ?? t('action_failed')); }
  };

  const rows = events.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-10 text-center">
        <p className="text-[13.5px] text-[#9BA1A6]">{t('changes_empty')}</p>
        <p className="text-[12.5px] text-[#6E747A] mt-1 max-w-lg mx-auto">{t('changes_empty_hint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-[12.5px] text-clay-600">{error}</p> : null}

      {rows.map((e: any) => (
        <div key={e.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <a href={`/ropa/${e.processingActivityId}`} className="text-[14px] text-[#F4F5F6] hover:text-[#C9A227]">{e.activityName}</a>
              <p className="text-[11.5px] text-[#6E747A] mt-1">
                {t(`materiality_${e.materiality}` as any)} · {new Date(e.detectedAt).toISOString().slice(0, 10)}
              </p>
            </div>
            <Button variant="ghost" onClick={() => { setOpenId(openId === e.id ? null : e.id); setNote(''); }} className="shrink-0">
              {t('review')}
            </Button>
          </div>

          {/* The three consequences, separately. They do not travel together, and a
              single "material: yes" would collapse three obligations into one. */}
          <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
            {(e.consequences ?? []).map((c: string) => {
              const verdict = (e.verdicts ?? {})[c];
              return (
                <li key={c}>
                  <p className={`text-[12.5px] font-medium ${verdict?.required ? 'text-[#C9A227]' : 'text-[#9BA1A6]'}`}>
                    {t(`consequence_${c}` as any)}
                    {verdict?.required ? '' : ` · ${t('advisory')}`}
                  </p>
                  <p className="text-[12px] text-[#9BA1A6] mt-0.5">{verdict?.reasoning}</p>
                  {verdict?.articles?.length ? (
                    <p className="text-[11px] text-[#6E747A] mt-0.5">{verdict.articles.join(' · ')}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {openId === e.id ? (
            <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
              <label htmlFor={`mc-note-${e.id}`} className="text-[12.5px] font-medium text-[#E6E8EA] block">{t('review_note')}</label>
              <Input id={`mc-note-${e.id}`} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={t('review_note_ph')} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => act(e.id, 'acknowledged')}>{t('acknowledge')}</Button>
                <Button variant="ghost" onClick={() => act(e.id, 'dismissed')} disabled={note.trim().length < 10}>{t('dismiss')}</Button>
                <Button onClick={() => act(e.id, 'actioned')}>{t('mark_actioned')}</Button>
              </div>
              <p className="text-[11.5px] text-[#6E747A]">{t('dismiss_needs_reason')}</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
