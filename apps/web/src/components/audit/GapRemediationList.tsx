import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';

export function GapRemediationList() {
  const { data: gaps = [], isLoading } = trpc.audit.listGaps.useQuery({});
  const utils = trpc.useUtils();
  const dismissMutation = trpc.audit.dismissGap.useMutation();
  
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  if (isLoading) return <div className="text-sm text-ink-500 p-8">Scanning for compliance gaps...</div>;

  const openGaps = ((gaps as any)?.data || gaps || []).filter((g: any) => g.status === 'open' || g.status === 'in_progress');

  const handleDismiss = async () => {
    if (!dismissingId || dismissReason.length < 10) return;
    await dismissMutation.mutateAsync({ gapId: dismissingId, reason: dismissReason });
    utils.audit.listGaps.invalidate({});
    setDismissingId(null);
    setDismissReason('');
  };

  if (openGaps.length === 0) {
    return (
      <div className="p-8 text-center bg-sage-50/50 rounded-2xl border border-sage-100">
        <CheckCircle2 className="w-12 h-12 text-sage-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-sage-900">No Compliance Gaps Detected</h3>
        <p className="text-sage-600 mt-1">Your organization is fully compliant based on the latest automated scan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {openGaps.map((gap: any) => (
        <div key={gap.id} className="bg-white border border-ink-900/10 rounded-xl p-4 flex items-start gap-4 hover:shadow-sm transition-shadow group">
          <div className="mt-1">
            <AlertCircle className={`w-5 h-5 ${
              gap.severity === 'critical' ? 'text-red-600' :
              gap.severity === 'high' ? 'text-amber-600' :
              'text-blue-600'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                gap.severity === 'critical' ? 'bg-red-100 text-red-700' :
                gap.severity === 'high' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>{gap.severity}</span>
              <h4 className="text-[14px] font-semibold text-ink-900 truncate">{gap.title}</h4>
            </div>
            <p className="text-[13px] text-ink-600">{gap.description}</p>
            <div className="mt-2 flex items-center gap-4 text-[11px] font-medium text-ink-500">
              <span>Detected: {new Date(gap.firstDetectedAt).toLocaleDateString()}</span>
              {gap.gdprArticles?.length > 0 && (
                <span className="flex items-center gap-1">
                  &bull; {gap.gdprArticles.join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {gap.resolutionUrl && (
              <Link href={gap.resolutionUrl} className="bg-sage-50 text-sage-700 hover:bg-sage-100 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                Resolve <ChevronRight className="w-3 h-3" />
              </Link>
            )}
            <button 
              onClick={() => setDismissingId(gap.id)}
              className="text-ink-400 hover:text-ink-600 text-xs font-medium px-3 py-1.5"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {/* Dismissal Modal */}
      {dismissingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-[400px] overflow-hidden shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif text-ink-900">Dismiss Gap</h3>
              <button onClick={() => setDismissingId(null)} className="text-ink-400 hover:text-ink-900"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-sm text-ink-600 mb-4">Please provide a reason for dismissing this compliance gap. This will be logged for audit purposes.</p>
            <textarea
              value={dismissReason}
              onChange={e => setDismissReason(e.target.value)}
              placeholder="e.g. This vendor does not process personal data..."
              className="w-full h-24 p-3 bg-bone-50 border border-ink-900/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDismissingId(null)} className="px-4 py-2 text-sm font-medium text-ink-600 hover:bg-bone-100 rounded-lg">Cancel</button>
              <button 
                onClick={handleDismiss} 
                disabled={dismissReason.length < 10 || dismissMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-sage-600 text-white hover:bg-sage-700 rounded-lg disabled:opacity-50"
              >
                Confirm Dismissal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
