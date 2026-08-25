"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface PreviewRow {
  rowNumber: number;
  name: string;
  match: { vendorId: string; confidence: number; method: string } | null;
  action: 'link' | 'create_custom';
}

/**
 * D40 — import the spreadsheet.
 *
 * Two-phase against `vendors.importCsv`: a preview (commit:false) shows exactly
 * what will be linked to the catalogue and what will become custom vendors,
 * then commit writes it. Errors are per-row and stay visible after commit.
 */
export function ImportVendorsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('vendors');
  const toast = useToast();
  const utils = trpc.useUtils();

  const [csvText, setCsvText] = React.useState('');
  const [preview, setPreview] = React.useState<{
    total: number;
    validCount: number;
    errorCount: number;
    errors: Array<{ rowNumber: number; error: string }>;
    rows: PreviewRow[];
  } | null>(null);
  const [commitResult, setCommitResult] = React.useState<{
    created: number;
    relinked: number;
    skippedExisting: number;
    errorCount: number;
    commitErrors: Array<{ rowNumber: number; error: string }>;
  } | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const importMutation = trpc.vendors.importCsv.useMutation({
    onSuccess: async (result: any) => {
      if (!result.committed) {
        setPreview(result);
        return;
      }
      setCommitResult(result);
      setPreview(null);
      await utils.vendors.getOrgVendors.invalidate();
      await utils.vendors.getRiskStats.invalidate();
      toast(t('import.toast_done', { created: result.created }));
      onClose();
    },
    onError: (err: any) => {
      toast(err.message || t('import.failed'), { tone: 'error' });
    },
  });

  if (!open) return null;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const runPreview = () => importMutation.mutate({ csv: csvText, hasHeader: true, commit: false });
  const runCommit = () => importMutation.mutate({ csv: csvText, hasHeader: true, commit: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="p-8 space-y-6">
          <div>
            <h2 className="text-xl font-serif text-[#F4F5F6]">{t('import.title')}</h2>
            <p className="text-[13px] text-[#9BA1A6] mt-1">{t('import.description')}</p>
          </div>

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
                {csvText && (
                  <span className="mt-3 inline-block text-[12px] text-[#C9A227]">
                    {t('import.file_loaded', { chars: csvText.length })}
                  </span>
                )}
              </label>

              <div className="bg-[#08090A] border border-white/10 rounded-xl p-4 text-[12px] text-[#6E747A] leading-relaxed">
                <p className="font-medium text-[#9BA1A6] mb-1">{t('import.columns_title')}</p>
                {t('import.columns_help')}
              </div>
            </>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-[13px]">
                <span className="inline-flex items-center gap-1.5 text-[#F4F5F6]">
                  <CheckCircle2 className="w-4 h-4 text-[#C9A227]" /> {t('import.valid', { count: preview.validCount })}
                </span>
                {preview.errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="w-4 h-4" /> {t('import.errors', { count: preview.errorCount })}
                  </span>
                )}
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#08090A] text-[#6E747A] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">{t('import.col_name')}</th>
                      <th className="text-left px-3 py-2">{t('import.col_action')}</th>
                      <th className="text-left px-3 py-2">{t('import.col_confidence')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-white/5">
                        <td className="px-3 py-2 text-[#6E747A]">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-[#F4F5F6]">{row.name}</td>
                        <td className="px-3 py-2">
                          {row.action === 'link'
                            ? <span className="text-[#C9A227]">{t('import.action_link')}</span>
                            : <span className="text-[#9BA1A6]">{t('import.action_create')}</span>}
                        </td>
                        <td className="px-3 py-2 text-[#9BA1A6]">
                          {row.match ? `${Math.round(row.match.confidence * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setPreview(null)} className="bg-[#08090A] border-white/10 text-[#9BA1A6]">
                  {t('import.common_back')}
                </Button>
                <Button onClick={runCommit} disabled={importMutation.isPending || preview.validCount === 0}>
                  {importMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Upload className="w-4 h-4 mr-2" />}
                  {t('import.commit', { count: preview.validCount })}
                </Button>
              </div>
            </div>
          )}

          {!preview && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} className="bg-[#08090A] border-white/10 text-[#9BA1A6]">
                {t('import.common_cancel')}
              </Button>
              <Button onClick={runPreview} disabled={!csvText || importMutation.isPending}>
                {t('import.preview')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
