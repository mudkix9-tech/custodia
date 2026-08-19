"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, Baby, ShieldAlert, Plus } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRopaVocabulary } from '@/utils/ropaVocabularies';

/**
 * Art. 30(1)(c), first limb — the categories of data subject.
 *
 * The register list has shown this column, and warned "Not recorded" when it was
 * empty, since the module shipped. Nothing anywhere in the product could write it:
 * only the 32 onboarding templates ever did, straight into the jsonb array on the
 * activity (D30).
 *
 * Rows come from the org catalogue, so "Employees" means the same thing in every
 * activity and the child and vulnerable flags travel with the category rather than
 * being re-asserted per activity. A free-text fallback is kept because a register
 * that refuses anything outside its taxonomy is one people keep in a spreadsheet.
 */
export function DataSubjectsPanel({ activityId }: { activityId: string }) {
  const t = useTranslations('ropa.subjects');
  const vocab = useRopaVocabulary();
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.ropa.dataSubjects.list.useQuery({ processingActivityId: activityId });
  const { data: catalogue = [] } = trpc.ropa.catalogue.subjects.list.useQuery({ includeArchived: false });

  const createMutation = trpc.ropa.dataSubjects.create.useMutation();
  const updateMutation = trpc.ropa.dataSubjects.update.useMutation();
  const deleteMutation = trpc.ropa.dataSubjects.delete.useMutation();
  const { confirm, dialog } = useConfirm();

  const [selectedCatalogueId, setSelectedCatalogueId] = useState('');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Adding a child category flips involvesChildren and requiresDpia on the activity,
  // so the editor above has to re-read or its DPIA tab disagrees with the register.
  const refresh = () => {
    utils.ropa.dataSubjects.list.invalidate({ processingActivityId: activityId });
    utils.ropa.get.invalidate({ id: activityId });
    utils.ropa.completeness.invalidate({ id: activityId });
  };

  const alreadyAdded = new Set(data.map((d: any) => (d.category || '').toLowerCase()));

  const handleAddFromCatalogue = async () => {
    if (!selectedCatalogueId) return;
    const entry = catalogue.find((c: any) => c.id === selectedCatalogueId) as any;
    if (!entry) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        processingActivityId: activityId,
        catalogueId: entry.id,
        category: entry.name,
      });
      setSelectedCatalogueId('');
      refresh();
    } catch (e: any) {
      setError(e?.message || t('add_failed'));
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        processingActivityId: activityId,
        category: customName.trim(),
      });
      setCustomName('');
      refresh();
    } catch (e: any) {
      setError(e?.message || t('add_failed'));
    }
  };

  const handleInlineEdit = async (rowId: string, columnId: string, value: any) => {
    await updateMutation.mutateAsync({ id: rowId, data: { [columnId]: value } });
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

  const columns = [
    {
      accessorKey: 'category',
      header: t('category'),
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <span className="text-[#F4F5F6] font-medium">{row.original.category}</span>
          {row.original.isChild && (
            <span
              title={t('child_title')}
              className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-900/50"
            >
              <Baby className="w-3 h-3" aria-hidden="true" /> {t('child')}
            </span>
          )}
          {row.original.isVulnerable && !row.original.isChild && (
            <span
              title={t('vulnerable_title')}
              className="inline-flex items-center gap-1 bg-white/5 text-[#9BA1A6] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10"
            >
              <ShieldAlert className="w-3 h-3" aria-hidden="true" /> {t('vulnerable')}
            </span>
          )}
          {!row.original.catalogueId && (
            <span title={t('ad_hoc_title')} className="text-[10px] text-[#6E747A] uppercase tracking-wider">{t('ad_hoc')}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'volumeBand',
      header: t('volume'),
      cell: ({ getValue, row, column, table }: any) => (
        <Select
          value={getValue() || 'none'}
          onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val === 'none' ? null : val)}
        >
          <SelectTrigger aria-label={t('volume')} className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
            <SelectValue placeholder={t('not_estimated')}>{vocab.label('volume_band', getValue())}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('not_estimated')}</SelectItem>
            {vocab.options('volume_band').map((b) => (
              <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
    },
  ];

  return (
    <div className="bg-[#08090A] hairline rounded-2xl p-6">
      {dialog}
      <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-1">{t('title')}</h2>
      <p className="text-[12px] text-[#6E747A] mb-4">{t('subtitle')}</p>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <label htmlFor="subject-catalogue" className="text-[12.5px] font-medium text-[#E6E8EA] block">{t('from_catalogue')}</label>
          <div className="flex gap-3">
            <Select value={selectedCatalogueId || 'none'} onValueChange={(v) => setSelectedCatalogueId(v === 'none' ? '' : v)}>
              <SelectTrigger id="subject-catalogue" className="flex-1">
                <SelectValue placeholder={t('select_category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('select_category')}</SelectItem>
                {catalogue.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} disabled={alreadyAdded.has((c.name || '').toLowerCase())}>
                    {c.name}{alreadyAdded.has((c.name || '').toLowerCase()) ? t('already_added') : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddFromCatalogue} disabled={!selectedCatalogueId || createMutation.isPending}>
              <Plus className="w-4 h-4" aria-hidden="true" /> {t('add')}
            </Button>
          </div>
        </div>

        <div className="space-y-2 md:border-l md:border-white/10 md:pl-6">
          <label htmlFor="subject-custom" className="text-[12.5px] font-medium text-[#E6E8EA] block">{t('or_custom')}</label>
          <div className="flex gap-3">
            <Input
              id="subject-custom"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t('custom_ph')}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleAddCustom} disabled={!customName.trim() || createMutation.isPending}>
              {t('add')}
            </Button>
          </div>
          <p className="text-[12px] text-[#6E747A]">
            {t('custom_hint')}{' '}
            <Link href="/ropa/catalogues" className="text-[#C9A227] hover:underline">{t('add_to_catalogue')}</Link>{' '}
            {t('custom_hint_end')}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-clay-600/10 border border-clay-600/25 text-clay-600 px-4 py-2.5 rounded-xl text-[13px]">
          {error}
        </div>
      )}

      <DataGrid
        mode="compact"
        columns={columns as any}
        data={data}
        isLoading={isLoading}
        onInlineEdit={handleInlineEdit}
        emptyStateMessage={t('empty')}
      />
    </div>
  );
}
