"use client";

import React from 'react';
import { ShieldCheck, Network, Lock, FileSearch, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ForAgenciesPage() {
  return (
    <div className="pt-24 pb-32">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 mb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700">
          Built specifically for digital, marketing, and design agencies
        </div>
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight max-w-4xl mx-auto">
          You build the internet. <br/>
          <span className="text-ink-400">We keep it compliant.</span>
        </h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto mb-10">
          Agencies face unique GDPR challenges. You are both a controller for your own data, and a processor for your clients. Generic compliance tools don't understand this. Privaro does.
        </p>
        <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
           Start free agency assessment <ArrowRight className="w-4 h-4"/>
        </Link>
      </section>

      {/* Challenges & Solutions */}
      <section className="max-w-7xl mx-auto px-6 mb-32 space-y-32">

        {/* Dual Role */}
        <div className="flex flex-col md:flex-row gap-16 items-center">
          <div className="w-full md:w-1/2">
            <div className="bg-white p-8 rounded-3xl hairline shadow-sm flex flex-col items-center text-center">
              <div className="flex gap-4 items-center mb-8 w-full justify-center">
                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-bone-100 rounded-full flex items-center justify-center mb-2 text-ink-900 font-bold">You</div>
                    <span className="text-xs text-ink-500 font-semibold uppercase tracking-widest">Controller</span>
                 </div>
                 <div className="w-16 h-[2px] bg-ink-900/10 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-ink-900/30"/>
                 </div>
                 <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mb-2 text-sage-700 font-bold">Clients</div>
                    <span className="text-xs text-sage-600 font-semibold uppercase tracking-widest">Processor</span>
                 </div>
              </div>
              <p className="text-ink-500 text-sm">Managing the complex relationship between your own data and the data you process for clients.</p>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl font-bold text-ink-900 mb-4">You're both a controller and a processor.</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
              When you manage a newsletter for a client, you're a processor. When you hire an employee, you're a controller.
              Privaro's architecture natively separates these contexts, ensuring your ROPA and policies accurately reflect your dual role.
            </p>
            <ul className="space-y-3">
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Context-aware ROPA generation</li>
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Automated Data Processing Agreements (DPAs)</li>
            </ul>
          </div>
        </div>

        {/* Client Trust */}
        <div className="flex flex-col md:flex-row-reverse gap-16 items-center">
          <div className="w-full md:w-1/2">
            <div className="bg-sage-50 border border-sage-500/20 p-8 rounded-3xl relative overflow-hidden h-64 flex items-center justify-center">
               <div className="text-center relative z-10">
                  <Lock className="w-12 h-12 text-sage-600 mx-auto mb-4"/>
                  <div className="text-xl font-bold text-ink-900 mb-2">Acme Corp Trust Center</div>
                  <div className="flex items-center justify-center gap-2 text-sm text-sage-700 bg-white/50 px-3 py-1 rounded-full w-max mx-auto border border-sage-500/10">
                     <ShieldCheck className="w-4 h-4"/> Compliant & Verified
                  </div>
               </div>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl font-bold text-ink-900 mb-4">Your clients are asking about compliance.</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
              Enterprise clients won't sign unless you can prove your GDPR posture. Don't lose deals because you're disorganized.
              Privaro lets you generate a live, verifiable Client Trust Portal with one click.
            </p>
            <ul className="space-y-3">
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Instantly shareable compliance portals</li>
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Password-protected document sharing</li>
            </ul>
          </div>
        </div>

        {/* Vendor Sprawl */}
        <div className="flex flex-col md:flex-row gap-16 items-center">
          <div className="w-full md:w-1/2">
             <div className="bg-bone-100 border border-ink-900/5 p-8 rounded-3xl h-64 flex items-center justify-center relative">
                <Network className="w-24 h-24 text-ink-900/10"/>
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="flex flex-wrap justify-center gap-2 max-w-[200px]">
                      {['Figma', 'Slack', 'HubSpot', 'Vercel', 'AWS', 'Google'].map((v, i) => (
                         <div key={i} className="bg-white text-xs font-semibold px-2 py-1 rounded shadow-sm text-ink-600">{v}</div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl font-bold text-ink-900 mb-4">You use 20+ tools that handle personal data.</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
              Between design, development, marketing, and operations, agencies use a massive stack of sub-processors.
              Tracking the compliance status of every tool manually is impossible. We automate it.
            </p>
            <ul className="space-y-3">
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Live database of 1,000+ tools</li>
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Automated transfer mechanism tracking</li>
            </ul>
          </div>
        </div>

        {/* Audit Readiness */}
        <div className="flex flex-col md:flex-row-reverse gap-16 items-center">
          <div className="w-full md:w-1/2">
             <div className="bg-white p-8 rounded-3xl hairline shadow-sm h-64 flex flex-col justify-center items-center">
                <FileSearch className="w-12 h-12 text-sage-600 mb-4"/>
                <div className="w-3/4 h-2 bg-bone-100 rounded-full mb-3"/>
                <div className="w-1/2 h-2 bg-bone-100 rounded-full mb-3"/>
                <div className="w-2/3 h-2 bg-bone-100 rounded-full mb-6"/>
                <div className="bg-sage-600 text-bone-50 text-xs font-bold px-4 py-2 rounded-lg">Download Audit File.pdf</div>
             </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl font-bold text-ink-900 mb-4">Prove compliance in seconds, not weeks.</h2>
            <p className="text-lg text-ink-500 leading-relaxed mb-6">
              When a client or a regulatory body asks for proof, you shouldn't have to scramble.
              Privaro compiles your ROPA, policies, DPAs, and vendor lists into a comprehensive, stamped audit file instantly.
            </p>
            <ul className="space-y-3">
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> One-click comprehensive audit generation</li>
               <li className="flex items-center gap-3 text-ink-700"><ShieldCheck className="w-5 h-5 text-sage-600"/> Always up-to-date and ready to send</li>
            </ul>
          </div>
        </div>

      </section>

      {/* Testimonial Placeholder */}
      <section className="max-w-4xl mx-auto px-6 mb-32 text-center">
         <div className="text-2xl font-serif text-ink-900 italic mb-6">
            "Privaro finally gave us a system that understands how our agency actually works. It replaced our messy spreadsheets and expensive legal consultant in one day."
         </div>
         <div className="font-bold text-ink-900">Sarah Jenkins</div>
         <div className="text-ink-500 text-sm">Managing Director, Digital Forward</div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 text-center">
        <div className="bg-sage-50 border border-sage-500/20 p-12 rounded-3xl relative overflow-hidden">
           <div className="relative z-10">
              <Users className="w-12 h-12 text-sage-600 mx-auto mb-6" />
              <h2 className="text-3xl font-serif text-ink-900 mb-4 tracking-tight">Ready to organize your agency?</h2>
              <p className="text-ink-600 mb-8 max-w-lg mx-auto">Join hundreds of EU agencies managing their compliance on Privaro.</p>
              <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
                 Start free assessment <ArrowRight className="w-4 h-4"/>
              </Link>
           </div>
        </div>
      </section>
    </div>
  );
}
