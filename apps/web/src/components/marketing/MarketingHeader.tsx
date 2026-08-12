"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
// The locale-aware Link, not next/link: with localePrefix 'as-needed' the plain
// one renders a bare '/pricing' and drops a de/fr visitor back into English.
import { Link } from '@/i18n/routing';

// Real routes, not same-page anchors. These used to be '#modules', '#advisor',
// '#pricing' and '#trust', which resolve on the homepage and nowhere else — on
// every other marketing page all four were silently dead.
const NAV_LINKS = [
  { key: 'platform', href: '/features' },
  { key: 'advisor', href: '/#advisor' },
  { key: 'pricing', href: '/pricing' },
  { key: 'security', href: '/security' },
] as const;

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
  const t = useTranslations('marketing.layout');
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setMobileMenuOpen(false);
    // Only intercept a same-page hash, and only once the target is known to be
    // on this page. The previous version called preventDefault() first and then
    // looked the element up, so an unresolved anchor swallowed the click and
    // did nothing at all.
    if (!href.startsWith('#')) return;
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

        <nav role="navigation" aria-label={t('nav_aria_label')} className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-[13.5px] text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded px-1.5 py-0.5"
            >
              {t(`nav.${link.key}`)}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-6">
          <Link href="/login" className="text-[13.5px] text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-md px-1.5 py-0.5">{t('sign_in')}</Link>
          <Link href="/assessment" className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[14px] font-medium py-2.5 px-5 transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090A]">
            {t('cta_assessment')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          aria-label={mobileMenuOpen ? t('nav_close') : t('nav_open')}
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
            aria-label={t('nav_close')}
            className="absolute top-6 right-6 text-[#9BA1A6] hover:text-[#E6E8EA] focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded-md p-1"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-left text-sm text-[#9BA1A6] hover:text-[#E6E8EA] py-2 border-b border-white/7 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded px-1.5"
            >
              {t(`nav.${link.key}`)}
            </Link>
          ))}
          <div className="flex flex-col gap-4 mt-4">
            <Link href="/login" className="text-center text-sm text-[#9BA1A6] hover:text-[#E6E8EA] py-2 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none rounded px-1.5">{t('sign_in')}</Link>
            <Link href="/assessment" className="bg-[#C9A227] text-[#08090A] text-center text-sm font-medium py-3 focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090A] transition-all">
              {t('cta_assessment')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
