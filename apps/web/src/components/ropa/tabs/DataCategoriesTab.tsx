"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, Plus, ChevronDown, ChevronRight, AlertTriangle, Scale } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataSubjectsPanel } from './DataSubjectsPanel';
import {
  SPECIAL_CATEGORY_TYPES,
  ARTICLE_9_CONDITIONS,
  IDENTIFIABILITY_LEVELS,
  RETENTION_TRIGGERS,
  article9RequiresNationalLaw,
  labelFor,
} from '@/utils/ropaVocabularies';

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
      title: 'Remove data category?',
      description: 'Are you sure you want to remove this data category?',
      variant: 'destructive',
      confirmText: 'Remove',
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
          aria-label={expanded === row.original.id ? 'Hide detail' : 'Show detail'}
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
      header: 'Data Category',
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
      header: 'Group',
      cell: ({ row, getValue, column, table }: any) =>
        row.original.catalogueId
          ? <span className="text-[#9BA1A6] px-2">{getValue()}</span>
          : <EditableCell row={row} getValue={getValue} column={column} table={table} />,
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: EditableCell,
    },
    {
      accessorKey: 'retentionPeriod',
      header: 'Retention',
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
              Not recorded
            </button>
          );
        }
        return (
          <button onClick={() => setExpanded(row.original.id)} className="px-2 text-left">
            <span className="text-[#F4F5F6] text-[13px]">{value}</span>
            {trigger && <span className="text-[#6E747A] text-[12px]"> from {labelFor(RETENTION_TRIGGERS, trigger).toLowerCase()}</span>}
          </button>
        );
      },
    },
    {
      id: 'classification',
      header: 'Classification',
      cell: ({ row }: any) => {
        const r = row.original;
        if (!r.isSpecialCategory && !r.isCriminalData) {
          return <span className="text-[#6E747A] text-[13px]">Standard</span>;
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
                {needsCondition && <AlertTriangle className="w-3 h-3" />} Art. 9
              </span>
            )}
            {r.isCriminalData && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                needsAuthority
                  ? 'bg-clay-600/10 text-clay-600 border-clay-600/30'
                  : 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/30'
              }`}>
                {needsAuthority && <AlertTriangle className="w-3 h-3" />} Art. 10
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'isSpecialCategory',
      header: 'Special',
      cell: ({ getValue, row, column, table }: any) => (
        <input
          type="checkbox"
          aria-label="Special category data"
          checked={getValue() || false}
          disabled={!!row.original.catalogueId}
          title={row.original.catalogueId ? 'Set by the catalogue entry.' : undefined}
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
          aria-label="Delete"
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
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-1">Data Categories</h2>
        <p className="text-[12px] text-[#6E747A] mb-4">
          Art. 30(1)(c) — what personal data this activity processes. Expand a row for the Art. 9(2) condition,
          the Art. 10 authority and the retention rule for that category.
        </p>

        <div className="flex gap-3 mb-5 max-w-xl">
          <Select value={selectedCatalogueId || 'none'} onValueChange={(v) => setSelectedCatalogueId(v === 'none' ? '' : v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Add from your data element catalogue..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Add from your data element catalogue...</SelectItem>
              {catalogue.map((c: any) => (
                <SelectItem key={c.id} value={c.id} disabled={alreadyAdded.has((c.name || '').toLowerCase())}>
                  {c.elementGroup} · {c.name}{alreadyAdded.has((c.name || '').toLowerCase()) ? ' — already added' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddFromCatalogue} disabled={!selectedCatalogueId || createMutation.isPending}>
            <Plus className="w-4 h-4" /> Add
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
          emptyStateMessage="No data categories added yet."
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
              Close
            </Button>
          </div>

          {/* ---- Retention, per category (A4) ---------------------------- */}
          <section className="space-y-3">
            <h4 className="text-[12.5px] font-medium text-[#E6E8EA] flex items-center gap-2">
              Retention <span className="text-[11px] text-[#6E747A] font-normal">Art. 30(1)(f)</span>
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#9BA1A6]">Period</label>
                <Input
                  key={`${detail.id}-period`}
                  defaultValue={detail.retentionPeriod || ''}
                  onBlur={(e) => e.target.value !== (detail.retentionPeriod || '') && handleFieldChange(detail.id, 'retentionPeriod', e.target.value || null)}
                  placeholder="E.g. 6 years"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#9BA1A6]">Counted from</label>
                <Select
                  value={detail.retentionTrigger || 'none'}
                  onValueChange={(v) => handleFieldChange(detail.id, 'retentionTrigger', v === 'none' ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select a trigger..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {RETENTION_TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[12px] text-[#6E747A]">
              A period without the event it runs from is not a rule — &quot;6 years&quot; from collection and from the
              end of the contract are different answers.
            </p>
            <div className="space-y-1.5">
              <label className="text-[12px] text-[#9BA1A6]">Justification</label>
              <Textarea
                key={`${detail.id}-retjust`}
                defaultValue={detail.retentionJustification || ''}
                onBlur={(e) => e.target.value !== (detail.retentionJustification || '') && handleFieldChange(detail.id, 'retentionJustification', e.target.value || null)}
                rows={2}
                placeholder="Statutory citation or business reason."
              />
            </div>
          </section>

          {/* ---- Article 9(2) ------------------------------------------- */}
          {detail.isSpecialCategory && (
            <section className="space-y-3 border-t border-white/10 pt-5">
              <h4 className="text-[12.5px] font-medium text-[#E6E8EA] flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-[#C9A227]" />
                Special category condition <span className="text-[11px] text-[#6E747A] font-normal">Art. 9(2)</span>
              </h4>
              <p className="text-[12px] text-[#6E747A]">
                Art. 9(1) prohibits processing this data. Recording the category without the condition that lifts
                the prohibition documents the problem and not the answer.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#9BA1A6]">Type of special category data</label>
                  <Select
                    value={detail.specialCategoryType || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'specialCategoryType', v === 'none' ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {SPECIAL_CATEGORY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#9BA1A6]">Art. 9(2) condition</label>
                  <Select
                    value={detail.article9Condition || 'none'}
                    onValueChange={(v) => handleFieldChange(detail.id, 'article9Condition', v === 'none' ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a condition..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {ARTICLE_9_CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {detail.article9Condition && (
                <p className="text-[12px] text-[#9BA1A6] bg-white/5 rounded-xl px-3 py-2">
                  {ARTICLE_9_CONDITIONS.find((c) => c.value === detail.article9Condition)?.hint}
                </p>
              )}

              {article9RequiresNationalLaw(detail.article9Condition) && (
                <div className="space-y-1.5">
                  <label className="text-[12px] text-[#9BA1A6]">
                    Union or Member State law relied on <span className="text-clay-600">*</span>
                  </label>
                  <Textarea
                    key={`${detail.id}-natlaw`}
                    defaultValue={detail.article9NationalLawBasis || ''}
                    onBlur={(e) => e.target.value !== (detail.article9NationalLawBasis || '') && handleFieldChange(detail.id, 'article9NationalLawBasis', e.target.value || null)}
                    rows={2}
                    placeholder="E.g. Employment Rights Act 1996 s.1; § 26 BDSG."
                  />
                  <p className="text-[12px] text-[#6E747A]">
                    Conditions (b), (h), (i) and (j) are only available where such a law provides for them. Naming it
                    is the difference between a condition and an assertion.
                  </p>
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
                <p className="text-[13px] font-medium text-[#F4F5F6]">Criminal convictions and offences</p>
                <p className="text-[12px] text-[#6E747A]">
                  Art. 10 — not an Art. 9 category. It needs official authority or a specific Union or Member State
                  authorisation of its own, which an Art. 9(2) condition does not carry.
                </p>
              </div>
            </label>

            {detail.isCriminalData && (
              <div className="space-y-1.5 pl-7">
                <label className="text-[12px] text-[#9BA1A6]">Authority or authorisation <span className="text-clay-600">*</span></label>
                <Textarea
                  key={`${detail.id}-art10`}
                  defaultValue={detail.article10Basis || ''}
                  onBlur={(e) => e.target.value !== (detail.article10Basis || '') && handleFieldChange(detail.id, 'article10Basis', e.target.value || null)}
                  rows={2}
                  placeholder="E.g. DBS checks under the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975."
                />
              </div>
            )}
          </section>

          {/* ---- Identifiability and necessity --------------------------- */}
          <section className="space-y-4 border-t border-white/10 pt-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#9BA1A6]">Identifiability</label>
                <Select
                  value={detail.identifiability || 'none'}
                  onValueChange={(v) => handleFieldChange(detail.id, 'identifiability', v === 'none' ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {IDENTIFIABILITY_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detail.identifiability && (
                  <p className="text-[12px] text-[#6E747A]">
                    {IDENTIFIABILITY_LEVELS.find((l) => l.value === detail.identifiability)?.hint}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-[#9BA1A6]">Source detail</label>
                <Input
                  key={`${detail.id}-srcdetail`}
                  defaultValue={detail.sourceDetail || ''}
                  onBlur={(e) => e.target.value !== (detail.sourceDetail || '') && handleFieldChange(detail.id, 'sourceDetail', e.target.value || null)}
                  placeholder="Art. 14(2)(f) — where it came from, if not the subject."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] text-[#9BA1A6]">Why this category is necessary</label>
              <Textarea
                key={`${detail.id}-necessity`}
                defaultValue={detail.necessityJustification || ''}
                onBlur={(e) => e.target.value !== (detail.necessityJustification || '') && handleFieldChange(detail.id, 'necessityJustification', e.target.value || null)}
                rows={2}
                placeholder="Art. 5(1)(c) data minimisation — what the purpose could not achieve without it."
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
