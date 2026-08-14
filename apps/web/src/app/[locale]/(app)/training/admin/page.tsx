// @ts-nocheck
'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Shield, Users, BookOpen, Clock, AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';

export default function TrainingAdminDashboard() {
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
          <h1 className="text-2xl font-serif text-[#F4F5F6]">Training Administration</h1>
          <p className="text-sm text-[#9BA1A6] mt-1">Manage GDPR staff training modules, compliance records, and assignments.</p>
        </div>
        <button className="px-4 py-2 bg-ink-900 text-white text-[13.5px] font-medium rounded-xl hover:bg-ink-800 transition-colors flex items-center gap-2 shadow-panel-elevated">
          <Plus className="w-4 h-4" />
          Create Module
        </button>
      </header>

      <div className="px-8 py-4 border-b border-white/10 shrink-0 flex gap-6">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'overview' ? 'text-[#F4F5F6] border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('modules')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'modules' ? 'text-[#F4F5F6] border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          Modules ({modules?.length || 0})
        </button>
        <button 
          onClick={() => setActiveTab('completions')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'completions' ? 'text-[#F4F5F6] border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-[#6E747A] hover:text-[#F4F5F6]'}`}
        >
          Employee Records
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
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">Overall Completion Rate</div>
                </div>

                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{passed}</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">Staff Certified</div>
                </div>

                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{modules?.filter(m => m.status === 'published').length || 0}</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">Active Modules</div>
                </div>

                <div className="bg-[#0D0F11] rounded-2xl p-6 border border-white/10 shadow-panel-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-serif text-[#F4F5F6]">{overdueCount}</div>
                  <div className="text-[13px] font-medium text-[#9BA1A6] mt-1">Overdue Assignments</div>
                </div>
              </div>

              <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h3 className="text-[14px] font-semibold text-[#F4F5F6]">Recent Activity</h3>
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
                          c.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                          c.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400' :
                          c.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                          'bg-white/10 text-[#E6E8EA]'
                        }`}>
                          {(c.status || '').replace('_', ' ')}
                        </span>
                        {c.status === 'passed' && (
                          <div className="text-[12px] font-medium text-[#F4F5F6]">{c.quizScore}% Score</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {((completions as any)?.data || [])?.length === 0 && (
                    <div className="p-8 text-center text-[13.5px] text-[#6E747A]">No training activity recorded yet.</div>
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
                    <th className="py-3 px-6 font-medium">Module Name</th>
                    <th className="py-3 px-6 font-medium">Type</th>
                    <th className="py-3 px-6 font-medium">Target Role</th>
                    <th className="py-3 px-6 font-medium">Status</th>
                    <th className="py-3 px-6 font-medium text-right">Actions</th>
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400">Custodia Global</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#C9A227]/10 text-[#C9A227]">Custom</span>
                        )}
                      </td>
                      <td className="py-4 px-6 capitalize text-[#9BA1A6]">{m.targetRole}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          m.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-white/10 text-[#E6E8EA]'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-indigo-400 font-medium hover:text-indigo-400">View Details</button>
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
                    <th className="py-3 px-6 font-medium">Employee</th>
                    <th className="py-3 px-6 font-medium">Module</th>
                    <th className="py-3 px-6 font-medium">Status</th>
                    <th className="py-3 px-6 font-medium">Score</th>
                    <th className="py-3 px-6 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/10">
                  {((completions as any)?.data || [])?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-[#08090A]/30 transition-colors">
                      <td className="py-3 px-6 font-medium text-[#F4F5F6]">{c.user?.name}</td>
                      <td className="py-3 px-6 text-[#9BA1A6]">{c.module?.title}</td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                          c.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400' :
                          c.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                          'bg-white/10 text-[#E6E8EA]'
                        }`}>
                          {(c.status || '').replace('_', ' ')}
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
