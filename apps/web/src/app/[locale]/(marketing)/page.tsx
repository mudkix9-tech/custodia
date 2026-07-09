"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, Database, UserCheck, ChevronRight,
  Lock, Check, ArrowRight, XCircle, Activity, CheckCircle,
  Shield, ShieldCheck, FileText, AlertTriangle,
  Users, BookOpen, Share2, BarChart3, HelpCircle, MessageSquare, Copy, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

// --- Premium Design Constants ---

const MODULES = [
  { 
    tag: "Assessment",
    title: 'Gap Assessment', 
    desc: 'Scan your operations against 142 GDPR requirements and identify compliance gaps instantly.',
    icon: Shield
  },
  { 
    tag: "ROPA Registry",
    title: 'Activity Register', 
    desc: 'Maintain up-to-date Article 30 ROPA records that automatically sync with your vendor stack.',
    icon: Database
  },
  { 
    tag: "Vendor Auditing",
    title: 'Vendor Tracking', 
    desc: 'Map sub-processors, check data hosting locations, and verify Data Protection Agreements (DPAs).',
    icon: Users
  },
  { 
    tag: "Legal Documents",
    title: 'Privacy Policies', 
    desc: 'Generate hosted, responsive privacy policies that update automatically as your active vendors change.',
    icon: FileText
  },
  { 
    tag: "Cookie Consent",
    title: 'Cookie Consent', 
    desc: 'Delivers a fast consent banner fully compatible with Google Consent Mode v2 and IAB guidelines.',
    icon: Globe
  },
  { 
    tag: "User Rights",
    title: 'Data Requests', 
    desc: 'Receive and verify subject access requests (DSARs) and automate secure data deletions.',
    icon: UserCheck
  },
  { 
    tag: "Incident Log",
    title: 'Breach Response', 
    desc: 'Log security incidents, evaluate reporting thresholds, and format regulator notify sheets.',
    icon: AlertTriangle
  },
  { 
    tag: "Team Training",
    title: 'Employee Training', 
    desc: 'Assign byte-sized GDPR awareness training modules to your team and log certification records.',
    icon: BookOpen
  },
  { 
    tag: "Client Portals",
    title: 'Client Portals', 
    desc: 'Provide secure, read-only compliance dashboards to clients to build trust in sales cycles.',
    icon: Share2
  },
  { 
    tag: "Audits & Export",
    title: 'Audit Reports', 
    desc: 'Generate complete compliance binders to share with auditors, prospects, or legal counsel.',
    icon: BarChart3
  },
  { 
    tag: "Risk Assessment",
    title: 'DPIA Wizard', 
    desc: 'Run Data Protection Impact Assessments (DPIA) for high-risk projects with guided templates.',
    icon: HelpCircle
  },
  { 
    tag: "Automation",
    title: 'Compliance AI', 
    desc: 'Resolve day-to-day data privacy questions using context-aware policy intelligence.',
    icon: MessageSquare
  }
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
    name: 'Commission Nationale de l&apos;Informatique', 
    country: 'France', 
    focus: 'Strict enforcement on cookie banner defaults and tracking consent opt-ins.', 
    enforcement: 'Focus on dark patterns, consent logs, and advertising identifiers.' 
  },
  { 
    code: 'BfDI', 
    name: 'Federal Commissioner for Data Protection', 
    country: 'Germany', 
    focus: 'Highly decentralized enforcement targeting medical, employee, and public sector data.', 
    enforcement: 'Strict stance on US data transfers and cloud hosting boundaries.' 
  },
  { 
    code: 'AEPD', 
    name: 'Agencia Española de Protección de Datos', 
    country: 'Spain', 
    focus: 'Active authority issuing high-frequency administrative fines for security failures.', 
    enforcement: 'Focuses on web form privacy disclosures, spam, and vendor tracking.' 
  },
  { 
    code: 'Garante', 
    name: 'Garante per la Protezione dei Dati Personali', 
    country: 'Italy', 
    focus: 'Pioneering regulator on artificial intelligence restrictions and algorithmic auditing.', 
    enforcement: 'Aggressive enforcement on automated user profiles and analytics tools.' 
  }
];

