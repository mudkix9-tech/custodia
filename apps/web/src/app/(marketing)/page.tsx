"use client";

import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, FileText, Globe, Database,
  UserCheck, LayoutDashboard, ChevronRight, CheckCircle2, Check, ArrowRight, XCircle
} from 'lucide-react';
import Link from 'next/link';

// --- Constants ---
const MODULES = [
  { icon: AlertTriangle, title: 'Compliance Gap Assessment', desc: 'Identify your immediate GDPR risks with our guided agency audit tool.', colSpan: 'md:col-span-2 lg:col-span-2' },
  { icon: Database, title: 'ROPA Management', desc: 'Dynamic Records of Processing Activities.', colSpan: 'md:col-span-1 lg:col-span-1' },
  { icon: ShieldCheck, title: 'Vendor Intelligence', desc: 'Pre-built database of 1,000+ marketing tools.', colSpan: 'md:col-span-1 lg:col-span-1' },
  { icon: FileText, title: 'Dynamic Privacy Policy', desc: 'Auto-updating legal documents tailored for agencies.', colSpan: 'md:col-span-2 lg:col-span-2' },
  { icon: Globe, title: 'Cookie Consent', desc: 'Google Consent Mode v2 and IAB TCF v2.2 compliant.', colSpan: 'md:col-span-1 lg:col-span-1' },
  { icon: UserCheck, title: 'DSAR Automation', desc: 'Streamline data subject requests workflows.', colSpan: 'md:col-span-2 lg:col-span-2' },
];

const PRICING = [
  { name: 'Free', price: '0', yearly: '0', desc: 'Gap assessment only.', features: ['Basic gap assessment', '1 User limit', 'Community support'] },
  { name: 'Starter', price: '39', yearly: '31', desc: 'For small design agencies.', features: ['ROPA (20 activities)', 'Vendor tracker (30 tools)', 'Privacy policy generator', '2 Users'], popular: false },
  { name: 'Professional', price: '89', yearly: '71', desc: 'The complete OS for growing agencies.', features: ['Everything in Starter', 'DSAR management', 'Breach workflow & DPIA', 'Cookie consent (5 domains)', 'Employee training', 'Client dashboards (10 clients)', '10 Users'], popular: true },
  { name: 'Agency', price: '179', yearly: '143', desc: 'Unlimited scale for large operations.', features: ['Everything in Pro', 'Unlimited activities & vendors', 'Unlimited clients & domains', 'Unlimited users', 'API access & Audit file generator', 'Priority support'], popular: false },
];

// --- Animations ---
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } }
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.1 } }
};

