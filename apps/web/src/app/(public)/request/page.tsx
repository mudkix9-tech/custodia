import React from 'react';
import { RequestSearchForm } from './RequestSearchForm';

export default function GenericDsarRequestPage() {
  return (
    <div className="min-h-screen bg-bone-50 py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto text-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-ink-900/10 flex items-center justify-center mx-auto mb-8">
          <svg className="w-8 h-8 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-serif text-ink-900 mb-4">Privacy Request Portal</h1>
        <p className="text-ink-600 mb-10">
          Which organization are you submitting a Data Subject Access Request to?
        </p>

        <RequestSearchForm />
      </div>
    </div>
  );
}
