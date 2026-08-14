import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, ChevronRight, X, Lightbulb } from 'lucide-react';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { useSearchParams } from 'next/navigation';

export function GapRemediationList() {
  const searchParams = useSearchParams();
  const sourceParam = searchParams?.get('source');
  const [filterSource, setFilterSource] = useState<'all' | 'scanner' | 'dpia'>('all');

  useEffect(() => {
    if (sourceParam === 'dpia') {
      setFilterSource('dpia');
    } else if (sourceParam === 'scanner') {
      setFilterSource('scanner');
    } else {
      setFilterSource('all');
    }
  }, [sourceParam]);

  const { data: gaps = [], isLoading } = trpc.audit.listGaps.useQuery({});
  const utils = trpc.useUtils();
  const dismissMutation = trpc.audit.dismissGap.useMutation();
  const { setContext, openPanel } = useAiGuidanceStore();
  
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  if (isLoading) return <div className="text-sm text-[#6E747A] p-8">Scanning for compliance gaps...</div>;

  const activeAndRemovedGaps = ((gaps as any)?.data || gaps || []).filter((g: any) => 
    (g.status === 'open' || g.status === 'in_progress' || g.resolvedReason === 'dpia_risk_removed') &&
    (filterSource === 'all' || 
     (filterSource === 'scanner' && g.source !== 'dpia') ||
     (filterSource === 'dpia' && g.source === 'dpia'))
  );

  const handleDismiss = async () => {
    if (!dismissingId || dismissReason.length < 10) return;
    await dismissMutation.mutateAsync({ gapId: dismissingId, reason: dismissReason });
    utils.audit.listGaps.invalidate({});
    setDismissingId(null);
    setDismissReason('');
  };

  // Click-only gap context injection (not hover)
  const handleGapClick = (gap: any) => {
    setContext({
      module: 'compliance_scoring',
      entityId: gap.id,
      formData: {
        title: gap.title,
        description: gap.description,
        severity: gap.severity,
        gdprArticles: gap.gdprArticles,
      }
    });
    openPanel();
  };

  // Determine remediation deep-link based on gap category
  const getRemediationLink = (gap: any) => {
    const articles = (gap.gdprArticles || []) as string[];
    if (articles.some((a: string) => ['5', '6', '13', '14', '30'].includes(String(a)))) return '/ropa';
    if (articles.some((a: string) => ['28', '44', '45', '46'].includes(String(a)))) return '/vendors';
    if (articles.some((a: string) => ['33', '34'].includes(String(a)))) return '/breaches';
    if (articles.some((a: string) => ['12', '15', '16', '17', '18', '20', '21'].includes(String(a)))) return '/dsar';
    return gap.resolutionUrl || null;
  };

  return (
    <div className="space-y-4">
      {/* Source Filters Tab Bar */}
      <div className="flex border-b border-white/10 text-[12.5px] font-medium gap-2 pb-1 mb-2">
        <button
          onClick={() => setFilterSource('all')}
          className={`pb-2 px-3 border-b-2 transition-colors ${
            filterSource === 'all' ? 'border-[#C9A227] text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'
          }`}
        >
          All Gaps
        </button>
        <button
          onClick={() => setFilterSource('scanner')}
          className={`pb-2 px-3 border-b-2 transition-colors ${
            filterSource === 'scanner' ? 'border-[#C9A227] text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'
          }`}
        >
          Scanner Detected
        </button>
        <button
          onClick={() => setFilterSource('dpia')}
          className={`pb-2 px-3 border-b-2 transition-colors ${
            filterSource === 'dpia' ? 'border-[#C9A227] text-[#C9A227] font-semibold' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'
          }`}
        >
          DPIA Identified
        </button>
      </div>

      {activeAndRemovedGaps.length === 0 ? (
        <div className="p-8 text-center bg-[#C9A227]/[0.07] rounded-2xl border border-[#C9A227]/25">
          <CheckCircle2 className="w-10 h-10 text-[#C9A227] mx-auto mb-3" />
          <h3 className="text-[14.5px] font-semibold text-[#F4F5F6]">No Compliance Gaps</h3>
          <p className="text-[#9BA1A6] mt-1 text-[13px]">No active compliance gaps found under the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAndRemovedGaps.map((gap: any) => {
            const isRemoved = gap.resolvedReason === 'dpia_risk_removed';
            return (
              <div 
                key={gap.id} 
                className={`bg-[#0D0F11] border rounded-xl p-4 flex items-start gap-4 hover:shadow-panel-elevated transition-shadow group ${
                  isRemoved 
                    ? 'border-[#C9A227]/30 bg-[#C9A227]/10 opacity-80' 
                    : 'border-white/10'
                }`}
              >
                <div className="mt-1">
                  {isRemoved ? (
                    <CheckCircle2 className="w-5 h-5 text-[#C9A227]" />
                  ) : (
                    <AlertCircle className={`w-5 h-5 ${
                      gap.severity === 'critical' ? 'text-red-400' :
                      gap.severity === 'high' ? 'text-amber-400' :
                      'text-blue-400'
                    }`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isRemoved ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#C9A227]/15 text-[#C9A227]">
                        Resolved
                      </span>
                    ) : (
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        gap.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        gap.severity === 'high' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-blue-100 text-blue-400'
                      }`}>{gap.severity}</span>
                    )}
                    <h4 className={`text-[14px] font-semibold text-[#F4F5F6] truncate ${isRemoved ? 'line-through text-[#6E747A]' : ''}`}>
                      {gap.title}
                    </h4>
                  </div>
                  
                  <p className="text-[13px] text-[#9BA1A6]">{gap.description}</p>
                  
                  {/* DPIA Source Badge */}
                  {gap.source === 'dpia' && gap.dpiaTitle && (
                    <div className="mt-2">
                      <span className="inline-flex items-center bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/50 text-[10px] px-2.5 py-1 rounded-md font-medium">
                        From DPIA: <Link href={gap.resolutionUrl || '/ropa'} className="underline hover:text-[#E5C463] font-bold ml-1">{gap.dpiaTitle}</Link>
                      </span>
                    </div>
                  )}

                  {/* Special notice for removed DPIA risks */}
                  {isRemoved && (
                    <p className="text-[12px] text-[#C9A227] mt-2 bg-[#C9A227]/10 border border-[#C9A227]/50 rounded-lg p-2.5 font-medium leading-relaxed">
                      💡 This compliance gap was automatically resolved because the underlying risk was removed or reassessed in the DPIA.
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-4 text-[11px] font-medium text-[#6E747A]">
                    <span>Detected: {new Date(gap.firstDetectedAt).toLocaleDateString()}</span>
                    {gap.gdprArticles?.length > 0 && (
                      <span className="flex items-center gap-1">
                        &bull; {gap.gdprArticles.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                
                {!isRemoved && (
                  <div className="flex flex-col gap-2">
                    {/* AI Explain - click-only */}
                    <button
                      onClick={() => handleGapClick(gap)}
                      className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 border border-amber-900/50 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <Lightbulb className="w-3 h-3" /> Explain
                    </button>
                    {/* Remediation deep-link */}
                    {(gap.resolutionUrl || getRemediationLink(gap)) && (
                      <Link href={gap.resolutionUrl || getRemediationLink(gap)} className="bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                        Resolve <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                    <button 
                      onClick={() => setDismissingId(gap.id)}
                      className="text-[#6E747A] hover:text-[#9BA1A6] text-xs font-medium px-3 py-1.5"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dismissal Modal */}
      {dismissingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="bg-[#0D0F11] rounded-2xl w-full max-w-[400px] overflow-hidden shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif text-[#F4F5F6]">Dismiss Gap</h3>
              <button onClick={() => setDismissingId(null)} className="text-[#6E747A] hover:text-[#F4F5F6]"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-sm text-[#9BA1A6] mb-4">Please provide a reason for dismissing this compliance gap. This will be logged for audit purposes.</p>
            <textarea
              value={dismissReason}
              onChange={e => setDismissReason(e.target.value)}
              placeholder="e.g. This vendor does not process personal data..."
              className="w-full h-24 p-3 bg-[#08090A] border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDismissingId(null)} className="px-4 py-2 text-sm font-medium text-[#9BA1A6] hover:bg-white/5 rounded-lg">Cancel</button>
              <button 
                onClick={handleDismiss} 
                disabled={dismissReason.length < 10 || dismissMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] rounded-lg disabled:opacity-50"
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
