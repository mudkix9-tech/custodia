"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Loader2, RefreshCw, ChevronRight,
  ChevronDown, ExternalLink, CircleSlash, Info, EyeOff, Undo2, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Coverage panel.
//
// Shows what the banner declares against what the last successful two-pass scan
// actually observed, then the findings the evaluator drew from that comparison.
//
// The rule this panel is built around: never state more than the scan proves.
// A finding below 0.7 confidence comes from a pass that could not reliably reach a
// consented state, and is labelled as needing verification rather than presented
// as fact.
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  high: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  low: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  info: 'bg-white/5 text-[#9BA1A6] border-white/10',
};

const CATEGORY_STYLES: Record<string, string> = {
  necessary: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  functional: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  analytics: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  marketing: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  uncategorized: 'bg-white/5 text-[#9BA1A6] border-white/10',
};

const FINDING_TITLES: Record<string, string> = {
  prior_consent_violation: 'Tracker fired before consent',
  cmp_no_enforcement: 'Custodia banner does not block scripts',
  missing_category: 'Consent category the banner never offers',
  consent_mode_only: 'Consent Mode behaving correctly',
  unclassified_cookie: 'Cookie with no documented purpose',
  untracked_cookie: 'Tracker with no cookie of its own',
  consent_mode_gap: 'Consent signalling not switched on',
  vendor_undocumented: 'Processor missing from the vendor register',
};

const PASS_LABELS: Record<string, string> = {
  pre_consent: 'Before consent',
  post_consent: 'After consent',
};

const POST_CONSENT_METHOD_LABELS: Record<string, string> = {
  seeded_cookies: 'Consent seeded from the detected CMP',
  clicked: 'Accepted by clicking the banner',
  seeded_and_clicked: 'Consent seeded, then the banner clicked',
  unknown: 'Could not confirm a consented state',
};

