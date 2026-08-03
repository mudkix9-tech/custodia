// @ts-nocheck
"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function BreachAlertsWidget() {
  const t = useTranslations('dashboard.breach');
  const { data: alertsCount, isLoading } = trpc.vendors.getUnreadIncidentAlertsCount.useQuery();

  if (isLoading || !alertsCount || alertsCount.count === 0) return null;

  const count = alertsCount.count;

  return (
    <div className="bg-red-500/100/10 border border-red-900/50 rounded-2xl p-5 shadow-panel-elevated mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-in fade-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-red-500/100/20 flex items-center justify-center text-red-400 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-red-950 text-sm">{t('title')}</h4>
          <p className="text-xs text-red-400 mt-0.5 font-medium">
            {count === 1 
              ? t('singular') 
              : t('plural', { count })}
          </p>
        </div>
      </div>

      <Link 
        href="/vendors" 
        className="inline-flex items-center gap-1 bg-red-900 hover:bg-red-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-panel-elevated self-end sm:self-auto shrink-0"
      >
        {t('review')} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
