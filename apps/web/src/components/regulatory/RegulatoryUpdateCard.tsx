import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Info, ExternalLink, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export function RegulatoryUpdateCard({ update }: { update: any }) {
  const isUrgent = update.severity === 'action_required' || update.severity === 'urgent';
  
  // Extract matches passed down from listHistory
  const matches = update.matches || [];

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl p-6 shadow-sm hover:border-ink-900/20 transition-colors">
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

      {matches.length > 0 && (
        <div className="mb-6 bg-indigo-50/50 border border-indigo-100 rounded-xl overflow-hidden">
          <div className="bg-indigo-100/50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-700" />
            <h4 className="text-[12px] font-bold text-indigo-900 uppercase tracking-wider">Affected in your organization</h4>
          </div>
          <div className="divide-y divide-indigo-100">
            {matches.map((match: any, idx: number) => {
              const isHigh = match.confidence === 'high';
              const isAck = match.acknowledgedAt !== null;
              
              // Generate deep link based on entityType
              let entityLink = '#';
              let entityLabel = match.entityName || 'Entity';
              if (match.entityType === 'processing_activity') {
                entityLink = '/ropa';
              } else if (match.entityType === 'vendor') {
                entityLink = `/vendors`;
              } else if (match.entityType === 'dpia') {
                entityLink = `/audit?source=dpia`;
              }

              return (
                <div key={match.id} className={`p-4 ${isAck ? 'opacity-60 grayscale-[50%]' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isHigh ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {match.entityType.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-semibold text-ink-900">{entityLabel}</span>
                    </div>
                    {isAck && <span className="text-[10px] uppercase font-bold text-ink-400">Acknowledged</span>}
                  </div>
                  <p className="text-[13px] text-ink-700 mb-3">{match.aiExplanation}</p>
                  <Link href={entityLink} className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-800">
                    Review {match.entityType.replace('_', ' ')} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
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
}
