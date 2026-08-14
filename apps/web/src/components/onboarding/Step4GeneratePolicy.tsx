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
      <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border border-white/10 max-w-4xl mx-auto w-full text-center">
        <h2 className="text-2xl font-serif mb-4 text-[#F4F5F6]">Add processing activities first</h2>
        <p className="text-[#9BA1A6] mb-8">
          We need to know what data you process to generate a meaningful privacy policy.
        </p>
        <button
          onClick={() => handleNext(false)}
          className="text-[#C9A227] hover:text-[#E5C463] font-medium px-4 py-2 transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border border-white/10 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-serif mb-2 text-[#F4F5F6]">Review your generated privacy policy</h2>
        <p className="text-[#9BA1A6]">
          We've drafted a real privacy policy using the tools and activities you just configured for <strong className="text-[#E6E8EA]">{policyPreview.orgName}</strong>. 
          You can review the draft below and save it to your workspace.
        </p>
      </div>

      {/* Policy Scrollbox */}
      <div className="bg-[#08090A] border border-white/10 rounded-lg p-6 mb-8 max-h-[500px] overflow-y-auto font-serif whitespace-pre-line text-[#E6E8EA] text-sm leading-relaxed">
        {policyPreview.policyText}
      </div>

      {/* Action Footer */}
      <div className="flex justify-between items-center border-t border-white/10 pt-6">
        <div>
          <button
            type="button"
            onClick={() => handleNext(false)}
            disabled={loading}
            className="text-[#9BA1A6] hover:text-[#E6E8EA] font-medium py-2 transition-colors"
          >
            Skip for now
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNext(true)}
            disabled={loading}
            className="text-[#E6E8EA] border border-white/10 font-semibold py-2.5 px-5 rounded-lg hover:bg-white/5 transition-colors"
          >
            Publish policy now
          </button>
          <button
            type="button"
            onClick={() => handleNext(false)}
            disabled={loading}
            className="bg-[#C9A227] text-[#08090A] font-semibold py-2.5 px-6 rounded-lg hover:bg-[#E5C463] transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save as draft and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
