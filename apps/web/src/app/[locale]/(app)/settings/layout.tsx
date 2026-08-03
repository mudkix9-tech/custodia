"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building2, Users, Bell, Plug, Code, CreditCard, Shield, Database, User, Cpu } from 'lucide-react';

const SETTINGS_NAV = [
  { id: 'organization', label: 'Organization', icon: Building2, href: '/settings/organization', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'team', label: 'Team', icon: Users, href: '/settings/team', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, href: '/settings/notifications', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'integrations', label: 'Integrations', icon: Plug, href: '/settings/integrations', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'developers', label: 'Developers', icon: Code, href: '/settings/developers', roles: ['member', 'admin', 'owner'] },
  { id: 'billing', label: 'Billing', icon: CreditCard, href: '/settings/billing', roles: ['admin', 'owner'] },
  { id: 'security', label: 'Security', icon: Shield, href: '/settings/security', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'data', label: 'Data & Privacy', icon: Database, href: '/settings/data', roles: ['admin', 'owner'] },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'member';

  const visibleNav = SETTINGS_NAV.filter(nav => nav.roles.includes(userRole));

  return (
    <div className="flex min-h-full relative bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
      <aside className="w-64 border-r border-white/10 bg-[#0D0F11] hidden md:block">
        <div className="p-6">
          <h2 className="text-lg font-serif text-[#F4F5F6] mb-6">Settings</h2>
          <nav className="space-y-1">
            <div className="text-xs font-medium text-[#6E747A] uppercase tracking-wider mb-2 px-3">Organization</div>
            {visibleNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ink-900/5 text-[#F4F5F6]'
                      : 'text-[#9BA1A6] hover:bg-ink-900/5 hover:text-[#F4F5F6]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#F4F5F6]' : 'text-[#6E747A]'}`} />
                  {item.label}
                </Link>
              );
            })}

            <div className="mt-8 mb-2 px-3 text-xs font-medium text-[#6E747A] uppercase tracking-wider">Personal</div>
            <Link
              href="/settings/profile"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/settings/profile')
                  ? 'bg-ink-900/5 text-[#F4F5F6]'
                  : 'text-[#9BA1A6] hover:bg-ink-900/5 hover:text-[#F4F5F6]'
              }`}
            >
              <User className={`w-5 h-5 ${pathname.startsWith('/settings/profile') ? 'text-[#F4F5F6]' : 'text-[#6E747A]'}`} />
              My Profile
            </Link>
          </nav>
        </div>
      </aside>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
