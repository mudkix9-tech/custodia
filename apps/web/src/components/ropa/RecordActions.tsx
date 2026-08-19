"use client";

/**
 * B22/B24. Archive, restore, duplicate and delete, from the editor's header.
 *
 * The delete confirmation names what goes with the record rather than asking "are
 * you sure?". "Are you sure" is a speed bump; naming the DPIA it evidences, the
 * client assignments that make it an Article 30(2) record for somebody, and the
 * gaps that cite it is a confirmation — in a compliance tool the thing being
 * deleted is usually load-bearing for something the person deleting it has not
 * thought about.
 */

import React, { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Copy, Archive, ArchiveRestore, Trash2, AlertTriangle, X } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { announce } from '@/components/layout/Announcer';
import { Button } from '@/components/ui/button';

export function RecordActions({ activity, onChanged }: { activity: any; onChanged: () => void }) {
  const t = useTranslations('ropa.actions');
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typed, setTyped] = useState('');

  const isArchived = activity.status === 'archived';

  // Fetched only when the dialog is open: the dependency counts are nine queries,
  // and running them on every editor load to populate a menu nobody has opened
  // would be nine round trips per page view on a 512MB box.
  const { data: deps, isLoading: depsLoading } = trpc.ropa.dependencies.useQuery(
    { id: activity.id },
    { enabled: confirmingDelete },
  );

  const done = (message: string) => {
    utils.ropa.list.invalidate();
    onChanged();
    setOpen(false);
    toast(message);
    announce(message);
  };

  const archive = trpc.ropa.archive.useMutation({
    onSuccess: () => done(t('archived')),
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const restore = trpc.ropa.restore.useMutation({
    onSuccess: () => done(t('restored')),
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const duplicate = trpc.ropa.duplicate.useMutation({
    onSuccess: (copy: any) => {
      utils.ropa.list.invalidate();
      setOpen(false);
      toast(t('duplicated'));
      router.push(`/ropa/${copy.id}`);
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });
  const remove = trpc.ropa.delete.useMutation({
    onSuccess: () => {
      utils.ropa.list.invalidate();
      toast(t('deleted'));
      router.push('/ropa');
    },
    onError: (err) => toast(t('failed'), { tone: 'error', description: err.message }),
  });

  /** The dependency counts worth naming, in the order somebody would worry about them. */
  const dependencyLines = deps
    ? ([
        ['dpia', deps.dpiaLinked ? 1 : 0],
        ['clients', deps.clients],
        ['gaps', deps.gaps],
        ['assessments', deps.assessments],
        ['dataSubjects', deps.dataSubjects],
        ['dataCategories', deps.dataCategories],
        ['recipients', deps.recipients],
        ['transfers', deps.transfers],
        ['tasks', deps.tasks],
        ['comments', deps.comments],
        ['versions', deps.versions],
      ] as const).filter(([, count]) => count > 0)
    : [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('menu')}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-2 text-[13px] text-[#9BA1A6] transition-colors hover:border-white/20 hover:text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Click-away, focusable by nothing: the menu items below carry the
              keyboard path, and Escape closes. */}
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label={t('menu')}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0D0F11] py-1 shadow-panel-elevated"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => duplicate.mutate({ id: activity.id })}
              disabled={duplicate.isPending}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#E6E8EA] transition-colors hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:bg-white/5"
            >
              <Copy className="h-4 w-4" aria-hidden="true" /> {t('duplicate')}
            </button>

            {isArchived ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => restore.mutate({ id: activity.id })}
                disabled={restore.isPending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#E6E8EA] transition-colors hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:bg-white/5"
              >
                <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> {t('restore')}
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => archive.mutate({ id: activity.id })}
                disabled={archive.isPending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#E6E8EA] transition-colors hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:bg-white/5"
              >
                <Archive className="h-4 w-4" aria-hidden="true" /> {t('archive')}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setConfirmingDelete(true); }}
              className="flex w-full items-center gap-2 border-t border-white/5 px-3 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-red-500/10 focus:outline-none focus-visible:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('delete')}
            </button>
          </div>
        </>
      )}

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ropa-delete-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setConfirmingDelete(false); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F11] shadow-panel-elevated">
            <div className="flex items-start gap-4 p-6">
              <div className="shrink-0 rounded-full bg-red-500/10 p-2.5 text-red-400">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 id="ropa-delete-title" className="mb-2 text-lg font-semibold leading-none text-[#F4F5F6]">
                    {t('delete_title', { name: activity.name })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    aria-label={t('close')}
                    className="text-[#6E747A] transition-colors hover:text-[#F4F5F6]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-sm leading-snug text-[#9BA1A6]">{t('delete_body')}</p>

                {depsLoading && <p className="mt-3 text-[12.5px] text-[#6E747A]">{t('checking')}</p>}

                {deps && dependencyLines.length > 0 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#08090A] p-3">
                    <p className="mb-2 text-[12px] uppercase tracking-[0.12em] text-[#6E747A]">{t('depends')}</p>
                    <ul className="space-y-1 text-[12.5px] text-[#9BA1A6]">
                      {dependencyLines.map(([key, count]) => (
                        <li key={key}>{t(`deps.${key}`, { count })}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {deps && dependencyLines.length === 0 && (
                  <p className="mt-3 text-[12.5px] text-[#6E747A]">{t('no_dependencies')}</p>
                )}

                {/* Archiving keeps the record and its evidence; deleting is what
                    people reach for when they mean archive. Offered here, at the
                    moment the choice is actually being made. */}
                {!isArchived && (
                  <p className="mt-3 text-[12.5px] text-[#6E747A]">{t('consider_archive')}</p>
                )}

                <div className="mt-4">
                  <label htmlFor="ropa-delete-confirm" className="mb-1 block text-sm font-medium text-[#F4F5F6]">
                    {t('type_to_confirm', { word: t('delete_word') })}
                  </label>
                  <input
                    id="ropa-delete-confirm"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    className="w-full rounded-lg border border-white/12 bg-[#0A0B0D] px-3 py-2 text-sm text-[#F4F5F6] focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    placeholder={t('delete_word')}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-[#08090A] px-6 py-4">
              <Button variant="ghost" onClick={() => { setConfirmingDelete(false); setTyped(''); }}>
                {t('cancel')}
              </Button>
              {!isArchived && (
                <Button
                  variant="outline"
                  onClick={() => { setConfirmingDelete(false); setTyped(''); archive.mutate({ id: activity.id }); }}
                  className="flex items-center gap-1.5"
                >
                  <Archive className="h-4 w-4" /> {t('archive_instead')}
                </Button>
              )}
              <button
                type="button"
                disabled={typed !== t('delete_word') || remove.isPending}
                onClick={() => remove.mutate({ id: activity.id })}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-[#F4F5F6] transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
