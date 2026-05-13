"use client";

import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, FileText, Globe, Database,
  UserCheck, BookOpen, LayoutDashboard, ChevronRight, CheckCircle2,
  Menu, X, Lock, Check, Shield, ArrowRight, XCircle
} from 'lucide-react';
import Link from 'next/link';

// --- Premium Design Constants ---

const NAV_LINKS = [
  { name: 'Features', id: 'features' },
  { name: 'For Agencies', id: 'agencies' },
  { name: 'Pricing', id: 'pricing' },
];

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

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#3F5836" />
        <path
          d="M16 7c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8z"
          fill="#EFF2EC"
        />
        <circle cx="16" cy="15" r="2.2" fill="#3F5836" />
      </svg>
      <div className="leading-none">
        <div className="font-serif text-[22px] tracking-tight text-ink-900">Privaro</div>
      </div>
    </div>
  );
}

// --- Page Component ---

export default function MarketingSite() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(true);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bone-50 text-ink-900 font-sans selection:bg-sage-500/30 overflow-x-hidden">
      
      {/* Precision Grid Background (Linear Style) */}
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center">
        <div className="w-full max-w-[1440px] h-full flex justify-between px-6 opacity-[0.04]">
          <div className="w-px h-full bg-ink-900" />
          <div className="w-px h-full bg-ink-900" />
          <div className="w-px h-full bg-ink-900 hidden md:block" />
          <div className="w-px h-full bg-ink-900 hidden lg:block" />
        </div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b ${isScrolled ? 'bg-bone-50/80 backdrop-blur-xl border-ink-900/8 py-3' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Logo />
          
          <div className="hidden lg:flex items-center gap-8 bg-bone-100/50 border border-ink-900/5 px-6 py-2 rounded-full">
            {NAV_LINKS.map(link => (
              <button 
                key={link.id} 
                onClick={() => {
                  const el = document.getElementById(link.id);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-200"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-ink-600 hover:text-ink-900 transition-colors">Sign in</Link>
            <Link href="/assessment" className="bg-sage-700 text-bone-50 shadow-card text-sm font-semibold py-2 px-4 rounded-lg hover:bg-sage-600 transition-all flex items-center gap-2">
              Start assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button className="lg:hidden text-ink-900">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-20">
        
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-4xl flex flex-col items-center">
            
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sage-600"></span>
              </span>
              GDPR fines reached €5.88 billion. Is your agency next?
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-serif tracking-tight mb-8 text-ink-900 leading-[1.05]">
              Compliance logic. <br className="hidden md:block" />
              <span className="text-ink-400">Automated precision.</span>
            </motion.h1>
            
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-ink-500 max-w-2xl mb-12 leading-relaxed">
              The only complete GDPR compliance operating system built exclusively for EU marketing, digital, and design agencies. Replace expensive consultants and messy spreadsheets.
            </motion.p>
            
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link href="/assessment" className="w-full sm:w-auto bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-card">
                Start free assessment
              </Link>
              <button className="w-full sm:w-auto bg-white/50 hover:bg-white text-ink-900 border border-ink-900/10 text-base font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
                Book a demo
              </button>
            </motion.div>

          </motion.div>
        </section>

        {/* Client Logos (Stark Monochrome) */}
        <section className="border-y border-ink-900/5 bg-bone-100/30 py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest whitespace-nowrap">Trusted by 200+ EU agencies</p>
            <div className="flex flex-wrap justify-center md:justify-end gap-x-12 gap-y-6 opacity-60 text-ink-900">
              <span className="text-xl font-bold font-serif tracking-tighter">Ogilvy</span>
              <span className="text-xl font-black tracking-widest">DEPT</span>
              <span className="text-xl font-bold italic">MediaMonks</span>
              <span className="text-xl font-bold tracking-tight">Wunderman</span>
            </div>
          </div>
        </section>

        {/* Bento Grid Features */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-32 scroll-mt-24">
          <div className="mb-20 max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight">Ten modules. One source of truth.</h2>
            <p className="text-lg text-ink-500">A unified architecture designed to assess, document, manage, respond, and prove your privacy posture effortlessly.</p>
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
                <div className="mt-8 flex items-center gap-1 text-sm font-medium text-ink-400 group-hover:text-ink-900 transition-colors cursor-pointer">
                  Explore module <ChevronRight className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Comparison Section (Austere IDE Style) */}
        <section id="agencies" className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5 scroll-mt-24">
          <h2 className="text-3xl md:text-4xl font-serif text-ink-900 mb-16 tracking-tight">The difference is in the architecture.</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* The Old Way */}
            <div className="bg-white hairline rounded-2xl p-10 font-mono text-sm">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-ink-900/5">
                <h3 className="text-ink-900 font-sans text-lg font-medium">The Old Way</h3>
                <span className="text-clay-600 bg-clay-50 border border-clay-100 px-3 py-1 rounded-full text-xs font-sans font-medium">High Risk</span>
              </div>
              <ul className="space-y-6">
                {[
                  'Spreadsheets out of date the day they are created.',
                  '€200/hr legal consultants for basic templates.',
                  'Panic mode when a client requests a compliance audit.',
                  'Manual DSAR resolution taking 20+ hours per request.'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-ink-500">
                    <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* The Privaro Way */}
            <div className="bg-sage-50 border border-sage-500/20 rounded-2xl p-10 font-mono text-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sage-500/50 to-transparent" />
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-sage-500/10">
                <h3 className="text-ink-900 font-sans text-lg font-medium">Privaro OS</h3>
                <span className="text-sage-700 bg-sage-100 px-3 py-1 rounded-full text-xs font-sans font-medium">Automated</span>
              </div>
              <ul className="space-y-6">
                {[
                  'Dynamic ROPA connected to a live vendor database.',
                  'Auto-updating privacy policies tailored to your stack.',
                  'Generate a client-facing trust dashboard instantly.',
                  'Automated DSAR intake portals and resolution workflows.'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-ink-700">
                    <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <button className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all mb-8 ${plan.popular ? 'bg-sage-600 text-bone-50 hover:bg-sage-500 shadow-card' : 'bg-bone-100 text-ink-900 hover:bg-bone-200'}`}>
                  {plan.price === '0' ? 'Start Free' : 'Get Started'}
                </button>
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
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-bone-100 border-t border-ink-900/8 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <Logo />
              </div>
              <p className="text-ink-500 text-sm leading-relaxed max-w-xs mb-8">
                The GDPR compliance operating system designed specifically for EU marketing and design agencies.
              </p>
              <div className="flex items-center gap-4 text-ink-400 text-sm font-medium">
                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> EU Hosted</span>
                <span className="flex items-center gap-1.5"><Lock className="w-4 h-4" /> SOC 2 Type II</span>
              </div>
            </div>
            
            {/* Footer Links */}
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Cookie Consent', 'Integrations', 'API Docs'] },
              { title: 'Company', links: ['About', 'Blog', 'Security', 'Careers', 'Contact'] },
              { title: 'Legal', links: ['Privacy Policy', 'Cookie Policy', 'Terms of Service', 'DPA', 'Sub-processors'] }
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-ink-900 font-medium mb-6 text-sm">{col.title}</h4>
                <ul className="space-y-4 text-sm text-ink-500">
                  {col.links.map((link, j) => (
                    <li key={j}><a href="#" className="hover:text-ink-900 transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-ink-900/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-ink-400 text-xs">© {new Date().getFullYear()} Privaro OS. All rights reserved.</p>
            <div className="flex items-center gap-2 text-xs text-ink-500 hover:text-ink-900 cursor-pointer transition-colors">
              <Globe className="w-3.5 h-3.5" /> English (EN)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
