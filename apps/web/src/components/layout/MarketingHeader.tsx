"use client";

import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const NAV_LINKS = [
  { name: 'Features', href: '#features' },
  { name: 'Risk Calculator', href: '#risk-calculator' },
  { name: 'DPA Alignment', href: '#authorities' },
  { name: 'Pricing', href: '#pricing' },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
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
  );
}

export function MarketingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      setMobileMenuOpen(false);
      const targetId = href.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${isScrolled ? 'bg-[#070B13]/85 backdrop-blur-xl border-slate-800/80 py-3.5' : 'bg-transparent border-transparent py-6'}`}>
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
            <a 
              key={link.href} 
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors duration-200"
            >
              {link.name}
            </a>
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
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-[#070B13] border-b border-slate-800 p-6 flex flex-col gap-4 lg:hidden">
          {NAV_LINKS.map(link => (
            <a 
              key={link.href} 
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-left text-sm font-semibold text-slate-400 hover:text-white py-2 border-b border-slate-900"
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col gap-4 mt-4">
            <Link href="/login" className="text-center text-sm font-semibold text-slate-300 hover:text-white py-2">Sign In</Link>
            <Link href="/assessment" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center text-sm font-bold py-3 rounded-lg">
              Start Free Assessment
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
