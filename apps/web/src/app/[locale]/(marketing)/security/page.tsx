"use client";

import React from 'react';
import { Shield, Lock, Server, Users, Key, Database, Globe, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SecurityPage() {
  return (
    <div className="pt-24 pb-32">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700">
          <Shield className="w-4 h-4"/> Security & Trust
        </div>
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight max-w-4xl mx-auto">
          We protect your data <br/>
          <span className="text-ink-400">like you protect your clients.</span>
        </h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto mb-10">
          We build compliance software, so our security posture has to be flawless. Read about how we secure the Privaro platform.
        </p>
      </section>

      {/* Core Security Principles */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: Server, title: 'EU Infrastructure', desc: 'EU hosted on AWS Dublin (eu-west-1). Your data never leaves the EU.' },
            { icon: Lock, title: 'Encryption', desc: 'AES-256 at rest, TLS 1.3 in transit. Top-tier cryptographic standards.' },
            { icon: Users, title: 'Access Control', desc: 'Row-level security, role-based permissions, and MFA support.' },
            { icon: FileText, title: 'Certifications', desc: 'SOC 2 Type II (in progress). We adhere to the highest industry standards.' },
            { icon: Database, title: 'Data Isolation', desc: 'Multi-tenant with database-level isolation per organization.' },
            { icon: Key, title: 'Penetration Testing', desc: 'Annual third-party penetration testing to identify and fix vulnerabilities.' }
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl hairline shadow-sm flex flex-col gap-4">
               <div className="w-12 h-12 bg-sage-50 rounded-xl flex items-center justify-center border border-sage-500/20">
                  <item.icon className="w-6 h-6 text-sage-600"/>
               </div>
               <h3 className="text-xl font-bold text-ink-900">{item.title}</h3>
               <p className="text-ink-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed Policies */}
      <section className="max-w-4xl mx-auto px-6 mb-32 space-y-16">

         <div className="border-t border-ink-900/5 pt-16">
            <h2 className="text-3xl font-bold text-ink-900 mb-6">GDPR Compliance</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
               We practice what we preach — Privaro is fully GDPR compliant. We maintain our own Records of Processing Activities, manage our vendors meticulously, and have strict data retention policies in place.
            </p>
            <ul className="space-y-3 mb-6">
               <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-600"/> Data Processing Agreement (DPA) available for all customers.</li>
               <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-600"/> Strict vendor assessment and sub-processor tracking.</li>
               <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-600"/> Dedicated Data Protection Officer (DPO).</li>
            </ul>
         </div>

         <div className="border-t border-ink-900/5 pt-16">
            <h2 className="text-3xl font-bold text-ink-900 mb-6">Sub-processors</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
               We maintain transparency regarding all third-party services that process data on our behalf. Our sub-processors are carefully vetted for security and compliance.
            </p>
            <Link href="/legal/subprocessors" className="inline-flex items-center gap-2 text-sage-700 font-semibold hover:text-sage-600 transition-colors">
               View our sub-processor list <ArrowRight className="w-4 h-4"/>
            </Link>
         </div>

         <div className="border-t border-ink-900/5 pt-16">
            <h2 className="text-3xl font-bold text-ink-900 mb-6">Security Inquiries</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
               If you have specific security questions, require our DPA, or want to report a vulnerability, our security team is ready to assist.
            </p>
            <a href="mailto:security@trycustodia.online" className="inline-flex bg-bone-100 hover:bg-bone-200 text-ink-900 text-sm font-semibold py-3 px-6 rounded-xl transition-all items-center justify-center border border-ink-900/5 shadow-sm">
               Contact Security Team
            </a>
         </div>

      </section>
    </div>
  );
}
