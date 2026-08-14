"use client";

import * as React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastOptions = {
  /** Longer supporting line, for results that need more than a verb. */
  description?: string;
  tone?: ToastTone;
  /** ms; errors hold longer because they usually need reading. */
  duration?: number;
};

type Toast = {
  id: number;
  message: string;
  description?: string;
  tone: ToastTone;
};

export type ToastApi = (message: string, options?: ToastOptions | ToastTone) => void;

const ToastContext = React.createContext<ToastApi | null>(null);

/**
 * Product-wide toast. Previously this existed only inside the settings layout,
 * so the other ~20 flows that report success or failure did it through
 * `window.alert()` — a modal browser chrome dialog that blocks the page, cannot
 * be styled, and reads as a bug rather than a confirmation.
 *
 * Mounted once by the `(app)` layout, so `useToast()` works from any
 * authenticated page.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = React.useCallback<ToastApi>((message, options) => {
    const opts: ToastOptions = typeof options === 'string' ? { tone: options } : (options ?? {});
    const tone = opts.tone ?? 'success';
    const id = Date.now() + Math.random();

    setToasts((prev) => [...prev, { id, message, description: opts.description, tone }]);

    const duration = opts.duration ?? (tone === 'error' ? 7000 : 4000);
    timers.current.set(
      id,
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timers.current.delete(id);
      }, duration),
    );
  }, []);

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-6 bottom-6 z-[60] flex w-full max-w-sm flex-col items-end gap-2"
      >
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'rise-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-[#0D0F11] px-4 py-3 shadow-panel-elevated',
                t.tone === 'error' ? 'border-red-500/40' : 'border-white/10',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 flex-none',
                  t.tone === 'error' ? 'text-red-400' : t.tone === 'info' ? 'text-[#9BA1A6]' : 'text-[#C9A227]',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-[#F4F5F6]">{t.message}</p>
                {t.description && (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#9BA1A6]">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-mr-1 mt-0.5 flex-none rounded p-0.5 text-[#6E747A] transition-colors hover:text-[#E6E8EA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * No-op outside the provider rather than throwing: several of these components
 * are also rendered by the onboarding and public request trees, which sit
 * outside the `(app)` layout.
 */
export function useToast(): ToastApi {
  return React.useContext(ToastContext) ?? noop;
}

const noop: ToastApi = () => {};
