'use client';

import React from 'react';
import { RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';

interface SummaryData {
  vendorsCount: number;
  activitiesCount: number;
  policyPublished: boolean;
  policyExists: boolean;
  invitesCount: number;
  cookieCount: number;
  domainName: string;
  isScanning: boolean;
  undocumentedVendorsCount: number;
}

/**
 * The handoff into the paid product. Every text node here was a light-theme
 * class on the dark card that steps 1-5 already use — `text-gray-900` on
 * `#0D0F11` — so the screen that is supposed to land the value rendered as an
 * empty panel. Repainted onto the same surfaces as the sibling steps.
 */

const NEXT_STEPS: { path: string; label: string }[] = [
  { path: '/vendors', label: 'Sign DPAs with your vendors' },
  { path: '/ropa', label: 'Complete your processing activities by adding retention periods' },
  { path: '/consent', label: 'Set up cookie consent for your website' },
  { path: '/training', label: 'Complete your GDPR training' },
];

function ChecklistItem({
  done,
  children,
  skippedLabel = 'Skipped',
}: {
  done: boolean;
  children: React.ReactNode;
  skippedLabel?: string;
}) {
  return (
    <li className="flex items-center justify-between text-sm text-[#E6E8EA]">
      <span className="flex items-center">
        {done ? (
          <span className="mr-3 font-bold text-green-400">✓</span>
        ) : (
          <span className="mr-3 font-medium text-[#6E747A]">—</span>
        )}
        <span>{children}</span>
      </span>
      {!done && (
        <span className="rounded border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6E747A]">
          {skippedLabel}
        </span>
      )}
    </li>
  );
}

export function Step6Complete({
  summary,
  onComplete,
}: {
  summary: SummaryData;
  onComplete: (targetPath?: string) => void;
}) {
  const handleGoToDashboard = () => {
    onComplete();
  };

  // This card used to print "Initial Compliance Score: 35%" as a literal, on an
  // account that had just been created and never assessed — the same fabricated
  // number the dashboard hero was carrying. What we can honestly report at this
  // point is how much of the setup was finished, so that is what it says.
  const setupSteps = [
    true, // the organisation profile is required to reach this screen
    summary.vendorsCount > 0,
    summary.activitiesCount > 0,
    summary.policyExists,
    summary.invitesCount > 0,
  ];
  const completed = setupSteps.filter(Boolean).length;
  const setupPercent = Math.round((completed / setupSteps.length) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-[#0D0F11] p-8 text-center shadow-panel-elevated">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
        <svg className="h-10 w-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>

      <h2 className="mb-2 font-serif text-3xl text-[#F4F5F6]">Your compliance workspace is set up</h2>
      <p className="mb-8 text-[#9BA1A6]">
        You&apos;ve successfully configured the foundation of your privacy program.
      </p>

      {/* Checklist Grid */}
      <div className="mb-8 rounded-lg border border-white/10 bg-[#08090A] p-6 text-left">
        <h3 className="mb-4 font-semibold text-[#F4F5F6]">What we created:</h3>
        <ul className="space-y-3">
          <ChecklistItem done>Organization profile configured</ChecklistItem>
          <ChecklistItem done={summary.vendorsCount > 0}>
            {summary.vendorsCount || 0} vendor{summary.vendorsCount === 1 ? '' : 's'} tracked
          </ChecklistItem>
          <ChecklistItem done={summary.activitiesCount > 0}>
            {summary.activitiesCount || 0} processing activit{summary.activitiesCount === 1 ? 'y' : 'ies'} documented
          </ChecklistItem>
          <ChecklistItem done={summary.policyExists}>
            Privacy policy{' '}
            {summary.policyPublished ? 'published' : summary.policyExists ? 'saved as draft' : 'not generated'}
          </ChecklistItem>
          <ChecklistItem done={summary.invitesCount > 0}>
            {summary.invitesCount > 0
              ? `${summary.invitesCount} team member${summary.invitesCount === 1 ? '' : 's'} invited`
              : 'Just you for now'}
          </ChecklistItem>
        </ul>
      </div>

      {/* Background Cookie & Vendor Scan Result Banner */}
      {summary.domainName && (
        <div className="mb-8 flex items-start gap-4 rounded-lg border border-white/10 bg-[#08090A] p-5 text-left">
          <div className="mt-0.5 shrink-0 rounded-lg bg-[#C9A227]/15 p-2.5 text-[#C9A227]">
            {summary.isScanning ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F4F5F6]">Background Cookie &amp; Vendor Scan</h4>
            {summary.isScanning ? (
              <p className="mt-1 text-xs leading-relaxed text-[#9BA1A6]">
                Currently scanning <strong className="text-[#E6E8EA]">{summary.domainName}</strong> for third-party
                trackers, cookies, and undocumented services...
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-[#9BA1A6]">
                We scanned your website <strong className="text-[#E6E8EA]">{summary.domainName}</strong> and found{' '}
                <strong className="text-[#E6E8EA]">{summary.cookieCount}</strong> cookies and{' '}
                <strong className="text-[#E6E8EA]">{summary.undocumentedVendorsCount}</strong> undocumented third-party
                services. Go to{' '}
                <button
                  onClick={() => onComplete('/vendors?tab=discovery')}
                  className="font-semibold text-[#C9A227] hover:underline"
                >
                  Vendor Discovery
                </button>{' '}
                to link or dismiss them.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Setup progress and next steps */}
      <div className="mb-8 rounded-lg border border-white/10 bg-[#08090A] p-6 text-left">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[#F4F5F6]">Setup progress</h3>
          <span className="font-serif text-2xl text-[#C9A227]">{setupPercent}%</span>
        </div>
        <div
          className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]"
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={setupSteps.length}
          aria-label="Setup progress"
        >
          <div
            className="h-2 rounded-full bg-[#C9A227] transition-[width] duration-500"
            style={{ width: `${setupPercent}%` }}
          />
        </div>
        <p className="mb-4 text-sm text-[#9BA1A6]">
          {completed} of {setupSteps.length} setup steps done. Your compliance score is calculated from your first
          assessment — pick up any of these to move it:
        </p>
        <ul className="space-y-2">
          {NEXT_STEPS.map((step) => (
            <li key={step.path}>
              <button
                type="button"
                onClick={() => onComplete(step.path)}
                className="group flex items-center gap-2 text-left text-sm font-medium text-[#C9A227] transition-colors hover:text-[#E5C463]"
              >
                <ArrowRight className="h-3.5 w-3.5 flex-none transition-transform group-hover:translate-x-0.5" />
                {step.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleGoToDashboard}
        className="w-full rounded-lg bg-[#C9A227] px-8 py-4 text-lg font-semibold text-[#08090A] shadow-panel-elevated transition-colors hover:bg-[#E5C463] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
