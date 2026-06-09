import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Menu, ArrowRight, Shield, Lock, Globe } from 'lucide-react';

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

const NAV_LINKS = [
  { name: 'Features', href: '/features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'For Agencies', href: '/for-agencies' },
  { name: 'Blog', href: '/blog' },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1F1B16" />
        <path d="M10 16L16 10L22 16" stroke="#FBF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 10V22" stroke="#FBF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-serif text-xl tracking-tight text-ink-900 font-bold">Privaro</span>
    </Link>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bone-50 text-ink-900 font-sans selection:bg-sage-500/30 overflow-x-hidden flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 inset-x-0 z-50 transition-all duration-500 border-b bg-bone-50/80 backdrop-blur-xl border-ink-900/8 py-3">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Logo />

          <div className="hidden lg:flex items-center gap-8 bg-bone-100/50 border border-ink-900/5 px-6 py-2 rounded-full">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-ink-600 hover:text-ink-900 transition-colors">Sign in</Link>
            <Link href="/assessment" className="bg-sage-700 text-bone-50 shadow-card text-sm font-semibold py-2 px-4 rounded-lg hover:bg-sage-600 transition-all flex items-center gap-2">
              Start free assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button className="lg:hidden text-ink-900">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      <main className="flex-grow">
        {children}
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
              { title: 'Product', links: [
                { name: 'Features', href: '/features' },
                { name: 'Pricing', href: '/pricing' },
                { name: 'Cookie Consent', href: '/cookie-consent' },
                { name: 'Security', href: '/security' },
                { name: 'Changelog', href: '/changelog' }
              ] },
              { title: 'Resources', links: [
                { name: 'Blog', href: '/blog' },
                { name: 'GDPR Guide', href: '/gdpr' },
                { name: 'API Docs', href: '#' },
                { name: 'Help Center', href: '#' }
              ] },
              { title: 'Company', links: [
                { name: 'About', href: '/about' },
                { name: 'Contact', href: '/contact' },
                { name: 'Careers', href: '#' }
              ] },
              { title: 'Legal', links: [
                { name: 'Privacy Policy', href: '/legal/privacy' },
                { name: 'Terms of Service', href: '/legal/terms' },
                { name: 'Cookie Policy', href: '/legal/cookies' },
                { name: 'DPA', href: '/legal/dpa' },
                { name: 'Sub-processors', href: '/legal/subprocessors' }
              ] }
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-ink-900 font-medium mb-6 text-sm">{col.title}</h4>
                <ul className="space-y-4 text-sm text-ink-500">
                  {col.links.map((link, j) => (
                    <li key={j}><Link href={link.href} className="hover:text-ink-900 transition-colors">{link.name}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-ink-900/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-ink-400 text-xs">© {new Date().getFullYear()} Privaro OS. Powered by Privaro.</p>
            <div className="flex items-center gap-2 text-xs text-ink-500 hover:text-ink-900 cursor-pointer transition-colors">
              <Globe className="w-3.5 h-3.5" /> English (EN)
            </div>
            <div className="flex items-center gap-4 text-xs text-ink-500">
              <a href="#" className="hover:text-ink-900 transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-ink-900 transition-colors">Twitter/X</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