const INTEGRATIONS = [
  { 
    name: 'HubSpot', 
    logo: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 aspect-square text-[#FF7A59] fill-current">
        <path d="M21.4 9.3c-.6 0-1.1-.3-1.4-.7l-2.2 1.3c.1.3.2.7.2 1.1 0 1.7-1.4 3-3 3-1.2 0-2.2-.7-2.7-1.7L6.8 15.6c.1.3.2.7.2 1.1 0 1.7-1.4 3-3 3s-3-1.3-3-3 1.3-3 3-3c.5 0 .9.1 1.3.3l3.9-2.3c-.3-.5-.4-1.1-.4-1.7 0-1.7 1.4-3 3-3 .6 0 1.1.2 1.6.5l2.2-1.3c-.1-.3-.2-.7-.2-1.1 0-1.7 1.4-3 3-3s3 1.3 3 3-1.3 3-3 3zm-9.2 1.7c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1z" />
      </svg>
    ) 
  },
  { 
    name: 'Mailchimp', 
    logo: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 aspect-square text-[#FFE01B] fill-current">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.2 13.9c0 .773-.627 1.4-1.4 1.4s-1.4-.627-1.4-1.4.627-1.4 1.4-1.4 1.4.627 1.4 1.4zm-1.4-4c-.994 0-1.8-.806-1.8-1.8s.806-1.8 1.8-1.8 1.8.806 1.8 1.8-.806 1.8-1.8 1.8z" />
      </svg>
    ) 
  },
  { 
    name: 'GA4', 
    logo: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 aspect-square text-[#F9AB00] fill-current">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2V9h2v8zm4 0h-2V7h2v10z" />
      </svg>
    ) 
  },
  { 
    name: 'Stripe', 
    logo: (
      <svg viewBox="0 0 40 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-4.5 aspect-[40/18] text-[#635BFF] fill-current">
        <path d="M13.9 6.8c0-1.1.9-1.8 2.4-1.8 1.4 0 2.5.5 3 .9l.8-2c-.8-.5-2.2-1-3.9-1-3.2 0-5.3 1.8-5.3 4.9 0 4.8 6.5 4 6.5 6.8 0 1.3-1.1 2-2.8 2-1.7 0-3.1-.6-3.8-1.1l-.8 2.1c1 .7 2.8 1.2 4.7 1.2 3.4 0 5.8-1.7 5.8-5 0-5.1-6.6-4.2-6.6-7zm-9.3-.9V3.5L1.4 4.2v2.2L4.6 5.9zm0 2.2H1.4v10.9h3.2V8.1zm15.3 0h-3.2v10.9h3.2V8.1zm-8.8 3.5c-.7 0-1.2.5-1.2 1.3 0 .8.5 1.3 1.2 1.3.7 0 1.2-.5 1.2-1.3 0-.8-.5-1.3-1.2-1.3zm0-3.5c-2.3 0-4 1.7-4 4.5s1.7 4.5 4 4.5c2.3 0 4-1.7 4-4.5s-1.7-4.5-4-4.5z" />
      </svg>
    ) 
  },
  { 
    name: 'Slack', 
    logo: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 aspect-square shrink-0">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042z" fill="#36C5F0"/>
        <path d="M8.823 5.043a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52v2.52h-2.522a2.528 2.528 0 0 1-2.52-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.52-2.522V8.824a2.528 2.528 0 0 1 2.52-2.52h5.043z" fill="#2EB67D"/>
        <path d="M18.878 8.824a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zm-1.261 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V3.78a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043z" fill="#ECB22E"/>
        <path d="M15.097 18.878a2.528 2.528 0 0 1-2.52 2.52 2.528 2.528 0 0 1-2.522-2.52v-2.52h2.522a2.528 2.528 0 0 1 2.52 2.52zm0-1.261a2.528 2.528 0 0 1-2.52-2.52v-5.043a2.528 2.528 0 0 1 2.52-2.522h5.043a2.528 2.528 0 0 1 2.52 2.522v5.043a2.528 2.528 0 0 1-2.52 2.52h-5.043z" fill="#E01E5A"/>
      </svg>
    ) 
  },
  { 
    name: 'Salesforce', 
    logo: (
      <svg viewBox="0 0 32 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-5 aspect-[32/22] text-[#00A1E0] fill-current">
        <path d="M25.75 10c0-2.76-2.24-5-5-5-1.5 0-2.85.66-3.79 1.71C16.24 6.27 15.15 6 14 6c-2.76 0-5 2.24-5 5 0 .5.08.97.22 1.42C8.49 13.06 8 14 8 15c0 2.21 1.79 4 4 4h14c2.21 0 4-1.79 4-4 0-1.63-.98-3.04-2.38-3.66.1-.42.13-.86.13-1.34z" />
      </svg>
    ) 
  },
  { 
    name: 'AWS', 
    logo: (
      <svg viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-4.5 aspect-[28/18] text-[#FF9900] fill-current">
        <path d="M12.04 16.52c-2.3 0-3.66-1.12-3.66-2.92 0-2.82 2.76-3.18 5.76-3.18V9.8c0-1.42-.64-2.12-2.18-2.12-1.32 0-2.6.48-3.32.96L8 6.48C9.04 5.6 10.96 5 12.56 5c3.22 0 4.88 1.58 4.88 4.6v6.92h-2.14v-1.74c-.72 1.1-2.02 1.74-3.26 1.74zm.76-4.9c-2.08 0-3.66.18-3.66 1.48 0 .8.54 1.28 1.48 1.28 1.34 0 2.18-.8 2.18-2.06v-.7zm7.54 1.7c-.54 1.22-1.72 3.2-3.8 3.2-1.14 0-1.8-.52-2.1-1.04l1.62-1.2c.22.28.52.48.86.48.74 0 1.24-.92 1.18-1.52-.42.54-1.16.88-1.92.88-2.06 0-3.34-1.7-3.34-3.8 0-2.4 1.58-4.1 3.56-4.1.86 0 1.54.4 1.86.82v-.6h2.08v8.88zm-3.38-4.66c0 1.08.62 1.94 1.46 1.94s1.46-.86 1.46-1.94c0-1.12-.6-1.96-1.46-1.96s-1.46.84-1.46 1.96z" />
        <path d="M2.86 19.38C8.54 22.2 16.2 22.2 21.14 19c.4-.26.86.26.54.58-4.34 4.22-11.96 4.76-17.7 1.9-.44-.22-.24-.88.26-1.1z" />
      </svg>
    ) 
  }
];

const CALCULATOR_QUESTIONS = [
  {
    id: 'jurisdiction',
    text: 'Where are your client targets or website visitors located?',
    options: [
      { text: 'We regularly process data of EU/UK citizens', value: 'eu', score: 30 },
      { text: 'We act as a sub-processor of EU datasets', value: 'sub', score: 20 },
      { text: 'We process only US/non-EU datasets', value: 'us', score: 5 }
    ]
  },
  {
    id: 'ropa',
    text: 'Do you maintain an active register of data processing activities?',
    options: [
      { text: 'Yes, we have an up-to-date processing ledger', value: 'yes', score: 0 },
      { text: 'No, we rely on static spreadsheets or have none', value: 'no', score: 35 },
      { text: 'We do not maintain any structured compliance records', value: 'unknown', score: 40 }
    ]
  },
  {
    id: 'cookies',
    text: 'How do you collect and log tracking cookie consent?',
    options: [
      { text: 'We audit and block trackers prior to consent', value: 'automated', score: 0 },
      { text: 'We have a standard banner, but no cookie logs', value: 'basic', score: 20 },
      { text: 'We load tracking codes without consent triggers', value: 'none', score: 35 }
    ]
  },
  {
    id: 'special',
    text: 'Do you handle sensitive data (health, minors, banking, location)?',
    options: [
      { text: 'Yes, we handle sensitive client/user datasets', value: 'yes', score: 25 },
      { text: 'No, we only process basic business contact info', value: 'no', score: 5 }
    ]
  }
];

