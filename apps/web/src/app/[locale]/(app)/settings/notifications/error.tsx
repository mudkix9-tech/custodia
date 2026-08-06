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
      <h2 className="text-xl font-semibold text-set-fg mb-2">Something went wrong</h2>
      <p className="text-set-fg-muted mb-6">We couldn't load this page. Our team has been notified.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-4 py-2 bg-set-gold text-[#0A0A0A] hover:bg-set-gold-hi rounded-lg transition-colors">Try again</button>
        <Link href="/dashboard" className="px-4 py-2 border border-set-line text-set-fg rounded hover:bg-set-row-hover transition-colors">Go to dashboard</Link>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-6 text-xs text-set-fg-subtle max-w-2xl overflow-auto">{error.message}</pre>
      )}
    </div>
  );
}
