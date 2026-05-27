"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { use } from 'react';
import { trpc } from '@/utils/trpc';
import { GraduationCap, ArrowLeft, CheckCircle2, PlayCircle, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: completions, isLoading } = trpc.training.myModules.useQuery();
  const utils = trpc.useUtils();
  const markComplete = trpc.training.startModule.useMutation({
    onMutate: async ({ completionId }) => {
      await utils.training.myModules.cancel();
      const previous = utils.training.myModules.getData();
      if (previous) {
        utils.training.myModules.setData(undefined, [...previous, { moduleId: id, completedAt: new Date().toISOString() } as any]);
      }
      return { previous };
    },
    onError: (err, newUpdate, context) => {
      if (context?.previous) {
        utils.training.myModules.setData(undefined, context.previous);
      }
    },
    onSuccess: () => {
      router.push('/training');
    },
    onSettled: () => {
      utils.training.myModules.invalidate();
    }
  });

  if (isLoading) {
    return <GenericWorkspaceSkeleton />;
  }

  // Mock data for the actual module content
  const moduleData = {
    id,
    title: 'Data Privacy Fundamentals',
    description: 'Learn the core principles of data protection and privacy regulations.',
    videoUrl: 'https://example.com/video.mp4',
    content: `
      <h2>1. Introduction to Data Privacy</h2>
      <p>Data privacy is about giving people control over how their personal information is collected and used.</p>

      <h2>2. Key Principles</h2>
      <ul>
        <li><strong>Lawfulness, fairness and transparency:</strong> Process data legally and openly.</li>
        <li><strong>Purpose limitation:</strong> Use data only for the reason it was collected.</li>
        <li><strong>Data minimisation:</strong> Collect only what is strictly necessary.</li>
      </ul>
    `
  };

  const isCompleted = completions?.some(c => c.moduleId === id);

  return (
    <div className="min-h-screen bg-bone-50">
      <div className="bg-white border-b border-ink-900/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/training" className="p-2 -ml-2 rounded-lg hover:bg-bone-100 text-ink-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sage-600 mb-1">
                <GraduationCap className="w-3.5 h-3.5" />
                Training Module
              </div>
              <h1 className="text-lg font-bold text-ink-900 leading-tight">{moduleData.title}</h1>
            </div>
          </div>
          {isCompleted ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-sage-50 text-sage-700 rounded-lg text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Completed
            </div>
          ) : (
            <button
              onClick={() => markComplete.mutate({ completionId: id })}
              className="btn-primary"
            >
              Mark as Complete
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-ink-900 rounded-2xl aspect-video mb-8 flex items-center justify-center relative group cursor-pointer overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
          <PlayCircle className="w-16 h-16 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all z-10" />
        </div>

        <div className="bg-white rounded-2xl border border-ink-900/10 p-8 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-500 uppercase tracking-wider mb-6">
            <FileText className="w-4 h-4" />
            Reading Material
          </div>
          
          <div
            className="prose prose-sm md:prose-base prose-sage max-w-none text-ink-700"
            dangerouslySetInnerHTML={{ __html: moduleData.content }}
          />
        </div>
      </div>
    </div>
  );
}
