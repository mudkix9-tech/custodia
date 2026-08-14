"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { useSession, signOut } from 'next-auth/react';
import { Settings, LifeBuoy, ChevronUp, Menu, X, LogOut } from 'lucide-react';
import { cn } from '@/utils/cn';
import { OrgSwitcher } from './OrgSwitcher';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { NAV_GROUPS } from './navigation';
import LanguageSelector from './LanguageSelector';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 [font-family:var(--font-plex-sans)] ${className}`}>
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
    </div>
  );
}


export function Sidebar() {
  const t = useTranslations('shared');
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { data: pendingDsars } = trpc.dsar.countPending.useQuery();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const subscriptionStatus = (session as any)?.subscriptionStatus;
  const trialEndsAt = (session as any)?.trialEndsAt;
  const isExpiredTrial = subscriptionStatus === 'trialing' && trialEndsAt && Date.now() > trialEndsAt;
  const isPastDue = subscriptionStatus === 'past_due';
  const isCanceled = subscriptionStatus === 'canceled';
  const isLocked = isExpiredTrial || isPastDue || isCanceled;

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        className="md:hidden fixed top-3 left-4 z-50 p-2 rounded-md hover:bg-white/[0.04] text-[#9BA1A6]"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-[244px] bg-[#08090A] border-r border-white/10 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex md:flex-col h-screen ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pt-6 pb-4 md:pt-6">
          <Logo />
          <button
            className="md:hidden p-2 -mr-2 rounded-md hover:bg-white/[0.04] text-[#9BA1A6]"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-3">
          <OrgSwitcher />
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          {!isLocked && (
            <>
              {NAV_GROUPS.map((group) => (
              <div key={group.id}>
              <div className="px-2 pt-3 pb-1.5 text-[11px] uppercase tracking-[0.14em] text-[#6E747A]">{t(`navigation.${group.id}`)}</div>
              <ul className="space-y-0.5">
                {group.items.map((n) => {
                  const isActive = pathname === n.href || (n.href !== '/' && pathname.startsWith(n.href));
                  const IconComp = n.icon;
                  // Only the DSAR item carries a count, and a zero is worth no pill at all.
                  const badge = n.id === 'dsars' && pendingDsars ? pendingDsars : null;

                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none
                          ${isActive
                            ? 'bg-gradient-to-r from-[#C9A227]/10 to-transparent text-[#F4F5F6] font-medium'
                            : 'text-[#9BA1A6] hover:bg-white/[0.04] hover:text-[#E6E8EA]'}`}
                      >
                        {isActive && (
                          <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-sm bg-[#C9A227]" />
                        )}
                        <IconComp
                          size={16}
                          className={isActive ? 'text-[#C9A227]' : 'text-[#6E747A] group-hover:text-[#9BA1A6]'}
                        />
                        <span className="flex-1 text-left">{t(`navigation.${n.id}`)}</span>
                        {badge !== null && (
                          <span className="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-md bg-[#C9A227]/20 text-[#C9A227]">{badge}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              </div>
              ))}
            </>
          )}
        </nav>

        <div className="mt-2 px-3 pb-3 pt-3 border-t border-white/10">
          <ul className="space-y-0.5 mb-3">
            <li>
              <Link href="/settings" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[#9BA1A6] hover:bg-white/[0.04] hover:text-[#E6E8EA] focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none">
                <Settings size={16} className="text-[#6E747A]" /> {t('navigation.settings')}
              </Link>
            </li>
            <li>
              <Link href="/support" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-[#9BA1A6] hover:bg-white/[0.04] hover:text-[#E6E8EA] focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none">
                <LifeBuoy size={16} className="text-[#6E747A]" /> {t('navigation.support')}
              </Link>
            </li>
            <li>
              {/* The product ships in three languages with no way to change
                  between them once you are inside it. */}
              <LanguageSelector />
            </li>
          </ul>
          {session?.user && (
            <div className="relative" ref={userMenuRef}>
              {userMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-[#1A1D21] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <div className="text-[13px] text-[#E6E8EA] font-medium truncate">{session.user.name || 'User'}</div>
                    <div className="text-[11.5px] text-[#9BA1A6] truncate">{session.user.email}</div>
                  </div>
                  <button 
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full text-left px-3 py-1.5 text-[13px] text-[#E6E8EA] hover:bg-white/5 flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} className="text-[#9BA1A6]" />
                    {t('navigation.log_out')}
                  </button>
                </div>
              )}
              <button 
                onClick={(e) => { e.preventDefault(); setUserMenuOpen(!userMenuOpen); }}
                className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#0D0F11]/10 text-[#E6E8EA] flex items-center justify-center font-medium text-[12.5px] border border-white/10 shrink-0">
                  {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[13px] text-[#E6E8EA] truncate">{session.user.name || 'User'}</div>
                  <div className="text-[11.5px] text-[#6E747A] truncate">{session.user.email}</div>
                </div>
                <ChevronUp size={14} className="text-[#6E747A] transition-transform duration-200 shrink-0" style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay on mobile when open */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
