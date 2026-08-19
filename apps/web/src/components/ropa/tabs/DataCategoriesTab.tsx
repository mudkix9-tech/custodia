"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, Plus, ChevronDown, ChevronRight, AlertTriangle, Scale } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataSubjectsPanel } from './DataSubjectsPanel';
import { article9RequiresNationalLaw, useRopaVocabulary } from '@/utils/ropaVocabularies';

/**
 * Art. 30(1)(c), second limb — the categories of personal data.
 *
 * Until Sprint 0 this tab bound two of its four columns to columns that do not
 * exist and hardcoded `category` to the literal 'New Category' (D5). It could then
 * record a category name and nothing else. What Art. 30 actually asks for around
 * that name — which Art. 9(2) condition lifts the prohibition for special-category
 * data, what authority carries Art. 10 criminal data, how long each category is
 * kept — has no home in a four-column grid, so it lives in the expandable detail
 * panel below each row.
 *
 * Per-category retention (A4) is the one that changes the shape of the record: an
 * activity holding a CV and an audit trail has two right answers and the
 * activity-level dropdown could only ever hold one.
 */
export function DataCategoriesTab({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.categories');
  const vocab = useRopaVocabulary();
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.ropa.dataCategories.list.useQuery({ processingActivityId: activityId });
  const { data: catalogue = [] } = trpc.ropa.catalogue.elements.list.useQuery({ includeArchived: false });
  const createMutation = trpc.ropa.dataCategories.create.useMutation();
  const updateMutation = trpc.ropa.dataCategories.update.useMutation();
  const deleteMutation = trpc.ropa.dataCategories.delete.useMutation();
  const { confirm, dialog } = useConfirm();

  const [selectedCatalogueId, setSelectedCatalogueId] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => {
    utils.ropa.dataCategories.list.invalidate({ processingActivityId: activityId });
    // Adding a special category escalates requiresDpia and riskLevel on the activity.
    utils.ropa.get.invalidate({ id: activityId });
    utils.ropa.completeness.invalidate({ id: activityId });
  };

  const handleAddFromCatalogue = async () => {
    if (!selectedCatalogueId) return;
    const entry = catalogue.find((c: any) => c.id === selectedCatalogueId) as any;
    if (!entry) return;
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      catalogueId: entry.id,
      // The server re-reads the catalogue entry and takes the classification from
      // it; these are what it falls back to if the id no longer resolves.
      category: entry.name,
      categoryGroup: entry.elementGroup,
    });
    setSelectedCatalogueId('');
    refresh();
  };

  const handleAdd = async () => {
    // Both columns are NOT NULL, so a new row needs placeholders. They are editable
    // in the grid; the catalogue picker above is the path that fills them in.
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      category: 'New Category',
      categoryGroup: 'General',
    });
    refresh();
  };

  const handleInlineEdit = async (rowId: string, columnId: string, value: any) => {
    await updateMutation.mutateAsync({ id: rowId, data: { [columnId]: value } });
    refresh();
  };

  const handleFieldChange = async (rowId: string, field: string, value: any) => {
    await updateMutation.mutateAsync({ id: rowId, data: { [field]: value } });
    refresh();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('remove_title'),
      description: t('remove_body'),
      variant: 'destructive',
      confirmText: t('remove'),
    });
    if (confirmed) {
      await deleteMutation.mutateAsync({ id });
      refresh();
    }
  };

  const EditableCell = ({ getValue, row, column, table }: any) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    const onBlur = () => {
      if (value !== initialValue) {
        table.options.meta?.updateData(row.index, column.id, value);
      }
    };

    return (
      <Input
        value={value || ''}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        className="bg-transparent border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#C9A227]/40 rounded px-2 py-1 h-8 w-full text-[#F4F5F6] placeholder:text-white/20"
      />
    );
  };

  const columns = [
    {
      id: 'expander',
      header: '',
      cell: ({ row }: any) => (
        <button
          onClick={() => setExpanded(expanded === row.original.id ? null : row.original.id)}
          aria-label={expanded === row.original.id ? t('hide_detail') : t('show_detail')}
          aria-expanded={expanded === row.original.id}
          className="text-[#6E747A] hover:text-[#F4F5F6] transition-colors"
        >
          {expanded === row.original.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ),
      size: 32,
    },
    {
      accessorKey: 'category',
      header: t('col_category'),
      cell: ({ row, getValue, column, table }: any) => {
        // A catalogue-linked row is not free text: renaming it here would silently
        // break the link that answers "which activities process health data?".
        if (row.original.catalogueId) {
          return <span className="text-[#F4F5F6] font-medium px-2">{getValue()}</span>;
        }
        return <EditableCell row={row} getValue={getValue} column={column} table={table} />;
      },
    },
    {
      accessorKey: 'categoryGroup',
      header: t('col_group'),
      cell: ({ row, getValue, column, table }: any) =>
        row.original.catalogueId
          ? <span className="text-[#9BA1A6] px-2">{getValue()}</span>
          : <EditableCell row={row} getValue={getValue} column={column} table={table} />,
    },
    {
      accessorKey: 'source',
      header: t('col_source'),
      cell: EditableCell,
    },
    {
      accessorKey: 'retentionPeriod',
      header: t('col_retention'),
      // Read-only here, edited in the detail panel. A period on its own is not a
      // retention rule — "6 years" from collection and from the end of the contract
      // are different answers — so the field that holds it is never offered without
      // the trigger and the justification beside it. That is the whole of A4.
      cell: ({ getValue, row }: any) => {
        const value = getValue();
        const trigger = row.original.retentionTrigger;
        if (!value) {
          return (
            <button
              onClick={() => setExpanded(row.original.id)}
              className="px-2 text-[12px] text-amber-400 hover:underline"
            >
              {t('not_recorded')}
            </button>
          );
        }
        return (
          <button onClick={() => setExpanded(row.original.id)} className="px-2 text-left">
            <span className="text-[#F4F5F6] text-[13px]">{value}</span>
            {trigger && (
              <span className="text-[#6E747A] text-[12px]">
                {' '}{t('counted_from_inline', { trigger: vocab.label('retention_trigger', trigger).toLowerCase() })}
              </span>
            )}
          </button>
        );
      },
    },
    {
      id: 'classification',
      header: t('col_classification'),
      cell: ({ row }: any) => {
        const r = row.original;
        if (!r.isSpecialCategory && !r.isCriminalData) {
          return <span className="text-[#6E747A] text-[13px]">{t('standard')}</span>;
        }
        // The two are not the same thing, and conflating them is the most common
        // mistake in a hand-built register — so they never share a badge.
        const needsCondition = r.isSpecialCategory && !r.article9Condition;
        const needsAuthority = r.isCriminalData && !r.article10Basis;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {r.isSpecialCategory && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                needsCondition
                  ? 'bg-clay-600/10 text-clay-600 border-clay-600/30'
                  : 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
              }`}>
                {needsCondition && <AlertTriangle className="w-3 h-3" aria-hidden="true" />} {t('art9')}
              </span>
            )}
            {r.isCriminalData && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                needsAuthority
                  ? 'bg-clay-600/10 text-clay-600 border-clay-600/30'
                  : 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
              }`}>
                {needsAuthority && <AlertTriangle className="w-3 h-3" aria-hidden="true" />} {t('art10')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'isSpecialCategory',
      header: t('col_special'),
      cell: ({ getValue, row, column, table }: any) => (
        <input
          type="checkbox"
          aria-label={t('special_aria')}
          checked={getValue() || false}
          disabled={!!row.original.catalogueId}
          title={row.original.catalogueId ? t('set_by_catalogue') : undefined}
          onChange={(e) => table.options.meta?.updateData(row.index, column.id, e.target.checked)}
          className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent disabled:opacity-40"
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('remove')}
          onClick={() => handleDelete(row.original.id)}
          className="w-7 h-7 text-[#6E747A] hover:text-clay-600 hover:bg-white/5"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
      size: 50,
    }
  ];

  const detail = data.find((d: any) => d.id === expanded) as any;

  const alreadyAdded = new Set(data.map((d: any) => (d.category || '').toLowerCase()));

  return (
    <div className="space-y-6 fade-up">
      {dialog}

      <DataSubjectsPanel activityId={activityId} />

      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-1">{t('title')}</h2>
        <p className="text-[12px] text-[#6E747A] mb-4">{t('subtitle')}</p>

        <div className="flex gap-3 mb-5 max-w-xl">
          <Select value={selectedCatalogueId || 'none'} onValueChange={(v) => setSelectedCatalogueId(v === 'none' ? '' : v)}>
            <SelectTrigger className="flex-1" aria-label={t('add_from_catalogue')}>
              <SelectValue placeholder={t('add_from_catalogue')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('add_from_catalogue')}</SelectItem>
              {catalogue.map((c: any) => (
                <SelectItem key={c.id} value={c.id} disabled={alreadyAdded.has((c.name || '').toLowerCase())}>
                  {c.elementGroup} · {c.name}{alreadyAdded.has((c.name || '').toLowerCase()) ? t('already_added') : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddFromCatalogue} disabled={!selectedCatalogueId || createMutation.isPending}>
            <Plus className="w-4 h-4" aria-hidden="true" /> {t('add')}
          </Button>
        </div>

        <DataGrid
          mode="compact"
          columns={columns as any}
          data={data}
          isLoading={isLoading}
          enableInlineAdd={true}
          onAddRow={handleAdd}
          onInlineEdit={handleInlineEdit}
          emptyStateMessage={t('empty')}
        />
      </div>

      {detail && (
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-6 fade-up">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-[14px] font-medium text-[#F4F5F6]">{detail.category}</h3>
              <p className="text-[12px] text-[#6E747A]">{detail.categoryGroup}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(null)} className="text-[#6E747A] hover:text-[#F4F5F6]">
              {t('close')}
            </Button>
          </div>

          {/* ---- Retention, per category (A4) ---------------------------- */}
          <section className="space-y-3">
            <h4 className="text-[12.5px] font-medium text-[#E6E8EA] flex items-center gap-2">
              {t('retention')} <span className="text-[11px] text-[#6E747A] font-normal">{t('art_30_1_f')}</span>
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="cat-period" className="text-[12px] text-[#9BA1A6]">{t('period')}</label>
                <Input
                  id="cat-period"
                  key={`${detail.id}-period`}
                  defaultValue={detail.retentionPeriod || ''}
                  onBlur={(e) => e.target.value !== (detail.retentionPeriod || '') && handleFieldChange(detail.id, 'retentionPeriod', e.target.value || null)}
                  placeholder={t('period_ph')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cat-trigger" className="text-[12px] text-[#9BA1A6]">{t('counted_from')}</label>
                <Select
                  value={detail.retentionTrigger || 'none'}
                  onValueChange={(v) => handleFieldChange(detail.id, 'retentionTrigger', v === 'none' ? null : v)}
                >
                  <SelectTrigger id="cat-trigger"><SelectValue placeholder={t('select_trigger')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('not_specified')}</SelectItem>
                    {vocab.options('retention_trigger').map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[12px] text-[#6E747A]">{t('retention_hint')}</p>
            <div className="space-y-1.5">
              <label htmlFor="cat-retjust" className="text-[12px] text-[#9BA1A6]">{t('justification')}</label>
              <Textarea
                id="cat-retjust"
                key={`${detail.id}-retjust`}
                defaultValue={detail.retentionJustification || ''}
                onBlur={(e) => e.target.value !== (detail.retentionJustification || '') && handleFieldChange(detail.id, 'retentionJustification', e.target.value || null)}
                rows={2}
                placeholder={t('justification_ph')}
              />
            </div>
          </section>

          {/* ---- Article 9(2) ------------------------------------------- */}
          {detail.isSpecialCategory && (
            <section className="space-y-3 border-t border-white/10 pt-5">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA] flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-[#C9A227]" aria-hidden="true" />
                {t('special_condition')} <span className="text-[11px] text-[#6E747A] font-normal">{t('art_9_2')}</span>
              </h4>
              <p className="text-[12px] text-[#6E747A]">{t('special_condition_hint')}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cat-sct" className="text-[12px] text-[#9BA1A6]">{t('special_type')}</label>
                  <Select
                    value={detail.specialCategoryType || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'specialCategoryType', v === 'none' ? null : v)}
                  >
                    <SelectTrigger id="cat-sct"><SelectValue placeholder={t('select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('not_specified')}</SelectItem>
                      {vocab.options('special_category_type').map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cat-a9c" className="text-[12px] text-[#9BA1A6]">{t('art_9_2_condition')}</label>
                  <Select
                    value={detail.article9Condition || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'article9Condition', v === 'none' ? null : v)}
                  >
                    <SelectTrigger id="cat-a9c"><SelectValue placeholder={t('select_condition')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('not_specified')}</SelectItem>
                      {vocab.options('article_9_condition').map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {detail.article9Condition && (
                <p className="text-[12px] text-[#9BA1A6] bg-white/5 rounded-xl px-3 py-2">
                  {vocab.hint('article_9_condition', detail.article9Condition)}
                </p>
              )}

              {article9RequiresNationalLaw(detail.article9Condition) && (
                <div className="space-y-1.5">
                  <label htmlFor="cat-natlaw" className="text-[12px] text-[#9BA1A6]">
                    {t('national_law')} <span className="text-clay-600" aria-hidden="true">*</span>
                  </label>
                  <Textarea
                    id="cat-natlaw"
                    key={`${detail.id}-natlaw`}
                    defaultValue={detail.article9NationalLawBasis || ''}
                    onBlur={(e) => e.target.value !== (detail.article9NationalLawBasis || '') && handleFieldChange(detail.id, 'article9NationalLawBasis', e.target.value || null)}
                    rows={2}
                    placeholder={t('national_law_ph')}
                  />
                  <p className="text-[12px] text-[#6E747A]">{t('national_law_hint')}</p>
                </div>
              )}
            </section>
          )}

          {/* ---- Article 10 --------------------------------------------- */}
          <section className="space-y-3 border-t border-white/10 pt-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={detail.isCriminalData || false}
                onChange={(e) => handleFieldChange(detail.id, 'isCriminalData', e.target.checked)}
                className="mt-1 rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
              />
              <div>
                <p className="text-[13px] font-medium text-[#F4F5F6]">{t('criminal')}</p>
                <p className="text-[12px] text-[#6E747A]">{t('criminal_hint')}</p>
              </div>
            </label>

            {detail.isCriminalData && (
              <div className="space-y-1.5 pl-7">
                <label htmlFor="cat-art10" className="text-[12px] text-[#9BA1A6]">
                  {t('authority')} <span className="text-clay-600" aria-hidden="true">*</span>
                </label>
                <Textarea
                  id="cat-art10"
                  key={`${detail.id}-art10`}
                  defaultValue={detail.article10Basis || ''}
                  onBlur={(e) => e.target.value !== (detail.article10Basis || '') && handleFieldChange(detail.id, 'article10Basis', e.target.value || null)}
                  rows={2}
                  placeholder={t('authority_ph')}
                />
              </div>
            )}
          </section>

          {/* ---- Identifiability and necessity --------------------------- */}
          <section className="space-y-4 border-t border-white/10 pt-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="cat-ident" className="text-[12px] text-[#9BA1A6]">{t('identifiability')}</label>
                <Select
                  value={detail.identifiability || 'none'}
                  onValueChange={(v) => handleFieldChange(detail.id, 'identifiability', v === 'none' ? null : v)}
                >
                  <SelectTrigger id="cat-ident"><SelectValue placeholder={t('select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('not_specified')}</SelectItem>
                    {vocab.options('identifiability').map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.identifiability && (
                  <p className="text-[12px] text-[#6E747A]">{vocab.hint('identifiability', detail.identifiability)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cat-srcdetail" className="text-[12px] text-[#9BA1A6]">{t('source_detail')}</label>
                <Input
                  id="cat-srcdetail"
                  key={`${detail.id}-srcdetail`}
                  defaultValue={detail.sourceDetail || ''}
                  onBlur={(e) => e.target.value !== (detail.sourceDetail || '') && handleFieldChange(detail.id, 'sourceDetail', e.target.value || null)}
                  placeholder={t('source_detail_ph')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cat-necessity" className="text-[12px] text-[#9BA1A6]">{t('necessity')}</label>
              <Textarea
                id="cat-necessity"
                key={`${detail.id}-necessity`}
                defaultValue={detail.necessityJustification || ''}
                onBlur={(e) => e.target.value !== (detail.necessityJustification || '') && handleFieldChange(detail.id, 'necessityJustification', e.target.value || null)}
                rows={2}
                placeholder={t('necessity_ph')}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
