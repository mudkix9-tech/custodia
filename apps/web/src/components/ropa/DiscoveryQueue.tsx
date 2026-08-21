"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadarIcon, Building2, Globe, PlugZap, RefreshCw } from 'lucide-react';

/**
 * C34–C36. The discovery queue: things outside the register that the register does
 * not account for.
 *
 * Read top-down and abandoned partway — which is why the server sorts by confidence
 * first and why each card carries its evidence. A suggestion with no evidence is a
 * guess, and a queue of guesses is one people learn to clear without reading.
 *
 * Accept creates a **draft** activity and takes you to it. It never publishes: a
 * vendor's typical data categories are a plausible guess about what an organisation
 * shares with it, and an Article 30 record is a statement the organisation makes
 * about itself.
 */

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  vendor_register: Building2,
  tracker_scan: Globe,
  saas_connector: PlugZap,
};

export function DiscoveryQueue() {
  const t = useTranslations('ropa.discovery');
  const router = useRouter();
  const utils = trpc.useUtils();

  const [source, setSource] = useState<'all' | 'vendor_register' | 'tracker_scan' | 'saas_connector'>('all');
  const [status, setStatus] = useState<'open' | 'dismissed' | 'accepted'>('open');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const signals = trpc.ropa.discovery.list.useQuery({ status, source, limit: 100 });
  const summary = trpc.ropa.discovery.summary.useQuery();
  const accept = trpc.ropa.discovery.accept.useMutation();
  const dismiss = trpc.ropa.discovery.dismiss.useMutation();
  const reopen = trpc.ropa.discovery.reopen.useMutation();
  const scan = trpc.ropa.discovery.scan.useMutation();

  const refresh = () => {
    utils.ropa.discovery.list.invalidate();
    utils.ropa.discovery.summary.invalidate();
  };

  const SOURCES = [
    ['all', t('source_all')],
    ['vendor_register', t('source_vendor_register')],
    ['tracker_scan', t('source_tracker_scan')],
    ['saas_connector', t('source_saas_connector')],
  ] as const;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="bg-clay-600/10 border border-clay-600/25 text-clay-600 px-4 py-2.5 rounded-xl text-[13px]">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat label={t('open_total')} value={summary.data?.openTotal ?? 0} />
        <Stat label={t('source_vendor_register')} value={summary.data?.bySource?.vendor_register ?? 0} />
        <Stat label={t('source_tracker_scan')} value={summary.data?.bySource?.tracker_scan ?? 0} />
        <Stat label={t('source_saas_connector')} value={summary.data?.bySource?.saas_connector ?? 0} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-white/10">
          {SOURCES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key as typeof source)}
              aria-pressed={source === key}
              className={`px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60 ${
                source === key
                  ? 'border-[#C9A227] text-[#C9A227] font-medium'
                  : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-[#6E747A]">
            <input
              type="checkbox"
              checked={status === 'dismissed'}
              onChange={(e) => setStatus(e.target.checked ? 'dismissed' : 'open')}
              className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
            />
            {t('show_dismissed')}
          </label>
          <Button
            variant="ghost"
            disabled={scan.isPending}
            onClick={async () => {
              setError(null);
              try { await scan.mutateAsync(); } catch (e: any) { setError(e?.message ?? t('action_failed')); }
            }}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> {t('rescan')}
          </Button>
        </div>
      </div>

      {(signals.data ?? []).length === 0 ? (
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-10 text-center">
          <RadarIcon className="w-7 h-7 text-[#6E747A] mx-auto" aria-hidden="true" />
          <p className="text-[13.5px] text-[#9BA1A6] mt-3">{status === 'open' ? t('empty_open') : t('empty_other')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(signals.data ?? []).map((s: any) => {
            const Icon = SOURCE_ICON[s.source] ?? RadarIcon;
            return (
              <div key={s.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-[#08090A] rounded-xl border border-white/10 shrink-0">
                      <Icon className="w-4 h-4 text-[#C9A227]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-[#F4F5F6]">{s.title}</p>
                      <p className="text-[12.5px] text-[#9BA1A6] mt-1">{s.description}</p>
                      <p className="text-[11.5px] text-[#6E747A] mt-2">
                        {t(`confidence_${s.confidence}` as any)} · {t('seen_times', { count: s.detectionCount })}
                      </p>
                    </div>
                  </div>

                  {s.status === 'open' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        onClick={() => { setDismissingId(dismissingId === s.id ? null : s.id); setDismissReason(''); }}
                      >
                        {t('dismiss')}
                      </Button>
                      <Button
                        onClick={async () => {
                          setError(null);
                          try {
                            const created = await accept.mutateAsync({ id: s.id });
                            refresh();
                            router.push(`/ropa/${created.activityId}`);
                          } catch (e: any) { setError(e?.message ?? t('action_failed')); }
                        }}
                      >
                        {t('accept')}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <span className="text-[11.5px] text-[#6E747A] block">{t(`status_${s.status}` as any)}</span>
                      {s.status === 'dismissed' ? (
                        <Button
                          variant="ghost"
                          onClick={async () => { await reopen.mutateAsync({ id: s.id }); refresh(); }}
                        >
                          {t('reopen')}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* The evidence, which is what turns a suggestion into a finding. */}
                {s.status === 'open' ? (
                  <dl className="mt-4 border-t border-white/5 pt-3 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                    {Object.entries(s.evidence ?? {}).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)).slice(0, 8).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-[11px] text-[#6E747A]">{key}</dt>
                        <dd className="text-[12px] text-[#E6E8EA] truncate">{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {s.status === 'dismissed' && s.dismissedReason ? (
                  <p className="mt-3 border-t border-white/5 pt-3 text-[12px] text-[#6E747A]">{s.dismissedReason}</p>
                ) : null}

                {dismissingId === s.id ? (
                  <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
                    {/* A reason is required, and it is not bureaucracy: dismissal
                        survives every future scan, so "why is this vendor not in
                        the register" has to have an answer a year later. */}
                    <label htmlFor={`dismiss-${s.id}`} className="text-[12.5px] font-medium text-[#E6E8EA] block">{t('dismiss_reason')}</label>
                    <Input
                      id={`dismiss-${s.id}`}
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      placeholder={t('dismiss_reason_ph')}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setDismissingId(null)}>{t('cancel')}</Button>
                      <Button
                        disabled={dismissReason.trim().length < 3}
                        onClick={async () => {
                          setError(null);
                          try {
                            await dismiss.mutateAsync({ id: s.id, reason: dismissReason.trim() });
                            setDismissingId(null);
                            refresh();
                          } catch (e: any) { setError(e?.message ?? t('action_failed')); }
                        }}
                      >
                        {t('dismiss')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated px-4 py-3">
      <p className="text-[11.5px] text-[#6E747A]">{label}</p>
      <p className="text-[20px] text-[#F4F5F6] mt-1">{value}</p>
    </div>
  );
}