function Chip({ className = '', children }: any) {
  return (
    <span className={`inline-flex items-center gap-1 border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}

function SeverityChip({ severity }: { severity: string }) {
  return <Chip className={SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info}>{severity}</Chip>;
}

function CategoryChip({ category, declared }: { category: string; declared?: boolean }) {
  const base = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.uncategorized;
  return (
    <Chip className={declared === false ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' : base}>
      {category}
    </Chip>
  );
}

export function CoveragePanel({ domainId }: { domainId: string }) {
  const utils = trpc.useUtils();
  const [showInfo, setShowInfo] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: coverage, isLoading: coverageLoading } =
    trpc.consent.getCoverage.useQuery({ domainId });

  const { data: findings = [], isLoading: findingsLoading } =
    trpc.consent.listFindings.useQuery({
      domainId,
      state: showResolved ? undefined : 'open',
      includeInfo: showInfo,
    });

  const { data: runs = [] } = trpc.consent.getScanRuns.useQuery({ domainId, limit: 5 });

  const runMutation = trpc.consent.runReconciliation.useMutation({
    onSuccess: () => {
      utils.consent.getScanRuns.invalidate({ domainId });
    },
  });

  const resolveMutation = trpc.consent.resolveFinding.useMutation({
    onSuccess: () => {
      utils.consent.listFindings.invalidate({ domainId });
      utils.consent.getCoverage.invalidate({ domainId });
    },
  });

  if (coverageLoading) {
    return (
      <div className="p-12 text-center text-xs text-[#6E747A] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
        Loading coverage…
      </div>
    );
  }

  // Not loading and still no data means the query failed. Saying so beats leaving
  // a spinner up, which would read as "no problems found".
  if (!coverage) {
    return (
      <div className="p-12 text-center text-xs text-[#6E747A]">
        Coverage could not be loaded. Refresh to try again.
      </div>
    );
  }

  const lastRun = coverage.lastRun;
  const counts: Record<string, number> = coverage.severityCounts ?? {};
  const latestAttempt = runs[0] ?? null;
  const scanning = latestAttempt?.status === 'running';

  const handleResolve = (id: string, resolution: string) => {
    const note = resolution === 'open'
      ? undefined
      : window.prompt(
          resolution === 'false_positive'
            ? 'Why is this a false positive? This note is kept as part of the audit trail.'
            : 'Why is this being dismissed? This note is kept as part of the audit trail.'
        );
    if (resolution !== 'open' && note === null) return;
    resolveMutation.mutate({ id, resolution: resolution as any, note: note || undefined });
  };

  return (
    <div className="fade-up space-y-6 max-w-5xl">

      {/* Scan header ------------------------------------------------------- */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <h3 className="font-semibold text-[#F4F5F6] text-[15px] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#C9A227]" />
            Tracker Reconciliation
          </h3>
          <p className="text-[13px] text-[#6E747A] leading-relaxed">
            The page is loaded twice — once without answering the banner, once with consent given —
            and every tracker seen is checked against the categories this banner declares.
          </p>
          {lastRun ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6E747A] pt-1">
              <span>
                Last scan: {format(new Date(lastRun.startedAt), 'MMM dd, yyyy h:mm a')}
              </span>
              <span className="text-ink-200">|</span>
              <span>CMP: {lastRun.cmpDetected ?? 'none detected'}</span>
              <span className="text-ink-200">|</span>
              <span>
                {lastRun.preRequestCount} hosts before consent, {lastRun.postRequestCount} after
              </span>
            </div>
          ) : (
            <p className="text-[12px] text-[#6E747A] pt-1">Never scanned.</p>
          )}
          {lastRun?.postConsentMethod === 'unknown' && (
            <div className="flex items-start gap-2 text-[12px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                This scan could not confirm it reached a consented state, so findings that depend on
                the second pass are marked as needing verification.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <Button
            onClick={() => runMutation.mutate({ domainId })}
            disabled={runMutation.isPending || scanning}
          >
            {runMutation.isPending || scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
            )}
            {scanning ? 'Scan running…' : runMutation.isPending ? 'Queuing…' : 'Run reconciliation'}
          </Button>
          {runMutation.isSuccess && !scanning && (
            <span className="text-[11px] text-[#6E747A]">
              Queued. A scan takes a couple of minutes.
            </span>
          )}
          {latestAttempt?.status === 'failed' && (
            <span className="text-[11px] text-rose-400 max-w-[16rem] md:text-right">
              Last attempt failed: {latestAttempt.error ?? 'unknown error'}
            </span>
          )}
        </div>
      </div>

      {/* Severity summary --------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['critical', 'high', 'medium', 'low', 'info'].map(severity => (
          <div
            key={severity}
            className="bg-[#0D0F11] border border-white/10 rounded-2xl p-4 shadow-panel-elevated"
          >
            <div className="text-[10px] font-bold text-[#6E747A] uppercase tracking-widest mb-1">
              {severity}
            </div>
            <div
              className={`text-2xl font-serif ${
                (counts[severity] ?? 0) > 0 && severity !== 'info'
                  ? 'text-[#F4F5F6]'
                  : 'text-[#6E747A]'
              }`}
            >
              {counts[severity] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* Declared vs observed ---------------------------------------------- */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-[#08090A]/50">
          <h4 className="font-medium text-[#F4F5F6] text-sm">Declared categories vs observed trackers</h4>
          <p className="text-[12px] text-[#6E747A] mt-0.5">
            A category with trackers but no banner option can never have consent collected for it.
          </p>
        </div>

        {!lastRun ? (
          <div className="p-12 text-center text-xs text-[#6E747A]">
            No successful scan yet. Run a reconciliation to populate this.
          </div>
        ) : coverage.categories.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6E747A]">
            The last scan matched no known trackers on this domain.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {coverage.categories.map((row: any) => {
              const isGap = !row.declared && row.trackers.length > 0;
              return (
                <div key={row.category} className="px-6 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <CategoryChip category={row.category} declared={row.declared} />
                    {row.declared ? (
                      <span className="text-[11px] text-[#6E747A]">Offered by the banner</span>
                    ) : (
                      <span className="text-[11px] text-rose-300 font-medium">
                        Not offered by the banner
                      </span>
                    )}
                    <span className="text-[11px] text-[#6E747A] ml-auto">
                      {row.trackers.length} tracker{row.trackers.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {row.trackers.length === 0 ? (
                    <p className="text-[12px] text-[#6E747A] pl-1">
                      Nothing observed needing this category.
                    </p>
                  ) : (
                    <div className={`space-y-1.5 ${isGap ? 'pl-3 border-l-2 border-rose-500/30' : 'pl-1'}`}>
                      {row.trackers.map((tracker: any) => (
                        <div
                          key={tracker.trackerKey}
                          className="flex flex-wrap items-center gap-2 text-[12px]"
                        >
                          <span className="text-[#F4F5F6] font-medium">
                            {tracker.provider || tracker.trackerKey}
                          </span>
                          <span className="font-mono text-[11px] text-[#6E747A]">
                            {tracker.hosts.join(', ')}
                          </span>
                          {tracker.identifiersPreConsent ? (
                            <Chip className="bg-rose-500/10 text-rose-300 border-rose-500/30">
                              ID sent pre-consent
                            </Chip>
                          ) : tracker.firesPreConsent && tracker.consentSignal === 'denied' ? (
                            <Chip className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                              Signalled denial
                            </Chip>
                          ) : tracker.firesPreConsent ? (
                            <Chip className="bg-amber-500/10 text-amber-300 border-amber-500/30">
                              Loads pre-consent
                            </Chip>
                          ) : (
                            <Chip className="bg-white/5 text-[#9BA1A6] border-white/10">
                              After consent only
                            </Chip>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {coverage.unmatchedHostCount > 0 && (
              <div className="px-6 py-3 text-[12px] text-[#6E747A]">
                {coverage.unmatchedHostCount} other host
                {coverage.unmatchedHostCount === 1 ? '' : 's'} loaded before consent that match no
                tracker in the registry.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Findings ----------------------------------------------------------- */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-[#08090A]/50 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-medium text-[#F4F5F6] text-sm">Findings</h4>
            <p className="text-[12px] text-[#6E747A] mt-0.5">
              Each one cites the scan that produced it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowInfo(v => !v)}
              className="text-[11px] h-auto py-1.5 px-3 text-[#6E747A] hover:text-[#F4F5F6] border border-white/10"
            >
              <Info className="w-3.5 h-3.5 mr-1.5" />
              {showInfo ? 'Hide informational' : 'Show informational'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowResolved(v => !v)}
              className="text-[11px] h-auto py-1.5 px-3 text-[#6E747A] hover:text-[#F4F5F6] border border-white/10"
            >
              {showResolved ? 'Open only' : 'Include closed'}
            </Button>
          </div>
        </div>

        {findingsLoading ? (
          <div className="p-12 text-center text-xs text-[#6E747A] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
            Loading findings…
          </div>
        ) : findings.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldCheck className="w-10 h-10 text-[#6E747A] mx-auto mb-3" />
            <p className="text-sm text-[#F4F5F6]">
              {lastRun ? 'No open findings on this domain.' : 'Nothing to report yet.'}
            </p>
            <p className="text-xs text-[#6E747A] mt-1 max-w-sm mx-auto">
              {lastRun
                ? 'Every tracker the last scan saw is covered by a category this banner offers.'
                : 'Run a reconciliation scan to check this domain.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {findings.map(({ finding, vendor }: any) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                vendor={vendor}
                expanded={expandedId === finding.id}
                onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
                onResolve={handleResolve}
                resolving={resolveMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FindingRow({ finding, vendor, expanded, onToggle, onResolve, resolving }: any) {
  // Only fetch the backing observations when someone actually opens the row.
  const { data: detail, isLoading } = trpc.consent.getFinding.useQuery(
    { id: finding.id },
    { enabled: expanded }
  );

  const confidence = finding.confidence === null ? null : Number(finding.confidence);
  const needsVerification = confidence !== null && confidence < 0.7;
  const isClosed = finding.state !== 'open';

  return (
    <div className={isClosed ? 'opacity-60' : ''}>
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-start gap-3 text-left hover:bg-[#08090A]/40 transition-colors"
      >
        <span className="mt-0.5 text-[#6E747A] shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={finding.severity} />
            <span className="text-sm font-medium text-[#F4F5F6]">
              {FINDING_TITLES[finding.findingType] ?? finding.findingType.replace(/_/g, ' ')}
            </span>
            {needsVerification && (
              <Chip className="bg-amber-500/10 text-amber-300 border-amber-500/30">
                Needs verification
              </Chip>
            )}
            {isClosed && (
              <Chip className="bg-white/5 text-[#9BA1A6] border-white/10">
                {finding.state.replace(/_/g, ' ')}
              </Chip>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6E747A]">
            {finding.observedHost && (
              <span className="font-mono text-[11px] text-[#9BA1A6]">{finding.observedHost}</span>
            )}
            {finding.provider && <span>{finding.provider}</span>}
            {finding.requiredCategory && <CategoryChip category={finding.requiredCategory} />}
            <span>Last seen {format(new Date(finding.lastSeenAt), 'MMM dd, yyyy')}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-5 pl-13 space-y-4">
          {finding.evidence?.reason && (
            <p className="text-[13px] text-[#9BA1A6] leading-relaxed max-w-2xl">
              {finding.evidence.reason}
            </p>
          )}
          {finding.evidence?.note && (
            <p className="text-[13px] text-emerald-300/80 leading-relaxed max-w-2xl">
              {finding.evidence.note}
            </p>
          )}

          {/* Sanitised evidence. The scanner never stores a raw tracker URL, so
              there is nothing here that could carry a visitor identifier. */}
          <div className="bg-[#08090A] border border-white/5 rounded-xl p-4">
            <div className="text-[10px] font-bold text-[#6E747A] uppercase tracking-widest mb-2">
              Evidence
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
              {Object.entries(finding.evidence ?? {})
                .filter(([key]) => key !== 'reason' && key !== 'note')
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="text-[#6E747A] shrink-0">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                    </dt>
                    <dd className="text-[#E6E8EA] font-mono text-[11px] break-all">
                      {Array.isArray(value) ? value.join(', ') || '—' : String(value)}
                    </dd>
                  </div>
                ))}
              {confidence !== null && (
                <div className="flex gap-2">
                  <dt className="text-[#6E747A] shrink-0">confidence:</dt>
                  <dd className="text-[#E6E8EA] font-mono text-[11px]">
                    {confidence.toFixed(2)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* What the scan actually recorded */}
          {isLoading ? (
            <div className="text-[12px] text-[#6E747A] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading observations…
            </div>
          ) : detail?.observations?.length ? (
            <div className="bg-[#08090A] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 text-[10px] font-bold text-[#6E747A] uppercase tracking-widest border-b border-white/5">
                Observed requests
                {detail.lastRun && (
                  <span className="ml-2 normal-case tracking-normal font-medium">
                    from the scan of{' '}
                    {format(new Date(detail.lastRun.startedAt), 'MMM dd, yyyy h:mm a')}
                    {detail.lastRun.postConsentMethod && (
                      <> — {POST_CONSENT_METHOD_LABELS[detail.lastRun.postConsentMethod] ?? detail.lastRun.postConsentMethod}</>
                    )}
                  </span>
                )}
              </div>
              <table className="w-full text-left text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-[#6E747A] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Host</th>
                    <th className="px-4 py-2 font-semibold">Pass</th>
                    <th className="px-4 py-2 font-semibold">Identifiers</th>
                    <th className="px-4 py-2 font-semibold">Consent signal</th>
                    <th className="px-4 py-2 font-semibold">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {detail.observations.map((observation: any) => (
                    <tr key={observation.id}>
                      <td className="px-4 py-2 font-mono text-[11px] text-[#E6E8EA]">
                        {observation.observedHost}
                      </td>
                      <td className="px-4 py-2 text-[#9BA1A6]">
                        {PASS_LABELS[observation.pass] ?? observation.pass}
                      </td>
                      <td className="px-4 py-2">
                        {observation.carriedIdentifiers ? (
                          <span className="text-rose-300">Sent</span>
                        ) : (
                          <span className="text-[#6E747A]">None</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[#9BA1A6]">
                        {observation.consentSignal ?? 'absent'}
                      </td>
                      <td className="px-4 py-2 text-[#9BA1A6]">{observation.requestCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {finding.resolutionNote && (
            <div className="text-[12px] text-[#9BA1A6]">
              <span className="text-[#6E747A]">Resolution note: </span>
              {finding.resolutionNote}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {vendor?.id && (
              <Link href={`/vendors/${vendor.id}`}>
                <Button
                  variant="ghost"
                  className="text-[11px] h-auto py-1.5 px-3 text-[#9BA1A6] hover:text-[#F4F5F6] border border-white/10"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  {vendor.name}
                </Button>
              </Link>
            )}

            {isClosed ? (
              <Button
                variant="ghost"
                disabled={resolving}
                onClick={() => onResolve(finding.id, 'open')}
                className="text-[11px] h-auto py-1.5 px-3 text-[#9BA1A6] hover:text-[#F4F5F6] border border-white/10"
              >
                <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                Reopen
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  disabled={resolving}
                  onClick={() => onResolve(finding.id, 'dismissed')}
                  className="text-[11px] h-auto py-1.5 px-3 text-[#9BA1A6] hover:text-[#F4F5F6] border border-white/10"
                >
                  <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                  Dismiss
                </Button>
                <Button
                  variant="ghost"
                  disabled={resolving}
                  onClick={() => onResolve(finding.id, 'false_positive')}
                  className="text-[11px] h-auto py-1.5 px-3 text-[#9BA1A6] hover:text-[#F4F5F6] border border-white/10"
                >
                  <CircleSlash className="w-3.5 h-3.5 mr-1.5" />
                  False positive
                </Button>
              </>
            )}

            {/* Fixing the cause closes the finding on the next scan, and that
                closure is the dated evidence of the remediation. */}
            <span className="text-[11px] text-[#6E747A] ml-1 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resolves automatically once a scan stops seeing it.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
