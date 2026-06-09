"use client";

import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, FileText, Globe, Database,
  UserCheck, LayoutDashboard, ChevronRight, CheckCircle2, Check, ArrowRight, XCircle, Users, Activity
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

// --- Components ---
const AnimatedCounter = ({ from, to, prefix = '', suffix = '' }: { from: number, to: number, prefix?: string, suffix?: string }) => {
  const [count, setCount] = useState(from);
  useEffect(() => {
    let current = from;
    const step = (to - from) / 30; // 30 frames
    const timer = setInterval(() => {
      current += step;
      if (current >= to) {
        setCount(to);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [from, to]);
  
  // Format numbers nicely
  const formatted = count >= 1000 ? count.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (Math.round(count * 100) / 100).toFixed(count % 1 === 0 ? 0 : 2);
  return <span>{prefix}{formatted}{suffix}</span>;
};

const DashboardMockup = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 50, rotateY: -10, rotateX: 10 }}
      animate={{ opacity: 1, x: 0, rotateY: -5, rotateX: 5 }}
      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
      className="relative w-full aspect-[4/3] max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden border border-ink-900/10 flex flex-col perspective-1000 transform-gpu"
      style={{ transformStyle: 'preserve-3d' }}
    >
       {/* Sidebar */}
       <div className="flex h-full">
         <div className="w-16 md:w-48 bg-bone-50 border-r border-ink-900/5 p-4 flex flex-col gap-4">
           <div className="h-6 w-6 md:w-24 bg-ink-900/10 rounded" />
           <div className="h-6 w-full bg-sage-500/10 rounded mt-4" />
           <div className="h-4 w-3/4 bg-ink-900/5 rounded" />
           <div className="h-4 w-5/6 bg-ink-900/5 rounded" />
           <div className="h-4 w-2/3 bg-ink-900/5 rounded" />
         </div>
         {/* Main Content */}
         <div className="flex-1 p-6 md:p-8 flex flex-col gap-8 bg-bone-50/30">
           {/* Header */}
           <div className="flex justify-between items-center">
             <div className="h-6 w-32 bg-ink-900/10 rounded" />
             <div className="h-8 w-8 rounded-full bg-sage-600/20" />
           </div>
           
           {/* Score Card */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-ink-900/5 flex items-center gap-6">
             <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-8 border-sage-100 flex items-center justify-center shrink-0">
               <svg className="absolute inset-0 w-full h-full -rotate-90">
                 <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="8" fill="none" className="text-sage-600" strokeDasharray="250" strokeDashoffset={250 * 0.15} />
               </svg>
               <span className="text-xl md:text-2xl font-bold text-ink-900"><AnimatedCounter from={0} to={85} /></span>
             </div>
             <div>
               <div className="text-sm text-ink-500 font-medium mb-1">Compliance Score</div>
               <div className="text-lg md:text-xl font-bold text-ink-900">Good standing</div>
             </div>
           </div>
           
           {/* Gap List */}
           <div className="bg-white rounded-xl shadow-sm border border-ink-900/5 p-4 flex flex-col gap-3">
             <div className="text-sm font-medium text-ink-900 mb-2">Priority Actions</div>
             <div className="flex justify-between items-center p-2 rounded-lg bg-ink-50/50">
               <div className="flex gap-3 items-center w-full">
                 <div className="w-8 h-8 rounded bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-amber-600"/></div>
                 <div className="flex-1 h-3 bg-ink-900/10 rounded" />
                 <div className="w-16 h-5 rounded-full bg-amber-100 shrink-0" />
               </div>
             </div>
             <div className="flex justify-between items-center p-2 rounded-lg bg-ink-50/50">
               <div className="flex gap-3 items-center w-full">
                 <div className="w-8 h-8 rounded bg-sage-100 flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4 text-sage-600"/></div>
                 <div className="flex-1 h-3 bg-ink-900/10 rounded" />
                 <div className="w-16 h-5 rounded-full bg-sage-100 shrink-0" />
               </div>
             </div>
           </div>
         </div>
       </div>
    </motion.div>
  );
};

export default function MarketingSite() {
  const [annualBilling, setAnnualBilling] = useState(true);

  return (
    <>
      {/* Precision Grid & Radial Gradient Background */}
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center bg-bone-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sage-200/40 via-transparent to-transparent opacity-60"></div>
        <div className="w-full max-w-[1440px] h-full flex justify-between px-6 opacity-[0.03]">
          <div className="w-px h-full bg-ink-900" />
          <div className="w-px h-full bg-ink-900" />
          <div className="w-px h-full bg-ink-900 hidden md:block" />
          <div className="w-px h-full bg-ink-900 hidden lg:block" />
        </div>
      </div>

      <div className="relative z-10 pt-16 pb-20">

        {/* Section 1 - Hero Section (Split Layout) */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col lg:flex-row items-center gap-16">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="flex-1 flex flex-col items-start text-left">

            <Link href="/assessment">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-sage-50 hover:bg-sage-100 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-sm font-medium text-sage-700 transition-colors cursor-pointer group shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-600 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sage-600"></span>
                </span>
                <AnimatedCounter prefix="€" suffix=" billion" from={0} to={5.88} /> in GDPR fines and counting. How compliant is your business?
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </motion.div>
            </Link>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-serif font-extrabold tracking-tight mb-8 text-ink-900 leading-[1.1]">
              GDPR compliance shouldn't <br className="hidden md:block" />
              <span className="text-ink-300">keep you up at night.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-ink-500 max-w-xl mb-12 leading-relaxed">
              Replace spreadsheets, consultants, and five separate tools with <span className="font-semibold text-sage-700">one platform</span>. ROPA documentation, vendor tracking, cookie consent, data requests, and breach management — all in one place.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <Link href="/assessment" className="group w-full sm:w-auto bg-sage-700 hover:bg-sage-600 text-bone-50 text-base font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-card hover:shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
                Start free assessment
              </Link>
              <Link href="/contact" className="w-full sm:w-auto bg-white/50 hover:bg-white text-ink-900 border border-ink-900/10 text-base font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
                Book a demo
              </Link>
            </motion.div>
            <motion.p variants={fadeUp} className="text-sm text-ink-400 mt-4">
              No credit card required • 3 minutes to complete • Free forever
            </motion.p>

          </motion.div>

          <div className="flex-1 w-full lg:w-auto flex justify-center lg:justify-end perspective-1000 hidden md:flex">
             <DashboardMockup />
          </div>
        </section>

        {/* Section 2 - Integrations Social Proof Bar */}
        <section className="border-y border-ink-900/5 bg-white py-10 overflow-hidden shadow-sm">
          <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-6">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-widest text-center">Seamlessly integrates with your agency stack</p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex flex-wrap justify-center items-center gap-x-12 md:gap-x-20 gap-y-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500"
            >
              <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-800">HubSpot</span>
              <span className="text-xl md:text-2xl font-bold tracking-tighter text-yellow-500 italic">Mailchimp</span>
              <span className="text-xl md:text-2xl font-medium tracking-tight text-blue-600 flex items-center gap-1">Google Analytics</span>
              <span className="text-xl md:text-2xl font-bold tracking-tighter text-indigo-500">stripe</span>
              <span className="text-xl md:text-2xl font-bold tracking-tight text-red-500">#slack</span>
            </motion.div>
          </div>
        </section>

        {/* Section 3 - The problem */}
        <section className="max-w-7xl mx-auto px-6 py-32">
          <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight text-center font-extrabold">Most agencies manage GDPR compliance with...</h2>
          <p className="text-lg text-ink-500 mb-16 text-center max-w-2xl mx-auto">A stressful web of disconnected tools, expensive consultants, and crossed fingers. We built Privaro to fix this.</p>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-3 rounded-full border border-ink-900/10 shadow-sm hidden md:block">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-widest">VS</span>
            </div>

            <div className="bg-white border border-ink-900/5 rounded-3xl p-10 font-mono text-sm shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-clay-500" />
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-ink-900/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-clay-50 rounded-lg"><Activity className="w-5 h-5 text-clay-600"/></div>
                  <h3 className="text-ink-900 font-sans text-xl font-bold">The Old Way</h3>
                </div>
                <span className="text-clay-600 bg-clay-50 border border-clay-100 px-3 py-1 rounded-full text-xs font-sans font-medium">Chaos</span>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 text-ink-500 group-hover:text-ink-600 transition-colors">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Spreadsheets that are out of date the day they are created.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-500 group-hover:text-ink-600 transition-colors">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">€200/hr legal consultants for basic document templates.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-500 group-hover:text-ink-600 transition-colors">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Panic mode when a client requests a compliance audit.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-500 group-hover:text-ink-600 transition-colors">
                  <XCircle className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Manual email threads taking 20+ hours per DSAR request.</span>
                </li>
              </ul>
            </div>

            <div className="bg-sage-50 border border-sage-500/20 rounded-3xl p-10 font-mono text-sm relative overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
              <div className="absolute top-0 left-0 w-full h-1 bg-sage-500" />
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-sage-500/10">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-white rounded-lg shadow-sm"><ShieldCheck className="w-5 h-5 text-sage-600"/></div>
                   <h3 className="text-ink-900 font-sans text-xl font-bold">With Privaro</h3>
                </div>
                <span className="text-sage-700 bg-sage-100 px-3 py-1 rounded-full text-xs font-sans font-medium">Organized</span>
              </div>
              <ul className="space-y-6">
                <li className="flex items-start gap-4 text-ink-700 group-hover:text-ink-900 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Dynamic ROPA connected to a live vendor database.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-700 group-hover:text-ink-900 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Auto-updating privacy policies tailored to your stack.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-700 group-hover:text-ink-900 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Generate a client-facing trust dashboard instantly.</span>
                </li>
                <li className="flex items-start gap-4 text-ink-700 group-hover:text-ink-900 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-base">Automated DSAR intake portals and resolution workflows.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 - Product Screenshot Section (Full Width) */}
        <section className="bg-ink-900 py-32 overflow-hidden border-y border-ink-800 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sage-900/40 via-transparent to-transparent opacity-50"></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
             <div className="text-center mb-16">
               <h2 className="text-3xl md:text-5xl font-serif font-extrabold text-white mb-6 tracking-tight">Everything you need. <span className="text-sage-400">Zero clutter.</span></h2>
               <p className="text-lg text-ink-300 max-w-2xl mx-auto">We designed Privaro to be powerful enough for DPOs, but simple enough for agency founders.</p>
             </div>
             
             {/* Wide CSS Representation of ROPA Editor */}
             <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="w-full bg-bone-50 rounded-2xl shadow-2xl border border-white/10 p-2 overflow-hidden"
             >
                <div className="w-full bg-white rounded-xl overflow-hidden flex flex-col md:flex-row h-[400px]">
                   {/* Sidebar */}
                   <div className="w-64 bg-bone-50 border-r border-ink-900/5 hidden md:block p-4">
                      <div className="h-4 w-24 bg-ink-900/10 rounded mb-8"></div>
                      <div className="space-y-3">
                         <div className="h-8 w-full bg-white border border-ink-900/5 rounded-md flex items-center px-3 gap-2">
                           <Database className="w-4 h-4 text-sage-600" />
                           <div className="h-2 w-16 bg-ink-900/20 rounded"></div>
                         </div>
                         <div className="h-8 w-full rounded-md flex items-center px-3 gap-2">
                           <Users className="w-4 h-4 text-ink-300" />
                           <div className="h-2 w-20 bg-ink-900/10 rounded"></div>
                         </div>
                         <div className="h-8 w-full rounded-md flex items-center px-3 gap-2">
                           <Globe className="w-4 h-4 text-ink-300" />
                           <div className="h-2 w-12 bg-ink-900/10 rounded"></div>
                         </div>
                      </div>
                   </div>
                   {/* Main Panel */}
                   <div className="flex-1 p-8 bg-white relative">
                      <div className="flex justify-between items-center mb-8 pb-4 border-b border-ink-900/5">
                        <div className="h-6 w-48 bg-ink-900/10 rounded"></div>
                        <div className="h-8 w-24 bg-sage-600 rounded-md"></div>
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                           <div key={i} className="flex items-center gap-4 p-4 border border-ink-900/5 rounded-lg bg-bone-50/30">
                              <div className="h-4 w-4 rounded-full bg-ink-900/10"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-1/3 bg-ink-900/20 rounded"></div>
                                <div className="h-2 w-1/2 bg-ink-900/10 rounded"></div>
                              </div>
                              <div className="h-6 w-20 bg-sage-100 rounded-full"></div>
                           </div>
                        ))}
                      </div>

                      {/* Tooltip Annotation */}
                      <motion.div 
                         initial={{ opacity: 0, scale: 0.9 }}
                         whileInView={{ opacity: 1, scale: 1 }}
                         transition={{ delay: 0.5 }}
                         className="absolute top-32 right-12 bg-ink-900 text-white p-4 rounded-xl shadow-xl w-64 border border-white/10"
                      >
                         <div className="absolute -left-2 top-4 w-4 h-4 bg-ink-900 rotate-45"></div>
                         <p className="text-sm font-bold mb-1">Auto-mapped vendors</p>
                         <p className="text-xs text-ink-300 leading-relaxed">Privaro automatically links your ROPA entries to our live vendor database.</p>
                      </motion.div>
                   </div>
                </div>
             </motion.div>
          </div>
        </section>

        {/* Section 5 - The 10 modules */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-32 scroll-mt-24">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight font-extrabold">Ten modules. One source of truth.</h2>
            <p className="text-lg text-ink-500 max-w-2xl mx-auto">A unified architecture designed to assess, document, manage, respond, and prove your privacy posture effortlessly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`bg-white border border-ink-900/5 rounded-2xl p-8 flex flex-col justify-between group hover:bg-bone-50 hover:-translate-y-1 hover:shadow-lg hover:border-sage-500/20 shadow-sm transition-all duration-300 ${mod.colSpan}`}
              >
                <div>
                  <div className="w-12 h-12 bg-sage-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                     <mod.icon className="w-6 h-6 text-sage-600" />
                  </div>
                  <h3 className="text-xl font-bold text-ink-900 mb-2">{mod.title}</h3>
                  <p className="text-ink-500 text-sm leading-relaxed">{mod.desc}</p>
                </div>
                <Link href="/features" className="mt-8 flex items-center gap-1 text-sm font-semibold text-sage-700 group-hover:text-sage-600 transition-colors cursor-pointer w-fit">
                  Explore module <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section 6 - How it works (3 steps) */}
        <section className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5 bg-bone-50 rounded-3xl mb-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif text-ink-900 mb-6 tracking-tight font-extrabold">How it works</h2>
            <p className="text-lg text-ink-500">Three simple steps to agency compliance.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-sage-200 via-sage-300 to-sage-200" />
            
            <div className="flex flex-col items-center relative z-10">
              <div className="w-24 h-24 bg-white border-[8px] border-bone-50 shadow-sm text-sage-700 rounded-full flex items-center justify-center text-3xl font-extrabold font-serif mb-6 group-hover:scale-110 transition-transform">1</div>
              <h3 className="text-xl font-bold text-ink-900 mb-3">Take the free assessment</h3>
              <p className="text-ink-500 max-w-xs">Answer a few simple questions about your agency's data practices.</p>
            </div>
            <div className="flex flex-col items-center relative z-10">
              <div className="w-24 h-24 bg-white border-[8px] border-bone-50 shadow-sm text-sage-700 rounded-full flex items-center justify-center text-3xl font-extrabold font-serif mb-6">2</div>
              <h3 className="text-xl font-bold text-ink-900 mb-3">See your compliance gaps</h3>
              <p className="text-ink-500 max-w-xs">Get an instant score and a clear, prioritized list of action items.</p>
            </div>
            <div className="flex flex-col items-center relative z-10">
              <div className="w-24 h-24 bg-white border-[8px] border-bone-50 shadow-sm text-sage-700 rounded-full flex items-center justify-center text-3xl font-extrabold font-serif mb-6">3</div>
              <h3 className="text-xl font-bold text-ink-900 mb-3">Fix them with Privaro</h3>
              <p className="text-ink-500 max-w-xs">Use our integrated modules to resolve issues and stay compliant.</p>
            </div>
          </div>
        </section>

        {/* Section 7 - Pricing preview */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-32 border-t border-ink-900/5 scroll-mt-24">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-5xl font-serif font-extrabold text-ink-900 mb-6 tracking-tight">Predictable pricing.</h2>
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
              <div key={i} className={`relative bg-bone-50 rounded-2xl p-8 flex flex-col shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md ${plan.popular ? 'border-2 border-sage-500' : 'border border-ink-900/10'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sage-600 text-bone-50 text-[10px] font-bold uppercase tracking-widest py-1 px-4 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-ink-900 mb-2">{plan.name}</h3>
                <p className="text-ink-500 text-sm mb-6 min-h-[40px]">{plan.desc}</p>
                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-ink-900 tracking-tight">€{annualBilling ? plan.yearly : plan.price}</span>
                  <span className="text-ink-400 text-sm font-medium">/mo</span>
                </div>
                <Link href={plan.price === '0' ? '/assessment' : '/signup'} className={`w-full py-3 rounded-xl text-sm font-bold transition-all mb-8 flex justify-center items-center ${plan.popular ? 'bg-sage-600 text-bone-50 hover:bg-sage-700 shadow-card' : 'bg-white border border-ink-900/10 text-ink-900 hover:bg-bone-100'}`}>
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
             <Link href="/pricing" className="text-sage-700 font-semibold hover:text-sage-600 flex items-center justify-center gap-2 group">
                See full comparison <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
             </Link>
          </div>
        </section>

        {/* Section 8 - Final CTA */}
        <section className="max-w-5xl mx-auto px-6 py-24 bg-sage-700 rounded-3xl text-center shadow-2xl my-12 relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-sage-500/50 to-transparent pointer-events-none"/>
           <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-serif text-bone-50 mb-6 tracking-tight font-extrabold">Ready to secure your agency?</h2>
              <p className="text-sage-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto">Start with a free compliance assessment to understand exactly where your agency stands, and what you need to fix.</p>
              <Link href="/assessment" className="inline-flex bg-bone-50 hover:bg-white text-sage-700 text-lg font-bold py-4 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-xl group">
                 Start free assessment <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
              </Link>
              <p className="text-sage-200 text-sm mt-6 font-medium">No credit card required. Free forever.</p>
           </div>
        </section>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </>
  );
}
