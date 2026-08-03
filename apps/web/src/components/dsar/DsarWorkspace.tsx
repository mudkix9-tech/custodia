"use client";
import DOMPurify from 'dompurify';

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { differenceInDays, format } from 'date-fns';
import { Clock, CheckCircle2, AlertCircle, FileText, Send, Mail, Download, History, User, Paperclip } from 'lucide-react';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';

export function DsarWorkspace({ dsarId }: { dsarId: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'comms' | 'package' | 'timeline'>('overview');
  const [commsSubject, setCommsSubject] = useState('');
  const [commsBody, setCommsBody] = useState('');
  
  const utils = trpc.useContext();
  const { data: dsar, isLoading } = trpc.dsar.getById.useQuery({ id: dsarId });
  const { data: tasksResp } = trpc.dsar.tasks.list.useQuery({ dsarId, limit: 100 });
  const tasks = tasksResp?.data || [];
  const { data: commsResp } = trpc.dsar.comms.list.useQuery({ dsarId, limit: 100 });
  const comms = commsResp?.data || [];
  
  const { setContext } = useAiGuidanceStore();

  // Set AI guidance context when DSAR data loads
  useEffect(() => {
    if (dsar) {
      setContext({
        module: 'dsar',
        entityId: dsarId,
        formData: {
          referenceNumber: dsar.referenceNumber,
          requestType: dsar.requestType,
          originalMessage: dsar.originalMessage,
          receivedAt: dsar.receivedAt,
        }
      });
    }
  }, [dsarId, dsar?.status]);

  const generateTasksMutation = trpc.dsar.tasks.generateFromRopa.useMutation({
    onSuccess: () => utils.dsar.tasks.list.invalidate({ dsarId })
  });
  const sendEmailMutation = trpc.dsar.comms.send.useMutation({
    onSuccess: () => {
      utils.dsar.comms.list.invalidate({ dsarId });
      setCommsBody('');
      setCommsSubject('');
    }
  });
  const exportPackageMutation = trpc.dsar.exportDataPackage.useMutation({
    onSuccess: () => utils.dsar.getById.invalidate({ id: dsarId })
  });
  const updateStatusMutation = trpc.dsar.updateStatus.useMutation({
    onSuccess: () => utils.dsar.getById.invalidate({ id: dsarId })
  });
  const updateTaskMutation = trpc.dsar.tasks.update.useMutation({
    onSuccess: () => utils.dsar.tasks.list.invalidate({ dsarId })
  });

  if (isLoading || !dsar) return <div className="text-[#6E747A]">Loading Workspace...</div>;

  const daysRemaining = differenceInDays(new Date(dsar.deadlineAt), new Date());
  
  // Header Escalation Logic
  let headerColor = 'bg-sage-600';
  let bannerText = `${daysRemaining} Days Remaining`;
  if (daysRemaining <= 14 && daysRemaining > 7) {
    headerColor = 'bg-amber-500/100';
  } else if (daysRemaining <= 7 && daysRemaining >= 0) {
    headerColor = 'bg-red-500/100';
  } else if (daysRemaining < 0) {
    headerColor = 'bg-red-600 animate-pulse';
    bannerText = `OVERDUE by ${Math.abs(daysRemaining)} Days`;
  }

  if (dsar.status === 'completed') {
    headerColor = 'bg-slate-500';
    bannerText = 'Completed';
  }

  return (
    <div className="bg-[#0D0F11] rounded-3xl border border-white/10 shadow-panel-elevated overflow-hidden min-h-[800px] flex flex-col">
      {/* Header */}
      <div className={`${headerColor} text-white p-6 flex justify-between items-center transition-colors`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="bg-[#0D0F11]/20 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider">{dsar.referenceNumber}</span>
            <h1 className="text-xl font-medium">{dsar.subjectName}</h1>
          </div>
          <div className="text-white/80 text-[13px] capitalize">{dsar.requestType.replace('_', ' ')} Request</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold flex items-center justify-end gap-2">
            <Clock className="w-6 h-6" />
            {bannerText}
          </div>
          <div className="text-white/80 text-[12px] mt-1">Deadline: {format(new Date(dsar.deadlineAt), 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-[#08090A]">
        {[
          { id: 'overview', icon: FileText, label: 'Overview' },
          { id: 'tasks', icon: CheckCircle2, label: 'System Tasks' },
          { id: 'comms', icon: Mail, label: 'Communications' },
          { id: 'package', icon: Download, label: 'Data Package' },
          { id: 'timeline', icon: History, label: 'Timeline' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-ink-900 text-[#F4F5F6] bg-[#0D0F11]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-ink-900/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-8 flex-1 overflow-y-auto bg-[#0D0F11]">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="max-w-3xl space-y-8 fade-up">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wider mb-3">Subject Details</h3>
                <div className="space-y-2 text-[14px]">
                  <div className="flex justify-between"><span className="text-[#6E747A]">Name</span> <span className="font-medium text-[#F4F5F6]">{dsar.subjectName}</span></div>
                  <div className="flex justify-between"><span className="text-[#6E747A]">Email</span> <span className="font-medium text-[#F4F5F6]">{dsar.subjectEmail}</span></div>
                  <div className="flex justify-between">
                    <span className="text-[#6E747A]">Verification</span> 
                    {dsar.subjectVerified ? (
                      <span className="text-[#C9A227] flex items-center gap-1 font-medium"><CheckCircle2 className="w-4 h-4"/> Verified</span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 font-medium"><AlertCircle className="w-4 h-4"/> Pending</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wider mb-3">Request Details</h3>
                <div className="space-y-2 text-[14px]">
                  <div className="flex justify-between"><span className="text-[#6E747A]">Type</span> <span className="font-medium text-[#F4F5F6] capitalize">{dsar.requestType}</span></div>
                  <div className="flex justify-between"><span className="text-[#6E747A]">Received</span> <span className="font-medium text-[#F4F5F6]">{format(new Date(dsar.receivedAt), 'MMM dd, yyyy')}</span></div>
                  <div className="flex justify-between">
                    <span className="text-[#6E747A]">Status</span> 
                    <select 
                      value={dsar.status || 'new'}
                      onChange={(e) => updateStatusMutation.mutate({ id: dsar.id, status: e.target.value })}
                      className="bg-[#08090A] border border-white/10 rounded px-2 py-0.5 text-[#F4F5F6] text-[13px]"
                    >
                      <option value="new">New</option>
                      <option value="identity_verification">Verification</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="completed">Completed</option>
                      <option value="refused">Refused</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {dsar.originalMessage && (
              <div>
                <h3 className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wider mb-3">Original Message</h3>
                <div className="bg-[#08090A] p-4 rounded-xl text-[14px] text-[#E6E8EA] whitespace-pre-wrap">
                  {dsar.originalMessage}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="fade-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-medium text-[#F4F5F6]">System Search Tasks</h3>
              <button 
                onClick={() => generateTasksMutation.mutate({ dsarId })}
                disabled={generateTasksMutation.isPending}
                className="bg-ink-900 text-white px-4 py-2 rounded-xl text-[13px] font-medium hover:bg-ink-800 disabled:opacity-50"
              >
                {generateTasksMutation.isPending ? 'Generating...' : 'Auto-Generate from ROPA'}
              </button>
            </div>
            
            {((tasks as any)?.data || [])?.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-[#9BA1A6]">No tasks generated yet.</p>
                <p className="text-sm text-[#6E747A] mt-1">Click Auto-Generate to scan your ROPA for relevant vendors.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {((tasks as any)?.data || [])?.map((task: any) => (
                  <div key={task.id} className={`p-5 rounded-2xl border ${task.status === 'completed' ? 'bg-[#C9A227]/10/30 border-sage-500/20' : 'bg-[#0D0F11] border-white/10'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-[#F4F5F6]">{task.systemName}</h4>
                          {task.priority === 'high' && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">High Priority</span>}
                        </div>
                        <div className="text-[12px] text-[#6E747A]">Related Activities: {(task.relatedActivities as string[])?.join(', ')}</div>
                      </div>
                      <select 
                        value={task.status || 'pending'}
                        onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}
                        className="bg-[#08090A] border border-white/10 rounded-lg px-3 py-1 text-[13px]"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="not_applicable">Not Applicable</option>
                      </select>
                    </div>
                    {task.searchInstructions && (
                      <div className="bg-[#08090A] p-3 rounded-lg text-[13px] text-[#E6E8EA] font-mono mb-3">
                        <span className="font-bold text-[#F4F5F6] mr-2">Instructions:</span>
                        {task.searchInstructions}
                      </div>
                    )}
                    <div className="flex gap-4 items-center">
                       <label className="flex items-center gap-2 text-[13px] text-[#E6E8EA]">
                         <input type="checkbox" checked={task.dataFound || false} onChange={e => updateTaskMutation.mutate({ id: task.id, data: { dataFound: e.target.checked }})} className="rounded border-white/20 text-[#C9A227] focus:ring-sage-600"/>
                         Data Found
                       </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMMS TAB */}
        {activeTab === 'comms' && (
          <div className="fade-up h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-6">
              {((comms as any)?.data || [])?.map((comm: any) => (
                <div key={comm.id} className={`p-4 rounded-xl border max-w-2xl ${comm.direction === 'inbound' ? 'bg-[#08090A] border-white/10 mr-auto' : 'bg-blue-500/10 border-blue-900/50 ml-auto'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E747A]">{comm.direction === 'inbound' ? 'From Subject' : 'Sent by System/Team'}</span>
                    <span className="text-[11px] text-[#6E747A]">{format(new Date(comm.sentAt!), 'MMM dd, h:mm a')}</span>
                  </div>
                  <div className="font-medium text-[#F4F5F6] text-[14px] mb-1">{comm.subject}</div>
                  <div className="text-[13px] text-[#E6E8EA] whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comm.body || '') }} />
                  
                  {Array.isArray(comm.attachments) && comm.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                      {comm.attachments.map((file: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 bg-[#0D0F11] border border-white/10 rounded px-2 py-1 text-[11px] text-[#9BA1A6]">
                          <Paperclip className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{file.filename}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {((comms as any)?.data || [])?.length === 0 && <div className="text-center text-[#6E747A] py-10">No communications yet.</div>}
            </div>

            <div className="bg-[#08090A] p-4 rounded-2xl border border-white/10">
              <input 
                type="text" 
                placeholder="Subject" 
                value={commsSubject}
                onChange={e => setCommsSubject(e.target.value)}
                className="w-full bg-[#0D0F11] border border-white/10 rounded-xl px-4 py-2 mb-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
              <textarea 
                placeholder="Write a message to the data subject..." 
                rows={4}
                value={commsBody}
                onChange={e => setCommsBody(e.target.value)}
                className="w-full bg-[#0D0F11] border border-white/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20 mb-3"
              />
              <div className="flex justify-end">
                <button 
                  onClick={() => sendEmailMutation.mutate({ dsarId, subject: commsSubject, body: commsBody })}
                  disabled={!commsSubject || !commsBody || sendEmailMutation.isPending}
                  className="flex items-center gap-2 bg-[var(--org-primary,#2c3e38)] text-white px-5 py-2 rounded-xl text-[13px] font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> {sendEmailMutation.isPending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PACKAGE TAB */}
        {activeTab === 'package' && (
          <div className="fade-up max-w-2xl text-center mx-auto py-12">
            <div className="w-20 h-20 bg-[#C9A227]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Download className="w-10 h-10 text-[#C9A227]" />
            </div>
            <h2 className="text-2xl font-serif text-[#F4F5F6] mb-3">Data Package Compilation</h2>
            <p className="text-[#9BA1A6] mb-8 leading-relaxed">
              Compile all findings from completed system search tasks into a secure, encrypted ZIP file. 
              The subject will receive a secure link that requires email re-verification to access.
            </p>
            
            {dsar.dataPackageUrl ? (
              <div className="bg-[#08090A] border border-white/10 rounded-2xl p-6 mb-8 text-left">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="font-medium text-[#F4F5F6]">Package Generated</div>
                    <div className="text-[13px] text-[#6E747A]">Expires: {format(new Date(dsar.dataPackageExpiresAt!), 'MMM dd, yyyy')}</div>
                  </div>
                  <span className="bg-sage-100 text-[#C9A227] px-3 py-1 rounded-full text-[12px] font-medium">Ready</span>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 bg-[#0D0F11] border border-white/20 text-[#F4F5F6] py-2 rounded-xl text-[13px] font-medium hover:bg-[#08090A]">
                    Preview Package
                  </button>
                  <button className="flex-1 bg-ink-900 text-white py-2 rounded-xl text-[13px] font-medium hover:bg-ink-800 flex items-center justify-center gap-2">
                    <Send className="w-4 h-4"/> Send Secure Link
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => exportPackageMutation.mutate({ id: dsar.id })}
                disabled={exportPackageMutation.isPending}
                className="bg-ink-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
              >
                {exportPackageMutation.isPending ? 'Compiling...' : 'Generate Data Package'}
              </button>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="fade-up max-w-2xl">
            <h3 className="font-medium text-[#F4F5F6] mb-8">Audit Trail</h3>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-ink-900/10 before:to-transparent">
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-sage-100 text-[#C9A227] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/10 bg-[#0D0F11] shadow-panel-elevated">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-[#F4F5F6] text-[13px]">Request Received</div>
                    <time className="font-mono text-[11px] text-[#6E747A]">{format(new Date(dsar.receivedAt), 'MMM dd')}</time>
                  </div>
                  <div className="text-[#9BA1A6] text-[13px]">Intake portal submission.</div>
                </div>
              </div>

              {dsar.subjectVerified && (
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-blue-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/10 bg-[#0D0F11] shadow-panel-elevated">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-[#F4F5F6] text-[13px]">Identity Verified</div>
                      <time className="font-mono text-[11px] text-[#6E747A]">{format(new Date(dsar.verificationDate!), 'MMM dd')}</time>
                    </div>
                    <div className="text-[#9BA1A6] text-[13px]">Via {dsar.verificationMethod?.replace('_', ' ')}.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
