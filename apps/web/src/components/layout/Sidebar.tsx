"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, Users, Database, Building2, UserCircle, GraduationCap, Settings, LifeBuoy, ChevronUp, FileText, Cookie, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';

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

  return (
    <aside className="w-[244px] shrink-0 hidden lg:flex flex-col border-r border-ink-900/8 bg-bone-50 sticky top-0 h-screen">
      <div className="px-5 pt-6 pb-4">
        <Logo />
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="px-2 pt-2 pb-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-400">Workspace</div>
        <ul className="space-y-0.5">
          {NAV.map((n) => {
            // Simplified active check
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
  );
}
