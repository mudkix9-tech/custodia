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
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${isScrolled ? 'bg-[#141712]/85 backdrop-blur-xl border-[#2F362D]/60 py-3.5' : 'bg-transparent border-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Logo />
        
        <div className="hidden lg:flex items-center gap-8 bg-[#1F241D]/60 border border-[#2F362D]/60 px-6 py-2 rounded-full backdrop-blur-sm">
          {NAV_LINKS.map(link => (
            <a 
              key={link.href} 
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-xs font-semibold text-[#9CA297] hover:text-[#F5F3ED] transition-colors duration-200"
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-6">
          <Link href="/login" className="text-xs font-semibold text-[#C5C8C1] hover:text-[#F5F3ED] transition-colors">Sign In</Link>
          <Link href="/assessment" className="bg-gradient-to-r from-[#596E51] to-[#788F6F] hover:from-[#495B42] hover:to-[#677B5D] text-[#F5F3ED] shadow-lg shadow-[#596E51]/10 text-xs font-bold py-2.5 px-5 rounded-lg transition-all flex items-center gap-2 border border-[#8BA381]/20">
            Start Free Assessment <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-[#9CA297] hover:text-[#F5F3ED] transition-colors">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-[#141712] border-b border-[#2F362D] p-6 flex flex-col gap-4 lg:hidden">
          {NAV_LINKS.map(link => (
            <a 
              key={link.href} 
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-left text-sm font-semibold text-[#9CA297] hover:text-[#F5F3ED] py-2 border-b border-[#2F362D]/40"
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col gap-4 mt-4">
            <Link href="/login" className="text-center text-sm font-semibold text-[#C5C8C1] hover:text-[#F5F3ED] py-2">Sign In</Link>
            <Link href="/assessment" className="bg-gradient-to-r from-[#596E51] to-[#788F6F] text-[#F5F3ED] text-center text-sm font-bold py-3 rounded-lg border border-[#8BA381]/20">
              Start Free Assessment
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
