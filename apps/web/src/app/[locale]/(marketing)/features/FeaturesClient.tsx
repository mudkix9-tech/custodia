"use client";

import React from 'react';
import {
  AlertTriangle, Database, ShieldCheck, FileText, Globe, UserCheck,
  Lock, ArrowRight, Shield, CheckCircle2, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

const FEATURES = [
  {
    id: "gap-assessment",
    icon: AlertTriangle,
    title: "Gap Assessment",
    subtitle: "Understand where you stand.",
    desc: "Stop wondering if you're compliant. Our intelligent assessment engine asks simple questions about your agency's data practices and generates a prioritized, actionable compliance roadmap.",
    highlights: [
      "Dynamic questionnaire adapts to your specific agency profile.",
      "Instant risk scoring across 10 distinct compliance categories.",
      "Step-by-step remediation plans tailored to your exact needs.",
      "Client-ready PDF reports to demonstrate proactive compliance."
    ],
    cta: "Take the assessment",
    href: "/assessment"
  },
  {
    id: "ropa",
    icon: Database,
    title: "ROPA (Record of Processing Activities)",
    subtitle: "Document your processing.",
    desc: "The cornerstone of GDPR compliance, made effortless. Maintain a living map of how data moves through your agency and client projects without wrestling with spreadsheets.",
    highlights: [
      "Pre-built templates for common agency activities (marketing, HR, etc.).",
      "Auto-link vendors and systems to specific processing activities.",
      "Track lawful bases, retention periods, and data categories.",
      "Export compliant Article 30 records in seconds."
    ],
    cta: "Start documenting",
    href: "/signup"
  },
  {
    id: "vendor-intelligence",
    icon: ShieldCheck,
    title: "Vendor Intelligence",
    subtitle: "Track your third parties.",
    desc: "Agencies use dozens of tools. Custodia tracks their compliance status for you. Access our database of over 1,000 marketing and operational tools to instantly verify their GDPR posture.",
    highlights: [
      "Instant insights into EU hosting, sub-processors, and transfer mechanisms.",
      "Automated alerts when a vendor changes their terms or gets breached.",
      "Centralized repository for all your signed DPAs (Data Processing Agreements).",
      "Easily assess vendor risk before onboarding new tools."
    ],
    cta: "Explore vendor tracker",
    href: "/signup"
  },
  {
    id: "privacy-policies",
    icon: FileText,
    title: "Dynamic Privacy Policies",
    subtitle: "Generate compliant policies.",
    desc: "Say goodbye to generic templates and expensive legal fees. Custodia generates bespoke privacy policies, cookie policies, and terms of service based on your actual data practices.",
    highlights: [
      "Policies automatically update when you add new vendors or activities.",
      "Embeddable widgets keep your website policies constantly in sync.",
      "Multi-language support for international agencies.",
      "Legally vetted language tailored for marketing and design agencies."
    ],
    cta: "Generate your policy",
    href: "/signup"
  },
  {
    id: "cookie-consent",
    icon: Globe,
    title: "Cookie Consent",
    subtitle: "Manage website consent.",
    desc: "A fully integrated Consent Management Platform (CMP) that doesn't ruin your website's design. Ensure compliance with ePrivacy and GDPR while maintaining your brand aesthetic.",
    highlights: [
      "Full support for Google Consent Mode v2 and IAB TCF v2.2.",
      "Automated weekly cookie scanning and categorization.",
      "Granular consent logs to prove compliance to auditors.",
      "Manage multiple client domains from a single dashboard."
    ],
    cta: "Set up consent",
    href: "/signup"
  },
  {
    id: "dsar-automation",
    icon: UserCheck,
    title: "DSAR Automation",
    subtitle: "Handle data requests.",
    desc: "Turn a 20-hour manual panic into a streamlined 5-minute workflow. Automate the intake, verification, and resolution of Data Subject Access Requests (DSARs).",
    highlights: [
      "Secure, customizable intake portals for data subjects.",
      "Automated identity verification workflows.",
      "Centralized task management to coordinate data retrieval.",
      "Secure delivery portal for requested data packages."
    ],
    cta: "Automate requests",
    href: "/signup"
  },
  {
    id: "breach-management",
    icon: AlertTriangle,
    title: "Breach Management",
    subtitle: "Respond to incidents.",
    desc: "When the worst happens, speed is critical. Custodia guides you through the exact steps required by the GDPR 72-hour notification rule, ensuring you respond correctly and legally.",
    highlights: [
      "Step-by-step incident response playbooks.",
      "Automated risk assessment to determine if notification is required.",
      "Pre-filled templates for supervisory authority notification.",
      "Internal incident log to maintain a legally required breach register."
    ],
    cta: "Prepare for incidents",
    href: "/signup"
  },
  {
    id: "dpia",
    icon: Shield,
    title: "DPIA (Data Protection Impact Assessments)",
    subtitle: "Assess high-risk processing.",
    desc: "Conduct mandatory assessments for high-risk projects efficiently. Custodia provides the framework to identify, evaluate, and mitigate privacy risks before you launch new initiatives.",
    highlights: [
      "Guided questionnaires based on regulatory guidelines.",
      "Collaborative workflows for involving DPOs and stakeholders.",
      "Risk matrix visualization to prioritize mitigation efforts.",
      "Exportable reports for supervisory authority consultation."
    ],
    cta: "Start an assessment",
    href: "/signup"
  },
  {
    id: "training",
    icon: CheckCircle2,
    title: "Employee Training",
    subtitle: "Educate your team.",
    desc: "Human error is the biggest privacy risk. Prove your commitment to compliance by enrolling your team in our agency-specific GDPR awareness training programs.",
    highlights: [
      "Bite-sized, engaging modules designed for agency professionals.",
      "Automated enrollment and progress tracking.",
      "Quizzes to verify comprehension and retention.",
      "Certificates of completion for your compliance records."
    ],
    cta: "Train your team",
    href: "/signup"
  },
  {
    id: "audit-readiness",
    icon: Lock,
    title: "Audit Readiness & Client Trust",
    subtitle: "Prove compliance on demand.",
    desc: "Turn compliance into a competitive advantage. Instantly generate comprehensive audit files or share live trust centers to win enterprise clients who demand rigorous privacy standards.",
    highlights: [
      "Public or password-protected Client Trust Portals.",
      "One-click generation of comprehensive compliance audit files.",
      "Demonstrate proactive compliance during client vendor assessments.",
      "Centralized repository for all compliance evidence."
    ],
    cta: "Build a trust center",
    href: "/signup"
  }
];

export default function FeaturesPage() {
  return (
    <div className="pt-24 pb-32">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 mb-20 text-center">
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight">Ten modules. <br/>One source of truth.</h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto">Explore the unified architecture designed to assess, document, manage, respond, and prove your privacy posture effortlessly.</p>
      </section>

      {/* Modules List */}
      <section className="max-w-5xl mx-auto px-6 space-y-32 mb-32">
        {FEATURES.map((feat, index) => (
          <div key={feat.id} id={feat.id} className={`flex flex-col md:flex-row gap-12 items-center ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>

            {/* Visual Placeholder */}
            <div className="w-full md:w-1/2">
              <div className="bg-bone-100 border border-ink-900/5 rounded-3xl aspect-[4/3] flex items-center justify-center relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-sage-50/50 to-bone-100/50 mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                 <feat.icon className="w-24 h-24 text-sage-600/20 group-hover:text-sage-600/40 transition-colors duration-500" strokeWidth={1} />
              </div>
            </div>

            {/* Content */}
            <div className="w-full md:w-1/2 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-sage-50 flex items-center justify-center border border-sage-500/20">
                  <feat.icon className="w-5 h-5 text-sage-600" />
                </div>
                <span className="text-sm font-semibold text-sage-700 uppercase tracking-widest">{feat.subtitle}</span>
              </div>

              <h2 className="text-3xl font-bold text-ink-900 mb-4">{feat.title}</h2>
              <p className="text-lg text-ink-500 leading-relaxed mb-8">{feat.desc}</p>

              <ul className="space-y-4 mb-8">
                {feat.highlights.map((highlight, j) => (
                  <li key={j} className="flex items-start gap-3 text-ink-600">
                    <CheckCircle2 className="w-5 h-5 text-sage-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{highlight}</span>
                  </li>
                ))}
              </ul>

              <Link href={feat.href} className="inline-flex items-center gap-2 text-sage-700 font-semibold hover:text-sage-600 transition-colors">
                {feat.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        ))}
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 text-center">
        <div className="bg-ink-900 p-12 rounded-3xl relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-ink-800 to-transparent pointer-events-none"/>
           <div className="relative z-10">
              <h2 className="text-3xl font-serif text-bone-50 mb-4 tracking-tight">See it in action.</h2>
              <p className="text-ink-300 mb-8 max-w-lg mx-auto">Experience the power of the complete Custodia OS. Start your free assessment today.</p>
              <Link href="/assessment" className="inline-flex bg-sage-600 hover:bg-sage-500 text-bone-50 text-base font-semibold py-3.5 px-8 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
                 Start free assessment <ArrowRight className="w-4 h-4"/>
              </Link>
           </div>
        </div>
      </section>
    </div>
  );
}
