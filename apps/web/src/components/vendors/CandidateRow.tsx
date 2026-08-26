'use client';

/**
 * One row of the pending-candidates list.
 *
 * Shows the candidate's name and website, the per-field confidence bar, and
 * two actions: approve (writes the catalogue row + provenance) and reject
 * (flips status). Approving a record bulk-approves it as far as the user
 * cares: confidence is the per-field signal, not a single number to debate.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { ConfidenceBar } from './ConfidenceBar';

interface Candidate {
  id: string;
  name: string;
  domain: string;
  category: string | null;
  confidence: number;
  payload: Record<string, unknown> | null;
  probeResults: Record<string, unknown> | null;
  grounding: unknown;
}

export function CandidateRow({ candidate }: { candidate: Candidate }) {
  const t = useTranslations('vendors');
  const [expanded, setExpanded] = useState(false);

  const utils = trpc.useUtils();
  const approve = trpc.vendorIntelligence.approveCandidate.useMutation({
    onSuccess: () => utils.vendorIntelligence.listCandidates.invalidate(),
  });
  const reject = trpc.vendorIntelligence.rejectCandidate.useMutation({
    onSuccess: () => utils.vendorIntelligence.listCandidates.invalidate(),
  });

  const urlFields = ['dpaUrl', 'privacyPolicyUrl', 'subProcessorListUrl'] as const;
  const record = (candidate.payload ?? {}) as Record<string, unknown>;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-[#F4F5F6]">{candidate.name}</h3>
          <p className="truncate text-xs text-[#9BA1A6]">
            {candidate.domain}
            {candidate.category ? ` · ${candidate.category}` : ''}
          </p>
        </div>
        <ConfidenceBar value={candidate.confidence} />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-[#9BA1A6] hover:bg-white/5"
          >
            {expanded ? t('intelligence.hide_detail') : t('intelligence.show_detail')}
          </button>
          <button
            type="button"
            disabled={approve.isPending || reject.isPending}
            onClick={() => reject.mutate({ id: candidate.id })}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-[#9BA1A6] hover:bg-white/5"
          >
            {t('intelligence.reject')}
          </button>
          <button
            type="button"
            disabled={approve.isPending || reject.isPending}
            onClick={() => approve.mutate({ id: candidate.id })}
            className="rounded-xl bg-[#C9A227] px-3 py-1.5 text-xs font-medium text-[#08090A] hover:bg-[#C9A227]/90 disabled:opacity-50"
          >
            {t('intelligence.approve')}
          </button>
        </div>
      </div>
      {expanded && (
        <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-[#08090A] p-3 text-xs sm:grid-cols-2">
          {urlFields.map((field) => {
            const value = record[field];
            return (
              <div key={field}>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-[#6E747A]">{field}</dt>
                <dd className="truncate text-[#9BA1A6]">{value ? String(value) : '—'}</dd>
              </div>
            );
          })}
          {record.headquartersCountry ? (
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-[#6E747A]">
                {t('intelligence.field_country')}
              </dt>
              <dd className="text-[#9BA1A6]">{String(record.headquartersCountry)}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}
