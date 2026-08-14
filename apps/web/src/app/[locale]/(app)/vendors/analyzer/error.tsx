'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <h2 className="text-xl font-semibold text-[#F4F5F6] mb-2">Something went wrong</h2>
      <p className="text-[#9BA1A6] mb-6">We couldn't load this page. Our team has been notified.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-4 py-2 bg-ink-900 text-white rounded hover:bg-ink-800 transition-colors">Try again</button>
        <Link href="/dashboard" className="px-4 py-2 border border-white/10 text-[#F4F5F6] rounded hover:bg-white/5 transition-colors">Go to dashboard</Link>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-6 text-xs text-[#6E747A] max-w-2xl overflow-auto">{error.message}</pre>
      )}
    </div>
  );
}
