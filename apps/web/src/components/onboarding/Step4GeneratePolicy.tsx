'use client';

import React, { useState } from 'react';

interface PolicyPreviewData {
  policyId: string;
  publicUrlPath: string;
  orgName: string;
  activities: any[];
  vendors: string[];
  policyText: string;
}

export function Step4GeneratePolicy({ 
  policyPreview, 
  onNext 
}: { 
  policyPreview: PolicyPreviewData | null, 
  onNext: (publish: boolean) => void 
}) {
  const [loading, setLoading] = useState(false);

  const handleNext = (publish: boolean) => {
    setLoading(true);
    onNext(publish);
  };

  // Guard clause for missing preview data
  if (!policyPreview) {
    return (
      <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border max-w-4xl mx-auto w-full text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Add processing activities first</h2>
        <p className="text-gray-500 mb-8">
          We need to know what data you process to generate a meaningful privacy policy.
        </p>
        <button
          onClick={() => handleNext(false)}
          className="text-blue-400 hover:text-blue-800 font-medium px-4 py-2"
        >
          Skip for now
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Review your generated privacy policy</h2>
        <p className="text-gray-500">
          We've drafted a real privacy policy using the tools and activities you just configured for <strong>{policyPreview.orgName}</strong>. 
          You can review the draft below and save it to your workspace.
        </p>
      </div>

      {/* Policy Scrollbox */}
      <div className="bg-gray-50 border rounded-lg p-6 mb-8 max-h-[500px] overflow-y-auto font-serif whitespace-pre-line text-gray-800 text-sm leading-relaxed">
        {policyPreview.policyText}
      </div>

      {/* Action Footer */}
      <div className="flex justify-between items-center border-t pt-6">
        <div>
          <button
            type="button"
            onClick={() => handleNext(false)}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 font-medium py-2"
          >
            Skip for now
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNext(true)}
            disabled={loading}
            className="text-gray-700 hover:text-gray-900 border border-gray-300 font-semibold py-2.5 px-5 rounded-lg hover:bg-gray-50 transition"
          >
            Publish policy now
          </button>
          <button
            type="button"
            onClick={() => handleNext(false)}
            disabled={loading}
            className="bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? 'Saving...' : 'Save as draft and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
