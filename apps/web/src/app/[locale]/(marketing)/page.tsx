"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Database, UserCheck, ChevronRight, CheckCircle2, Menu, X, 
  Lock, Check, ArrowRight, XCircle, Activity, Server, CheckCircle, 
  ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';

// --- Premium Design Constants ---

const NAV_LINKS = [
  { name: 'Features', id: 'features' },
  { name: 'Risk Calculator', id: 'risk-calculator' },
  { name: 'DPA Alignment', id: 'authorities' },
  { name: 'Pricing', id: 'pricing' },
];

const MODULES = [
  { 
    tag: "Assessment",
    title: 'Continuous Gap Audit', 
    desc: 'Deep-scans your business operations against a checklist of 142 GDPR requirements. Identifies gaps instantly.', 
    colSpan: 'md:col-span-2 lg:col-span-2' 
  },
  { 
    tag: "ROPA Ledger",
    title: 'Dynamic ROPA Generator', 
    desc: 'Maintains cryptographically verifiable Article 30 Records of Processing Activities that auto-update as your stack changes.', 
    colSpan: 'md:col-span-1 lg:col-span-1' 
  },
  { 
    tag: "Vendor Intel",
    title: 'Vendor Risk Directory', 
    desc: 'Over 1,000+ pre-audited sub-processors. Instantly maps their headquarters, data paths, and public DPAs.', 
    colSpan: 'md:col-span-1 lg:col-span-1' 
  },
  { 
    tag: "Dynamic Docs",
    title: 'Self-Updating Privacy Policies', 
    desc: 'Generate hosted, responsive privacy and cookie policies connected to your active vendor list via webhooks.', 
    colSpan: 'md:col-span-2 lg:col-span-2' 
  },
  { 
    tag: "Consent Management",
    title: 'Consent Mode v2 Banner', 
    desc: 'Edge-delivered consent collection script. Full compatibility with Google Consent Mode v2 and IAB TCF v2.2.', 
    colSpan: 'md:col-span-1 lg:col-span-1' 
  },
  { 
    tag: "Subject Rights",
    title: 'Automated DSAR Vault', 
    desc: 'Verify requestor identity, execute secure data exports, and automatically track the statutory 30-day response window.', 
    colSpan: 'md:col-span-2 lg:col-span-2' 
  },
];

const AUTHORITIES = [
  { 
    code: 'IE DPC', 
    name: 'Data Protection Commission', 
    country: 'Ireland', 
    focus: 'Lead authority for major tech and cross-border SaaS companies.', 
    enforcement: 'High focus on analytics tracking consent and marketing profiling.' 
  },
  { 
    code: 'CNIL', 
    name: 'Commission Nationale', 
    country: 'France', 
    focus: 'Highly strict regulatory standards for cookies and analytics trackers.', 
    enforcement: 'Enforces prior-consent mechanisms and active user opt-out options.' 
  },
  { 
    code: 'BfDI', 
    name: 'Der Bundesbeauftragte', 
    country: 'Germany', 
    focus: 'Federal authority enforcing sovereign data hosting and workspace logs.', 
    enforcement: 'Strict rules governing employee records and local EU cloud architecture.' 
  },
  { 
    code: 'AEPD', 
    name: 'Agencia Española', 
    country: 'Spain', 
    focus: 'Leads the EU in the volume of administrative compliance investigations.', 
    enforcement: 'Heavy enforcement against spam lists, email outreach, and cookie walls.' 
  },
  { 
    code: 'Garante', 
    name: 'Garante Privacy', 
    country: 'Italy', 
    focus: 'Aggressive enforcement regarding automated decisions and AI training datasets.', 
    enforcement: 'Demands transparent lawful bases for marketing automation systems.' 
  },
];

const INTEGRATIONS = [
  { name: 'HubSpot', category: 'CRM & Marketing' },
  { name: 'Mailchimp', category: 'Email Campaigns' },
  { name: 'Google Analytics 4', category: 'Web Analytics' },
  { name: 'Stripe', category: 'Payments' },
  { name: 'Slack', category: 'Alerting' },
  { name: 'Amazon Web Services', category: 'Infrastructure' },
  { name: 'Salesforce', category: 'Enterprise CRM' }
];

