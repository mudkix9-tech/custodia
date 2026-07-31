"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const NAV_LINKS = [
  { name: 'Platform', href: '#modules' },
  { name: 'AI Advisor', href: '#advisor' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'Security', href: '#trust' },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 [font-family:var(--font-plex-sans)] ${className}`}>
      <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 21v-6a7 7 0 0 1 7-7h6" fill="none" stroke="#E6E8EA" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 27v6a7 7 0 0 1-7 7h-6" fill="none" stroke="#E6E8EA" strokeWidth="5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="7.5" fill="#C9A227" />
      </svg>
      <div className="leading-none">
        <div className="font-medium text-[16px] tracking-[-0.01em] text-[#E6E8EA] flex items-center gap-1.5">
          Custodia
        </div>
      </div>
    </Link>
  );
}

export function MarketingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [mobileMenuOpen]);

  // Focus trap for mobile navigation drawer
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) {
      setTimeout(() => firstElement.focus(), 50);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

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
    <header
      role="banner"
      className={`[font-family:var(--font-plex-sans)] fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#08090A]/82 backdrop-blur-md border-b border-white/7 py-3.5' : 'bg-transparent border-b border-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Logo className="focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-md" />

        <nav role="navigation" aria-label="Primary Navigation" className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-[13.5px] text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded px-1.5 py-0.5"
            >
              {link.name}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-6">
          <Link href="/login" className="text-[13.5px] text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-md px-1.5 py-0.5">Sign in</Link>
          <Link href="/assessment" className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[14px] font-medium py-2.5 px-5 transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090A]">
            Start free assessment <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="lg:hidden text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-md p-1"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile Menu Overlay Drawer */}
      {mobileMenuOpen && (
        <div
          ref={drawerRef}
          id="mobile-nav-drawer"
          className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#08090A]/97 border-l border-white/10 p-6 flex flex-col gap-4 lg:hidden z-50 h-screen overflow-y-auto pt-24 shadow-2xl backdrop-blur-md"
        >
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="absolute top-6 right-6 text-[#9BA1A6] hover:text-[#E6E8EA] focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-md p-1"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-left text-sm text-[#9BA1A6] hover:text-[#E6E8EA] py-2 border-b border-white/7 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded px-1.5"
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col gap-4 mt-4">
            <Link href="/login" className="text-center text-sm text-[#9BA1A6] hover:text-[#E6E8EA] py-2 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded px-1.5">Sign in</Link>
            <Link href="/assessment" className="bg-[#C9A227] text-[#08090A] text-center text-sm font-medium py-3 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090A] transition-all">
              Start free assessment
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
