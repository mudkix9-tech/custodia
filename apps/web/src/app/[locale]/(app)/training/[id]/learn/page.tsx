"use client";

import React, { use } from 'react';
import { useTranslations } from 'next-intl';
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';
import { trpc } from '@/utils/trpc';
import { GraduationCap, ArrowLeft, CheckCircle2, XCircle, FileText, Clock } from 'lucide-react';
import Link from 'next/link';

/**
 * A slide from `training_modules.content`, which is jsonb rather than a typed
 * column — the seed in `defaultTrainingModules.ts` is the reference shape.
 */
type Slide = {
  id: string;
  type?: 'text' | 'key_point' | string;
  title?: string;
  content?: string;
  keyPoints?: string[];
  estimatedMinutes?: number;
};

/**
 * The route parameter is a *completion* id, not a module id — `/training`
 * links with `c.id`, where `c` is the completion row. Getting that backwards is
 * what made this page's two bugs: it compared the parameter against
 * `c.moduleId`, so the "Completed" state was unreachable, and it rendered a
 * hard-coded "Data Privacy Fundamentals" lesson for every module because it
 * never looked the record up at all.
 */
export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('training');

  // `myModules` already returns each completion with its module attached, so
  // the lesson content is in hand without a second round trip.
  const { data: completions, isLoading } = trpc.training.myModules.useQuery();
  const utils = trpc.useUtils();

  const startModule = trpc.training.startModule.useMutation({
    onSettled: () => utils.training.myModules.invalidate(),
  });

  if (isLoading) return <GenericWorkspaceSkeleton />;

  const completion = completions?.find((c: any) => c.id === id) as any;
  if (!completion) {
    return (
      <div className="min-h-screen bg-[#08090A] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-[#9BA1A6] mb-4">{t('learn.not_found')}</p>
          <Link href="/training" className="text-[#C9A227] hover:underline text-sm font-medium">
            {t('learn.back')}
          </Link>
        </div>
      </div>
    );
  }

  const trainingModule = completion.module;
  const slides = (trainingModule?.content ?? []) as Slide[];
  const status: string = completion.status ?? 'not_started';

  return (
    <div className="min-h-screen bg-[#08090A]">
      <div className="bg-[#0D0F11] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/training"
              aria-label={t('learn.back')}
              className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-[#6E747A] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A227] mb-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {t('learn.eyebrow')}
              </div>
              <h1 className="text-lg font-bold text-[#F4F5F6] leading-tight truncate">{trainingModule?.title}</h1>
            </div>
          </div>

          {status === 'passed' && (
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#C9A227]/10 px-4 py-2 text-sm font-medium text-[#C9A227]">
              <CheckCircle2 className="w-4 h-4" />
              {t('learn.completed')}
            </div>
          )}
          {status === 'failed' && (
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400">
              <XCircle className="w-4 h-4" />
              {t('learn.failed')}
            </div>
          )}
          {status === 'in_progress' && (
            <div className="shrink-0 rounded-lg bg-white/[0.06] px-4 py-2 text-sm font-medium text-[#9BA1A6]">
              {t('learn.in_progress')}
            </div>
          )}
          {status === 'not_started' && (
            // This used to say "Mark as Complete" and call startModule, which
            // sets `in_progress`. Nothing here can record a pass — that is what
            // submitQuiz is for — so the button now claims only what it does.
            <button
              onClick={() => startModule.mutate({ completionId: id })}
              disabled={startModule.isPending}
              className="shrink-0 rounded-lg bg-[#C9A227] px-4 py-2 text-[13.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:opacity-50"
            >
              {startModule.isPending ? t('learn.starting') : t('learn.start')}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {trainingModule?.description && (
          <p className="text-[15px] leading-relaxed text-[#9BA1A6]">{trainingModule.description}</p>
        )}

        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-8 shadow-panel-elevated">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#6E747A] uppercase tracking-wider mb-6">
            <FileText className="w-4 h-4" />
            {t('learn.reading_material')}
          </div>

          {slides.length === 0 ? (
            <p className="text-[14px] text-[#6E747A]">{t('learn.no_content')}</p>
          ) : (
            <div className="space-y-8">
              {slides.map((slide) => (
                <section key={slide.id} className="border-b border-white/5 pb-8 last:border-b-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-4 mb-3">
                    <h2 className="text-[17px] font-medium text-[#F4F5F6]">{slide.title}</h2>
                    {slide.estimatedMinutes ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-[#6E747A]">
                        <Clock className="w-3 h-3" />
                        {t('learn.minutes', { count: slide.estimatedMinutes })}
                      </span>
                    ) : null}
                  </div>

                  {/* Rendered as text, not HTML: the seed content carries "\n"
                      for its numbered lists and nothing in it is markup. */}
                  {slide.content && (
                    <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-[#E6E8EA]">
                      {slide.content}
                    </p>
                  )}

                  {slide.keyPoints && slide.keyPoints.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {slide.keyPoints.map((point) => (
                        <li key={point} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[#E6E8EA]">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A227]" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>

        <p className="text-[13px] leading-relaxed text-[#6E747A]">{t('learn.quiz_note')}</p>
      </div>
    </div>
  );
}
