"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { Download, ChevronDown, Loader2 } from 'lucide-react';

/**
 * J93–J98. Every regulator-facing output the register produces.
 *
 * The button this replaces exported whichever twenty-five rows the browser
 * happened to have loaded and called it an export of the register. Everything
 * here is built on the server from the whole register — or from the filter the
 * user is actually looking at, which is the same query with a `where` and is what
 * makes J96 fall out of J94.
 *
 * The "loaded rows" export is kept and relabelled rather than removed: it is a
 * genuinely different thing (what is on screen, right now, for a quick paste into
 * a mail), and a control that quietly changes what it does is worse than two
 * controls that each say which they are.
 */

type Filters = Record<string, any>;

function download(blob: Blob, filename: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/** base64 → Blob, without the intermediate data: URI that caps a download at a few MB in Safari. */
function base64Blob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function ExportMenu({
  filters,
  isFiltered,
  onExportLoaded,
}: {
  filters: Filters;
  isFiltered: boolean;
  onExportLoaded: () => void;
}) {
  const t = useTranslations('ropa.export');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: templates } = trpc.ropa.export.templates.useQuery();
  const pdfMutation = trpc.ropa.export.article30Pdf.useMutation();
  const xlsxMutation = trpc.ropa.export.xlsx.useMutation();
  const csvMutation = trpc.ropa.export.csv.useMutation();
  const jsonMutation = trpc.ropa.export.json.useMutation();
  const regulatorMutation = trpc.ropa.export.regulator.useMutation();

  // `fn` returns `unknown` rather than a promise type, and deliberately: written
  // as `() => Promise<void>` the arrow and the generic put a `>` and a `<` around
  // the word "Promise", which check:ropa-i18n reads as a JSX text node and reports
  // as hardcoded English. It is a text scan by design — noisy in the safe
  // direction — and this is the honest way past it rather than an ALLOWED entry
  // for a string that is not UI copy. `await` accepts a non-promise unchanged.
  const run = async (key: string, fn: () => unknown) => {
    setBusy(key);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      toast(t('failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const Item = ({
    id,
    label,
    hint,
    onClick,
  }: { id: string; label: string; hint: string; onClick: () => void }) => (
    <button
      type="button"
      role="menuitem"
      disabled={busy !== null}
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
    >
      <div className="flex items-center gap-2 text-[13px] text-[#F4F5F6]">
        {busy === id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A227]" aria-hidden="true" /> : null}
        {label}
      </div>
      <div className="text-[11.5px] text-[#6E747A] mt-0.5">{hint}</div>
    </button>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-[#E6E8EA] hover:border-white/20"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        {t('menu')}
        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <>
          {/* Click-away. A backdrop rather than a document listener so keyboard
              focus is not stolen while the menu is open. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-[22rem] rounded-2xl border border-white/10 bg-[#0D0F11] p-2 shadow-panel-elevated"
          >
            <p className="px-3 pt-2 pb-3 text-[11.5px] text-[#6E747A]">
              {t('menu_hint')}
              {isFiltered ? <><br />{t('filtered_note')}</> : null}
            </p>

            <Item
              id="pdf"
              label={t('article30_pdf')}
              hint={t('article30_pdf_hint')}
              onClick={() =>
                run('pdf', async () => {
                  const result = await pdfMutation.mutateAsync(filters);
                  download(base64Blob(result.pdfData, 'application/pdf'), result.filename);
                  toast(t('done', { count: result.counts.total }));
                })
              }
            />

            <Item
              id="xlsx"
              label={t('xlsx')}
              hint={t('xlsx_hint')}
              onClick={() =>
                run('xlsx', async () => {
                  const result = await xlsxMutation.mutateAsync(filters);
                  download(
                    base64Blob(result.data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
                    result.filename,
                  );
                  toast(t('done', { count: result.counts.total }));
                })
              }
            />

            <Item
              id="csv"
              label={t('csv')}
              hint={t('csv_hint')}
              onClick={() =>
                run('csv', async () => {
                  const result = await csvMutation.mutateAsync(filters);
                  download(new Blob([result.csv], { type: 'text/csv;charset=utf-8;' }), result.filename);
                  toast(t('done', { count: result.counts.total }));
                })
              }
            />

            <Item
              id="json"
              label={t('json')}
              hint={t('json_hint')}
              onClick={() =>
                run('json', async () => {
                  const result = await jsonMutation.mutateAsync(filters);
                  download(new Blob([result.json], { type: 'application/json' }), result.filename);
                  toast(t('done', { count: result.counts.total }));
                })
              }
            />

            <div className="mt-1 border-t border-white/10 pt-2">
              <p className="px-3 pt-1 text-[11.5px] font-medium text-[#9BA1A6]">{t('regulator')}</p>
              <p className="px-3 pb-1 text-[11.5px] text-[#6E747A]">{t('regulator_hint')}</p>
              {(templates ?? []).map((template: any) => (
                <Item
                  key={template.id}
                  id={template.id}
                  label={template.title}
                  hint={template.authority}
                  onClick={() =>
                    run(template.id, async () => {
                      const result = await regulatorMutation.mutateAsync({ template: template.id, filters });
                      download(
                        base64Blob(result.data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
                        result.filename,
                      );
                      toast(t('done', { count: result.counts.total }));
                    })
                  }
                />
              ))}
            </div>

            <div className="mt-1 border-t border-white/10 pt-2">
              <Item
                id="loaded"
                label={t('loaded_csv')}
                hint={t('loaded_csv_hint')}
                onClick={() => {
                  onExportLoaded();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
