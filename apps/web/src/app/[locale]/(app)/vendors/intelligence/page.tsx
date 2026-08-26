'use client';

/**
 * Vendor intelligence — review console (audit P-3b).
 *
 * The admin surface for what the pipeline produces: "side-by-side current
 * versus candidate, per-field accept/reject, evidence inline, bulk-approve
 * above a threshold". Approving writes the catalogue row and the per-field
 * provenance (P-2); rejecting only flips status.
 */
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { CandidateRow } from '@/components/vendors/CandidateRow';
import { RunLog } from '@/components/vendors/RunLog';
import { ImportJsonForm } from '@/components/vendors/ImportJsonForm';
import { useToast } from '@/components/ui/Toast';

export default function VendorIntelligencePage() {
  const t = useTranslations('vendors');
  const toast = useToast();
  const utils = trpc.useUtils();
  const [limit, setLimit] = useState(50);

  const candidates = trpc.vendorIntelligence.listCandidates.useQuery({
    status: 'pending',
    limit,
  });

  const bulkApprove = trpc.vendorIntelligence.bulkApprove.useMutation({
    onSuccess: (res) => {
      void utils.vendorIntelligence.listCandidates.invalidate();
      toast(t('intelligence.bulk_done', { count: res.approvedCount }), { tone: 'success' });
    },
    onError: () => toast(t('intelligence.bulk_error'), { tone: 'error' }),
  });

  return (
    <PageShell>
      <PageHeader title={t('intelligence.title')} description={t('intelligence.subtitle')} />
      <div className="space-y-8">
        <RunLog />
        <CandidateSection
          candidates={candidates.data ?? []}
          limit={limit}
          isLoading={candidates.isFetching}
          onLoadMore={() => setLimit((prev) => prev + 50)}
        />

        <section className="rounded-2xl border border-white/10 bg-[#0D0F11] p-6">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-[#F4F5F6]">{t('intelligence.import_title')}</h2>
            <button
              type="button"
              onClick={() => bulkApprove.mutate({ minConfidence: 70, limit: 25 })}
              disabled={bulkApprove.isPending || (candidates.data?.length ?? 0) === 0}
              className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#08090A] disabled:opacity-50"
            >
              {bulkApprove.isPending ? t('intelligence.approving') : t('intelligence.bulk_approve')}
            </button>
          </header>
          <ImportJsonForm />
        </section>
      </div>
    </PageShell>
  );
}

function CandidateSection({
  candidates,
  limit,
  isLoading,
  onLoadMore,
}: {
  candidates: Array<Record<string, unknown>>;
  limit: number;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations('vendors');
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0D0F11] p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-[#F4F5F6]">{t('intelligence.pending_title')}</h2>
        <span className="text-xs text-[#9BA1A6]">
          {t('intelligence.pending_count', { count: candidates.length })}
        </span>
      </header>
      {candidates.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#9BA1A6]">{t('intelligence.empty_pending')}</p>
      ) : (
        <>
          <ul className="divide-y divide-white/5">
            {candidates.map((c) => (
              <li key={String(c.id)} className="py-3">
                <CandidateRow candidate={c as never} />
              </li>
            ))}
          </ul>
          {candidates.length >= limit && (
            <div className="mt-4 flex justify-center border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoading}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-[#9BA1A6] hover:bg-white/5 disabled:opacity-50"
              >
                {t('history.load_more')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
