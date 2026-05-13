"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { format } from 'date-fns';
import { Download, Search, Settings, Server, User, Clock, ShieldAlert, FileJson } from 'lucide-react';

export function AuditLogTable() {
  const [cursor, setCursor] = useState(0);
  const { data: logs, isLoading } = trpc.audit.listLogs.useQuery({ limit: 50, cursor });
  
  const [selectedLog, setSelectedLog] = useState<any>(null);

  if (isLoading) {
    return <div className="p-8 text-center text-ink-500">Loading audit ledger...</div>;
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white border border-ink-900/10 rounded-2xl p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-ink-300 mx-auto mb-4" />
        <h3 className="text-lg font-serif text-ink-900">No Audit Logs Found</h3>
        <p className="text-ink-500 mt-2">There is no recorded activity yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-ink-900/5 flex items-center justify-between bg-bone-50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="pl-9 pr-4 py-1.5 text-sm rounded-lg border border-ink-900/20 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 outline-none w-64 bg-white"
            />
          </div>
          <select className="text-sm rounded-lg border border-ink-900/20 py-1.5 px-3 bg-white outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500">
            <option value="">All Resource Types</option>
            <option value="processing_activity">Processing Activity</option>
            <option value="vendor">Vendor</option>
            <option value="dsar_request">DSAR Request</option>
            <option value="breach">Breach</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-ink-700 bg-white border border-ink-900/20 rounded-lg hover:bg-bone-100 transition-colors">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-bone-50 text-ink-500 border-b border-ink-900/10">
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
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-bone-50/50 transition-colors">
                <td className="px-6 py-3 text-ink-600 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-ink-400" />
                    {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    {log.userId ? (
                      <User className="w-4 h-4 text-ink-400" />
                    ) : (
                      <Server className="w-4 h-4 text-amber-500" />
                    )}
                    <span className={!log.userId ? 'text-amber-700 text-xs font-medium uppercase tracking-wider' : 'text-ink-900'}>
                      {log.userEmail || 'System'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-ink-900 font-medium">
                  {log.description || log.action}
                </td>
                <td className="px-6 py-3 text-ink-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ink-900/5 text-ink-600">
                    {log.resourceType || 'system'}
                  </span>
                </td>
                <td className="px-6 py-3 text-ink-400 font-mono text-xs">
                  {log.ipAddress || '—'}
                </td>
                <td className="px-6 py-3 text-right">
                  {(log.changes || log.metadata) && (
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="text-sage-600 hover:text-sage-700 font-medium inline-flex items-center gap-1"
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

      <div className="p-4 border-t border-ink-900/5 flex items-center justify-between bg-bone-50">
        <span className="text-sm text-ink-500">Showing {logs.length} entries</span>
        <div className="flex gap-2">
          <button 
            disabled={cursor === 0}
            onClick={() => setCursor(Math.max(0, cursor - 50))}
            className="px-3 py-1.5 text-sm font-medium text-ink-700 bg-white border border-ink-900/20 rounded-lg hover:bg-bone-100 disabled:opacity-50"
          >
            Previous
          </button>
          <button 
            onClick={() => setCursor(cursor + 50)}
            className="px-3 py-1.5 text-sm font-medium text-ink-700 bg-white border border-ink-900/20 rounded-lg hover:bg-bone-100"
          >
            Next
          </button>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/20 backdrop-blur-sm transition-all">
          <div className="w-[500px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-ink-900/10 flex items-center justify-between bg-bone-50">
              <div>
                <h3 className="text-lg font-serif text-ink-900">Audit Entry Details</h3>
                <p className="text-xs text-ink-500 mt-1 font-mono">{selectedLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink-900/10 transition-colors text-ink-500"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-400 font-medium mb-1">Actor</div>
                  <div className="text-sm font-medium text-ink-900 flex items-center gap-2">
                    {selectedLog.userId ? <User size={14}/> : <Server size={14} className="text-amber-500"/>}
                    {selectedLog.userEmail || 'System Process'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-400 font-medium mb-1">Timestamp</div>
                  <div className="text-sm text-ink-900">
                    {format(new Date(selectedLog.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </div>
                </div>
              </div>

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-ink-900 mb-3 border-b border-ink-900/10 pb-2">Changes</h4>
                  <div className="space-y-3">
                    {Object.entries(selectedLog.changes).map(([field, change]: [string, any]) => (
                      <div key={field} className="bg-bone-50 rounded-lg p-3 border border-ink-900/10 text-sm">
                        <div className="font-mono text-xs font-bold text-ink-700 mb-2">{field}</div>
                        <div className="flex items-start gap-4">
                          <div className="flex-1 bg-red-50 text-red-900 p-2 rounded border border-red-100 break-all">
                            <span className="text-red-500 font-bold mr-2">-</span>
                            {JSON.stringify(change.old)}
                          </div>
                          <div className="flex-1 bg-sage-50 text-sage-900 p-2 rounded border border-sage-100 break-all">
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
                  <h4 className="text-sm font-medium text-ink-900 mb-3 border-b border-ink-900/10 pb-2">Raw Payload Metadata</h4>
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