export default function MarketingSite() {
  const [annualBilling, setAnnualBilling] = useState(true);

  return (
    <>
      {/* Precision Grid Background (Linear Style) */}
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center">
        <div className="w-full max-w-[1440px] h-full flex justify-between px-6 opacity-[0.04]">
          <div className="w-px h-full bg-ink-900" />
          <div className="w-px h-full bg-ink-900" />
          <div className="w-px h-full bg-ink-900 hidden md:block" />
          <div className="w-px h-full bg-ink-900 hidden lg:block" />
        </div>
      </div>

      <div className="relative z-10 pt-16 pb-20">

        {/* Section 1 - Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-4xl flex flex-col items-center">

            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sage-600"></span>
              </span>
              GDPR fines reached €5.88 billion
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-serif tracking-tight mb-8 text-ink-900 leading-[1.05]">
              GDPR compliance shouldn't <br className="hidden md:block" />
              <span className="text-ink-400">keep you up at night.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-ink-500 max-w-2xl mb-12 leading-relaxed">
              The complete GDPR operating system for EU agencies. Assess, manage, and automate your privacy posture without the panic.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col items-center gap-4 w-full">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <Link href="/assessment" className="w-full sm:w-auto bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-card">
                  Start free assessment
                </Link>
                <Link href="/contact" className="w-full sm:w-auto bg-white/50 hover:bg-white text-ink-900 border border-ink-900/10 text-base font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
                  Book a demo
                </Link>
              </div>
              <p className="text-sm text-ink-400 mt-2">
                No credit card required • 3 minutes to complete • Free forever
              </p>
            </motion.div>

          </motion.div>
        </section>

        {/* Section 2 - Social proof bar */}
        <section className="border-y border-ink-900/5 bg-bone-100/30 py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest whitespace-nowrap">Built for EU agencies</p>
            <div className="flex flex-wrap justify-center md:justify-end gap-x-12 gap-y-6 opacity-60 text-ink-900">
              <span className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5"/> EU Hosted</span>
              <span className="text-lg font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> AES-256 Encrypted</span>
              <span className="text-lg font-bold flex items-center gap-2"><Globe className="w-5 h-5"/> GDPR Compliant</span>
            </div>
          </div>
        </section>

        {/* Section 3 - The problem */}
        <section className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5">
          <h2 className="text-3xl md:text-4xl font-serif text-ink-900 mb-4 tracking-tight text-center">Most agencies manage GDPR compliance with...</h2>
          <p className="text-lg text-ink-500 mb-16 text-center">A stressful web of disconnected tools, expensive consultants, and crossed fingers.</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white hairline rounded-2xl p-10 font-mono text-sm shadow-sm">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-ink-900/5">
                <h3 className="text-ink-900 font-sans text-lg font-medium">The Old Way</h3>
                <span className="text-clay-600 bg-clay-50 border border-clay-100 px-3 py-1 rounded-full text-xs font-sans font-medium">Chaos</span>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 text-ink-500">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Spreadsheets that are out of date the day they are created.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-500">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">€200/hr legal consultants for basic document templates.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-500">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Panic mode when a client requests a compliance audit.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-500">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Manual email threads taking 20+ hours per DSAR request.</span>
                </li>
              </ul>
            </div>

            <div className="bg-sage-50 border border-sage-500/20 rounded-2xl p-10 font-mono text-sm relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sage-500/50 to-transparent" />
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-sage-500/10">
                <h3 className="text-ink-900 font-sans text-lg font-medium">With Privaro</h3>
                <span className="text-sage-700 bg-sage-100 px-3 py-1 rounded-full text-xs font-sans font-medium">Organized</span>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 text-ink-700">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Dynamic ROPA connected to a live vendor database.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-700">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Auto-updating privacy policies tailored to your stack.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-700">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Generate a client-facing trust dashboard instantly.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-700">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Automated DSAR intake portals and resolution workflows.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 - The 10 modules */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5 scroll-mt-24">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight">Ten modules. One source of truth.</h2>
            <p className="text-lg text-ink-500 max-w-2xl">A unified architecture designed to assess, document, manage, respond, and prove your privacy posture effortlessly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`bg-bone-50 hairline rounded-2xl p-8 flex flex-col justify-between group hover:bg-bone-100/50 shadow-sm transition-colors ${mod.colSpan}`}
              >
                <div>
                  <mod.icon className="w-6 h-6 text-sage-600 mb-6 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <h3 className="text-lg font-semibold text-ink-900 mb-2">{mod.title}</h3>
                  <p className="text-ink-500 text-sm leading-relaxed">{mod.desc}</p>
                </div>
                <Link href="/features" className="mt-8 flex items-center gap-1 text-sm font-medium text-ink-400 group-hover:text-ink-900 transition-colors cursor-pointer">
                  Explore module <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
             <Link href="/features" className="text-sage-700 font-semibold hover:text-sage-600 flex items-center gap-2">
                See all features <ArrowRight className="w-4 h-4"/>
             </Link>
          </div>
        </section>

        {/* Section 5 - How it works (3 steps) */}
        <section className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight">How it works</h2>
            <p className="text-lg text-ink-500">Three simple steps to agency compliance.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center text-2xl font-bold font-serif mb-6">1</div>
              <h3 className="text-xl font-bold text-ink-900 mb-3">Take the free assessment</h3>
              <p className="text-ink-500">Answer a few simple questions about your agency's data practices.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center text-2xl font-bold font-serif mb-6">2</div>
              <h3 className="text-xl font-bold text-ink-900 mb-3">See your compliance gaps</h3>
              <p className="text-ink-500">Get an instant score and a clear, prioritized list of action items.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center text-2xl font-bold font-serif mb-6">3</div>
              <h3 className="text-xl font-bold text-ink-900 mb-3">Fix them with Privaro</h3>
              <p className="text-ink-500">Use our integrated modules to resolve issues and stay compliant.</p>
            </div>
          </div>
        </section>

        {/* Section 6 - Key differentiators */}
        <section className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5 bg-bone-100/50 rounded-3xl mb-32">
          <h2 className="text-3xl md:text-4xl font-serif text-ink-900 mb-16 tracking-tight text-center">Why Privaro?</h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-16">
            <div className="flex gap-4">
               <div className="mt-1 bg-white p-2 rounded-lg shadow-sm h-fit"><ShieldCheck className="w-6 h-6 text-sage-600"/></div>
               <div>
                  <h3 className="text-xl font-bold text-ink-900 mb-2">Built for agencies, not enterprises</h3>
                  <p className="text-ink-500 leading-relaxed">We understand your dual controller/processor role. Privaro is designed around how agencies actually operate.</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="mt-1 bg-white p-2 rounded-lg shadow-sm h-fit"><UserCheck className="w-6 h-6 text-sage-600"/></div>
               <div>
                  <h3 className="text-xl font-bold text-ink-900 mb-2">Unlimited team members</h3>
                  <p className="text-ink-500 leading-relaxed">Compliance is a team effort. We don't punish you for involving more people with per-seat pricing on our Agency tier.</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="mt-1 bg-white p-2 rounded-lg shadow-sm h-fit"><Globe className="w-6 h-6 text-sage-600"/></div>
               <div>
                  <h3 className="text-xl font-bold text-ink-900 mb-2">Client trust portals</h3>
                  <p className="text-ink-500 leading-relaxed">Prove your compliance to prospects and clients effortlessly with instantly generated, secure trust centers.</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="mt-1 bg-white p-2 rounded-lg shadow-sm h-fit"><LayoutDashboard className="w-6 h-6 text-sage-600"/></div>
               <div>
                  <h3 className="text-xl font-bold text-ink-900 mb-2">One platform replaces five tools</h3>
                  <p className="text-ink-500 leading-relaxed">Manage ROPA, vendors, consent, DSARs, and policies all in one deeply integrated, unified platform.</p>
               </div>
            </div>
          </div>
        </section>

        {/* Section 7 - Pricing preview */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5 scroll-mt-24">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight">Predictable pricing.</h2>
              <p className="text-lg text-ink-500">No hidden fees. Cancel anytime. Scale as your agency grows.</p>
            </div>

            <div className="inline-flex items-center bg-bone-100 border border-ink-900/5 p-1 rounded-xl">
              <button onClick={() => setAnnualBilling(false)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${!annualBilling ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>
                Monthly
              </button>
              <button onClick={() => setAnnualBilling(true)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annualBilling ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>
                Annually <span className="text-[10px] uppercase bg-sage-100 text-sage-700 px-1.5 py-0.5 rounded-md font-bold">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {PRICING.map((plan, i) => (
              <div key={i} className={`relative bg-bone-50 rounded-2xl p-8 flex flex-col shadow-sm ${plan.popular ? 'border border-sage-500/50 ring-1 ring-sage-500/20' : 'hairline'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-8 bg-sage-600 text-bone-50 text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-ink-900 mb-2">{plan.name}</h3>
                <p className="text-ink-500 text-sm mb-6 min-h-[40px]">{plan.desc}</p>
                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-ink-900 tracking-tight">€{annualBilling ? plan.yearly : plan.price}</span>
                  <span className="text-ink-400 text-sm font-medium">/mo</span>
                </div>
                <Link href={plan.price === '0' ? '/assessment' : '/signup'} className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all mb-8 flex justify-center items-center ${plan.popular ? 'bg-sage-600 text-bone-50 hover:bg-sage-500 shadow-card' : 'bg-bone-100 text-ink-900 hover:bg-bone-200'}`}>
                  {plan.price === '0' ? 'Start Free' : 'Get Started'}
                </Link>
                <ul className="space-y-4 mt-auto">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-ink-600">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.popular ? 'text-sage-600' : 'text-ink-300'}`} />
                      <span className="leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center">
             <Link href="/pricing" className="text-sage-700 font-semibold hover:text-sage-600 flex items-center justify-center gap-2">
                See full comparison <ArrowRight className="w-4 h-4"/>
             </Link>
          </div>
        </section>

        {/* Section 8 - Final CTA */}
        <section className="max-w-5xl mx-auto px-6 py-24 bg-sage-600 rounded-3xl text-center shadow-lift my-12 relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sage-500/50 to-transparent pointer-events-none"/>
           <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-serif text-bone-50 mb-6 tracking-tight">Find out your GDPR compliance score in 3 minutes.</h2>
              <p className="text-sage-100 text-lg mb-10 max-w-2xl mx-auto">Start with a free compliance assessment to understand exactly where your agency stands, and what you need to fix.</p>
              <Link href="/assessment" className="inline-flex bg-bone-50 hover:bg-white text-sage-700 text-base font-semibold py-4 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
                 Start free assessment <ArrowRight className="w-4 h-4"/>
              </Link>
              <p className="text-sage-100 text-sm mt-6">No credit card required. Free forever.</p>
           </div>
        </section>

      </div>
    </>
  );
}
