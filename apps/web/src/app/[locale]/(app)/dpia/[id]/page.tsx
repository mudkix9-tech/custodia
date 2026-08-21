"use client";

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { DpiaEditor } from '@/components/dpia/DpiaEditor';
import { trpc } from '@/utils/trpc';

/**
 * F57. One assessment, in full.
 *
 * `params` is a promise in Next 16 — a sync `{ id: string }` reads as `undefined`
 * at runtime with no type error, which `check:params` exists to catch.
 */
export default function DpiaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('ropa.dpia.module');
  const { id } = use(params);
  const { data, isLoading, error } = trpc.dpia.full.useQuery({ id });

  if (isLoading) return <GenericWorkspaceSkeleton />;

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#F4F5F6] mb-2">{t('not_found')}</h2>
          <p className="text-[#9BA1A6]">{t('not_found_description')}</p>
        </div>
      </div>
    );
  }

  return <DpiaEditor dpiaId={id} />;
}
