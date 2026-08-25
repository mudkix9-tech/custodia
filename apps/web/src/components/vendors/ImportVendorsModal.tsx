"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';

interface PreviewRow {
  rowNumber: number;
  name: string;
  website: string | null;
  headquartersCountry: string | null;
  criticality: string | null;
  dataCategoriesShared: string[];
  warnings: string[];
  match: { vendorId: string; confidence: number; method: string } | null;
  nearMiss: { vendorId: string; confidence: number; name: string } | null;
  action: 'link' | 'create_custom' | 'already_linked';
}

interface PreviewResult {
  total: number;
  validCount: number;
  netAdditions: number;
  errorCount: number;
  ignoredColumns: string[];
  errors: Array<{ rowNumber: number; error: string }>;
  rows: PreviewRow[];
}

interface CommitResult {
  created: number;
  relinked: number;
  skippedExisting: number;
  errorCount: number;
  ignoredColumns: string[];
  errors: Array<{ rowNumber: number; error: string }>;
}

/**
 * The browser's own cap, matched to the tRPC input's `.max()`.
 *
 * Checked here as well as on the server so the message names the file the user
 * just chose. Before the API's body limit was raised this failed in the HTTP
 * layer as `FST_ERR_CTP_BODY_TOO_LARGE`, which reads as a broken importer.
 */
const MAX_CSV_BYTES = 600_000;

/**
 * D40 — import the spreadsheet.
 *
 * Two-phase against `vendors.importCsv`: a preview (`commit: false`) shows what
 * will be linked, what will become a custom vendor, what is already in the
 * register and which of the file's columns were not recognised at all; then
 * commit writes it in one transaction.
 *
 * The commit summary is a *screen*, not a toast. The first version stored the
 * result and immediately called `onClose()`, with no branch that rendered it —
 * so the per-row failures the server carefully returned were dropped on the
 * floor and 260 of 300 rows importing looked identical to all 300 importing.
 */
