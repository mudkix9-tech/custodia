"use client";

import * as React from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };

type ToastApi = (message: string, tone?: ToastTone) => void;

const SettingsToastContext = React.createContext<ToastApi | null>(null);

/**
 * Settings-scoped toast. Mounted once by the settings layout; call
 * `useSettingsToast()` from any page inside it.
 */
export function SettingsToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = React.useCallback<ToastApi>((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    timers.current.push(
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600)
    );
  }, []);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <SettingsToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-7 bottom-6 z-50 flex flex-col items-end gap-2"
      >
        {toasts.map((t) => {
          const Icon =
            t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              className={cn(
                'rise-in pointer-events-auto flex items-center gap-2.5 rounded-[10px] border bg-set-hover px-4 py-3 shadow-[var(--shadow-set-toast)]',
                t.tone === 'error' ? 'border-set-danger/40' : 'border-set-gold/30'
              )}
            >
              <Icon
                className={cn(
                  'h-[15px] w-[15px] flex-none',
                  t.tone === 'error' ? 'text-set-danger' : 'text-set-gold'
                )}
              />
              <span className="text-[13px] text-set-fg">{t.message}</span>
            </div>
          );
        })}
      </div>
    </SettingsToastContext.Provider>
  );
}

export function useSettingsToast(): ToastApi {
  const ctx = React.useContext(SettingsToastContext);
  // No-op outside the settings layout rather than throwing — pages under
  // /settings are the only consumers, but nested routes may render standalone.
  return ctx ?? noop;
}

const noop: ToastApi = () => {};
