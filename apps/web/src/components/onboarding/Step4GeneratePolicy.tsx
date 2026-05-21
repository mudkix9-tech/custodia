'use client';

import React, { useState } from 'react';

export function Step4GeneratePolicy({ policyPreview, onNext }: { policyPreview: any, onNext: (publish: boolean) => void }) {
  const [loading, setLoading] = useState(false);


  if (!policyPreview) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Add processing activities first</h2>
        <p className="text-gray-500 mb-8">
          We need to know what data you process to generate a meaningful privacy policy.
        </p>
        <button
          onClick={() => handleNext(false)}
          className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2"
        >
          Skip for now
        </button>
      </div>
    );
  }

  const handleNext = (publish: boolean) => {
    setLoading(true);
    onNext(publish);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Generate your privacy policy</h2>
        <p className="text-gray-500">
          We've drafted a privacy policy based on the tools and activities you just added.
          This policy will automatically update as you make changes to your workspace.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-6 mb-8 max-h-96 overflow-y-auto font-serif">
        <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
        <p className="mb-4 text-sm text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>

        <p className="mb-4">
          This Privacy Policy describes how we collect, use, and share your personal data.
        </p>

        <h2 className="text-xl font-bold mt-6 mb-2">1. Data we collect</h2>
        <p className="mb-4">
          We collect various types of information in connection with the services we provide, including:
          contact information, technical data, and behavioral data.
        </p>

        <h2 className="text-xl font-bold mt-6 mb-2">2. How we use your data</h2>
        <p className="mb-4">
          We process personal data for several purposes, relying on valid legal bases including consent,
          contractual necessity, and legitimate interests.
        </p>

        <div className="bg-blue-50 p-4 border border-blue-100 rounded text-sm text-blue-800 mt-6">
          <p className="font-medium mb-1">Auto-generated preview</p>
          <p>The full policy will be customized with your organization details and specific data categories.</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg flex items-center mb-8 border">
        <div className="bg-blue-100 p-2 rounded mr-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
        </div>
        <div>
          <h4 className="font-medium text-gray-900">Hosted Privacy Center</h4>
          <p className="text-sm text-gray-500">Your policy will be published to a dedicated URL you can link to from your website.</p>
        </div>
      </div>

      <div className="flex justify-between items-center border-t pt-6">
        <button
          onClick={() => handleNext(false)}
          disabled={loading}
          className="text-gray-600 hover:text-gray-900 font-medium px-4 py-2 border rounded-md"
        >
          Save as draft
        </button>
        <button
          onClick={() => handleNext(true)}
          disabled={loading}
          className="bg-blue-600 text-white font-medium py-2 px-8 rounded-md hover:bg-blue-700 transition"
        >
          {loading ? 'Publishing...' : 'Publish policy'}
        </button>
      </div>
    </div>
  );
}
