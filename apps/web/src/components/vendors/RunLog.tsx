'use client';

import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';

const KIND_LABELS: Record<string, string> = {
  enrich_batch: 'enrich_batch',
  reverify: 'reverify',
  dpf_import: 'dpf_import',
};

const STATUS_TONES: Record<string, string> = {
  pending: 'text-[#9BA1A6]',
  running: 'text-[#C9A227]',
  completed: 'text-[#F4F5F6]',
  failed: 'text-red-400',
};

export function RunLog() {
  const t = useTranslations('vendors');
  const runs = trpc.vendorIntelligence.listRuns.useQuery({ limit: 10 });

  if (runs.isLoading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#0D0F11] p-6">
        <p className="text-sm text-[#9BA1A6]">{t('intelligence.runs_loading')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0D0F11] p-6">
      <h2 className="mb-4 text-lg font-medium text-[#F4F5F6]">{t('intelligence.runs_title')}</h2>
      {runs.data?.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#9BA1A6]">{t('intelligence.runs_empty')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-[#6E747A]">
              <th className="py-2 pr-4 font-normal">{t('intelligence.runs_col_kind')}</th>
              <th className="py-2 pr-4 font-normal">{t('intelligence.runs_col_status')}</th>
              <th className="py-2 pr-4 font-normal">{t('intelligence.runs_col_progress')}</th>
              <th className="py-2 font-normal">{t('intelligence.runs_col_started')}</th>
            </tr>
          </thead>
          <tbody>
            {runs.data?.map((run) => (
              <tr key={run.id} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-4 font-mono text-xs text-[#9BA1A6]">
                  {KIND_LABELS[run.kind] ?? run.kind}
                </td>
                <td className={`py-2 pr-4 font-mono text-xs ${STATUS_TONES[run.status] ?? 'text-[#9BA1A6]'}`}>
                  {run.status}
                </td>
                <td className="py-2 pr-4 text-[#F4F5F6]">
                  {run.processed}/{(run.targets ?? []).length}
                  {run.failed > 0 ? ` · ${run.failed} failed` : ''}
                </td>
                <td className="py-2 text-xs text-[#9BA1A6]">
                  {new Date(run.startedAt).toISOString().slice(0, 19).replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
