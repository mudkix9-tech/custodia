'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export function Step6Complete({ summary, onComplete }: { summary: any, onComplete: () => void }) {
  const router = useRouter();

  const handleGoToDashboard = () => {
    onComplete();
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-2xl mx-auto w-full text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
      </div>

      <h2 className="text-3xl font-bold mb-2 text-gray-900">Your compliance workspace is set up</h2>
      <p className="text-gray-500 mb-8">You've successfully configured the foundation of your privacy program.</p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left border">
        <h3 className="font-bold text-gray-900 mb-4">What we created:</h3>
        <ul className="space-y-3">
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✓</span> Organization profile configured
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✓</span> {summary.vendorsCount || 0} vendors tracked
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✓</span> {summary.activitiesCount || 0} processing activities documented
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✓</span> Privacy policy {summary.policyPublished ? 'published' : 'saved as draft'}
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✓</span> {summary.invitesCount > 0 ? `${summary.invitesCount} team members invited` : 'Just you for now'}
          </li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-8 text-left">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900">Initial Compliance Score</h3>
          <span className="text-2xl font-bold text-blue-600">35%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2 mb-4">
          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '35%' }}></div>
        </div>
        <p className="text-sm text-gray-600 mb-4">You're off to a great start! Here's what you should do next:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
          <li>Sign DPAs with your vendors</li>
          <li>Complete your processing activities by adding retention periods</li>
          <li>Set up cookie consent for your website</li>
          <li>Complete your GDPR training</li>
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
