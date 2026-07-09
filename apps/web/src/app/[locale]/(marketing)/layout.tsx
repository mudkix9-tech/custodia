import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Lock, Server, Globe } from 'lucide-react';
import { MarketingHeader } from '@/components/layout/MarketingHeader';

export const metadata: Metadata = {
  title: 'Privaro — GDPR Compliance Operating System for EU Agencies',
  description: 'The complete GDPR compliance platform built for EU marketing, digital, and design agencies. Replace consultants and spreadsheets.',
  openGraph: {
    title: 'Privaro — GDPR Compliance for EU Agencies',
    description: 'The complete GDPR compliance platform built for EU marketing, digital, and design agencies. Replace consultants and spreadsheets.',
    images: ['/og/homepage.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privaro — GDPR Compliance for EU Agencies',
    description: 'The complete GDPR compliance platform built for EU marketing, digital, and design agencies.',
  },
  alternates: {
    canonical: 'https://privaro.io', // Placeholder domain
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#070B13] text-[#F3F4F6] font-sans selection:bg-blue-500/30 overflow-x-hidden flex flex-col relative antialiased">
      
      {/* Precision Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main className="flex-grow relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#050910] border-t border-slate-900 pt-16 pb-10 relative z-10 text-xs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Link href="/" className="flex items-center gap-2.5">
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
                </Link>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xs mb-6">
                The compliance automation platform designed for modern agencies.
              </p>
              <div className="flex items-center gap-4 text-slate-500 font-mono text-[10px]">
                <span className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> AWS Dublin</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> SSL Secured</span>
              </div>
            </div>
            
            {/* Footer Links */}
            {[
              { 
                title: 'Product Modules', 
                links: [
                  { name: 'Continuous Auditor', href: '/features' },
                  { name: 'ROPA Ledger', href: '/features' },
                  { name: 'Cookie Scan Engine', href: '/features' },
                  { name: 'Integrations', href: '/features' }
                ] 
              },
              { 
                title: 'Resource Hub', 
                links: [
                  { name: 'GDPR Guidance', href: '/gdpr' },
                  { name: 'Audit Prep Checklist', href: '/changelog' },
                  { name: 'Security Posture', href: '/security' }
                ] 
              },
              { 
                title: 'Legal Ledger', 
                links: [
                  { name: 'Terms of Service', href: '/legal/terms' },
                  { name: 'Privacy Policy', href: '/legal/privacy' },
                  { name: 'Cookie Statement', href: '/legal/cookies' },
                  { name: 'Standard DPA', href: '/legal/dpa' }
                ] 
              }
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-bold mb-4 text-xs">{col.title}</h4>
                <ul className="space-y-2.5 text-slate-400">
                  {col.links.map((link, j) => (
                    <li key={j}><Link href={link.href} className="hover:text-white transition-colors">{link.name}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-[10.5px]">© {new Date().getFullYear()} Privaro OS. All rights reserved.</p>
            <div className="flex items-center gap-2 text-slate-450 hover:text-slate-200 cursor-pointer transition-colors text-[10.5px]">
              <Globe className="w-3.5 h-3.5 text-slate-500" /> English (EU)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
