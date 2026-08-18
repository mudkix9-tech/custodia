"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { useRouter } from '@/i18n/routing';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { Library, Plus, Archive, ArchiveRestore, ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  SPECIAL_CATEGORY_TYPES,
  IDENTIFIABILITY_LEVELS,
  SENSITIVITY_LEVELS,
  labelFor,
} from '@/utils/ropaVocabularies';

/**
 * A2/A3 — the two org-level catalogues the register's child rows point at.
 *
 * They exist so that "Email address" means the same thing in every activity and so
 * that "which activities process health data?" — the question a DPO is asked most
 * often — has an answer. Both ship seeded; this is where a customer shapes them to
 * their own vocabulary.
 *
 * Entries archive rather than delete. Child rows keep a denormalised copy of the
 * name, so a hard delete would not corrupt a published register — but it would break
 * the `catalogue_id` link that answers the question above, and that link is the
 * entire reason the catalogue exists.
 *
 * English throughout, matching the five ROPA child tabs. Extracting all of them is
 * one sweep (R142); a half-translated page would show German and French readers raw
 * key paths, which next-intl renders verbatim.
 */
export default function RopaCataloguesPage() {
  const router = useRouter();
  const t = useTranslations('ropa');
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<'elements' | 'subjects'>('elements');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: elements = [], isLoading: elementsLoading } =
    trpc.ropa.catalogue.elements.list.useQuery({ includeArchived: showArchived });
  const { data: subjects = [], isLoading: subjectsLoading } =
    trpc.ropa.catalogue.subjects.list.useQuery({ includeArchived: showArchived });

  const createElement = trpc.ropa.catalogue.elements.create.useMutation();
  const updateElement = trpc.ropa.catalogue.elements.update.useMutation();
  const archiveElement = trpc.ropa.catalogue.elements.archive.useMutation();
  const createSubject = trpc.ropa.catalogue.subjects.create.useMutation();
  const updateSubject = trpc.ropa.catalogue.subjects.update.useMutation();
  const archiveSubject = trpc.ropa.catalogue.subjects.archive.useMutation();

  const [newElementName, setNewElementName] = useState('');
  const [newElementGroup, setNewElementGroup] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');

  const refreshElements = () => utils.ropa.catalogue.elements.list.invalidate();
  const refreshSubjects = () => utils.ropa.catalogue.subjects.list.invalidate();

  const handleAddElement = async () => {
    if (!newElementName.trim() || !newElementGroup.trim()) return;
    setError(null);
    try {
      await createElement.mutateAsync({ name: newElementName.trim(), elementGroup: newElementGroup.trim() });
      setNewElementName('');
      refreshElements();
    } catch (e: any) {
      setError(e?.message || 'Could not add that element.');
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    setError(null);
    try {
      await createSubject.mutateAsync({ name: newSubjectName.trim() });
      setNewSubjectName('');
      refreshSubjects();
    } catch (e: any) {
      setError(e?.message || 'Could not add that category.');
    }
  };

  const EditableCell = ({ getValue, row, column, table }: any) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    return (
      <Input
        value={value || ''}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== initialValue && table.options.meta?.updateData(row.index, column.id, value)}
        className="bg-transparent border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#C9A227]/40 rounded px-2 py-1 h-8 w-full text-[#F4F5F6]"
      />
    );
  };

  const SelectCell = ({ getValue, row, column, table, options, placeholder }: any) => (
    <Select
      value={getValue() || 'none'}
      onValueChange={(v) => table.options.meta?.updateData(row.index, column.id, v === 'none' ? null : v)}
    >
      <SelectTrigger className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-[#C9A227]/40">
        <SelectValue placeholder={placeholder}>{labelFor(options, getValue())}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {options.map((o: any) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const CheckCell = ({ getValue, row, column, table, label }: any) => (
    <input
      type="checkbox"
      aria-label={label}
      checked={getValue() || false}
      onChange={(e) => table.options.meta?.updateData(row.index, column.id, e.target.checked)}
      className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
    />
  );

  const ArchiveCell = ({ row, onToggle }: any) => (
    <Button
      variant="ghost"
      size="icon"
      aria-label={row.original.archivedAt ? 'Restore' : 'Archive'}
      title={row.original.archivedAt ? 'Restore' : 'Archive — existing register entries keep the name they were recorded with.'}
      onClick={() => onToggle(row.original.id, !row.original.archivedAt)}
      className="w-7 h-7 text-[#6E747A] hover:text-[#F4F5F6] hover:bg-white/5"
    >
      {row.original.archivedAt ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
    </Button>
  );

  const elementColumns = [
    { accessorKey: 'name', header: 'Element', cell: EditableCell },
    { accessorKey: 'elementGroup', header: 'Group', cell: EditableCell },
    {
      accessorKey: 'sensitivity',
      header: 'Sensitivity',
      // Not a synonym for Art. 9. Salary and bank details are commercially sensitive
      // and are not special-category data; treating the two as one field is how a
      // register claims Art. 9 processing it does not do.
      cell: (p: any) => <SelectCell {...p} options={SENSITIVITY_LEVELS} placeholder="Standard" />,
    },
    {
      accessorKey: 'isSpecialCategory',
      header: 'Art. 9',
      cell: (p: any) => <CheckCell {...p} label="Special category" />,
    },
    {
      accessorKey: 'specialCategoryType',
      header: 'Art. 9 type',
      cell: (p: any) =>
        p.row.original.isSpecialCategory
          ? <SelectCell {...p} options={SPECIAL_CATEGORY_TYPES} placeholder="Not specified" />
          : <span className="text-[#6E747A] text-[13px] px-2">—</span>,
    },
    {
      accessorKey: 'isCriminalData',
      header: 'Art. 10',
      cell: (p: any) => <CheckCell {...p} label="Criminal offence data" />,
    },
    {
      accessorKey: 'identifiability',
      header: 'Identifiability',
      cell: (p: any) => <SelectCell {...p} options={IDENTIFIABILITY_LEVELS} placeholder="Direct" />,
    },
    {
      id: 'archive',
      header: '',
      cell: (p: any) => (
        <ArchiveCell
          {...p}
          onToggle={async (id: string, archived: boolean) => {
            await archiveElement.mutateAsync({ id, archived });
            refreshElements();
          }}
        />
      ),
      size: 50,
    },
  ];

  const subjectColumns = [
    { accessorKey: 'name', header: 'Category', cell: EditableCell },
    {
      accessorKey: 'isChild',
      header: 'Children',
      // Art. 8 and Recital 38. Feeds the Art. 35(3) DPIA screening rather than being
      // decoration, which is why it lives on the category and not on each activity.
      cell: (p: any) => <CheckCell {...p} label="Children" />,
    },
    {
      accessorKey: 'isVulnerable',
      header: 'Vulnerable',
      cell: (p: any) => <CheckCell {...p} label="Vulnerable data subjects" />,
    },
    { accessorKey: 'description', header: 'Note', cell: EditableCell },
    {
      id: 'archive',
      header: '',
      cell: (p: any) => (
        <ArchiveCell
          {...p}
          onToggle={async (id: string, archived: boolean) => {
            await archiveSubject.mutateAsync({ id, archived });
            refreshSubjects();
          }}
        />
      ),
      size: 50,
    },
  ];

  return (
    <PageShell className="fade-up space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/ropa')}
            aria-label={t('record.back')}
            className="text-[#6E747A] hover:text-[#F4F5F6] mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif text-[#F4F5F6] tracking-tight flex items-center gap-3">
              <div className="p-2 bg-[#0D0F11] rounded-xl shadow-card border border-white/10">
                <Library className="w-5 h-5 text-[#C9A227]" />
              </div>
              Register catalogues
            </h1>
            <p className="text-[13.5px] text-[#6E747A] mt-2 max-w-2xl">
              The shared vocabulary your processing activities draw on. Kept here rather than typed per activity so
              that one element means one thing across the register — and so that &quot;which activities process health
              data?&quot; has an answer.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#6E747A] shrink-0">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
          />
          Show archived
        </label>
      </div>

      <div className="flex items-center gap-1 border-b border-white/10">
        {([
          ['elements', `Data elements (${elements.length})`],
          ['subjects', `Data subject categories (${subjects.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-[13.5px] whitespace-nowrap transition-colors border-b-2 ${
              tab === key
                ? 'border-[#C9A227] text-[#C9A227] font-medium'
                : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-clay-600/10 border border-clay-600/25 text-clay-600 px-4 py-2.5 rounded-xl text-[13px]">
          {error}
        </div>
      )}

      {tab === 'elements' ? (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-3 max-w-3xl">
            <Input
              value={newElementName}
              onChange={(e) => setNewElementName(e.target.value)}
              placeholder="Element — e.g. Payroll number"
              className="flex-1"
            />
            <Input
              value={newElementGroup}
              onChange={(e) => setNewElementGroup(e.target.value)}
              placeholder="Group — e.g. Employment"
              className="flex-1"
            />
            <Button onClick={handleAddElement} disabled={!newElementName.trim() || !newElementGroup.trim() || createElement.isPending}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
            <DataGrid
              mode="full"
              columns={elementColumns as any}
              data={elements}
              isLoading={elementsLoading}
              onInlineEdit={async (id: string, columnId: string, value: any) => {
                await updateElement.mutateAsync({ id, data: { [columnId]: value } });
                refreshElements();
              }}
              emptyStateMessage="No data elements in the catalogue."
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-3 max-w-2xl">
            <Input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Category — e.g. Scheme trustees"
              className="flex-1"
            />
            <Button onClick={handleAddSubject} disabled={!newSubjectName.trim() || createSubject.isPending}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
            <DataGrid
              mode="full"
              columns={subjectColumns as any}
              data={subjects}
              isLoading={subjectsLoading}
              onInlineEdit={async (id: string, columnId: string, value: any) => {
                await updateSubject.mutateAsync({ id, data: { [columnId]: value } });
                refreshSubjects();
              }}
              emptyStateMessage="No data subject categories in the catalogue."
            />
          </div>
        </div>
      )}
    </PageShell>
  );
}
