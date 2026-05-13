'use client';

import { trpc } from '@/utils/trpc';
import { BookOpen, CheckCircle, Clock, PlayCircle } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeTrainingDashboard() {
  const { data: myCompletions, isLoading } = trpc.training.myModules.useQuery();

  if (isLoading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  const assignedCount = myCompletions?.filter(c => c.status !== 'passed').length || 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bone-50/50">
      <header className="px-8 py-6 border-b border-ink-900/10 bg-white/50 backdrop-blur-xl shrink-0">
        <h1 className="text-2xl font-bold text-ink-900 font-display">My Training</h1>
        <p className="text-sm text-ink-600 mt-1">Complete your mandatory data protection and security training.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-8 fade-in">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {assignedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[14px] font-medium text-amber-900">Training Due</h3>
                <p className="text-[13px] text-amber-800 mt-0.5">You have {assignedCount} incomplete training module{assignedCount > 1 ? 's' : ''}. Please complete them as soon as possible.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-[15px] font-semibold text-ink-900">Assigned Modules</h2>
            <div className="grid grid-cols-1 gap-4">
              {myCompletions?.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-6 border border-ink-900/10 shadow-sm flex flex-col sm:flex-row gap-6 sm:items-center justify-between transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      c.status === 'passed' ? 'bg-emerald-50 text-emerald-600' :
                      c.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {c.status === 'passed' ? <CheckCircle className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-ink-900">{c.module?.title}</h3>
                      <p className="text-[13px] text-ink-600 mt-1">{c.module?.description}</p>
                      
                      <div className="flex items-center gap-4 mt-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                          c.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                          c.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                          'bg-ink-100 text-ink-700'
                        }`}>
                          {(c.status || '').replace('_', ' ')}
                        </span>
                        {c.status === 'passed' && (
                          <span className="text-[12px] text-ink-500 font-medium">Score: {c.quizScore}%</span>
                        )}
                        {c.expiresAt && c.status === 'passed' && (
                          <span className="text-[12px] text-ink-500">Valid until {new Date(c.expiresAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {c.status !== 'passed' ? (
                      <Link 
                        href={`/training/${c.id}/learn`}
                        className="px-5 py-2.5 bg-indigo-600 text-white text-[13.5px] font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {c.status === 'in_progress' || c.status === 'failed' ? 'Resume Course' : 'Start Course'}
                      </Link>
                    ) : (
                      <button 
                        className="px-5 py-2.5 bg-white border border-ink-900/10 text-ink-900 text-[13.5px] font-medium rounded-xl hover:bg-bone-50 transition-colors shadow-sm"
                        onClick={() => window.open(`/api/export/certificate?id=${c.id}`, '_blank')}
                      >
                        Download Certificate
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {myCompletions?.length === 0 && (
                <div className="p-8 text-center bg-white border border-ink-900/10 rounded-2xl">
                  <p className="text-[14px] text-ink-600">You have no assigned training modules.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
