"use client";

import React from 'react';
import Link from 'next/link';

export default function EnterprisePage() {
  return (
    <div className="pt-24 pb-32 max-w-7xl mx-auto px-6">
      <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6">Enterprise Compliance</h1>
      <p className="text-xl text-ink-500 mb-10">Advanced security, custom roles, multi-entity support and more.</p>

      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Security & Certifications</h2>
        <p>SOC 2 Type II Certified, HIPAA compliant, ISO 27001.</p>
      </div>

      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Case Studies</h2>
        <p>Used by Fortune 500 companies to maintain global compliance.</p>
      </div>

      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Features vs Agency</h2>
        <ul className="list-disc pl-5">
          <li>SSO & Custom Roles</li>
          <li>Dedicated Database</li>
          <li>SIEM Integration</li>
          <li>Data Residency Options</li>
        </ul>
      </div>

      <Link href="mailto:sales@privaro.com" className="bg-sage-600 text-bone-50 py-3 px-8 rounded-xl font-semibold">Talk to sales</Link>
    </div>
  );
}
