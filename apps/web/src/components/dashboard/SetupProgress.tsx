'use client';

import React from 'react';
import Link from 'next/link';
import { trpc } from '@/utils/trpc';

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
  const score = 35; // Defaulting for demo before real score is available

  return (
    <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-sm mb-8 flex flex-col md:flex-row gap-6 items-start">
      <div className="flex-1">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Complete your workspace setup</h2>
        <p className="text-gray-600 mb-4 text-sm">You're currently at {score}% compliance. Complete these tasks to improve your score.</p>

        <div className="space-y-3">
          <Link href="/onboarding" className="flex items-center p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition">
            <div className="w-5 h-5 rounded-full border border-gray-300 mr-3"></div>
            <div className="flex-1">
              <span className="font-medium text-sm text-gray-900">Finish Onboarding Wizard</span>
              <p className="text-xs text-gray-500">Pick up where you left off</p>
            </div>
          </Link>

          <Link href="/ropa" className="flex items-center p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition">
            <div className="w-5 h-5 rounded-full border border-gray-300 mr-3"></div>
            <div className="flex-1">
              <span className="font-medium text-sm text-gray-900">Complete your ROPA</span>
              <p className="text-xs text-gray-500">Activities need retention periods</p>
            </div>
          </Link>

          <Link href="/vendors" className="flex items-center p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition">
            <div className="w-5 h-5 rounded-full border border-gray-300 mr-3"></div>
            <div className="flex-1">
              <span className="font-medium text-sm text-gray-900">Sign vendor DPAs</span>
              <p className="text-xs text-gray-500">Vendors need signed DPAs</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="w-full md:w-64 bg-blue-50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
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
              className="text-blue-600"
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
