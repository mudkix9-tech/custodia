'use client';

import React from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

interface SummaryData {
  vendorsCount: number;
  activitiesCount: number;
  policyPublished: boolean;
  policyExists: boolean;
  invitesCount: number;
  cookieCount: number;
  domainName: string;
  isScanning: boolean;
  undocumentedVendorsCount: number;
}

export function Step6Complete({ 
  summary, 
  onComplete 
}: { 
  summary: SummaryData, 
  onComplete: (targetPath?: string) => void 
}) {
  const handleGoToDashboard = () => {
    onComplete();
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-2xl mx-auto w-full text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>

      <h2 className="text-3xl font-bold mb-2 text-gray-900">Your compliance workspace is set up</h2>
      <p className="text-gray-500 mb-8">You've successfully configured the foundation of your privacy program.</p>

      {/* Checklist Grid */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left border">
        <h3 className="font-bold text-gray-900 mb-4">What we created:</h3>
        <ul className="space-y-3">
          <li className="flex items-center justify-between text-sm text-gray-700">
            <span className="flex items-center">
              <span className="text-green-500 font-bold mr-3">✓</span>
              <span>Organization profile configured</span>
            </span>
          </li>
          <li className="flex items-center justify-between text-sm text-gray-700">
            <span className="flex items-center">
              {summary.vendorsCount > 0 ? (
                <span className="text-green-500 font-bold mr-3">✓</span>
              ) : (
                <span className="text-gray-400 font-medium mr-3">—</span>
              )}
              <span>{summary.vendorsCount || 0} vendor{summary.vendorsCount === 1 ? '' : 's'} tracked</span>
            </span>
            {summary.vendorsCount === 0 && (
              <span className="text-[10px] bg-gray-200/60 text-gray-500 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Skipped</span>
            )}
          </li>
          <li className="flex items-center justify-between text-sm text-gray-700">
            <span className="flex items-center">
              {summary.activitiesCount > 0 ? (
                <span className="text-green-500 font-bold mr-3">✓</span>
              ) : (
                <span className="text-gray-400 font-medium mr-3">—</span>
              )}
              <span>{summary.activitiesCount || 0} processing activit{summary.activitiesCount === 1 ? 'y' : 'ies'} documented</span>
            </span>
            {summary.activitiesCount === 0 && (
              <span className="text-[10px] bg-gray-200/60 text-gray-500 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Skipped</span>
            )}
          </li>
          <li className="flex items-center justify-between text-sm text-gray-700">
            <span className="flex items-center">
              {summary.policyExists ? (
                <span className="text-green-500 font-bold mr-3">✓</span>
              ) : (
                <span className="text-gray-400 font-medium mr-3">—</span>
              )}
              <span>Privacy policy {summary.policyPublished ? 'published' : summary.policyExists ? 'saved as draft' : 'not generated'}</span>
            </span>
            {!summary.policyExists && (
              <span className="text-[10px] bg-gray-200/60 text-gray-500 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Skipped</span>
            )}
          </li>
          <li className="flex items-center justify-between text-sm text-gray-700">
            <span className="flex items-center">
              {summary.invitesCount > 0 ? (
                <span className="text-green-500 font-bold mr-3">✓</span>
              ) : (
                <span className="text-gray-400 font-medium mr-3">—</span>
              )}
              <span>{summary.invitesCount > 0 ? `${summary.invitesCount} team member${summary.invitesCount === 1 ? '' : 's'} invited` : 'Just you for now'}</span>
            </span>
            {summary.invitesCount === 0 && (
              <span className="text-[10px] bg-gray-200/60 text-gray-500 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Skipped</span>
            )}
          </li>
        </ul>
      </div>

      {/* Background Cookie & Vendor Scan Result Banner */}
      {summary.domainName && (
        <div className="bg-gray-50 border rounded-lg p-5 mb-8 text-left flex items-start gap-4">
          <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600 shrink-0 mt-0.5">
            {summary.isScanning ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">Background Cookie &amp; Vendor Scan</h4>
            {summary.isScanning ? (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Currently scanning <strong>{summary.domainName}</strong> for third-party trackers, cookies, and undocumented services...
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                We scanned your website <strong>{summary.domainName}</strong> and found <strong>{summary.cookieCount}</strong> cookies and <strong>{summary.undocumentedVendorsCount}</strong> undocumented third-party services. Go to <button onClick={() => onComplete('/vendors?tab=discovery')} className="text-blue-600 font-semibold hover:underline">Vendor Discovery</button> to link or dismiss them.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Compliance Score and Next Steps */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-8 text-left">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900">Initial Compliance Score</h3>
          <span className="text-2xl font-bold text-blue-600">35%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2 mb-4">
          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '35%' }}></div>
        </div>
        <p className="text-sm text-gray-600 mb-4">You're off to a great start! Click any next step below to jump directly to that module:</p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
          <li>
            <button
              type="button"
              onClick={() => onComplete('/vendors')}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-left transition-colors"
            >
              Sign DPAs with your vendors
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onComplete('/ropa')}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-left transition-colors"
            >
              Complete your processing activities by adding retention periods
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onComplete('/consent')}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-left transition-colors"
            >
              Set up cookie consent for your website
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onComplete('/training')}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-left transition-colors"
            >
              Complete your GDPR training
            </button>
          </li>
        </ul>
      </div>

      <button
        onClick={handleGoToDashboard}
        className="w-full bg-blue-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-blue-700 transition shadow-sm text-lg"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
