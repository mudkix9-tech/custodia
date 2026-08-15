"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { use } from 'react';
import { RopaEditor } from '@/components/ropa/RopaEditor';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';

export default function EditRopaPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('ropa');
  const { id } = use(params);
  const { data, isLoading, error } = trpc.ropa.get.useQuery({ id });

  if (isLoading) {
    return <GenericWorkspaceSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex-1 min-h-screen bg-[#08090A] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#F4F5F6] mb-2">{t('editor.not_found')}</h2>
          <p className="text-[#9BA1A6]">{t('editor.not_found_description')}</p>
        </div>
      </div>
    );
  }

  return <RopaEditor initialData={data} />;
}
