"use client";

import { use } from 'react';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { FullRecordView } from '@/components/ropa/FullRecordView';

/**
 * Q132 — the single-page, read-only, print-ready view of one activity.
 *
 * Nine tabs is how you enter a record. It is not how you review one, and it is not
 * how you show one to a lawyer or a supervisory authority: nobody reads a record by
 * clicking through nine screens and holding the first eight in their head.
 */
export default function RopaRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('ropa');
  const { id } = use(params);
  const { data, isLoading, error } = trpc.ropa.get.useQuery({ id });

  if (isLoading) {
    return <GenericWorkspaceSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#F4F5F6] mb-2">{t('editor.not_found')}</h2>
          <p className="text-[#9BA1A6]">{t('editor.not_found_description')}</p>
        </div>
      </div>
    );
  }

  return <FullRecordView activity={data} />;
}
