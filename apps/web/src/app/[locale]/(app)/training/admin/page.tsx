// @ts-nocheck
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Shield, Users, BookOpen, Clock, AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';

export default function TrainingAdminDashboard() {
  const t = useTranslations('training');
  const { data: modulesResp, isLoading: loadingModules } = trpc.training.listModules.useQuery({ limit: 100 });
  const modules = modulesResp?.data || [];
  const { data: completionsResp, isLoading: loadingCompletions } = trpc.training.orgOverview.useQuery({ limit: 100 } as any);
  const completions = completionsResp?.data || [];

  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'completions'>('overview');

  if (loadingModules || loadingCompletions) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9A227]"></div>
      </div>
    );
  }

  const passed = ((completions as any)?.data || [])?.filter((c: any) => c.status === 'passed').length || 0;
  const inProgress = ((completions as any)?.data || [])?.filter((c: any) => c.status === 'in_progress').length || 0;
  const notStarted = ((completions as any)?.data || [])?.filter((c: any) => c.status === 'not_started').length || 0;
  const total = ((completions as any)?.data || [])?.length || 0;
  
  const completionRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const overdueCount = ((completions as any)?.data || [])?.filter((c: any) =>
    c.status !== 'passed' && 
    c.dueAt && new Date(c.dueAt).getTime() < new Date().getTime()
  ).length || 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#08090A]/50">
      <header className="px-8 py-6 border-b border-white/10 bg-[#0D0F11]/50 backdrop-blur-xl shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6]">{t('admin.title')}</h1>
          <p className="text-sm text-[#9BA1A6] mt-1">{t('admin.subtitle')}</p>
        </div>
        <button className="px-4 py-2 bg-ink-900 text-white text-[13.5px] font-medium rounded-xl hover:bg-ink-800 transition-colors flex items-center gap-2 shadow-panel-elevated">
          <Plus className="w-4 h-4" />
          {t('admin.create_module')}
        </button>
      </header>

      <div className="px-8 py-4 border-b border-white/10 shrink-0 flex gap-6">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'overview' ? 'text-[#F4F5F6] border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          {t('admin.tabs.overview')}
        </button>
        <button 
          onClick={() => setActiveTab('modules')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'modules' ? 'text-[#F4F5F6] border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          {t('admin.tabs.modules', { count: modules?.length || 0 })}
        </button>
        <button 
          onClick={() => setActiveTab('completions')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'completions' ? 'text-[#F4F5F6] border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          {t('admin.tabs.completions')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 fade-in">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{completionRate}%</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">{t('admin.metrics.completion_rate')}</div>
                </div>

                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{passed}</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">{t('admin.metrics.certified')}</div>
                </div>

                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{modules?.filter(m => m.status === 'published').length || 0}</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">{t('admin.metrics.active_modules')}</div>
                </div>

                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{overdueCount}</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">{t('admin.metrics.overdue')}</div>
                </div>
              </div>

              <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h3 className="text-[14px] font-semibold text-[#F4F5F6]">{t('admin.recent_activity')}</h3>
                </div>
                <div className="divide-y divide-ink-900/10">
                  {((completions as any)?.data || [])?.slice(0, 5).map((c: any) => (
                    <div key={c.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#9BA1A6] font-medium text-[13px]">
                          {c.user?.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-medium text-[#F4F5F6]">{c.user?.name}</div>
                          <div className="text-[12px] text-[#6E747A]">{c.module?.title}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === 'passed' ? 'bg-green-500/10 text-green-400' :
                          c.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400' :
                          c.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-white/10 text-[#E6E8EA]'
                        }`}>
                          {t(`status.${c.status || 'not_started'}`)}
                        </span>
                        {c.status === 'passed' && (
                          <div className="text-[12px] font-medium text-[#F4F5F6]">{t('admin.score', { score: c.quizScore })}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {((completions as any)?.data || [])?.length === 0 && (
                    <div className="p-8 text-center text-[13.5px] text-[#6E747A]">{t('admin.empty_activity')}</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'modules' && (
            <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden">
              <table className="w-full text-left text-[13.5px]">
                <thead className="bg-[#08090A]/50 text-[#9BA1A6] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-6 font-medium">{t('admin.modules_table.name')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.modules_table.type')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.modules_table.target_role')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.modules_table.status')}</th>
                    <th className="py-3 px-6 font-medium text-right">{t('admin.modules_table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/10">
                  {modules?.map(m => (
                    <tr key={m.id} className="hover:bg-[#08090A]/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-[#F4F5F6]">{m.title}</div>
                        <div className="text-[#6E747A] text-[12px] mt-0.5 line-clamp-1">{m.description}</div>
                      </td>
                      <td className="py-4 px-6">
                        {m.isGlobal ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400">{t('admin.modules_table.global')}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#C9A227]/10 text-[#C9A227]">{t('admin.modules_table.custom')}</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-[#9BA1A6]">{t(`admin.roles.${m.targetRole || 'all'}`)}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          m.status === 'published' ? 'bg-green-500/10 text-green-400' : 'bg-white/[0.06] text-[#9BA1A6]'
                        }`}>
                          {t(`admin.module_status.${m.status || 'draft'}`)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-indigo-400 font-medium hover:text-indigo-400">{t('admin.modules_table.view')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'completions' && (
            <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden">
               <table className="w-full text-left text-[13.5px]">
                <thead className="bg-[#08090A]/50 text-[#9BA1A6] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-6 font-medium">{t('admin.records_table.employee')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.records_table.module')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.records_table.status')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.records_table.score')}</th>
                    <th className="py-3 px-6 font-medium">{t('admin.records_table.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/10">
                  {((completions as any)?.data || [])?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-[#08090A]/30 transition-colors">
                      <td className="py-3 px-6 font-medium text-[#F4F5F6]">{c.user?.name}</td>
                      <td className="py-3 px-6 text-[#9BA1A6]">{c.module?.title}</td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === 'passed' ? 'bg-green-500/10 text-green-400' :
                          c.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400' :
                          c.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-white/10 text-[#E6E8EA]'
                        }`}>
                          {t(`status.${c.status || 'not_started'}`)}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-medium text-[#F4F5F6]">{c.quizScore ? `${c.quizScore}%` : '-'}</td>
                      <td className="py-3 px-6 text-[#6E747A] text-[12px]">
                        {c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
