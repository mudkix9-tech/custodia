"use client";
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { format } from 'date-fns';
import { AlertTriangle, Info, ExternalLink, Filter, Search } from 'lucide-react';

export default function UpdatesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: updates, isLoading } = trpc.regulatory.listHistory.useQuery({ limit: 100 });

  if (isLoading) return <GenericListSkeleton />;

  const filteredUpdates = updates?.filter(u => 
    u.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.sourceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Regulatory Feed</h1>
          <p className="text-ink-600">Chronological history of all GDPR updates and DPA guidelines.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search updates..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-ink-900/10 rounded-lg text-sm focus:ring-sage-500 w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-ink-900/10 rounded-lg text-sm text-ink-600 hover:bg-bone-50">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {filteredUpdates?.map(update => {
          const isUrgent = update.severity === 'action_required' || update.severity === 'urgent';
          
          return (
            <div key={update.id} className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm hover:border-ink-900/20 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                {isUrgent ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md uppercase tracking-wide">
                    <AlertTriangle className="w-3 h-3" /> Action Required
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wide">
                    <Info className="w-3 h-3" /> {update.severity}
                  </span>
                )}
                <span className="text-[13px] font-semibold text-ink-900">{update.sourceName}</span>
                <span className="text-[13px] text-ink-500">• {format(new Date(update.publishedAt!), 'MMMM d, yyyy')}</span>
              </div>
              
              <h2 className="text-lg font-semibold text-ink-900 mb-2">{update.title}</h2>
              <p className="text-ink-700 text-[14px] leading-relaxed mb-6">{update.summary}</p>
              
              <div className="bg-bone-50 border border-ink-900/5 rounded-xl p-4 mb-4">
                <h4 className="text-[12px] font-bold text-ink-900 uppercase tracking-wider mb-3">Key Changes</h4>
                <ul className="space-y-3">
                  {((update.keyChanges as any[]) || []).map((change, i) => (
                    <li key={i} className="text-[13px] text-ink-700">
                      <strong>{change.change}</strong>
                      <p className="text-ink-500 mt-0.5">{change.impact}</p>
                      {change.gdprArticles && change.gdprArticles.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {change.gdprArticles.map((art: string) => (
                            <span key={art} className="text-[10px] bg-white border border-ink-900/10 text-ink-500 px-1.5 py-0.5 rounded">{art}</span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-ink-900/5">
                <div className="flex gap-2">
                  {((update.affectsRegions as string[]) || []).map(region => (
                    <span key={region} className="text-[11px] font-medium text-ink-500 bg-bone-100 px-2 py-0.5 rounded-full">{region}</span>
                  ))}
                </div>
                <a 
                  href={update.sourceUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--org-primary,#2c3e38)] hover:underline"
                >
                  Read original publication <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
        {filteredUpdates?.length === 0 && (
          <div className="text-center py-20 text-ink-500">No regulatory updates found.</div>
        )}
      </div>
    </div>
  );
}
