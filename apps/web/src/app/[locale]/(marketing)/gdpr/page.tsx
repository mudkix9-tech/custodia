"use client";

import React from 'react';
import Link from 'next/link';
import { BookOpen, Shield, Users, AlertTriangle, FileCheck, ArrowRight } from 'lucide-react';

export default function GdprHubPage() {
  return (
    <div className="relative pt-24 pb-32 overflow-hidden min-h-screen">
      {/* Background decorations matching new design */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
      <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-24">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal text-text-heading mb-6 tracking-[-0.032em] text-balance">
            The practical guide to GDPR compliance
          </h1>
          <p className="text-[17px] sm:text-[19px] text-text-muted mb-10 text-pretty">
            The General Data Protection Regulation (GDPR) is a comprehensive privacy law that dictates how organizations must collect, handle, and protect personal data. This hub breaks down complex requirements into actionable steps so your team can achieve and maintain compliance.
          </p>
          <div className="flex justify-center">
            <Link href="/assessment" className="inline-flex items-center gap-2 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-8 py-3.5 transition-colors">
              Take Free Assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Grid of Resource Clusters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Cluster 1: Rights & Obligations */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col">
            <BookOpen className="w-8 h-8 text-accent-gold mb-6" />
            <h2 className="text-xl text-text-heading mb-3">Rights & Obligations</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Understand the core tenets of Articles 13-22, mapping exactly what you must do to honor data subject requests like access, rectification, and erasure.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Responding to Data Subject Access Requests (DSARs)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>The Right to be Forgotten in practice</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Data portability requirements</span>
              </li>
            </ul>
          </div>

          {/* Cluster 2: Data Processing */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col">
            <FileCheck className="w-8 h-8 text-accent-gold mb-6" />
            <h2 className="text-xl text-text-heading mb-3">Data Processing</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Establish your lawful bases, map your data flows with a ROPA, and assess high-risk activities through Data Protection Impact Assessments (DPIAs).
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>How to map your ROPA (Record of Processing Activities)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Choosing the correct lawful basis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>When to conduct a DPIA</span>
              </li>
            </ul>
          </div>

          {/* Cluster 3: Vendor Management */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col">
            <Users className="w-8 h-8 text-accent-gold mb-6" />
            <h2 className="text-xl text-text-heading mb-3">Vendor Management</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Learn how to vet sub-processors, enforce Standard Contractual Clauses (SCCs), and conduct Transfer Impact Assessments (TIAs).
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary mb-6">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Managing third-party sub-processors</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Implementing Standard Contractual Clauses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>How to run a Transfer Impact Assessment</span>
              </li>
            </ul>
            <div className="pt-4 border-t border-white/7 mt-auto">
              <Link href="/gdpr/vendors/aws" className="text-[13px] text-accent-gold hover:text-accent-gold-hover transition-colors flex items-center gap-1.5">
                View vendor intelligence profiles <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Cluster 4: Breach Response */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col lg:col-start-1 lg:col-end-2">
            <AlertTriangle className="w-8 h-8 text-accent-gold mb-6" />
            <h2 className="text-xl text-text-heading mb-3">Breach Response</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Prepare for the worst with a robust incident response plan, including 72-hour notification procedures and data subject communication workflows.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>The 72-hour notification rule explained</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>When to communicate breaches to data subjects</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Building an internal incident response plan</span>
              </li>
            </ul>
          </div>

          {/* Cluster 5: Consent & Privacy */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col lg:col-start-2 lg:col-end-3">
            <Shield className="w-8 h-8 text-accent-gold mb-6" />
            <h2 className="text-xl text-text-heading mb-3">Consent & Privacy</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Navigate the nuances of cookie banners, marketing opt-ins, and understanding when to use legitimate interest versus explicit consent.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Legitimate interest vs. explicit consent</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Building compliant cookie banners</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>B2B vs B2C marketing rules under GDPR</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
