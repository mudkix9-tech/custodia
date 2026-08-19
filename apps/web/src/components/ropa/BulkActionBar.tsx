"use client";

/**
 * L107/L108. What a selection can be made to do.
 *
 * The bar appears when anything is selected and says two things the removed
 * `enableBulkActions` checkbox never did: how many rows are selected, and whether
 * that is the page or the filter. "Select all 340 matching" is a separate,
 * explicit action for exactly that reason — a control whose meaning depends on how
 * far you have scrolled is a control that eventually does the wrong thing quietly.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Users, Archive, Trash2, Tag, CalendarClock, Download, ListChecks } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { announce } from '@/components/layout/Announcer';
import { toCsvRow } from '@/utils/csv';
import { normaliseLawfulBasis } from '@/utils/ropaFormat';

type Panel = 'owner' | 'status' | 'review' | 'tags' | null;

export function BulkActionBar({ selectedIds, onClear, orgMembers, onDone }: {
  selectedIds: string[];
  onClear: () => void;
  orgMembers: { id: string; name?: string | null; email: string }[];
  onDone: () => void;
}) {
  const t = useTranslations('ropa');
  const toast = useToast();
  const utils = trpc.useUtils();
  const { confirm, dialog } = useConfirm();

  const [panel, setPanel] = useState<Panel>(null);
  const [ownerId, setOwnerId] = useState('');
  const [ownerRole, setOwnerRole] = useState<'businessOwnerId' | 'privacyOwnerId'>('privacyOwnerId');
  const [status, setStatus] = useState<'draft' | 'under_review'>('under_review');
  const [reviewDate, setReviewDate] = useState('');
  const [tagText, setTagText] = useState('');
  const [tagMode, setTagMode] = useState<'add' | 'remove'>('add');

  const finish = (message: string) => {
    utils.ropa.list.invalidate();
    utils.ropa.tags.invalidate();
    utils.ropa.review.summary.invalidate();
    setPanel(null);
    onDone();
    toast(message);
    announce(message);
  };

  const bulkUpdate = trpc.ropa.bulk.update.useMutation({
    onSuccess: (res) => finish(t('bulk.updated', { count: res.updated })),
    onError: (err) => toast(t('bulk.failed'), { tone: 'error', description: err.message }),
  });
  const bulkArchive = trpc.ropa.bulk.archive.useMutation({
    onSuccess: (res) => finish(t('bulk.archived', { count: res.archived })),
    onError: (err) => toast(t('bulk.failed'), { tone: 'error', description: err.message }),
  });
  const bulkDelete = trpc.ropa.bulk.delete.useMutation({
    onSuccess: (res) => finish(t('bulk.deleted', { count: res.deleted })),
    onError: (err) => toast(t('bulk.failed'), { tone: 'error', description: err.message }),
  });

  // L107. Exported from the server for the selected ids rather than from whatever
  // the page has loaded — the register's own CSV button exports what is on screen
  // no matter what the user has selected.
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const rows = await utils.ropa.bulk.export.fetch({ ids: selectedIds });
      const headers = ['Name', 'Purpose', 'Lawful Basis', 'Role', 'Controller', 'Status', 'Risk Level', 'Completeness', 'Tags', 'Description'];
      const csv = [
        toCsvRow(headers),
        ...rows.map((a: any) => toCsvRow([
          a.name, a.purpose, normaliseLawfulBasis(a.lawfulBasis), a.role || 'controller', a.controllerName || '',
          a.status, a.riskLevel || 'low', String(a.completenessScore ?? ''),
          Array.isArray(a.tags) ? a.tags.join(' ') : '', a.description || '',
        ])),
      ].join('\r\n');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      link.setAttribute('download', `ropa_selection_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      announce(t('bulk.exported', { count: rows.length }));
    } catch (err) {
      toast(t('bulk.failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async () => {
    const ok = await confirm({
      title: t('bulk.confirm_archive_title', { count: selectedIds.length }),
      description: t('bulk.confirm_archive_body'),
      confirmText: t('bulk.archive'),
    });
    if (ok) bulkArchive.mutate({ ids: selectedIds });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('bulk.confirm_delete_title', { count: selectedIds.length }),
      description: t('bulk.confirm_delete_body'),
      confirmText: t('bulk.delete'),
      variant: 'destructive',
      requireTyping: String(selectedIds.length),
    });
    if (ok) bulkDelete.mutate({ ids: selectedIds });
  };

  const busy = bulkUpdate.isPending || bulkArchive.isPending || bulkDelete.isPending;

  const action = 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0D0F11] px-2.5 py-1.5 text-[12.5px] text-[#E6E8EA] transition-colors hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60';

  return (
    <div className="space-y-3 rounded-2xl border border-[#C9A227]/25 bg-[#C9A227]/[0.06] p-3">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 pr-2 text-[13px] font-medium text-[#C9A227]">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {t('bulk.selected', { count: selectedIds.length })}
        </span>

        <button type="button" className={action} disabled={busy} onClick={() => setPanel(panel === 'owner' ? null : 'owner')} aria-expanded={panel === 'owner'}>
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t('bulk.assign_owner')}
        </button>
        <button type="button" className={action} disabled={busy} onClick={() => setPanel(panel === 'status' ? null : 'status')} aria-expanded={panel === 'status'}>
          {t('bulk.set_status')}
        </button>
        <button type="button" className={action} disabled={busy} onClick={() => setPanel(panel === 'review' ? null : 'review')} aria-expanded={panel === 'review'}>
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> {t('bulk.set_review')}
        </button>
        <button type="button" className={action} disabled={busy} onClick={() => setPanel(panel === 'tags' ? null : 'tags')} aria-expanded={panel === 'tags'}>
          <Tag className="h-3.5 w-3.5" aria-hidden="true" /> {t('bulk.tags')}
        </button>
        <button type="button" className={action} disabled={busy || isExporting} onClick={handleExport}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> {isExporting ? t('generating') : t('bulk.export')}
        </button>
        <button type="button" className={action} disabled={busy} onClick={handleArchive}>
          <Archive className="h-3.5 w-3.5" aria-hidden="true" /> {t('bulk.archive')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-[12.5px] text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('bulk.delete')}
        </button>

        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-[#6E747A] transition-colors hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> {t('bulk.clear')}
        </button>
      </div>

      {panel === 'owner' && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            bulkUpdate.mutate({ ids: selectedIds, set: { [ownerRole]: ownerId || null } as any });
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="bulk-owner-role" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('bulk.owner_kind')}</label>
            <select id="bulk-owner-role" value={ownerRole} onChange={(e) => setOwnerRole(e.target.value as any)}
              className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40">
              <option value="privacyOwnerId">{t('editor.general.privacy_owner')}</option>
              <option value="businessOwnerId">{t('editor.general.business_owner')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bulk-owner" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('filters.owner')}</label>
            <select id="bulk-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40">
              <option value="">{t('editor.general.owner_unassigned')}</option>
              {orgMembers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-[12.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:opacity-50">
            {t('bulk.apply')}
          </button>
        </form>
      )}

      {panel === 'status' && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-3"
          onSubmit={(e) => { e.preventDefault(); bulkUpdate.mutate({ ids: selectedIds, set: { status } }); }}
        >
          <div className="space-y-1.5">
            <label htmlFor="bulk-status" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('filters.status')}</label>
            <select id="bulk-status" value={status} onChange={(e) => setStatus(e.target.value as any)}
              className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40">
              <option value="draft">{t('status_types.draft')}</option>
              <option value="under_review">{t('status_types.under_review')}</option>
            </select>
          </div>
          {/* 'active' is deliberately absent: publication runs through the Art. 30
              gate one record at a time. Said here rather than left as a missing
              option somebody assumes is a bug. */}
          <p className="max-w-sm text-[12px] text-[#6E747A]">{t('bulk.no_bulk_publish')}</p>
          <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-[12.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:opacity-50">
            {t('bulk.apply')}
          </button>
        </form>
      )}

      {panel === 'review' && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            bulkUpdate.mutate({ ids: selectedIds, set: { nextReviewAt: reviewDate ? new Date(reviewDate) : null } });
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="bulk-review" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('bulk.next_review')}</label>
            <input id="bulk-review" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40" />
          </div>
          <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-[12.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:opacity-50">
            {t('bulk.apply')}
          </button>
        </form>
      )}

      {panel === 'tags' && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const tags = tagText.split(',').map((s) => s.trim()).filter(Boolean);
            if (tags.length === 0) return;
            bulkUpdate.mutate({ ids: selectedIds, set: tagMode === 'add' ? { addTags: tags } : { removeTags: tags } });
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="bulk-tag-mode" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('bulk.tag_mode')}</label>
            <select id="bulk-tag-mode" value={tagMode} onChange={(e) => setTagMode(e.target.value as any)}
              className="rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40">
              <option value="add">{t('bulk.tag_add')}</option>
              <option value="remove">{t('bulk.tag_remove')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bulk-tags" className="block text-[11px] uppercase tracking-[0.12em] text-[#6E747A]">{t('filters.tags')}</label>
            <input id="bulk-tags" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder={t('bulk.tags_ph')}
              className="w-64 rounded-lg border border-white/10 bg-[#08090A] px-2.5 py-1.5 text-[12.5px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40" />
          </div>
          <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-[12.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:opacity-50">
            {t('bulk.apply')}
          </button>
        </form>
      )}
    </div>
  );
}