const PRICING = [
  { 
    name: 'Free Starter', 
    price: '0', 
    yearly: '0', 
    desc: 'Baseline assessment tools.', 
    features: ['GDPR Gap Assessment', '1 Admin Seat', 'Regulatory News Updates', 'Self-Serve Help Docs'] 
  },
  { 
    name: 'Starter Package', 
    price: '39', 
    yearly: '31', 
    desc: 'Designed for small boutique digital agencies.', 
    features: ['Dynamic ROPA (20 activities)', 'Vendor Tracker (30 processors)', 'Hosted Privacy Policy', '2 Admin Seats', 'Standard Email Support'], 
    popular: false 
  },
  { 
    name: 'Professional OS', 
    price: '89', 
    yearly: '71', 
    desc: 'Complete compliance management system for growing organizations.', 
    features: ['Unlimited ROPA activities', 'Unlimited tracked vendors', 'Hosted Cookie Consent banner', 'DSAR Intake Portal', 'DPIA Risk Assessment wizard', 'Client Dashboards (up to 10 clients)', '10 Admin Seats', 'Priority Support'], 
    popular: true 
  },
  { 
    name: 'Enterprise Scale', 
    price: '179', 
    yearly: '143', 
    desc: 'Custom APIs and deep scaling for large networks.', 
    features: ['Everything in Professional', 'Custom branding for portals', 'Automated Cookie Scanner API', 'Continuous Audit Log exports', 'Employee Training LMS integrations', 'Unlimited Client Dashboards', 'Dedicated Success Representative'], 
    popular: false 
  },
];

const CALCULATOR_QUESTIONS = [
  {
    id: 'jurisdiction',
    text: 'Where are your data subjects (visitors, customers, lists) located?',
    options: [
      { text: 'We regularly process data of EU/UK citizens', value: 'eu', score: 30 },
      { text: 'We act as a sub-processor of EU datasets', value: 'sub', score: 20 },
      { text: 'We process only US/non-EU datasets', value: 'us', score: 5 }
    ]
  },
  {
    id: 'ropa',
    text: 'Do you maintain an active, documented Article 30 ROPA ledger?',
    options: [
      { text: 'Yes, we have a fully-documented active ROPA', value: 'yes', score: 0 },
      { text: 'No, we rely on static spreadsheets or have none', value: 'no', score: 35 },
      { text: 'We do not know what an Article 30 ROPA is', value: 'unknown', score: 40 }
    ]
  },
  {
    id: 'cookies',
    text: 'How are cookies and trackers monitored and consented to?',
    options: [
      { text: 'Automated crawler & Consent Mode v2 mapping', value: 'automated', score: 0 },
      { text: 'A basic banner, but no ongoing audits or logs', value: 'basic', score: 20 },
      { text: 'We install analytics/pixel tags without dynamic block triggers', value: 'none', score: 35 }
    ]
  },
  {
    id: 'special',
    text: 'Do you process special category data (health, minors, biometrics, banking)?',
    options: [
      { text: 'Yes, we process sensitive datasets regularly', value: 'yes', score: 25 },
      { text: 'No, we only collect standard email/billing logs', value: 'no', score: 5 }
    ]
  }
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="text-blue-500">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#1E293B" stroke="#3B82F6" strokeWidth="1.5" />
        <path
          d="M16 6c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8z"
          fill="#3B82F6"
          opacity="0.2"
        />
        <path
          d="M16 6c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8zM16 11.5v7"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="leading-none">
        <div className="font-sans font-bold text-[20px] tracking-tight text-white flex items-center gap-1.5">
          Privaro <span className="text-[10px] uppercase font-mono tracking-wider bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">OS</span>
        </div>
      </div>
    </div>
  );
}

