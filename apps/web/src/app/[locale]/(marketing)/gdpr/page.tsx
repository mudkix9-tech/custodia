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
            The GDPR is 99 articles, 173 recitals, and thousands of pages of regulatory guidance. These guides cut through it and tell you what actually matters for your business.
          </p>
          <div className="flex justify-center">
            <Link href="/assessment" className="inline-flex items-center gap-2 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-8 py-3.5 transition-colors">
              Take free gap assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Grid of Resource Clusters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          
          {/* Cluster 1: Rights & Obligations */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col">
            <BookOpen className="w-8 h-8 text-accent-gold mb-6" />
            <div className="text-[11px] font-mono tracking-widest text-text-muted mb-2 uppercase">ARTICLES 13–22</div>
            <h2 className="text-xl text-text-heading mb-3">Data subject rights and your obligations</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              The GDPR gives individuals specific rights over their personal data — access, rectification, erasure, portability, and objection. Your obligation isn't just to respect them, it's to have a documented process that can respond within one calendar month.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Understanding the right to erasure vs retention obligations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/compliance-guide-agencies" className="hover:text-accent-gold transition-colors">The Ultimate GDPR Compliance Guide for Agencies</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/dsar-controller-processor" className="hover:text-accent-gold transition-colors">How to handle a DSAR when you're both controller and processor</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Responding to data portability requests in practice</span>
              </li>
            </ul>
          </div>

          {/* Cluster 2: Data Processing */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col">
            <FileCheck className="w-8 h-8 text-accent-gold mb-6" />
            <div className="text-[11px] font-mono tracking-widest text-text-muted mb-2 uppercase">ARTICLES 5, 6, 30, 35</div>
            <h2 className="text-xl text-text-heading mb-3">Lawful bases, ROPA, and impact assessments</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Every time you process personal data, you need a lawful basis. Every processing activity needs to be recorded. And some activities require a formal impact assessment before you start. This is where most compliance gaps live.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/lawful-bases" className="hover:text-accent-gold transition-colors">The six lawful bases and how to choose the right one</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/ropa-template" className="hover:text-accent-gold transition-colors">What is a ROPA? A Practical Template for Marketing Teams</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/dpia-guide" className="hover:text-accent-gold transition-colors">When a DPIA is required and how to run one</Link>
              </li>
            </ul>
          </div>

          {/* Cluster 3: Vendor Management */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col">
            <Users className="w-8 h-8 text-accent-gold mb-6" />
            <div className="text-[11px] font-mono tracking-widest text-text-muted mb-2 uppercase">ARTICLES 28, 44–49</div>
            <h2 className="text-xl text-text-heading mb-3">Sub-processors, DPAs, and international transfers</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Every SaaS tool in your stack that touches personal data is a sub-processor with data processing implications. You need a DPA with each one, and if they transfer data outside the EU, you need a legal mechanism to justify it.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary mb-6">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/sccs-dpf-schrems" className="hover:text-accent-gold transition-colors">SCCs, the Data Privacy Framework, and what survives Schrems III</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>How to audit your vendor stack for GDPR compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/vendors" className="hover:text-accent-gold transition-colors flex items-center gap-1.5">Browse vendor compliance profiles <ArrowRight className="w-3.5 h-3.5" /></Link>
              </li>
            </ul>
          </div>

          {/* Cluster 4: Breach Response */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col lg:col-start-1 lg:col-end-2">
            <AlertTriangle className="w-8 h-8 text-accent-gold mb-6" />
            <div className="text-[11px] font-mono tracking-widest text-text-muted mb-2 uppercase">ARTICLES 33–34</div>
            <h2 className="text-xl text-text-heading mb-3">Breach notification and incident response</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              A breach isn't just a cyberattack. An email sent to the wrong recipient, a lost laptop, an unencrypted export — all qualify. You have 72 hours to notify your supervisory authority once you're aware. That window is too short to figure out your process on the fly.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/data-breach-response" className="hover:text-accent-gold transition-colors">What qualifies as a personal data breach under the GDPR</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/breach-timeline" className="hover:text-accent-gold transition-colors">The 72-hour notification timeline step by step</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/incident-response-plan" className="hover:text-accent-gold transition-colors">Building an incident response plan before you need one</Link>
              </li>
            </ul>
          </div>

          {/* Cluster 5: Consent & Privacy */}
          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 shadow-panel-elevated flex flex-col lg:col-start-2 lg:col-end-3">
            <Shield className="w-8 h-8 text-accent-gold mb-6" />
            <div className="text-[11px] font-mono tracking-widest text-text-muted mb-2 uppercase">EPRIVACY DIRECTIVE &middot; ARTICLES 6–7</div>
            <h2 className="text-xl text-text-heading mb-3">Cookie consent, legitimate interest, and the ePrivacy rules</h2>
            <p className="text-[14px] text-text-muted mb-6 leading-relaxed flex-grow">
              Consent under the GDPR isn't just a cookie banner. It's a specific lawful basis with strict conditions: freely given, specific, informed, and unambiguous. And the ePrivacy Directive adds its own layer of rules for electronic communications and terminal equipment access.
            </p>
            <ul className="space-y-3 text-[14px] text-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <Link href="/gdpr/consent-mode-v2" className="hover:text-accent-gold transition-colors">Why Google Consent Mode v2 Matters for Your Clients</Link>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>Legitimate interest vs consent: when you can skip the banner</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/20 mt-1">&mdash;</span>
                <span>ePrivacy and the GDPR: where they overlap and where they don't</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom CTA */}
        <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-10 shadow-panel-elevated text-center">
          <p className="text-text-primary text-[17px] mb-8 max-w-2xl mx-auto">
            Not sure where your gaps are? The assessment scans your operations against 142 GDPR requirements and shows you exactly where you stand. Takes 12 minutes, no account required.
          </p>
          <Link href="/assessment" className="inline-flex items-center gap-2 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-8 py-3.5 transition-colors">
            Start free assessment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
