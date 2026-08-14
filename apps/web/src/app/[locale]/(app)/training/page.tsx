// @ts-nocheck
'use client';
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import { trpc } from '@/utils/trpc';
import { BookOpen, CheckCircle, Clock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { completionChipClasses, completionTileClasses } from '@/utils/status';

export default function EmployeeTrainingDashboard() {
  const t = useTranslations('training');
  const { data: myCompletions, isLoading } = trpc.training.myModules.useQuery();

  if (isLoading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9A227]"></div>
      </div>
    );
  }

  const assignedCount = myCompletions?.filter(c => c.status !== 'passed').length || 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#08090A]/50">
      <header className="px-8 py-6 border-b border-white/10 bg-[#0D0F11]/50 backdrop-blur-xl shrink-0">
        <h1 className="text-2xl font-serif text-[#F4F5F6]">{t('title')}</h1>
        <p className="text-sm text-[#9BA1A6] mt-1">{t('subtitle')}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-8 fade-in">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {assignedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[14px] font-medium text-amber-300">{t('training_due.title')}</h3>
                <p className="text-[13px] text-amber-300 mt-0.5">{t('training_due.description', { count: assignedCount })}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-[15px] font-semibold text-[#F4F5F6]">{t('assigned_modules')}</h2>
            <div className="grid grid-cols-1 gap-4">
              {myCompletions?.map(c => (
                <div key={c.id} className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated flex flex-col sm:flex-row gap-6 sm:items-center justify-between transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${completionTileClasses(c.status)}`}>
                      {c.status === 'passed' ? <CheckCircle className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-[16px] font-serif text-[#F4F5F6]">{c.module?.title}</h3>
                      <p className="text-[13px] text-[#9BA1A6] mt-1">{c.module?.description}</p>
                      
                      <div className="flex items-center gap-4 mt-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-medium capitalize ${completionChipClasses(c.status)}`}>
                          {(c.status || '').replace('_', ' ')}
                        </span>
                        {c.status === 'passed' && (
                          <span className="text-[12px] text-[#6E747A] font-medium">{t('score', { score: c.quizScore })}</span>
                        )}
                        {c.expiresAt && c.status === 'passed' && (
                          <span className="text-[12px] text-[#6E747A]">{t('valid_until', { date: new Date(c.expiresAt).toLocaleDateString() })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {c.status !== 'passed' ? (
                      <Link 
                        href={`/training/${c.id}/learn`}
                        className="px-5 py-2.5 bg-[#C9A227] text-[#08090A] text-[13.5px] font-medium rounded-xl hover:bg-[#E5C463] transition-colors flex items-center gap-2 shadow-panel-elevated"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {c.status === 'in_progress' || c.status === 'failed' ? t('resume_course') : t('start_course')}
                      </Link>
                    ) : (
                      <button 
                        className="px-5 py-2.5 bg-[#0D0F11] border border-white/10 text-[#F4F5F6] text-[13.5px] font-medium rounded-xl hover:bg-[#08090A] transition-colors shadow-panel-elevated"
                        onClick={() => window.open(`/api/export/certificate?id=${c.id}`, '_blank')}
                      >
                        {t('download_certificate')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {myCompletions?.length === 0 && (
                <div className="p-8 text-center bg-[#0D0F11] border border-white/10 rounded-2xl">
                  <p className="text-[14px] text-[#9BA1A6]">{t('empty_state')}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