export default function MarketingSite() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cookies' | 'ropa' | 'dsar'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Risk Calculator State
  const [calcStep, setCalcStep] = useState(0);
  const [calcAnswers, setCalcAnswers] = useState<Record<string, string>>({});
  const [calcScores, setCalcScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCalculatorSelect = (questionId: string, value: string, score: number) => {
    setCalcAnswers(prev => ({ ...prev, [questionId]: value }));
    setCalcScores(prev => ({ ...prev, [questionId]: score }));
    
    if (calcStep < CALCULATOR_QUESTIONS.length - 1) {
      setCalcStep(prev => prev + 1);
    } else {
      setCalcStep(CALCULATOR_QUESTIONS.length); // complete state
    }
  };

  const resetCalculator = () => {
    setCalcAnswers({});
    setCalcScores({});
    setCalcStep(0);
  };

  // Calculate overall risk metrics
  const totalRiskScore = Object.values(calcScores).reduce((a, b) => a + b, 0);
  let riskLevel = 'LOW';
  let riskColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
  let riskText = 'Your operations indicate low regulatory exposure. Maintain compliance audits regularly to avoid gap drifts.';

  if (totalRiskScore >= 75) {
    riskLevel = 'CRITICAL';
    riskColor = 'text-red-400 border-red-500/20 bg-red-500/10';
    riskText = 'Extreme regulatory liability detected. Missing Article 30 ROPA records combined with third-party tracking poses direct exposure to severe administrative fines under CNIL and IE DPC mandates.';
  } else if (totalRiskScore >= 45) {
    riskLevel = 'HIGH';
    riskColor = 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    riskText = 'Significant compliance gaps detected. Lack of automated consent logging or outdated static documentation exposes your agency and clients to audit failure.';
  } else if (totalRiskScore >= 20) {
    riskLevel = 'MEDIUM';
    riskColor = 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10';
    riskText = 'Moderate exposure. Some technical structures exist, but lack of continuous verification indicates potential compliance degradation.';
  }

  // Pre-fill URL generation
  const prefillUrl = `/assessment?jurisdiction=${calcAnswers.jurisdiction || ''}&ropa=${calcAnswers.ropa || ''}&cookies=${calcAnswers.cookies || ''}&special=${calcAnswers.special || ''}&risk=${riskLevel.toLowerCase()}`;

  return (
    <div className="min-h-screen bg-[#070B13] text-[#F3F4F6] font-sans selection:bg-blue-500/30 overflow-x-hidden antialiased">
      
      {/* Precision Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${isScrolled ? 'bg-[#070B13]/85 backdrop-blur-xl border-slate-800/80 py-3.5' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1 rounded-full text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Continuous Audit Engine Active
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-8 bg-[#0F1626]/60 border border-slate-800/60 px-6 py-2 rounded-full backdrop-blur-sm">
            {NAV_LINKS.map(link => (
              <button 
                key={link.id} 
                onClick={() => {
                  const el = document.getElementById(link.id);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white transition-colors duration-200"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <Link href="/login" className="text-xs font-semibold text-slate-300 hover:text-white transition-colors">Sign In</Link>
            <Link href="/assessment" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 text-xs font-bold py-2.5 px-5 rounded-lg transition-all flex items-center gap-2">
              Start Free Assessment <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-slate-300 hover:text-white transition-colors">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 w-full bg-[#070B13] border-b border-slate-800 p-6 flex flex-col gap-4 lg:hidden"
            >
              {NAV_LINKS.map(link => (
                <button 
                  key={link.id} 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    const el = document.getElementById(link.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-left text-sm font-semibold text-slate-400 hover:text-white py-2 border-b border-slate-900"
                >
                  {link.name}
                </button>
              ))}
              <div className="flex flex-col gap-4 mt-4">
                <Link href="/login" className="text-center text-sm font-semibold text-slate-300 hover:text-white py-2">Sign In</Link>
                <Link href="/assessment" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center text-sm font-bold py-3 rounded-lg">
                  Start Free Assessment
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="relative z-10 pt-28">
        
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center text-center">
          <div className="max-w-4xl flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 bg-blue-950/40 border border-blue-500/20 rounded-full px-4.5 py-1.5 mb-8 text-xs font-semibold text-blue-400 tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Continuous GDPR Compliance Operating System
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-sans font-extrabold tracking-tight mb-8 leading-[1.08] text-white">
              Compliance logic. <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Automated precision.</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
              Verify operations, dynamic ROPA ledger generation, and instant cookie scans. 
              The infrastructure dashboard designed to secure user privacy and client contracts with absolute audit readiness.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-20">
              <Link href="/assessment" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold py-3.5 px-7 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10">
                Run Free Gap Assessment
              </Link>
              <button 
                onClick={() => {
                  const el = document.getElementById('risk-calculator');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-sm font-semibold py-3.5 px-7 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Test Risk Exposure
              </button>
            </div>

            {/* Interactive Mockup Container */}
            <div className="w-full max-w-5xl bg-[#0F1626]/90 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
              
              {/* Fake Window Controls */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/30" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/30" />
                  <div className="w-3 h-3 rounded-full bg-green-500/30" />
                  <span className="ml-3 text-[11px] font-mono text-slate-500">privaro-compliance-console v2.4</span>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 max-w-[70%] sm:max-w-none">
                  {[
                    { id: 'overview', label: 'Console Overview', icon: Activity },
                    { id: 'cookies', label: 'Cookie Scanner', icon: Globe },
                    { id: 'ropa', label: 'ROPA Audit (Art. 30)', icon: Database },
                    { id: 'dsar', label: 'DSAR Queue', icon: UserCheck }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'overview' | 'cookies' | 'ropa' | 'dsar')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                        activeTab === tab.id 
                          ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
                      }`}
                    >
                      <tab.icon className="w-3 h-3" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Display Area */}
              <div className="min-h-[300px] text-left">
                <AnimatePresence mode="wait">
                  
                  {activeTab === 'overview' && (
                    <motion.div 
                      key="overview"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="grid md:grid-cols-3 gap-6"
                    >
                      {/* Radial Progress Graphic */}
                      <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="48" stroke="#1E293B" strokeWidth="6" fill="transparent" />
                            <circle cx="56" cy="56" r="48" stroke="#10B981" strokeWidth="6" fill="transparent" 
                              strokeDasharray={2 * Math.PI * 48}
                              strokeDashoffset={2 * Math.PI * 48 * (1 - 0.94)}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-2xl font-bold text-white font-mono">94%</span>
                            <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider">Health</span>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-white mt-4">Compliance Status: Solid</h4>
                        <p className="text-[10px] text-slate-500 mt-1">Audit exposure level is minimal.</p>
                      </div>

                      {/* Diagnostic Logs */}
                      <div className="md:col-span-2 bg-slate-950/40 border border-slate-800/50 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-blue-500" /> Compliance Feed
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500">Live Updates</span>
                        </div>
                        <div className="space-y-3 font-mono text-[11px]">
                          <div className="flex items-start gap-2.5 text-slate-300 border-b border-slate-900 pb-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-white">HubSpot DPA Verified</p>
                              <p className="text-[10px] text-slate-500">Data protection agreement signatures cross-referenced with EU standard clauses.</p>
                            </div>
                            <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap">2 hrs ago</span>
                          </div>
                          <div className="flex items-start gap-2.5 text-slate-300 border-b border-slate-900 pb-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-white">Automated Cookie Audit Completed</p>
                              <p className="text-[10px] text-slate-500">Crawler scanned domain: 14 trackers identified, 0 unclassified scripts found.</p>
                            </div>
                            <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap">1 day ago</span>
                          </div>
                          <div className="flex items-start gap-2.5 text-slate-300">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-white">Employee training logs generated</p>
                              <p className="text-[10px] text-slate-500">LMS training completed by 12 personnel. Compliance ledger certificates generated.</p>
                            </div>
                            <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap">3 days ago</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'cookies' && (
                    <motion.div 
                      key="cookies"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            Active Scan Target: <span className="font-mono text-blue-400 font-normal">https://agency.domain.com</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">Automatic crawler detects and blocks non-essential cookies prior to user selection.</p>
                        </div>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded">
                          Consent Mode v2: ACTIVE
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                              <th className="pb-2 font-semibold">Cookie Identifier</th>
                              <th className="pb-2 font-semibold">Service Provider</th>
                              <th className="pb-2 font-semibold">Classification</th>
                              <th className="pb-2 font-semibold">Expiry</th>
                              <th className="pb-2 font-semibold">AI Confidence</th>
                              <th className="pb-2 font-semibold">Action Trigger</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 text-slate-300">
                            <tr>
                              <td className="py-2.5 font-bold text-white">_ga</td>
                              <td className="py-2.5">Google Analytics</td>
                              <td className="py-2.5"><span className="text-blue-400 bg-blue-400/5 px-2 py-0.5 rounded border border-blue-500/10">Analytics</span></td>
                              <td className="py-2.5">2 Years</td>
                              <td className="py-2.5 text-emerald-400">99.8%</td>
                              <td className="py-2.5 text-slate-400">Blocked prior to consent</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-bold text-white">_fbp</td>
                              <td className="py-2.5">Meta Pixel</td>
                              <td className="py-2.5"><span className="text-purple-400 bg-purple-400/5 px-2 py-0.5 rounded border border-purple-500/10">Marketing</span></td>
                              <td className="py-2.5">3 Months</td>
                              <td className="py-2.5 text-emerald-400">99.5%</td>
                              <td className="py-2.5 text-slate-400">Blocked prior to consent</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-bold text-white">stripe_mid</td>
                              <td className="py-2.5">Stripe Payments</td>
                              <td className="py-2.5"><span className="text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded border border-emerald-500/10">Necessary</span></td>
                              <td className="py-2.5">1 Year</td>
                              <td className="py-2.5 text-emerald-400">100%</td>
                              <td className="py-2.5 text-emerald-400 font-semibold">Always Allowed</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-bold text-white">_hjSession</td>
                              <td className="py-2.5">Hotjar</td>
                              <td className="py-2.5"><span className="text-blue-400 bg-blue-400/5 px-2 py-0.5 rounded border border-blue-500/10">Analytics</span></td>
                              <td className="py-2.5">Session</td>
                              <td className="py-2.5 text-emerald-400">98.2%</td>
                              <td className="py-2.5 text-slate-400">Blocked prior to consent</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'ropa' && (
                    <motion.div 
                      key="ropa"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Article 30 Registry Ledger</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Records of Processing Activities automatically mapped and updated.</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">ROPA Version: v2.4 (Signed)</span>
                      </div>

                      <div className="space-y-3 font-mono text-[11px]">
                        {[
                          { 
                            name: 'Customer Newsletter & Marketing Campaign System', 
                            basis: 'Consent (Double Opt-In Required)', 
                            subjects: 'Prospects, Leads & Active Customers', 
                            retention: 'Until consent withdrawal (Immediate deletion purge)' 
                          },
                          { 
                            name: 'Transactional Payments & Order Fulfillment Engine', 
                            basis: 'Contract Performance (GDPR Art. 6.1.b)', 
                            subjects: 'Registered Paying Clients', 
                            retention: '7 Years (Mandatory Financial Ledger audits)' 
                          },
                          { 
                            name: 'User Retargeting & Tracking Pixel Campaigns', 
                            basis: 'Explicit Consent (Prior to Opt-In Check)', 
                            subjects: 'Anonymous Website Visitors', 
                            retention: '90 Days from collection timestamp' 
                          }
                        ].map((item, index) => (
                          <div key={index} className="bg-slate-950/40 border border-slate-800/40 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-white text-xs">{item.name}</span>
                              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-bold">
                                {item.basis}
                              </span>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                              <p>Data Subjects: <span className="text-slate-300">{item.subjects}</span></p>
                              <p className="sm:text-right">Retention Period: <span className="text-slate-300">{item.retention}</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'dsar' && (
                    <motion.div 
                      key="dsar"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Data Subject Rights Requests</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Automated queue of user erasure, access, or portability tickets.</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Verification: Strict OAuth2 / ID confirmation</span>
                      </div>

                      {[
                        {
                          ref: 'DSAR-2026-0412',
                          name: 'Sarah Jenkins',
                          type: 'Erasure Request (Right to be Forgotten)',
                          status: 'Verified (Pending Purge Execution)',
                          statusColor: 'text-amber-400 bg-amber-500/5 border-amber-500/10',
                          timer: '18 Days remaining',
                          action: 'Trigger Automated Wipe'
                        },
                        {
                          ref: 'DSAR-2026-0398',
                          name: 'Marcus Vance',
                          type: 'Access Request (Right to Portability)',
                          status: 'Completed (Secure package delivered)',
                          statusColor: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10',
                          timer: 'Completed 2 days ago',
                          action: 'Download Receipt'
                        }
                      ].map((ticket, idx) => (
                        <div key={idx} className="bg-slate-950/40 border border-slate-800/40 rounded-lg p-3.5 flex flex-col sm:flex-row justify-between gap-3 text-xs font-mono">
                          <div>
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <span className="text-[10px] text-slate-500">{ticket.ref}</span>
                              <span className="font-bold text-white">{ticket.name}</span>
                              <span className="text-[10px] text-slate-400">({ticket.type})</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center text-[10px]">
                              <span className={`px-2 py-0.5 rounded border font-semibold ${ticket.statusColor}`}>
                                {ticket.status}
                              </span>
                              <span className="text-slate-500 flex items-center gap-1">
                                <ClockIcon className="w-3.5 h-3.5 text-slate-500" /> {ticket.timer}
                              </span>
                            </div>
                          </div>
                          <div className="sm:self-center flex shrink-0">
                            <button className="w-full sm:w-auto bg-[#10192A] hover:bg-blue-600/15 text-blue-400 hover:text-blue-300 border border-slate-800 hover:border-blue-500/20 px-3 py-1.5 rounded text-[11px] font-bold transition-all">
                              {ticket.action}
                            </button>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </div>

          </div>
        </section>

        {/* Integration Logo Bar (Social Proof) */}
        <section className="border-y border-slate-800/60 bg-[#0A101C]/40 py-10">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Live Connect</p>
              <h4 className="text-sm font-bold text-white mt-1">Works with the systems you use daily</h4>
            </div>
            <div className="flex flex-wrap justify-center md:justify-end items-center gap-x-8 gap-y-4 opacity-50">
              {INTEGRATIONS.map((int, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/40 px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:opacity-100 transition-opacity">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>{int.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GDPR Risk Exposure Calculator */}
        <section id="risk-calculator" className="max-w-4xl mx-auto px-6 py-28 scroll-mt-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-white mb-4 tracking-tight">
              Evaluate your GDPR exposure
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
              Calculate your organization&apos;s compliance risk profile in 60 seconds. Receive instant recommendations.
            </p>
          </div>

          <div className="bg-[#0F1626]/80 border border-slate-800/80 rounded-2xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            
            {calcStep < CALCULATOR_QUESTIONS.length ? (
              <div>
                {/* Step indicator */}
                <div className="flex justify-between items-center mb-8">
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-bold">
                    Assessment Question {calcStep + 1} of {CALCULATOR_QUESTIONS.length}
                  </span>
                  <div className="flex gap-1.5">
                    {CALCULATOR_QUESTIONS.map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-4 h-1 rounded transition-colors ${i <= calcStep ? 'bg-blue-500' : 'bg-slate-800'}`} 
                      />
                    ))}
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-white mb-6 leading-snug">
                  {CALCULATOR_QUESTIONS[calcStep].text}
                </h3>

                <div className="space-y-3">
                  {CALCULATOR_QUESTIONS[calcStep].options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleCalculatorSelect(CALCULATOR_QUESTIONS[calcStep].id, opt.value, opt.score)}
                      className="w-full text-left bg-slate-950/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 p-4 rounded-xl text-xs sm:text-sm text-slate-300 hover:text-white transition-all flex items-center justify-between group"
                    >
                      <span>{opt.text}</span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1.5 transition-all shrink-0 ml-4" />
                    </button>
                  ))}
                </div>

                {calcStep > 0 && (
                  <button 
                    onClick={() => setCalcStep(prev => prev - 1)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 mt-6 block transition-colors"
                  >
                    ← Previous Question
                  </button>
                )}
              </div>
            ) : (
              // Results Display
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="text-center"
              >
                <div className="inline-flex items-center gap-2 mb-6">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-bold">Calculation Complete</span>
                </div>

                <div className="max-w-2xl mx-auto">
                  <div className={`inline-block border rounded-full px-6 py-1.5 font-mono text-sm font-bold mb-6 ${riskColor}`}>
                    RISK LEVEL: {riskLevel}
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">
                    Audit Risk Coefficient: {totalRiskScore}%
                  </h3>
                  
                  <p className="text-slate-400 text-sm leading-relaxed mb-8">
                    {riskText}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    <Link 
                      href={prefillUrl} 
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm py-3 px-6 rounded-lg shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      Complete Assessment (Pre-filled) <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button 
                      onClick={resetCalculator} 
                      className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
                    >
                      Recalculate
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Bento Grid Features */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-28 border-t border-slate-900/80 scroll-mt-24">
          <div className="mb-20 max-w-2xl">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Compliance Infrastructure</p>
            <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-white mb-6 tracking-tight">Six modules. One compliance core.</h2>
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
              Replace disjointed spreadsheets with a continuous monitoring stack built for the rigorous GDPR standards of cross-border operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`bg-[#0F1626]/50 border border-slate-850 rounded-xl p-6 flex flex-col justify-between group hover:bg-[#0F1626]/85 hover:border-slate-700/60 transition-all ${mod.colSpan}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[9px] font-mono font-bold tracking-wider text-slate-500 uppercase bg-slate-950/60 border border-slate-900 px-2 py-0.5 rounded">
                      {mod.tag}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2">{mod.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{mod.desc}</p>
                </div>
                <div className="mt-8 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition-colors cursor-pointer">
                  Specifications <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Supervisory Authority Alignment (Strict Differentiator) */}
        <section id="authorities" className="max-w-7xl mx-auto px-6 py-28 border-t border-slate-900/80 scroll-mt-24">
          <div className="mb-16">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Regulatory Scope</p>
            <h2 className="text-3xl md:text-4xl font-sans font-extrabold text-white mb-5 tracking-tight">Supervisory Authority alignment</h2>
            <p className="text-slate-400 max-w-2xl text-sm sm:text-base leading-relaxed">
              GDPR is uniform, but enforcement focus differs by country. Privaro adapts compliance configurations based on the jurisdictions of your targets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {AUTHORITIES.map((auth, i) => (
              <div 
                key={i}
                className="bg-[#0F1626]/40 border border-slate-850 p-5 rounded-xl hover:border-slate-800 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-900">
                    <span className="font-mono font-bold text-white text-xs">{auth.code}</span>
                    <span className="text-[9px] text-slate-500">{auth.country}</span>
                  </div>
                  <p className="text-slate-300 text-xs font-bold mb-2">{auth.name}</p>
                  <p className="text-slate-400 text-[10.5px] leading-relaxed mb-3">{auth.focus}</p>
                </div>
                <div className="text-[10px] font-mono text-blue-400 bg-blue-500/5 border border-blue-500/10 p-2.5 rounded">
                  <span className="font-bold text-white block mb-0.5 text-[9px]">ENFORCEMENT FOCUS:</span>
                  {auth.enforcement}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Section (Austere IDE Style) */}
        <section className="max-w-7xl mx-auto px-6 py-28 border-t border-slate-900/80">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-sans font-extrabold text-white mb-4 tracking-tight">Built for compliance infrastructure</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm">
              Why static documents fail regulatory audits and how continuous ledger systems ensure compliance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* The Old Way */}
            <div className="bg-slate-950/20 border border-slate-900 rounded-xl p-8 sm:p-10 font-mono text-[11px] leading-relaxed">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-900">
                <h3 className="text-slate-200 font-sans text-sm font-bold uppercase tracking-wider">Unverified Compliance</h3>
                <span className="text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-0.5 rounded text-[10px] font-sans font-bold">Unchecked Exposure</span>
              </div>
              <ul className="space-y-5">
                {[
                  'Spreadsheets that are out of date the day they are saved.',
                  'Paying legal consultants to draft static Word DPAs.',
                  'Compiling response packages manually when a DSAR arrives.',
                  'Hoping tracking pixels do not load before the banner accepts.',
                  'No verifiable audit history of client processing logs.'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3.5 text-slate-400">
                    <XCircle className="w-4 h-4 text-red-500/80 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* The Privaro Way */}
            <div className="bg-[#0F1626]/40 border border-blue-900/20 rounded-xl p-8 sm:p-10 font-mono text-[11px] leading-relaxed relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-900">
                <h3 className="text-white font-sans text-sm font-bold uppercase tracking-wider">Privaro Compliance OS</h3>
                <span className="text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-0.5 rounded text-[10px] font-sans font-bold">Automated Guardrails</span>
              </div>
              <ul className="space-y-5">
                {[
                  'Article 30 ROPA maps connected directly to your active vendor list.',
                  'Automated crawler audits scripts and locks trackers prior to consent.',
                  'Identity-verified portals generate secure DSAR reply vaults.',
                  'Pre-audited profiles monitor vendor sub-processors for shifts.',
                  'Continuous logging provides accountability proofs for DPAs.'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-28 border-t border-slate-900/80 scroll-mt-24">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">SaaS Licensing</p>
              <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-white mb-5 tracking-tight">Predictable pricing matrices</h2>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Scale compliance controls as your operations expand. Standard cancel-anytime agreements.
              </p>
            </div>
            
            <div className="inline-flex items-center bg-[#0F1626]/60 border border-slate-800 p-1 rounded-xl">
              <button onClick={() => setAnnualBilling(false)} className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all ${!annualBilling ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                Monthly
              </button>
              <button onClick={() => setAnnualBilling(true)} className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${annualBilling ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                Annually <span className="text-[9px] uppercase bg-emerald-950 text-emerald-400 px-1 py-0.5 rounded font-bold">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRICING.map((plan, i) => (
              <div key={i} className={`relative bg-[#0F1626]/30 rounded-xl p-6 sm:p-7 flex flex-col justify-between border ${plan.popular ? 'border-blue-600/60 ring-1 ring-blue-600/30' : 'border-slate-850'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                    RECOMMENDED OS
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-xs mb-6 min-h-[35px]">{plan.desc}</p>
                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="text-3xl font-mono font-bold text-white">€{annualBilling ? plan.yearly : plan.price}</span>
                    <span className="text-slate-500 text-xs font-medium">/month</span>
                  </div>
                  <Link href={prefillUrl} className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all mb-6 block text-center ${plan.popular ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>
                    {plan.price === '0' ? 'Start Free Assessment' : 'License License Option'}
                  </Link>
                  <ul className="space-y-3.5 border-t border-slate-900 pt-5 mt-2">
                    {plan.features.map((feat, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-xs text-slate-350">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Security & Verification Credentials Section (Honest claims) */}
        <section className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900/80">
          <div className="bg-slate-950/20 border border-slate-900 rounded-xl p-8 sm:p-10">
            <div className="text-center mb-10 max-w-xl mx-auto">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2.5">Security & Compliance Architecture</h3>
              <p className="text-xs text-slate-450 leading-relaxed">
                Compliance products must process data with complete transparency. Our hosting and encryption standards are documented below.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { title: 'EU Data Residency', desc: '100% hosted in AWS Dublin (eu-west-1). Customer data never exits EU boundaries.' },
                { title: 'AES-256 Encryption', desc: 'Strict data encrypt-at-rest pipelines and database sector partitions.' },
                { title: 'Zero-Knowledge Log', desc: 'Consent validation receipts are cryptographic hashes. No tracking of raw user IPs.' },
                { title: 'SOC 2 Type II Prep', desc: 'Internal security logs mapped to SOC 2 safety guidelines. Readiness audit target Q4 2026.' },
                { title: 'GDPR Self-Certified', desc: 'Privaro is self-certified compliant under official EU Art. 30 processing standards.' }
              ].map((cred, i) => (
                <div key={i} className="bg-slate-900/30 border border-slate-900/50 p-4.5 rounded-lg">
                  <Lock className="w-4 h-4 text-blue-400 mb-3" />
                  <h4 className="text-xs font-bold text-white mb-1.5">{cred.title}</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">{cred.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-[#050910] border-t border-slate-900 pt-16 pb-10 relative z-10 text-xs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Logo />
              </div>
              <p className="text-slate-450 text-xs leading-relaxed max-w-xs mb-6">
                The compliance automation platform designed for modern agencies.
              </p>
              <div className="flex items-center gap-4 text-slate-500 font-mono text-[10px]">
                <span className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> AWS Dublin</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> SSL Secured</span>
              </div>
            </div>
            
            {/* Footer Links */}
            {[
              { title: 'Product Modules', links: ['Continuous Auditor', 'ROPA Ledger', 'Cookie Scan Engine', 'Integrations'] },
              { title: 'Resource Hub', links: ['GDPR Guidance', 'Audit Prep Checklist', 'Security Posture'] },
              { title: 'Legal Ledger', links: ['Terms of Service', 'Privacy Policy', 'Cookie Statement', 'Standard DPA'] }
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-bold mb-4 text-xs">{col.title}</h4>
                <ul className="space-y-2.5 text-slate-450">
                  {col.links.map((link, j) => (
                    <li key={j}><a href="#" className="hover:text-white transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-slate-950 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-[10.5px]">© {new Date().getFullYear()} Privaro OS. All rights reserved.</p>
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors text-[10.5px]">
              <Globe className="w-3.5 h-3.5 text-slate-500" /> English (EU)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Simple clock icon
function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
