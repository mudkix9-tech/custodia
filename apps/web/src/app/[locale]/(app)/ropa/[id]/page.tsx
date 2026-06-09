"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { use } from 'react';
import { RopaEditor } from '@/components/ropa/RopaEditor';
import { trpc } from '@/utils/trpc';

export default function EditRopaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = trpc.ropa.get.useQuery({ id });

  if (isLoading) {
    return <GenericWorkspaceSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex-1 min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Activity not found</h2>
          <p className="text-slate-400">The requested processing activity could not be loaded.</p>
        </div>
      </div>
    );
  }

  return <RopaEditor initialData={data} />;
}