export function ImportVendorsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('vendors');
  const toast = useToast();
  const utils = trpc.useUtils();

  const [csvText, setCsvText] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = React.useState<CommitResult | null>(null);

  const reset = React.useCallback(() => {
    setCsvText('');
    setFileName('');
    setFileError(null);
    setPreview(null);
    setCommitResult(null);
  }, []);

  // Reopening the modal used to show the previous run's state: `commitResult`
  // was truthy, so the dropzone did not render and the dialog opened empty with
  // a single dead button.
  const close = () => {
    reset();
    onClose();
  };

  const importMutation = trpc.vendors.importCsv.useMutation({
    onSuccess: async (result: any) => {
      if (!result.committed) {
        setPreview(result as PreviewResult);
        return;
      }
      setCommitResult(result as CommitResult);
      setPreview(null);
      await utils.vendors.getOrgVendors.invalidate();
      await utils.vendors.getRiskStats.invalidate();
      toast(t('import.toast_done', { created: result.created + result.relinked }));
    },
  });

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Escape closes, and focus moves into the dialog when it opens.
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleFile = (file: File) => {
    setFileError(null);
    if (file.size > MAX_CSV_BYTES) {
      setFileError(t('import.too_large', { limit: Math.floor(MAX_CSV_BYTES / 1000) }));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError(t('import.read_failed'));
    reader.onload = () => {
      const text = String(reader.result ?? '');
      // A UTF-8 read of a Windows-1252 file turns every accented vendor name
      // into a replacement character, and Excel still writes 1252 by default on
      // an English Windows install. One retry in that encoding is cheap and
      // catches almost all of it.
      if (text.includes('�')) {
        const retry = new FileReader();
        retry.onload = () => setCsvText(String(retry.result ?? text));
        retry.onerror = () => setCsvText(text);
        retry.readAsText(file, 'windows-1252');
      } else {
        setCsvText(text);
      }
      setFileName(file.name);
    };
    reader.readAsText(file, 'utf-8');
  };

  const runPreview = () => importMutation.mutate({ csv: csvText, hasHeader: true, commit: false });
  const runCommit = () => importMutation.mutate({ csv: csvText, hasHeader: true, commit: true });

  const actionLabel = (action: PreviewRow['action']) => {
    if (action === 'link') return <span className="text-[#C9A227]">{t('import.action_link')}</span>;
    if (action === 'already_linked') return <span className="text-[#6E747A]">{t('import.action_existing')}</span>;
    return <span className="text-[#9BA1A6]">{t('import.action_create')}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('import.title')}>
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated w-full max-w-3xl max-h-[85vh] overflow-y-auto focus:outline-none"
      >
        <div className="p-8 space-y-6">
          <div>
            <h2 className="text-xl font-serif text-[#F4F5F6]">{t('import.title')}</h2>
            <p className="text-[13px] text-[#9BA1A6] mt-1">{t('import.description')}</p>
          </div>

          {/* ---- 1. choose a file -------------------------------------------- */}
          {!preview && !commitResult && (
            <>
              <label className="block bg-[#08090A] rounded-xl border border-dashed border-white/20 p-10 text-center cursor-pointer hover:border-[#C9A227]/40 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-[#C9A227] mx-auto mb-3" />
                <span className="text-[14px] font-medium text-[#F4F5F6] block mb-1">{t('import.choose_file')}</span>
                <span className="text-[12px] text-[#6E747A]">{t('import.choose_file_hint')}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                {fileName && (
                  <span className="mt-3 block text-[12px] text-[#C9A227]">{fileName}</span>
                )}
              </label>

              {fileError && (
                <p className="text-[12px] text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {fileError}
                </p>
              )}

              <div className="bg-[#08090A] border border-white/10 rounded-xl p-4 text-[12px] text-[#6E747A] leading-relaxed">
                <p className="font-medium text-[#9BA1A6] mb-1">{t('import.columns_title')}</p>
                {t('import.columns_help')}
              </div>
            </>
          )}

          {/* ---- 2. preview --------------------------------------------------- */}
          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-[#F4F5F6]">
                  <CheckCircle2 className="w-4 h-4 text-[#C9A227]" /> {t('import.valid', { count: preview.validCount })}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#9BA1A6]">
                  {t('import.net_additions', { count: preview.netAdditions })}
                </span>
                {preview.errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="w-4 h-4" /> {t('import.errors', { count: preview.errorCount })}
                  </span>
                )}
              </div>

              {/* A column the importer did not understand is silently absent from
                  the register otherwise, which leaves it looking complete. */}
              {preview.ignoredColumns.length > 0 && (
                <div className="bg-[#08090A] border border-white/10 rounded-xl p-3 text-[12px] text-[#9BA1A6] flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#6E747A]" />
                  <span>{t('import.ignored_columns', { columns: preview.ignoredColumns.join(', ') })}</span>
                </div>
              )}

              <div className="border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-[#08090A] text-[#6E747A] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">{t('import.col_name')}</th>
                        <th className="text-left px-3 py-2">{t('import.col_country')}</th>
                        <th className="text-left px-3 py-2">{t('import.col_action')}</th>
                        <th className="text-left px-3 py-2">{t('import.col_confidence')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber} className="border-t border-white/5 align-top">
                          <td className="px-3 py-2 text-[#6E747A]">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-[#F4F5F6]">
                            {row.name}
                            {row.warnings.map((warning) => (
                              <span key={warning} className="block text-[11px] text-amber-300/80 mt-0.5">{warning}</span>
                            ))}
                            {/* A near-miss is exactly what a person should
                                adjudicate, so it is shown rather than discarded. */}
                            {row.nearMiss && (
                              <span className="block text-[11px] text-[#6E747A] mt-0.5">
                                {t('import.near_miss', {
                                  name: row.nearMiss.name,
                                  confidence: Math.round(row.nearMiss.confidence * 100),
                                })}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#9BA1A6]">{row.headquartersCountry ?? '—'}</td>
                          <td className="px-3 py-2">{actionLabel(row.action)}</td>
                          <td className="px-3 py-2 text-[#9BA1A6]">
                            {row.match ? `${Math.round(row.match.confidence * 100)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.errors.length > 0 && (
                  <div className="border-t border-white/10 bg-[#08090A] p-3 space-y-1">
                    {preview.errors.map((error) => (
                      <p key={error.rowNumber} className="text-[11px] text-red-400">
                        {t('import.row_error', { row: error.rowNumber })} {error.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-[#6E747A]">{t('import.transaction_note')}</p>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setPreview(null)} className="bg-[#08090A] border-white/10 text-[#9BA1A6]">
                  {t('import.common_back')}
                </Button>
                <Button onClick={runCommit} disabled={importMutation.isPending || preview.netAdditions === 0}>
                  {importMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Upload className="w-4 h-4 mr-2" />}
                  {t('import.commit', { count: preview.netAdditions })}
                </Button>
              </div>
            </div>
          )}

          {/* ---- 3. what actually happened ------------------------------------ */}
          {commitResult && (
            <div className="space-y-4">
              <div className="bg-[#08090A] border border-white/10 rounded-xl p-5 space-y-2">
                <p className="text-[14px] text-[#F4F5F6] font-medium">{t('import.done_title')}</p>
                <ul className="text-[13px] text-[#9BA1A6] space-y-1">
                  <li>{t('import.done_created', { count: commitResult.created })}</li>
                  <li>{t('import.done_linked', { count: commitResult.relinked })}</li>
                  {commitResult.skippedExisting > 0 && (
                    <li>{t('import.done_skipped', { count: commitResult.skippedExisting })}</li>
                  )}
                </ul>
              </div>

              {commitResult.ignoredColumns.length > 0 && (
                <div className="bg-[#08090A] border border-white/10 rounded-xl p-3 text-[12px] text-[#9BA1A6] flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#6E747A]" />
                  <span>{t('import.ignored_columns', { columns: commitResult.ignoredColumns.join(', ') })}</span>
                </div>
              )}

              {commitResult.errors.length > 0 && (
                <div className="border border-red-400/30 bg-red-500/5 rounded-xl p-4 space-y-1">
                  <p className="text-[12px] text-red-300 font-medium mb-1">
                    {t('import.skipped_rows', { count: commitResult.errors.length })}
                  </p>
                  {commitResult.errors.map((error) => (
                    <p key={error.rowNumber} className="text-[11px] text-red-400">
                      {t('import.row_error', { row: error.rowNumber })} {error.error}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={reset} className="bg-[#08090A] border-white/10 text-[#9BA1A6]">
                  {t('import.import_another')}
                </Button>
                <Button onClick={close}>{t('import.done_close')}</Button>
              </div>
            </div>
          )}

          {importMutation.error && (
            <p className="text-[12px] text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {importMutation.error.message}
            </p>
          )}

          {!preview && !commitResult && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={close} className="bg-[#08090A] border-white/10 text-[#9BA1A6]">
                {t('import.common_cancel')}
              </Button>
              <Button onClick={runPreview} disabled={!csvText || importMutation.isPending}>
                {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('import.preview')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
