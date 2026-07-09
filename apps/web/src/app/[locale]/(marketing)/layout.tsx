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
    <div className="min-h-screen bg-[#141712] text-[#F5F3ED] font-sans selection:bg-[#6E8B60]/30 overflow-x-hidden flex flex-col relative antialiased">
      
      {/* Skip to Content Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#1F241D] focus:text-[#F5F3ED] focus:px-4 focus:py-2.5 focus:rounded-lg focus:border focus:border-[#8BA381]/30 focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Precision Grid Background */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,#2a332508_1px,transparent_1px),linear-gradient(to_bottom,#2a332508_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0" />
      <div aria-hidden="true" className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#6E8B60]/5 rounded-full blur-[120px] pointer-events-none" />
      <div aria-hidden="true" className="absolute top-[30%] right-1/4 w-[500px] h-[500px] bg-[#8BA381]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <MarketingHeader />

      {/* Main Content */}
      <main id="main-content" role="main" className="flex-grow relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer role="contentinfo" className="bg-[#0C0F0B] border-t border-[#1F231D] pt-16 pb-10 relative z-10 text-xs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Link href="/" className="flex items-center gap-2.5">
                  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="text-[#8BA381]">
                    <rect x="1" y="1" width="30" height="30" rx="8" fill="#1F241D" stroke="#6E8B60" strokeWidth="1.5" />
                    <path
                      d="M16 6c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8z"
                      fill="#6E8B60"
                      opacity="0.2"
                    />
                    <path
                      d="M16 6c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8zM16 11.5v7"
                      stroke="#8BA381"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="leading-none">
                    <div className="font-sans font-bold text-[20px] tracking-tight text-[#F5F3ED] flex items-center gap-1.5">
                      Privaro <span className="text-[10px] uppercase font-mono tracking-wider bg-[#6E8B60]/15 text-[#8BA381] px-1.5 py-0.5 rounded border border-[#6E8B60]/20">OS</span>
                    </div>
                  </div>
                </Link>
              </div>
              <p className="text-[#9CA297] text-xs leading-relaxed max-w-xs mb-6">
                The compliance automation platform designed for modern agencies.
              </p>
              <div className="flex items-center gap-4 text-[#5F655A] font-mono text-[10px]">
                <span className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-[#6E8B60]" /> AWS Dublin</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#6E8B60]" /> SSL Secured</span>
              </div>
            </div>
            
            {/* Footer Links */}
            {[
              { 
                title: 'Product Modules', 
                links: [
                  { name: 'Gap Assessment', href: '/features' },
                  { name: 'Activity Register', href: '/features' },
                  { name: 'Vendor Tracking', href: '/features' },
                  { name: 'Cookie Consent', href: '/features' }
                ] 
              },
              { 
                title: 'Resource Hub', 
                links: [
                  { name: 'GDPR Guidance', href: '/gdpr' },
                  { name: 'Audit Checklist', href: '/changelog' },
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
                <h4 className="text-[#F5F3ED] font-bold mb-4 text-xs">{col.title}</h4>
                <ul className="space-y-2.5 text-[#9CA297]">
                  {col.links.map((link, j) => (
                    <li key={j}><Link href={link.href} className="hover:text-[#F5F3ED] transition-colors">{link.name}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-[#1F231D] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#5F655A] text-[10.5px]">© {new Date().getFullYear()} Privaro OS. All rights reserved.</p>
            <div className="flex items-center gap-2 text-[#9CA297] hover:text-[#F5F3ED] cursor-pointer transition-colors text-[10.5px]">
              <Globe className="w-3.5 h-3.5 text-[#5F655A]" /> English (EU)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
