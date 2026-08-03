"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { format } from 'date-fns';
import { Download, Search, Settings, Server, User, Clock, ShieldAlert, FileJson } from 'lucide-react';

export function AuditLogTable() {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data: logs, isLoading } = trpc.audit.listLogs.useQuery({ limit: 50, cursor });
  
  const [selectedLog, setSelectedLog] = useState<any>(null);

  if (isLoading) {
    return <div className="p-8 text-center text-[#6E747A]">Loading audit ledger...</div>;
  }

  if (((logs as any)?.data || [])?.length === 0) {
    return (
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-serif text-[#F4F5F6]">No Audit Logs Found</h3>
        <p className="text-[#6E747A] mt-2">There is no recorded activity yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#08090A]">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6E747A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="pl-9 pr-4 py-1.5 text-sm rounded-lg border border-white/20 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 outline-none w-64 bg-[#0D0F11]"
            />
          </div>
          <select className="text-sm rounded-lg border border-white/20 py-1.5 px-3 bg-[#0D0F11] outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500">
            <option value="">All Resource Types</option>
            <option value="processing_activity">Processing Activity</option>
            <option value="vendor">Vendor</option>
            <option value="dsar_request">DSAR Request</option>
            <option value="breach">Breach</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#E6E8EA] bg-[#0D0F11] border border-white/20 rounded-lg hover:bg-white/5 transition-colors">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#08090A] text-[#6E747A] border-b border-white/10">
            <tr>
              <th className="px-6 py-3 font-medium whitespace-nowrap">Timestamp</th>
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Action</th>
              <th className="px-6 py-3 font-medium">Resource</th>
              <th className="px-6 py-3 font-medium">IP Address</th>
              <th className="px-6 py-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/5">
            {((logs as any)?.data || []).map((log: any) => (
              <tr key={log.id} className="hover:bg-[#08090A]/50 transition-colors">
                <td className="px-6 py-3 text-[#9BA1A6] whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#6E747A]" />
                    {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    {log.userId ? (
                      <User className="w-4 h-4 text-[#6E747A]" />
                    ) : (
                      <Server className="w-4 h-4 text-amber-500" />
                    )}
                    <span className={!log.userId ? 'text-amber-400 text-xs font-medium uppercase tracking-wider' : 'text-[#F4F5F6]'}>
                      {log.userEmail || 'System'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-[#F4F5F6] font-medium">
                  {log.description || log.action}
                </td>
                <td className="px-6 py-3 text-[#6E747A]">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ink-900/5 text-[#9BA1A6]">
                    {log.resourceType || 'system'}
                  </span>
                </td>
                <td className="px-6 py-3 text-[#6E747A] font-mono text-xs">
                  {log.ipAddress || '—'}
                </td>
                <td className="px-6 py-3 text-right">
                  {(log.changes || log.metadata) && (
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="text-[#C9A227] hover:text-[#C9A227] font-medium inline-flex items-center gap-1"
                    >
                      <FileJson className="w-4 h-4" />
                      View Diff
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-white/5 flex items-center justify-between bg-[#08090A]">
        <span className="text-sm text-[#6E747A]">Showing {((logs as any)?.data || []).length} entries</span>
        <div className="flex gap-2">
          <button 
            disabled={!cursor}
            onClick={() => setCursor(((logs as any)?.pagination?.previous_cursor) || null)}
            className="px-3 py-1.5 text-sm font-medium text-[#E6E8EA] bg-[#0D0F11] border border-white/20 rounded-lg hover:bg-white/5 disabled:opacity-50"
          >
            Previous
          </button>
          <button 
            onClick={() => setCursor(((logs as any)?.pagination?.next_cursor) || null)}
            className="px-3 py-1.5 text-sm font-medium text-[#E6E8EA] bg-[#0D0F11] border border-white/20 rounded-lg hover:bg-white/5"
          >
            Next
          </button>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/20 backdrop-blur-sm transition-all">
          <div className="w-[500px] bg-[#0D0F11] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#08090A]">
              <div>
                <h3 className="text-lg font-serif text-[#F4F5F6]">Audit Entry Details</h3>
                <p className="text-xs text-[#6E747A] mt-1 font-mono">{selectedLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink-900/10 transition-colors text-[#6E747A]"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#6E747A] font-medium mb-1">Actor</div>
                  <div className="text-sm font-medium text-[#F4F5F6] flex items-center gap-2">
                    {selectedLog.userId ? <User size={14}/> : <Server size={14} className="text-amber-500"/>}
                    {selectedLog.userEmail || 'System Process'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#6E747A] font-medium mb-1">Timestamp</div>
                  <div className="text-sm text-[#F4F5F6]">
                    {format(new Date(selectedLog.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </div>
                </div>
              </div>

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[#F4F5F6] mb-3 border-b border-white/10 pb-2">Changes</h4>
                  <div className="space-y-3">
                    {Object.entries(selectedLog.changes).map(([field, change]: [string, any]) => (
                      <div key={field} className="bg-[#08090A] rounded-lg p-3 border border-white/10 text-sm">
                        <div className="font-mono text-xs font-bold text-[#E6E8EA] mb-2">{field}</div>
                        <div className="flex items-start gap-4">
                          <div className="flex-1 bg-red-500/10 text-red-900 p-2 rounded border border-red-900/50 break-all">
                            <span className="text-red-500 font-bold mr-2">-</span>
                            {JSON.stringify(change.old)}
                          </div>
                          <div className="flex-1 bg-[#C9A227]/10 text-sage-900 p-2 rounded border border-sage-100 break-all">
                            <span className="text-sage-500 font-bold mr-2">+</span>
                            {JSON.stringify(change.new)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <h4 className="text-sm font-medium text-[#F4F5F6] mb-3 border-b border-white/10 pb-2">Raw Payload Metadata</h4>
                  <pre className="bg-ink-900 text-ink-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
