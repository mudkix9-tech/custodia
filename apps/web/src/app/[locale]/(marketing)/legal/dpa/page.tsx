import React from 'react';
import { FileDown } from 'lucide-react';

export default function DPAPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 font-sans text-center">
      <h1 className="text-4xl font-serif text-ink-900 mb-6">Data Processing Agreement</h1>
      <p className="text-lg text-ink-500 mb-10">
        Our DPA outlines our commitment to processing data in compliance with the GDPR. It is incorporated into our Terms of Service.
      </p>

      <div className="bg-sage-50 border border-sage-500/20 p-8 rounded-2xl flex flex-col items-center max-w-md mx-auto">
        <FileDown className="w-12 h-12 text-sage-600 mb-4" />
        <h3 className="text-xl font-bold text-ink-900 mb-2">Download DPA</h3>
        <p className="text-ink-500 text-sm mb-6">PDF Format • Version 1.0 • Pre-signed by Privaro</p>
        <button className="bg-sage-700 hover:bg-sage-600 text-bone-50 font-semibold py-2.5 px-6 rounded-lg transition-all w-full shadow-card">
          Download PDF
        </button>
      </div>
    </div>
  );
}
