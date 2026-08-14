"use client";

import React from 'react';
import { useLocale } from 'next-intl';
import { useDeadlineCountdown, formatDeadline } from '@/hooks/useDeadlineCountdown';

/**
 * The Article 33 clock, shared with the banner at the top of the workspace via
 * `useDeadlineCountdown` so the two cannot disagree — they previously did, the
 * banner being frozen at page load while this ticked.
 *
 * `status === 'notified'` alone never matched: the workspace writes
 * `notified_authority`, so the "notified" state below was unreachable and this
 * kept counting down in red after the obligation had already been discharged.
 * `authorityNotifiedAt` is the fact that actually settles it.
 */
export default function BreachCountdown({
  deadline,
  status,
  notifiedAt,
}: {
  deadline: string | Date;
  status: string;
  notifiedAt?: string | Date | null;
}) {
  const locale = useLocale();
  const notified = !!notifiedAt || status === 'notified' || status === 'notified_authority';
  const closed = status === 'closed';
  const timeLeft = useDeadlineCountdown(deadline, notified || closed);

  if (notified) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
        <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Notified Authority</p>
        <p className="text-sm font-medium text-green-300">
          {notifiedAt ? formatDeadline(notifiedAt, locale) : 'Recorded'}
        </p>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="bg-[#08090A] border border-white/10 rounded-lg p-3 text-center">
        <p className="text-xs font-semibold text-[#9BA1A6] uppercase tracking-wide">Case Closed</p>
      </div>
    );
  }

  if (!timeLeft) return null;

  return (
    <div
      className={`rounded-lg p-3 text-center border ${
        timeLeft.expired ? 'bg-red-500/10 border-red-500/30' : 'bg-red-600 border-red-700 text-white shadow-inner'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
          timeLeft.expired ? 'text-red-400' : 'text-red-100'
        }`}
      >
        {timeLeft.expired ? '⚠️ Deadline Passed' : 'Notification Deadline'}
      </p>
      <div
        className={`font-mono text-xl font-bold flex gap-1 justify-center tabular-nums ${
          timeLeft.expired ? 'text-red-400' : 'text-white'
        }`}
      >
        <div className="flex flex-col">
          <span>{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-[10px] font-sans opacity-70 leading-none">HRS</span>
        </div>
        <span>:</span>
        <div className="flex flex-col">
          <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-[10px] font-sans opacity-70 leading-none">MIN</span>
        </div>
        <span>:</span>
        <div className="flex flex-col">
          <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-[10px] font-sans opacity-70 leading-none">SEC</span>
        </div>
      </div>
      {/* An absolute deadline survives being screenshotted, forwarded or read tomorrow. */}
      <p className={`mt-1.5 text-[11px] ${timeLeft.expired ? 'text-red-400/80' : 'text-red-100/80'}`}>
        {formatDeadline(deadline, locale)}
      </p>
    </div>
  );
}
