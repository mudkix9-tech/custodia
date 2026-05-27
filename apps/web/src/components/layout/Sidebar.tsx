"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, Users, Database, Building2, UserCircle, GraduationCap, Settings, LifeBuoy, ChevronUp, FileText, Cookie, AlertTriangle, ShieldCheck, Sparkles, Menu, X } from 'lucide-react';
import { cn } from '@/utils/cn'; // Assuming you have a cn utility, if not, I will add it or just use template literals

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#3F5836" />
        <path
          d="M16 7c-3.5 1.5-6.5 1.8-8 1.8 0 6.4 2 11.5 8 14.4 6-2.9 8-8 8-14.4-1.5 0-4.5-.3-8-1.8z"
          fill="#EFF2EC"
        />
        <circle cx="16" cy="15" r="2.2" fill="#3F5836" />
      </svg>
      <div className="leading-none">
        <div className="font-serif text-[22px] tracking-tight text-ink-900">Privaro</div>
      </div>
    </div>
  );
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'clients', label: 'Clients', icon: Users, href: '/clients' },
  { id: 'ropa', label: 'Data Processing', icon: Database, href: '/ropa' },
  { id: 'vendors', label: 'Vendors', icon: Building2, href: '/vendors' },
  { id: 'dsars', label: 'Data Requests', icon: UserCircle, href: '/dsar', badge: 1 },
  { id: 'policies', label: 'Privacy Policies', icon: FileText, href: '/policies' },
  { id: 'consent', label: 'Cookie Consent', icon: Cookie, href: '/consent' },
  { id: 'breaches', label: 'Breaches', icon: AlertTriangle, href: '/breaches' },
  { id: 'audit', label: 'Audit Readiness', icon: ShieldCheck, href: '/audit' },
  { id: 'training', label: 'Training', icon: GraduationCap, href: '/training' },
  { id: 'copilot', label: 'Co-Pilot', icon: Sparkles, href: '/copilot' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger - this is typically in Header, but we can add one here if needed or modify the main layout. Actually, the Header handles this, but let's make the sidebar responsive. We'll leave the hamburger in Header and expose setSidebarOpen via context or just use a shared state. For now, let's just make the sidebar slide in. */}
      {/* Wait, the problem says: "Sidebar doesn't collapse gracefully... ensure full hamburger menu behavior on mobile". I'll add the mobile toggle button here so it's self-contained or coordinate with Header. */}

      <button
        className="md:hidden fixed top-3 left-4 z-50 p-2 rounded-md hover:bg-bone-100 text-ink-600"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-[244px] bg-bone-50 border-r border-ink-900/8 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex md:flex-col h-screen ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pt-6 pb-4 md:pt-6">
          <Logo />
          <button
            className="md:hidden p-2 -mr-2 rounded-md hover:bg-bone-100 text-ink-600"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          <div className="px-2 pt-2 pb-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-400">Workspace</div>
          <ul className="space-y-0.5">
            {NAV.map((n) => {
              const isActive = pathname === n.href || (n.href !== '/' && pathname.startsWith(n.href));
              const IconComp = n.icon;

              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-colors
                      ${isActive
                        ? 'bg-sage-50 text-sage-700 font-medium'
                        : 'text-ink-700 hover:bg-bone-100'}`}
                  >
                    <IconComp
                      size={16}
                      className={isActive ? 'text-sage-600' : 'text-ink-500 group-hover:text-ink-700'}
                    />
                    <span className="flex-1 text-left">{n.label}</span>
                    {n.badge && (
                      <span className="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-md bg-clay-50 text-clay-600">{n.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-2 px-3 pb-3 pt-3 border-t border-ink-900/8">
          <ul className="space-y-0.5 mb-3">
            <li>
              <Link href="/settings" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-ink-700 hover:bg-bone-100">
                <Settings size={16} className="text-ink-500" /> Settings
              </Link>
            </li>
            <li>
              <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-ink-700 hover:bg-bone-100">
                <LifeBuoy size={16} className="text-ink-500" /> Help &amp; Docs
              </button>
            </li>
          </ul>
          {session?.user && (
            <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-bone-100 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center font-medium text-[12.5px]">
                {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13px] text-ink-900 truncate">{session.user.name || 'User'}</div>
                <div className="text-[11.5px] text-ink-500 truncate">{session.user.email}</div>
              </div>
              <ChevronUp size={14} className="text-ink-400" />
            </div>
          )}
        </div>
      </aside>

      {/* Overlay on mobile when open */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
