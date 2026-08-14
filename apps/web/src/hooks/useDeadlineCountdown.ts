"use client";

import { useEffect, useState } from 'react';

/**
 * Live countdown to a statutory deadline.
 *
 * The Article 33 banner computed its hours in a `useMemo` keyed on the deadline,
 * so the 72-hour regulator clock was frozen at whatever it read when the page
 * mounted — a tab left open overnight still showed the previous evening's
 * figure. It also rendered hours only, which is the wrong resolution for the
 * last few hours of a 72-hour window.
 *
 * Ticking is per second only inside the final hour; above that a minute is
 * enough and avoids re-rendering the whole workspace 3,600 times an hour.
 */
export type Countdown = {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  /** Hours remaining, rounded down — for thresholds like "under 24 hours". */
  hoursRemaining: number;
};

function compute(deadlineMs: number): Countdown {
  const diff = deadlineMs - Date.now();
  if (diff <= 0) {
    return { totalMs: 0, hours: 0, minutes: 0, seconds: 0, expired: true, hoursRemaining: 0 };
  }
  return {
    totalMs: diff,
    hours: Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
    hoursRemaining: Math.floor(diff / 3_600_000),
  };
}

/**
 * @param deadline  ISO string or Date; null when the record has no deadline.
 * @param paused    Stop the clock — the obligation has already been discharged.
 */
export function useDeadlineCountdown(
  deadline: string | Date | null | undefined,
  paused = false,
): Countdown | null {
  const deadlineMs = deadline ? new Date(deadline).getTime() : null;
  const valid = deadlineMs !== null && Number.isFinite(deadlineMs);

  const [countdown, setCountdown] = useState<Countdown | null>(() =>
    valid ? compute(deadlineMs) : null,
  );

  useEffect(() => {
    if (!valid || paused) return;

    const tick = () => setCountdown(compute(deadlineMs));
    tick();

    const remaining = deadlineMs - Date.now();
    const interval = remaining <= 3_600_000 ? 1000 : 60_000;
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
    // `countdown.hours` is in the deps so that crossing into the final hour
    // re-runs this and swaps the minute tick for a second one.
  }, [deadlineMs, valid, paused, countdown?.hours]);

  if (!valid) return null;
  return countdown;
}

/**
 * The absolute deadline, with the viewer's timezone named. "14 hours remaining"
 * is not something a DPO can put in a calendar or hand to a colleague in another
 * office; "16 Aug 2026, 09:12 GMT+1" is.
 */
export function formatDeadline(deadline: string | Date, locale?: string): string {
  return new Date(deadline).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
