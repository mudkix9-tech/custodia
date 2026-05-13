'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Shield, Users, BookOpen, Clock, AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';

export default function TrainingAdminDashboard() {
  const { data: modules, isLoading: loadingModules } = trpc.training.listModules.useQuery();
  const { data: completions, isLoading: loadingCompletions } = trpc.training.orgOverview.useQuery();

  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'completions'>('overview');

  if (loadingModules || loadingCompletions) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  const passed = completions?.filter(c => c.status === 'passed').length || 0;
  const inProgress = completions?.filter(c => c.status === 'in_progress').length || 0;
  const notStarted = completions?.filter(c => c.status === 'not_started').length || 0;
  const total = completions?.length || 0;
  
  const completionRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const overdueCount = completions?.filter(c => 
    c.status !== 'passed' && 
    c.dueAt && new Date(c.dueAt).getTime() < new Date().getTime()
  ).length || 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bone-50/50">
      <header className="px-8 py-6 border-b border-ink-900/10 bg-white/50 backdrop-blur-xl shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 font-display">Training Administration</h1>
          <p className="text-sm text-ink-600 mt-1">Manage GDPR staff training modules, compliance records, and assignments.</p>
        </div>
        <button className="px-4 py-2 bg-ink-900 text-white text-[13.5px] font-medium rounded-xl hover:bg-ink-800 transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Create Module
        </button>
      </header>

      <div className="px-8 py-4 border-b border-ink-900/10 shrink-0 flex gap-6">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'overview' ? 'text-ink-900 border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-ink-500 hover:text-ink-900'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('modules')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'modules' ? 'text-ink-900 border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-ink-500 hover:text-ink-900'}`}
        >
          Modules ({modules?.length || 0})
        </button>
        <button 
          onClick={() => setActiveTab('completions')}
          className={`text-[13.5px] font-medium transition-colors ${activeTab === 'completions' ? 'text-ink-900 border-b-2 border-ink-900 pb-4 -mb-[17px]' : 'text-ink-500 hover:text-ink-900'}`}
        >
          Employee Records
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 fade-in">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-ink-900/10 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-sage-50 text-sage-600 flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-ink-900">{completionRate}%</div>
                  <div className="text-[13px] font-medium text-ink-600 mt-1">Overall Completion Rate</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-ink-900/10 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-ink-900">{passed}</div>
                  <div className="text-[13px] font-medium text-ink-600 mt-1">Staff Certified</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-ink-900/10 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-ink-900">{modules?.filter(m => m.status === 'published').length || 0}</div>
                  <div className="text-[13px] font-medium text-ink-600 mt-1">Active Modules</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-ink-900/10 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-ink-900">{overdueCount}</div>
                  <div className="text-[13px] font-medium text-ink-600 mt-1">Overdue Assignments</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-ink-900/10 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-900/10">
                  <h3 className="text-[14px] font-semibold text-ink-900">Recent Activity</h3>
                </div>
                <div className="divide-y divide-ink-900/10">
                  {completions?.slice(0, 5).map(c => (
                    <div key={c.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center text-ink-600 font-medium text-[13px]">
                          {c.user?.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-medium text-ink-900">{c.user?.name}</div>
                          <div className="text-[12px] text-ink-500">{c.module?.title}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                          c.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                          c.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                          'bg-ink-100 text-ink-700'
                        }`}>
                          {(c.status || '').replace('_', ' ')}
                        </span>
                        {c.status === 'passed' && (
                          <div className="text-[12px] font-medium text-ink-900">{c.quizScore}% Score</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {completions?.length === 0 && (
                    <div className="p-8 text-center text-[13.5px] text-ink-500">No training activity recorded yet.</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'modules' && (
            <div className="bg-white rounded-2xl border border-ink-900/10 shadow-sm overflow-hidden">
              <table className="w-full text-left text-[13.5px]">
                <thead className="bg-bone-50/50 text-ink-600 border-b border-ink-900/10">
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
                    <tr key={m.id} className="hover:bg-bone-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-ink-900">{m.title}</div>
                        <div className="text-ink-500 text-[12px] mt-0.5 line-clamp-1">{m.description}</div>
                      </td>
                      <td className="py-4 px-6">
                        {m.isGlobal ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700">Privaro Global</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sage-50 text-sage-700">Custom</span>
                        )}
                      </td>
                      <td className="py-4 px-6 capitalize text-ink-600">{m.targetRole}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          m.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-700'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-indigo-600 font-medium hover:text-indigo-700">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'completions' && (
            <div className="bg-white rounded-2xl border border-ink-900/10 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[13.5px]">
                <thead className="bg-bone-50/50 text-ink-600 border-b border-ink-900/10">
                  <tr>
                    <th className="py-3 px-6 font-medium">Employee</th>
                    <th className="py-3 px-6 font-medium">Module</th>
                    <th className="py-3 px-6 font-medium">Status</th>
                    <th className="py-3 px-6 font-medium">Score</th>
                    <th className="py-3 px-6 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/10">
                  {completions?.map(c => (
                    <tr key={c.id} className="hover:bg-bone-50/30 transition-colors">
                      <td className="py-3 px-6 font-medium text-ink-900">{c.user?.name}</td>
                      <td className="py-3 px-6 text-ink-600">{c.module?.title}</td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                          c.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                          c.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                          'bg-ink-100 text-ink-700'
                        }`}>
                          {(c.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-medium text-ink-900">{c.quizScore ? `${c.quizScore}%` : '-'}</td>
                      <td className="py-3 px-6 text-ink-500 text-[12px]">
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
