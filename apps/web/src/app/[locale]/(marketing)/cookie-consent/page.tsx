"use client";

import React from 'react';
import { Globe, ShieldCheck, Settings, Database, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function CookieConsentPage() {
  return (
    <div className="pt-24 pb-32">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 mb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700">
          <Globe className="w-4 h-4"/> Cookie Consent Management (CMP)
        </div>
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight max-w-4xl mx-auto">
          Compliant cookie banners <br/>
          <span className="text-ink-400">that don't ruin your design.</span>
        </h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto mb-10">
          A fully integrated Consent Management Platform for agencies. Manage consent across dozens of client domains from a single dashboard. GCM v2 and TCF v2.2 compliant.
        </p>
        <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
           Start free assessment <ArrowRight className="w-4 h-4"/>
        </Link>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
         <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl hairline shadow-sm">
               <ShieldCheck className="w-10 h-10 text-sage-600 mb-6"/>
               <h3 className="text-2xl font-bold text-ink-900 mb-4">Google Consent Mode v2</h3>
               <p className="text-lg text-ink-500 leading-relaxed mb-6">
                  Keep your analytics and ad tracking legal. Our CMP is fully integrated with Google Consent Mode v2, ensuring you only collect data when explicit consent is granted.
               </p>
               <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-500"/> Native GTM template</li>
                  <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-500"/> Advanced/Basic mode support</li>
               </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl hairline shadow-sm">
               <Settings className="w-10 h-10 text-sage-600 mb-6"/>
               <h3 className="text-2xl font-bold text-ink-900 mb-4">Multi-domain Agency Dashboard</h3>
               <p className="text-lg text-ink-500 leading-relaxed mb-6">
                  Stop logging into 20 different Cookiebot accounts. Manage banners, policies, and consent logs for all your clients from one centralized agency view.
               </p>
               <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-500"/> Cross-domain consent sharing</li>
                  <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-500"/> Client access provisioning</li>
               </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl hairline shadow-sm">
               <Database className="w-10 h-10 text-sage-600 mb-6"/>
               <h3 className="text-2xl font-bold text-ink-900 mb-4">Automated Cookie Scanning</h3>
               <p className="text-lg text-ink-500 leading-relaxed mb-6">
                  Our scanner crawls your domains weekly, identifying new cookies and automatically categorizing them against our database of 100,000+ known trackers.
               </p>
               <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-500"/> Auto-updating cookie declarations</li>
                  <li className="flex items-center gap-3 text-ink-700"><CheckCircle2 className="w-5 h-5 text-sage-500"/> Alerts for uncategorized cookies</li>
               </ul>
            </div>

            <div className="bg-sage-50 border border-sage-500/20 p-8 rounded-3xl flex flex-col justify-center">
               <h3 className="text-2xl font-bold text-ink-900 mb-4">More than just a banner.</h3>
               <p className="text-lg text-ink-600 leading-relaxed mb-8">
                  Unlike standalone CMPs (Cookiebot, Usercentrics), our cookie consent module is deeply integrated into the Custodia OS. When a cookie scanner detects a new vendor, it automatically prompts you to update your ROPA and Privacy Policy.
               </p>
               <Link href="/features" className="inline-flex items-center gap-2 text-sage-700 font-semibold hover:text-sage-600 transition-colors">
                  Explore all 10 modules <ArrowRight className="w-4 h-4"/>
               </Link>
            </div>
         </div>
      </section>

      {/* Setup Steps */}
      <section className="max-w-4xl mx-auto px-6 mb-32 text-center">
         <h2 className="text-3xl font-serif text-ink-900 mb-12 tracking-tight">3-step implementation</h2>
         <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center">
               <div className="w-12 h-12 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center font-bold mb-4">1</div>
               <h4 className="font-bold text-ink-900 mb-2">Add your domain</h4>
               <p className="text-sm text-ink-500">Custodia automatically scans and categorizes your cookies.</p>
            </div>
            <div className="flex flex-col items-center">
               <div className="w-12 h-12 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center font-bold mb-4">2</div>
               <h4 className="font-bold text-ink-900 mb-2">Customize design</h4>
               <p className="text-sm text-ink-500">Match the banner to your brand's specific colors and fonts.</p>
            </div>
            <div className="flex flex-col items-center">
               <div className="w-12 h-12 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center font-bold mb-4">3</div>
               <h4 className="font-bold text-ink-900 mb-2">Paste script</h4>
               <p className="text-sm text-ink-500">Add a single script tag to your site's head. You're compliant.</p>
            </div>
         </div>
      </section>

    </div>
  );
}