export default function MarketingSite() {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cookies' | 'ropa' | 'dsar'>('overview');

  // Risk Calculator State
  const [calcStep, setCalcStep] = useState(0);
  const [calcAnswers, setCalcAnswers] = useState<Record<string, string>>({});
  const [calcScores, setCalcScores] = useState<Record<string, number>>({});

  // Caching & Prefill Effect
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlJurisdiction = params.get('jurisdiction');
      const urlRopa = params.get('ropa');
      const urlCookies = params.get('cookies');
      const urlSpecial = params.get('special');
      const urlResults = params.get('results') === 'true';

      if (urlJurisdiction || urlRopa || urlCookies || urlSpecial) {
        const answers: Record<string, string> = {};
        const scores: Record<string, number> = {};
        
        if (urlJurisdiction) {
          answers.jurisdiction = urlJurisdiction;
          scores.jurisdiction = CALCULATOR_QUESTIONS[0].options.find(o => o.value === urlJurisdiction)?.score ?? 0;
        }
        if (urlRopa) {
          answers.ropa = urlRopa;
          scores.ropa = CALCULATOR_QUESTIONS[1].options.find(o => o.value === urlRopa)?.score ?? 0;
        }
        if (urlCookies) {
          answers.cookies = urlCookies;
          scores.cookies = CALCULATOR_QUESTIONS[2].options.find(o => o.value === urlCookies)?.score ?? 0;
        }
        if (urlSpecial) {
          answers.special = urlSpecial;
          scores.special = CALCULATOR_QUESTIONS[3].options.find(o => o.value === urlSpecial)?.score ?? 0;
        }

        setTimeout(() => {
          setCalcAnswers(answers);
          setCalcScores(scores);
          if (urlResults) {
            setCalcStep(CALCULATOR_QUESTIONS.length);
          } else {
            setCalcStep(0);
          }
        }, 0);
        return;
      }

      const savedAnswers = localStorage.getItem('pvr_calc_answers');
      const savedScores = localStorage.getItem('pvr_calc_scores');
      const savedStep = localStorage.getItem('pvr_calc_step');
      setTimeout(() => {
        if (savedAnswers) setCalcAnswers(JSON.parse(savedAnswers));
        if (savedScores) setCalcScores(JSON.parse(savedScores));
        if (savedStep) setCalcStep(Number(savedStep));
      }, 0);
    } catch (e) {
      console.error("Failed to load calculator state:", e);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(calcAnswers).length > 0) {
      localStorage.setItem('pvr_calc_answers', JSON.stringify(calcAnswers));
      localStorage.setItem('pvr_calc_scores', JSON.stringify(calcScores));
      localStorage.setItem('pvr_calc_step', String(calcStep));
    }
  }, [calcAnswers, calcScores, calcStep]);

  const handleCalculatorSelect = (questionId: string, value: string, score: number) => {
    setCalcAnswers(prev => ({ ...prev, [questionId]: value }));
    setCalcScores(prev => ({ ...prev, [questionId]: score }));
    
    if (calcStep < CALCULATOR_QUESTIONS.length - 1) {
      setCalcStep(prev => prev + 1);
    } else {
      setCalcStep(CALCULATOR_QUESTIONS.length);
    }
  };

  const resetCalculator = () => {
    setCalcAnswers({});
    setCalcScores({});
    setCalcStep(0);
    try {
      localStorage.removeItem('pvr_calc_answers');
      localStorage.removeItem('pvr_calc_scores');
      localStorage.removeItem('pvr_calc_step');
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  };

  const [copiedCalculatorLink, setCopiedCalculatorLink] = useState(false);
  const handleCopyCalculatorLink = () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?jurisdiction=${calcAnswers.jurisdiction || ''}&ropa=${calcAnswers.ropa || ''}&cookies=${calcAnswers.cookies || ''}&special=${calcAnswers.special || ''}&results=true`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedCalculatorLink(true);
      setTimeout(() => setCopiedCalculatorLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const totalRiskScore = Object.values(calcScores).reduce((a, b) => a + b, 0);
  let riskLevel = 'LOW';
  let riskColor = 'text-[#8BA381] border-[#384332] bg-[#242A20]/80';
  let riskText = 'Your operations indicate low regulatory exposure. Maintain compliance audits regularly to avoid gap drifts.';

  if (totalRiskScore >= 75) {
    riskLevel = 'CRITICAL';
    riskColor = 'text-red-400 border-red-950 bg-red-950/20';
    riskText = 'Extreme regulatory liability detected. Missing processing activity records combined with unconsented tracking poses direct exposure to severe administrative fines.';
  } else if (totalRiskScore >= 45) {
    riskLevel = 'HIGH';
    riskColor = 'text-amber-500 border-amber-950 bg-amber-950/20';
    riskText = 'Significant compliance gaps detected. Lack of active consent logging or outdated static documentation exposes your agency and clients to audit failures.';
  } else if (totalRiskScore >= 20) {
    riskLevel = 'MEDIUM';
    riskColor = 'text-[#C9C3AC] border-[#444034] bg-[#2A2920]/80';
    riskText = 'Moderate exposure. Some compliance elements exist, but lack of continuous validation indicates potential compliance degradation.';
  }

  const prefillUrl = `/assessment?jurisdiction=${calcAnswers.jurisdiction || ''}&ropa=${calcAnswers.ropa || ''}&cookies=${calcAnswers.cookies || ''}&special=${calcAnswers.special || ''}&risk=${riskLevel.toLowerCase()}`;

  return (
    <div className="pt-16 antialiased">
      
      {/* SECTION 1: HERO CONTAINER */}
      <section className="w-full bg-[#141712] relative overflow-hidden">
        {/* Soft forest radial glow behind mockup */}
        <div aria-hidden="true" className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[550px] bg-[radial-gradient(circle,#24331E_0%,transparent_70%)] opacity-35 pointer-events-none z-0" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-8 flex flex-col items-center text-center relative z-10">
          <div className="max-w-4xl flex flex-col items-center">
            
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 bg-[#1F241D] border border-[#2F362D] rounded-full px-4.5 py-1.5 mb-6 text-xs font-semibold text-[#8BA381] tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8BA381] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8BA381]"></span>
              </span>
              GDPR Compliance Operating System
            </div>
            
            {/* Headline */}
            <h1 className="font-sans tracking-tight mb-5 leading-[1.05] text-balance">
              <span className="block text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#9CA297] mb-2">GDPR compliance for your entire agency.</span>
              <span className="inline-block text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#F5F3ED] bg-clip-text">
                One platform.
              </span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-sm text-[#9CA297] max-w-xl mb-6 leading-relaxed font-medium">
              Document processing activities, map vendors, manage cookie consent, handle data requests, and train employees {"\u2014"} all in one place. No expensive legal consultants. No spreadsheets.
            </p>
            
            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-10">
              <Link href="/assessment" className="w-full sm:w-auto bg-gradient-to-r from-[#596E51] to-[#788F6F] hover:from-[#495B42] hover:to-[#677B5D] text-[#F5F3ED] text-sm font-bold py-3.5 px-7 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#596E51]/10 border border-[#8BA381]/20 focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#141712] hover:scale-[1.02] active:scale-[0.98]">
                Run Free Gap Assessment
              </Link>
              <button 
                onClick={() => {
                  const el = document.getElementById('risk-calculator');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto bg-[#1F241D] hover:bg-[#252B21] text-[#C5C8C1] border border-[#2F362D] text-sm font-semibold py-3.5 px-7 rounded-lg transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#141712] hover:scale-[1.02] active:scale-[0.98]"
              >
                Test Risk Exposure
              </button>
            </div>
            
            {/* LIGHT-THEMED BUSINESS APP MOCKUP */}
            <div className="w-full max-w-5xl bg-[#FBF8F3] border border-[#1F1B16]/10 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden text-[#1F1B16] text-left">
              
              {/* Browser Header Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1F1B16]/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-3 text-[11px] font-sans font-medium text-[#1F1B16]/65">Privaro Compliance Dashboard</span>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 max-w-[70%] sm:max-w-none">
                  {[
                    { id: 'overview', label: 'Compliance Overview', icon: Activity },
                    { id: 'cookies', label: 'Cookie Consent', icon: Globe },
                    { id: 'ropa', label: 'Activity Register', icon: Database },
                    { id: 'dsar', label: 'Data Requests', icon: UserCheck }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'overview' | 'cookies' | 'ropa' | 'dsar')}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap z-10 focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none ${
                        activeTab === tab.id 
                          ? 'text-[#6E8B60]' 
                          : 'text-[#1F1B16]/60 hover:text-[#1F1B16] hover:bg-[#1F1B16]/5'
                      }`}
                    >
                      {activeTab === tab.id && (
                        <motion.div 
                          layoutId="activeMockupTab"
                          className="absolute inset-0 bg-[#6E8B60]/10 border border-[#6E8B60]/20 rounded-md -z-10"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <tab.icon className="w-3 h-3" />
                      {tab.label}
                      <span className="sr-only">{activeTab === tab.id ? '(Active)' : '(Inactive)'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Display Area */}
              <div className="min-h-[380px]">
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
                      {/* Radial Progress */}
                      <div className="bg-[#F4EFE6]/60 border border-[#1F1B16]/8 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="48" stroke="#EAE5DC" strokeWidth="6" fill="transparent" />
                            <circle cx="56" cy="56" r="48" stroke="#6E8B60" strokeWidth="6" fill="transparent" 
                              strokeDasharray={2 * Math.PI * 48}
                              strokeDashoffset={2 * Math.PI * 48 * (1 - 0.94)}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-2xl font-bold text-[#1F1B16] font-mono">94%</span>
                            <span className="text-[9px] uppercase font-bold text-[#6E8B60] tracking-wide">Health</span>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-[#1F1B16] mt-4">Compliance Status: Solid</h4>
                        <p className="text-[10px] text-[#1F1B16]/75 mt-1">Audit exposure level is minimal.</p>
                      </div>

                      {/* Log Feed */}
                      <div className="md:col-span-2 bg-[#F4EFE6]/60 border border-[#1F1B16]/8 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold text-[#1F1B16] uppercase tracking-wide flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-[#6E8B60]" /> Operational Feed
                          </h4>
                          <span className="text-[10px] font-sans font-semibold text-[#1F1B16]/65">Real-Time Sync</span>
                        </div>
                        <div className="space-y-3 text-[11px]">
                          <div className="flex items-start gap-2.5 border-b border-[#1F1B16]/5 pb-2">
                            <CheckCircle className="w-4 h-4 text-[#6E8B60] shrink-0" />
                            <div>
                              <p className="font-bold text-[#1F1B16]">HubSpot DPA Verified</p>
                              <p className="text-[10px] text-[#1F1B16]/75">Data Protection Agreement verified and logged for HubSpot email marketing.</p>
                            </div>
                            <span className="ml-auto text-[10px] text-[#1F1B16]/65 whitespace-nowrap font-medium font-mono"><time dateTime="PT2H">2 hrs ago</time></span>
                          </div>
                          <div className="flex items-start gap-2.5 border-b border-[#1F1B16]/5 pb-2">
                            <CheckCircle className="w-4 h-4 text-[#6E8B60] shrink-0" />
                            <div>
                              <p className="font-bold text-[#1F1B16]">Automated Cookie Scan Completed</p>
                              <p className="text-[10px] text-[#1F1B16]/75">14 active cookie scripts audited. Zero unclassified tags detected.</p>
                            </div>
                            <span className="ml-auto text-[10px] text-[#1F1B16]/65 whitespace-nowrap font-medium font-mono"><time dateTime="P1D">1 day ago</time></span>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <CheckCircle className="w-4 h-4 text-[#6E8B60] shrink-0" />
                            <div>
                              <p className="font-bold text-[#1F1B16]">Employee training logs updated</p>
                              <p className="text-[10px] text-[#1F1B16]/75">12 team members completed the annual GDPR awareness module.</p>
                            </div>
                            <span className="ml-auto text-[10px] text-[#1F1B16]/65 whitespace-nowrap font-medium font-mono"><time dateTime="P3D">3 days ago</time></span>
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
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#F4EFE6]/60 border border-[#1F1B16]/8 p-4 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-[#1F1B16]">
                            Active Target Domain: <span className="text-[#6E8B60]">https://agency.domain.com</span>
                          </p>
                          <p className="text-[10px] text-[#1F1B16]/60 mt-1">Consent banner detects and blocks trackers automatically prior to visitor selection.</p>
                        </div>
                        <span className="text-[10px] font-bold bg-[#6E8B60]/10 text-[#6E8B60] border border-[#6E8B60]/20 px-2.5 py-1 rounded">
                          Consent Mode v2: ACTIVE
                        </span>
                      </div>

                      <div className="relative group/scroll overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] min-w-[550px]">
                          <thead>
                            <tr className="border-b border-[#1F1B16]/10 text-[#1F1B16]/50 uppercase tracking-wider text-[10px] font-bold">
                              <th className="pb-2">Cookie ID</th>
                              <th className="pb-2">Service</th>
                              <th className="pb-2">Classification</th>
                              <th className="pb-2">Expiry</th>
                              <th className="pb-2">Confidence</th>
                              <th className="pb-2">Trigger Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F1B16]/5 text-[#1F1B16]/80 font-medium">
                            <tr>
                              <td className="py-2.5 font-bold text-[#1F1B16] font-mono">_ga</td>
                              <td className="py-2.5">Google Analytics</td>
                              <td className="py-2.5"><span className="text-[#6E8B60] bg-[#6E8B60]/8 px-2 py-0.5 rounded border border-[#6E8B60]/15 text-[10px] font-bold">Analytics</span></td>
                              <td className="py-2.5 font-mono">2 Years</td>
                              <td className="py-2.5 text-[#6E8B60] font-bold font-mono">99.8%</td>
                              <td className="py-2.5 text-[#1F1B16]/60">Blocked prior to consent</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-bold text-[#1F1B16] font-mono">_fbp</td>
                              <td className="py-2.5">Meta Pixel</td>
                              <td className="py-2.5"><span className="text-[#B28247] bg-[#B28247]/8 px-2 py-0.5 rounded border border-[#B28247]/15 text-[10px] font-bold">Marketing</span></td>
                              <td className="py-2.5 font-mono">3 Months</td>
                              <td className="py-2.5 text-[#6E8B60] font-bold font-mono">99.5%</td>
                              <td className="py-2.5 text-[#1F1B16]/60">Blocked prior to consent</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-bold text-[#1F1B16] font-mono">stripe_mid</td>
                              <td className="py-2.5">Stripe Payments</td>
                              <td className="py-2.5"><span className="text-[#4F779E] bg-[#4F779E]/8 px-2 py-0.5 rounded border border-[#4F779E]/15 text-[10px] font-bold">Necessary</span></td>
                              <td className="py-2.5 font-mono">1 Year</td>
                              <td className="py-2.5 text-[#6E8B60] font-bold font-mono">100%</td>
                              <td className="py-2.5 text-[#6E8B60] font-bold">Always Allowed</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {/* Left scroll indicator mask */}
                      <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-[#FBF8F3] to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-300" />
                      {/* Right scroll indicator mask */}
                      <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-[#FBF8F3] to-transparent pointer-events-none opacity-100 group-hover/scroll:opacity-0 transition-opacity duration-300" />
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
                      <div className="flex items-center justify-between border-b border-[#1F1B16]/10 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-[#1F1B16] uppercase tracking-wide">Processing Activities Register</h4>
                          <p className="text-[10px] text-[#1F1B16]/60 mt-0.5">Article 30 records mapped to active vendor pipelines.</p>
                        </div>
                        <span className="text-[10px] text-[#1F1B16]/40 font-semibold">ROPA Version: <span className="font-mono">v2.4</span> (Signed)</span>
                      </div>

                      <div className="space-y-2.5 text-[11px] font-medium">
                        {[
                          { 
                            name: 'Client Email Marketing Campaigns (HubSpot Integration)', 
                            basis: 'Consent (Opt-In Audited)', 
                            subjects: 'Prospects, Leads & Active Customers', 
                            retention: 'Until consent withdrawal (immediate purge)' 
                          },
                          { 
                            name: 'Transactional Payments & Subscriptions (Stripe Integration)', 
                            basis: 'Contract Performance (Art. 6.1.b)', 
                            subjects: 'Active Paying Clients', 
                            retention: '7 Years (Financial Ledger audits)' 
                          }
                        ].map((item, index) => (
                          <div key={index} className="bg-[#F4EFE6]/60 border border-[#1F1B16]/8 rounded-lg p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                              <span className="font-bold text-[#1F1B16] text-[11px]">{item.name}</span>
                              <span className="text-[9px] bg-[#6E8B60]/10 text-[#6E8B60] border border-[#6E8B60]/20 px-2 py-0.5 rounded font-bold shrink-0 self-start sm:self-auto">
                                {item.basis}
                              </span>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2 text-[10px] text-[#1F1B16]/60 pt-1.5 border-t border-[#1F1B16]/5">
                              <p>Data Subjects: <span className="text-[#1F1B16]/80 font-bold">{item.subjects}</span></p>
                              <p className="sm:text-right">Retention Period: <span className="text-[#1F1B16]/80 font-bold font-mono">{item.retention}</span></p>
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
                      <div className="flex items-center justify-between border-b border-[#1F1B16]/10 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-[#1F1B16] uppercase tracking-wide">Active Data Requests</h4>
                          <p className="text-[10px] text-[#1F1B16]/60 mt-0.5">Secure queue of data access and deletion requests.</p>
                        </div>
                        <span className="text-[10px] text-[#1F1B16]/40 font-semibold">Verification: Email OAuth verified</span>
                      </div>

                      <div className="space-y-2 text-[11px] font-medium">
                        {[
                          {
                            ref: 'REQ-2026-04',
                            name: 'Sarah Jenkins',
                            type: 'Data Deletion (Right to be Forgotten)',
                            status: 'Pending Purge Approval',
                            statusColor: 'text-[#B28247] bg-[#B28247]/8 border-[#B28247]/20',
                            daysLeft: 14
                          },
                          {
                            ref: 'REQ-2026-03',
                            name: 'Marcus Thorne',
                            type: 'Data Access Request (Export)',
                            status: 'Completed & Dispatched',
                            statusColor: 'text-[#6E8B60] bg-[#6E8B60]/8 border-[#6E8B60]/20',
                            daysLeft: 0
                          }
                        ].map((req, i) => (
                          <div key={i} className="bg-[#F4EFE6]/60 border border-[#1F1B16]/8 rounded-lg p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-[#1F1B16]/40 font-bold">{req.ref}</span>
                                <span className="font-bold text-[#1F1B16]">{req.name}</span>
                              </div>
                              <p className="text-[10px] text-[#1F1B16]/60 mt-0.5">{req.type}</p>
                            </div>
                            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${req.statusColor}`}>
                                {req.status}
                              </span>
                              <span className="text-[10px] text-[#1F1B16]/60 font-semibold">
                                {req.daysLeft > 0 ? <><span className="font-mono">{req.daysLeft}</span> days remaining</> : 'Archive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* SECTION 2: INTEGRATION BAR (REAL LOGOS) */}
      <section id="integrations" className="w-full bg-[#191D17] border-y border-[#252B21]/60 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left shrink-0">
            <p className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wide">Active Integrations</p>
            <h4 className="text-sm font-bold text-[#F5F3ED] mt-1">Works with the systems you use daily</h4>
          </div>
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:flex md:flex-wrap justify-center lg:justify-end items-center gap-x-8 gap-y-6">
            {INTEGRATIONS.map((int, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-[#1F241D]/60 border border-[#2F362D]/60 px-4 py-2 rounded-xl text-xs font-semibold text-[#C5C8C1] opacity-70 hover:opacity-100 hover:shadow-md hover:shadow-[#8BA381]/5 hover:text-[#F5F3ED] hover:border-[#8BA381]/40 transition-all duration-300">
                {int.logo}
                <span>{int.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: BENTO GRID FEATURES (12 SYMMETRICAL MODULES) */}
      <section id="features" className="w-full bg-[#141712] relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 md:pt-14 md:pb-20">
          
          <div className="mb-10 max-w-2xl text-center md:text-left mx-auto md:mx-0">
            <p className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wide">Compliance Suite</p>
            <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-[#F5F3ED] mb-4 tracking-tight text-balance">Twelve modules. One compliance core.</h2>
            <p className="text-sm text-[#9CA297] leading-relaxed">
              Ditch separate compliance trackers and spreadsheet audits. Monitor, track, and protect your entire operation from a single dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {MODULES.map((mod, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.35, delay: i * 0.03 }}
                className="bg-[#1F241D]/45 border border-[#2F362D]/90 rounded-xl p-5.5 flex flex-col justify-between group hover:bg-[#1F241D]/80 hover:border-[#596E51]/40 transition-all duration-300 h-full relative overflow-hidden"
              >
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(89,110,81,0.08)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[9px] font-sans font-bold tracking-wider text-[#8BA381] bg-[#141712]/80 border border-[#2F362D] px-2 py-0.5 rounded">
                      {mod.tag}
                    </span>
                    <mod.icon aria-hidden="true" className="w-4 h-4 text-[#5F655A] group-hover:text-[#8BA381] transition-colors" />
                  </div>
                  <h3 className="text-base font-bold text-[#F5F3ED] mb-2">{mod.title}</h3>
                  <p className="text-[#9CA297] text-xs leading-relaxed">{mod.desc}</p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8BA381]/80 group-hover:text-[#8BA381] transition-colors cursor-pointer">
                  Manage Module <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 4: SUPERVISORY AUTHORITY GRID */}
      <section id="authorities" className="w-full bg-[#191D17] border-y border-[#252B21]/60 relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          
          <div className="mb-10">
            <p className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wide">Enforcement Landscape</p>
            <h2 className="text-3xl md:text-4xl font-sans font-extrabold text-[#F5F3ED] mb-4 tracking-tight text-balance">Supervisory Authority alignment</h2>
            <p className="text-[#9CA297] max-w-2xl text-xs sm:text-sm leading-relaxed">
              GDPR is uniform, but enforcement priorities vary by nation. Privaro adapts compliance configurations to map to the audits of your target audiences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {AUTHORITIES.map((auth, i) => (
              <div 
                key={i}
                className="bg-[#1F241D]/45 border border-[#2F362D]/90 p-5 rounded-xl hover:border-[#5F7556]/60 transition-all duration-300 flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#2F362D]/40">
                    <div className="relative group/tooltip flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#F5F3ED] text-xs">{auth.code}</span>
                      <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 hover:text-[#8BA381] cursor-help transition-colors" />
                      
                      {/* Tooltip Popover */}
                      <div className="absolute bottom-full left-0 mb-2 w-52 p-3 bg-[#1F241D]/95 border border-[#2F362D] text-[#C5C8C1] text-[10px] rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none backdrop-blur-md">
                        <div className="font-bold text-[#F5F3ED] mb-1 text-[11px]">{auth.name}</div>
                        <div className="text-[#8BA381] font-mono text-[9px] mb-1">{auth.country} Authority</div>
                        <p className="text-[#9CA297] leading-relaxed text-[10px] pt-1 border-t border-[#2F362D]/40">{auth.focus}</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#9CA297]">{auth.country}</span>
                  </div>
                  <p className="text-[#F5F3ED] text-xs font-bold mb-2">{auth.name}</p>
                  <p className="text-[#9CA297] text-[10.5px] leading-relaxed mb-3">{auth.focus}</p>
                </div>
                <div className="text-[10px] font-mono text-[#8BA381] bg-[#6E8B60]/5 border border-[#6E8B60]/15 p-2.5 rounded">
                  <span className="font-bold text-[#F5F3ED] block mb-0.5 text-[9px]">ENFORCEMENT FOCUS:</span>
                  {auth.enforcement}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 5: COMPARISON SECTION */}
      <section className="w-full bg-[#141712] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          
          <div className="text-center mb-10">
            <p className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wide">Platform Advantage</p>
            <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-[#F5F3ED] mt-2 mb-3 tracking-tight text-balance">Structured workflow, no legacy tools</h2>
            <p className="text-[#9CA297] max-w-xl mx-auto text-xs sm:text-sm">
              A comparison of audit-readiness and overhead between manual efforts, consultants, and Privaro.
            </p>
          </div>

          <div className="relative group/scroll overflow-hidden">
            <div className="overflow-x-auto border border-[#2F362D]/90 rounded-2xl bg-[#1f241d]/20 backdrop-blur-md">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#2F362D] text-[#F5F3ED] font-bold">
                    <th className="p-6">Compliance Capability</th>
                    <th className="p-6 bg-[#1F241D]/30">Manual Sheets</th>
                    <th className="p-6 bg-[#1F241D]/30">Legal Consultants</th>
                    <th className="p-6 text-[#8BA381] bg-[#242A20]/80 border-x border-[#8BA381]/25">Privaro OS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F362D]/60 text-[#9CA297] font-medium">
                  <tr>
                    <td className="p-6 font-bold text-[#F5F3ED]">ROPA / Record keeping</td>
                    <td className="p-6 bg-[#1F241D]/10 text-red-400/90 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Static spreadsheets (Outdates instantly)</td>
                    <td className="p-6 bg-[#1F241D]/10">Manual document audits (Slow & expensive)</td>
                    <td className="p-6 text-[#F5F3ED] bg-[#242A20]/40 border-x border-[#8BA381]/20 font-bold flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#8BA381]" /> Automated logs matching live code stack</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-bold text-[#F5F3ED]">Consent mode tracking</td>
                    <td className="p-6 bg-[#1F241D]/10 text-red-400/90 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Hardcoded scripts (Frequent drifts)</td>
                    <td className="p-6 bg-[#1F241D]/10">Policy outlines, no actual engineering code</td>
                    <td className="p-6 text-[#F5F3ED] bg-[#242A20]/40 border-x border-[#8BA381]/20 font-bold flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#8BA381]" /> Edge blocking scripts synced with logs</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-bold text-[#F5F3ED]">Data subject request queue</td>
                    <td className="p-6 bg-[#1F241D]/10 text-red-400/90 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Manual inbox tracking (High human risk)</td>
                    <td className="p-6 bg-[#1F241D]/10">Guidance documents, manual action steps</td>
                    <td className="p-6 text-[#F5F3ED] bg-[#242A20]/40 border-x border-[#8BA381]/20 font-bold flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#8BA381]" /> OAuth-verified intake and countdowns</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-bold text-[#F5F3ED]">Employee training & logging</td>
                    <td className="p-6 bg-[#1F241D]/10 text-red-400/90 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Omitted or undocumented (Audit failure)</td>
                    <td className="p-6 bg-[#1F241D]/10">External seminars (No centralized logs)</td>
                    <td className="p-6 text-[#F5F3ED] bg-[#242A20]/40 border-x border-[#8BA381]/20 font-bold flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#8BA381]" /> Integrated training portal & auto certifications</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Scroll indicator gradient masks */}
            <div className="absolute top-0 bottom-0 left-0 w-10 bg-gradient-to-r from-[#141712] to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 bottom-0 right-0 w-10 bg-gradient-to-l from-[#141712] to-transparent pointer-events-none opacity-100 group-hover/scroll:opacity-0 transition-opacity duration-300" />
          </div>

        </div>
      </section>

      {/* SECTION 6: GDPR RISK CALCULATOR */}
      <section id="risk-calculator" className="w-full bg-[#191D17] border-y border-[#252B21]/60 relative z-10 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-[#F5F3ED] mb-3 tracking-tight text-balance">Evaluate your GDPR exposure</h2>
            <p className="text-[#9CA297] max-w-xl mx-auto text-xs sm:text-sm">
              Calculate your organization&apos;s compliance risk profile in 60 seconds. Receive instant recommendations.
            </p>
          </div>

          <div className="bg-[#1F241D]/45 border border-[#2F362D]/90 rounded-2xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#8BA381]/25 to-transparent" />
            
            {calcStep < CALCULATOR_QUESTIONS.length ? (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    {calcStep > 0 && (
                      <button 
                        onClick={() => setCalcStep(prev => prev - 1)}
                        className="text-[10px] text-[#9CA297] hover:text-[#F5F3ED] flex items-center gap-1 bg-[#141712]/50 border border-[#2F362D] px-2.5 py-1 rounded transition-colors touch-manipulation"
                      >
                        <ArrowLeft className="w-3 h-3" /> Back
                      </button>
                    )}
                    <span className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wider">
                      Question {calcStep + 1} of {CALCULATOR_QUESTIONS.length}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {CALCULATOR_QUESTIONS.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`w-5 h-1 rounded-full transition-all ${
                          idx <= calcStep ? 'bg-[#8BA381]' : 'bg-[#2F362D]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-[#F5F3ED] mb-6 leading-snug flex items-center gap-2 flex-wrap">
                  <span>{CALCULATOR_QUESTIONS[calcStep].text}</span>
                  {CALCULATOR_QUESTIONS[calcStep].id === 'ropa' && (
                    <span className="relative group/term inline-block leading-none">
                      <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 cursor-help hover:text-[#8BA381] transition-colors" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-[#1F241D] border border-[#2F362D] text-[#C5C8C1] text-[10.5px] rounded-xl shadow-2xl opacity-0 invisible group-hover/term:opacity-100 group-hover/term:visible transition-all duration-200 z-50 pointer-events-none normal-case font-normal leading-relaxed backdrop-blur-md">
                        <strong className="text-[#F5F3ED] block mb-1">Record of Processing Activities (ROPA):</strong>
                        A log required under GDPR Article 30 that documents your agency&apos;s data categories, purposes, and recipients of personal data.
                      </span>
                    </span>
                  )}
                  {CALCULATOR_QUESTIONS[calcStep].id === 'cookies' && (
                    <span className="relative group/term inline-block leading-none">
                      <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 cursor-help hover:text-[#8BA381] transition-colors" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-[#1F241D] border border-[#2F362D] text-[#C5C8C1] text-[10.5px] rounded-xl shadow-2xl opacity-0 invisible group-hover/term:opacity-100 group-hover/term:visible transition-all duration-200 z-50 pointer-events-none normal-case font-normal leading-relaxed backdrop-blur-md">
                        <strong className="text-[#F5F3ED] block mb-1">ePrivacy & Consent Management:</strong>
                        GDPR requires blocking marketing pixels and analytic cookies *before* a visitor selects their consent preferences.
                      </span>
                    </span>
                  )}
                  {CALCULATOR_QUESTIONS[calcStep].id === 'special' && (
                    <span className="relative group/term inline-block leading-none">
                      <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 cursor-help hover:text-[#8BA381] transition-colors" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-[#1F241D] border border-[#2F362D] text-[#C5C8C1] text-[10.5px] rounded-xl shadow-2xl opacity-0 invisible group-hover/term:opacity-100 group-hover/term:visible transition-all duration-200 z-50 pointer-events-none normal-case font-normal leading-relaxed backdrop-blur-md">
                        <strong className="text-[#F5F3ED] block mb-1">Special Category Data (DPIA):</strong>
                        Sensitive personal data (health, biometric, location, banking) carries high-risk profiles that require a formal Data Protection Impact Assessment (DPIA).
                      </span>
                    </span>
                  )}
                </h3>

                <div className="space-y-3">
                  {CALCULATOR_QUESTIONS[calcStep].options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleCalculatorSelect(CALCULATOR_QUESTIONS[calcStep].id, opt.value, opt.score)}
                      className="w-full text-left bg-[#141712]/55 hover:bg-[#252B21]/80 border border-[#2F362D]/60 hover:border-[#8BA381]/40 p-4.5 rounded-xl transition-all duration-200 text-xs sm:text-sm text-[#C5C8C1] hover:text-[#F5F3ED] font-semibold flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <span>{opt.text}</span>
                      <ChevronRight className="w-4 h-4 text-[#5F655A] group-hover:text-[#8BA381] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
                aria-live="polite"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#6E8B60]/10 border border-[#6E8B60]/20 text-[#8BA381] mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                
                <h3 className="text-xl sm:text-2xl font-bold text-[#F5F3ED] mb-3">Assessment Diagnostic Complete</h3>
                
                <div className={`max-w-md mx-auto border rounded-xl p-5 mb-6 ${riskColor}`}>
                  <div className="flex items-center justify-center gap-2.5 mb-2.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase">EXPOSURE LEVEL:</span>
                    <span className={`font-mono font-bold text-xs bg-[#141712]/55 px-2.5 py-0.5 rounded border flex items-center gap-1.5 ${
                      riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'text-red-400 border-red-500/50' :
                      riskLevel === 'MEDIUM' ? 'text-amber-400 border-amber-500/50' : 'text-[#8BA381] border-[#8BA381]/50'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'bg-red-500 animate-pulse' :
                        riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-[#8BA381]'
                      }`} />
                      {riskLevel}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed font-semibold">{riskText}</p>
                </div>

                {/* Diagnostic Input Selections Summary Checklist */}
                <div className="mt-6 text-left border-t border-[#2F362D]/40 pt-5 space-y-3 text-[11px] text-[#9CA297] max-w-md mx-auto mb-8 bg-[#141712]/20 p-4.5 rounded-xl border border-[#2F362D]/40">
                  <p className="font-bold text-[#F5F3ED] uppercase tracking-wide text-[9px] mb-1">Your Diagnostic Answers:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#F5F3ED]">Audience:</strong> {
                          calcAnswers.jurisdiction === 'eu' ? 'EU/UK citizens' :
                          calcAnswers.jurisdiction === 'sub' ? 'Sub-processor' : 'Non-EU only'
                        }
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#F5F3ED]">ROPA Status:</strong> {
                          calcAnswers.ropa === 'yes' ? 'Audited register' :
                          calcAnswers.ropa === 'no' ? 'Spreadsheets' : 'None maintained'
                        }
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#F5F3ED]">Consent logs:</strong> {
                          calcAnswers.cookies === 'automated' ? 'Pre-consent block' :
                          calcAnswers.cookies === 'basic' ? 'Basic banner' : 'No blockers'
                        }
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#F5F3ED]">Sensitive:</strong> {
                          calcAnswers.special === 'yes' ? 'Sensitive data' : 'Basic contact info'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href={prefillUrl} className="w-full sm:w-auto bg-gradient-to-r from-[#596E51] to-[#788F6F] hover:from-[#495B42] hover:to-[#677B5D] text-[#F5F3ED] text-xs sm:text-sm font-bold py-3.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 border border-[#8BA381]/20 focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] touch-manipulation">
                    Verify Exposure in Assessment <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button 
                    onClick={handleCopyCalculatorLink}
                    className="w-full sm:w-auto bg-[#1F241D] hover:bg-[#2A3127] text-[#C5C8C1] hover:text-[#F5F3ED] border border-[#2F362D] text-xs font-semibold py-3.5 px-6 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 touch-manipulation"
                  >
                    {copiedCalculatorLink ? (
                      <>Copied! <Check className="w-3.5 h-3.5 text-[#8BA381]" /></>
                    ) : (
                      <>Share Result Link <Copy className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                  <button 
                    onClick={resetCalculator}
                    className="w-full sm:w-auto bg-[#141712]/50 hover:bg-[#141712] text-[#9CA297] hover:text-[#F5F3ED] border border-[#2F362D] text-xs font-semibold py-3.5 px-6 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
                  >
                    Reset Calculator
                  </button>
                </div>
              </motion.div>
            )}
          </div>

        </div>
      </section>

      {/* SECTION 7: PRICING TIERS */}
      <section id="pricing" className="w-full bg-[#141712] relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          
          <div className="text-center mb-10">
            <p className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wide">Pricing Matrix</p>
            <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-[#F5F3ED] mt-2 mb-3 tracking-tight text-balance">Structured plans for every agency size</h2>
            
            {/* Annual Billing Toggle */}
            <div className="inline-flex items-center gap-3 bg-[#1F241D] border border-[#2F362D]/80 p-1 rounded-full mt-4">
              <button 
                onClick={() => setAnnualBilling(true)}
                className={`text-[10px] sm:text-xs font-bold py-1.5 px-4 rounded-full transition-all ${
                  annualBilling ? 'bg-[#6E8B60] text-[#F5F3ED]' : 'text-[#9CA297] hover:text-[#F5F3ED]'
                }`}
              >
                Yearly Billing (Save 20%)
              </button>
              <button 
                onClick={() => setAnnualBilling(false)}
                className={`text-[10px] sm:text-xs font-bold py-1.5 px-4 rounded-full transition-all ${
                  !annualBilling ? 'bg-[#6E8B60] text-[#F5F3ED]' : 'text-[#9CA297] hover:text-[#F5F3ED]'
                }`}
              >
                Monthly Billing
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
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
                features: ['Activity Register (20 ROPAs)', 'Vendor Tracking (30 processors)', 'Hosted Privacy Policy', '2 Admin Seats', 'Standard Email Support'], 
                popular: false 
              },
              { 
                name: 'Professional OS', 
                price: '89', 
                yearly: '71', 
                desc: 'Complete compliance management system for growing organizations.', 
                features: ['Unlimited activity registers', 'Unlimited vendor tracking', 'Hosted Cookie Consent banner', 'Data Request queue', 'DPIA impact assessments', 'Client Portals (up to 10 clients)', '10 Admin Seats', 'Priority Support'], 
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
            ].map((plan, i) => (
              <div 
                key={i} 
                className={`rounded-2xl p-6.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-[#1F241D] border-2 border-[#8BA381] shadow-2xl shadow-[#6E8B60]/10 scale-[1.01] md:scale-100 z-10' 
                    : 'bg-[#1F241D]/35 border border-[#2F362D]/90 hover:border-[#2F362D]/60'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-[#6E8B60] text-[#F5F3ED] text-[9px] font-bold uppercase tracking-wider py-1.5 px-4 rounded-bl-xl border-l border-b border-[#8BA381]/30">
                    Recommended Plan
                  </div>
                )}

                <div>
                  <h4 className="text-base font-bold text-[#F5F3ED] mb-1.5">{plan.name}</h4>
                  <p className="text-[11px] text-[#9CA297] leading-normal min-h-[32px] mb-6">{plan.desc}</p>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-extrabold text-[#F5F3ED] font-mono">
                      €{annualBilling ? plan.yearly : plan.price}
                    </span>
                    <span className="text-xs text-[#9CA297]">/month</span>
                  </div>

                  <ul className="space-y-3.5 border-t border-[#2F362D] pt-6 mb-8 text-xs text-[#9CA297]">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 leading-normal">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.popular ? 'text-[#8BA381]' : 'text-[#5F655A]'}`} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link 
                  href="/assessment" 
                  className={`w-full text-center text-xs font-bold py-3 rounded-lg transition-all border focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] ${
                    plan.popular 
                      ? 'bg-[#6E8B60] hover:bg-[#596E51] text-[#F5F3ED] border-[#8BA381]/20 shadow-lg shadow-[#6E8B60]/10' 
                      : 'bg-[#141712]/50 hover:bg-[#141712] text-[#C5C8C1] border-[#2F362D] hover:border-[#8BA381]/20'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 8: TRUST & AUDIT SECURITY CREDENTIALS */}
      <section className="w-full bg-[#191D17] border-y border-[#252B21]/60 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-16">
          <div className="bg-[#1F241D]/45 border border-[#2F362D]/90 rounded-2xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#8BA381]/20 to-transparent" />
            
            <div className="text-center mb-10 max-w-xl mx-auto">
              <h3 className="text-sm font-bold text-[#F5F3ED] uppercase tracking-wide mb-2.5">Security & Hosting Architecture</h3>
              <p className="text-xs text-[#9CA297] leading-relaxed">
                Compliance products must process data with complete transparency. Our hosting and encryption standards are fully documented below.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {[
                { title: 'EU Data Residency', desc: '100% hosted in AWS Dublin (eu-west-1). Customer data never exits EU boundaries.' },
                { title: 'AES-256 Encryption', desc: 'Strict data encrypt-at-rest pipelines and database sector partitions.' },
                { title: 'Zero-Knowledge Log', desc: 'Consent validation receipts are cryptographic hashes. No tracking of raw user IPs.' },
                { title: 'SOC 2 Type II Prep', desc: 'Internal security logs mapped to SOC 2 safety guidelines. Readiness audit target Q4 2026.' },
                { title: 'GDPR Self-Certified', desc: 'Privaro is self-certified compliant under official EU Art. 30 processing standards.' }
              ].map((cred, i) => (
                <div key={i} className="bg-[#141712]/55 border border-[#2F362D]/60 p-4.5 rounded-xl">
                  <Lock className="w-4 h-4 text-[#8BA381] mb-3" />
                  <h4 className="text-xs font-bold text-[#F5F3ED] mb-1.5">{cred.title}</h4>
                  <p className="text-[10px] text-[#9CA297] leading-normal">{cred.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
