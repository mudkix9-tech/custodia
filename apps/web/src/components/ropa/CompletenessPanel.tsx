"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';

/**
 * B25/B26 — the completeness ring and the "what's missing" list.
 *
 * The scoring itself is server-side and tested (`apps/api/src/lib/ropaCompleteness.ts`),
 * because it gates publication and a wrong verdict either lets an incomplete register
 * reach a supervisory authority or trains people to reach for the exception.
 *
 * Each unmet requirement names the Article that asks for it. That is the whole point:
 * a compliance officer learns the Regulation from the tool, and "Retention period" on
 * its own teaches nothing that "Retention period — Art. 30(1)(f)" does not.
 */

export type Requirement = {
  id: string;
  article: string;
  label: string;
  status: 'met' | 'partial' | 'missing' | 'not_applicable';
  weight: number;
  blocksPublication: boolean;
  tab: string;
  detail?: string;
};

/** Gold once the record is more right than wrong; amber while it is not. */
function ringColour(score: number) {
  return score >= 60 ? '#C9A227' : '#D97706';
}

export function CompletenessRing({ score, size = 44 }: { score: number; size?: number }) {
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${score}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColour(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-medium text-[#F4F5F6]"
        style={{ fontSize: size * 0.28 }}
      >
        {score}
      </span>
    </div>
  );
}

export function CompletenessPanel({
  score,
  missing,
  onGoToTab,
}: {
  score: number;
  missing: Requirement[];
  onGoToTab: (tab: string) => void;
}) {
  const t = useTranslations('ropa.editor.completeness');

  return (
    <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-4 fade-up">
      <div className="flex items-center gap-4 border-b border-ink-900/8 pb-4">
        <CompletenessRing score={score} size={52} />
        <div>
          <h2 className="text-[14px] font-medium text-[#F4F5F6]">{t('title')}</h2>
          <p className="text-[12px] text-[#6E747A]">
            {missing.length === 0 ? t('complete') : t('outstanding', { count: missing.length })}
          </p>
        </div>
      </div>

      {missing.length === 0 ? (
        <p className="text-[12.5px] text-[#9BA1A6] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#C9A227]" /> {t('complete_detail')}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {missing.map((req) => (
            <li key={req.id}>
              <button
                onClick={() => onGoToTab(req.tab)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors"
              >
                {req.blocksPublication ? (
                  <AlertTriangle className="w-4 h-4 text-clay-600 mt-0.5 shrink-0" />
                ) : (
                  <CircleDashed className="w-4 h-4 text-[#6E747A] mt-0.5 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-medium text-[#F4F5F6]">{req.label}</span>
                    <span className="text-[11px] text-[#6E747A] uppercase tracking-wider">{req.article}</span>
                    {req.status === 'partial' && (
                      <span className="text-[10px] text-amber-400 uppercase tracking-wider font-bold">{t('partial')}</span>
                    )}
                    {req.blocksPublication && (
                      <span className="text-[10px] text-clay-600 uppercase tracking-wider font-bold">{t('blocks')}</span>
                    )}
                  </span>
                  {req.detail && <span className="block text-[12px] text-[#6E747A] mt-1">{req.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
