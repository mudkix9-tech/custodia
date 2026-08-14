'use client';

import React from 'react';
import Link from 'next/link';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';

export function SetupProgress() {
  const { data: status, isLoading } = trpc.onboarding.getStatus.useQuery();

  if (isLoading || !status) return null;

  // As we don't have a specific endpoint for settings available yet,
  // we'll use onboardingCompleted status. If not completed, show score as 35%
  // If completed, let's assume they don't need this progress card for this step.
  if (status.onboardingCompleted) return null;

  return <SetupProgressCard />;
}

function SetupProgressCard() {
  const t = useTranslations('dashboard.setup_progress');
  const score = 35; // Defaulting for demo before real score is available

  return (
    <div className="bg-[#0D0F11] border-2 border-blue-900/50 rounded-2xl p-6 shadow-panel-elevated mb-8 flex flex-col md:flex-row gap-6 items-start">
      <div className="flex-1">
        <h2 className="text-lg font-bold text-[#F4F5F6] mb-2">{t('title')}</h2>
        <p className="text-[#9BA1A6] mb-4 text-sm">{t('description', { score })}</p>

        <div className="space-y-3">
          <Link href="/onboarding" className="flex items-center p-3 hover:bg-white/5 rounded border border-transparent hover:border-white/10 transition">
            <div className="w-5 h-5 rounded-full border border-white/10 mr-3"></div>
            <div className="flex-1">
              <span className="font-medium text-sm text-[#F4F5F6]">{t('onboarding_title')}</span>
              <p className="text-xs text-[#6E747A]">{t('onboarding_desc')}</p>
            </div>
          </Link>

          <Link href="/ropa" className="flex items-center p-3 hover:bg-white/5 rounded border border-transparent hover:border-white/10 transition">
            <div className="w-5 h-5 rounded-full border border-white/10 mr-3"></div>
            <div className="flex-1">
              <span className="font-medium text-sm text-[#F4F5F6]">{t('ropa_title')}</span>
              <p className="text-xs text-[#6E747A]">{t('ropa_desc')}</p>
            </div>
          </Link>

          <Link href="/vendors" className="flex items-center p-3 hover:bg-white/5 rounded border border-transparent hover:border-white/10 transition">
            <div className="w-5 h-5 rounded-full border border-white/10 mr-3"></div>
            <div className="flex-1">
              <span className="font-medium text-sm text-[#F4F5F6]">{t('vendors_title')}</span>
              <p className="text-xs text-[#6E747A]">{t('vendors_desc')}</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="w-full md:w-64 bg-blue-500/10 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <div className="relative w-24 h-24 mb-3">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <path
              className="text-blue-200"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="text-blue-400"
              strokeDasharray={`${score}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-blue-900">{score}%</span>
          </div>
        </div>
        <span className="text-sm font-medium text-blue-800">Compliance Score</span>
      </div>
    </div>
  );
}
