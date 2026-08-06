"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Building2, Users, Bell, Plug, CreditCard, Shield, Database, User } from 'lucide-react';
import { SettingsToastProvider } from '@/components/settings/SettingsToast';
import { cn } from '@/utils/cn';

const SETTINGS_NAV = [
  { id: 'organization', icon: Building2, href: '/settings/organization', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'team', icon: Users, href: '/settings/team', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'notifications', icon: Bell, href: '/settings/notifications', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'integrations', icon: Plug, href: '/settings/integrations', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'billing', icon: CreditCard, href: '/settings/billing', roles: ['admin', 'owner'] },
  { id: 'security', icon: Shield, href: '/settings/security', roles: ['viewer', 'member', 'admin', 'owner'] },
  { id: 'data_privacy', icon: Database, href: '/settings/data', roles: ['admin', 'owner'] },
];

function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-[11px] rounded-lg px-2.5 py-[9px] text-[13.5px] transition-colors',
        isActive
          ? 'bg-gradient-to-r from-set-gold/10 to-transparent font-medium text-set-fg'
          : 'text-set-fg-muted hover:bg-[#0D0D10] hover:text-set-fg'
      )}
    >
      {isActive ? (
        <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-sm bg-set-gold" />
      ) : null}
      <Icon className={cn('h-4 w-4 flex-none', isActive ? 'text-set-gold' : 'text-current')} />
      {label}
    </Link>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslations('settings');
  const userRole = (session?.user as { role?: string } | undefined)?.role || 'member';

  const visibleNav = SETTINGS_NAV.filter((nav) => nav.roles.includes(userRole));
  const isProfile = pathname.includes('/settings/profile');

  return (
    <SettingsToastProvider>
      <div className="settings-scope flex min-h-full">
        <aside className="sticky top-0 hidden max-h-screen w-[252px] flex-none self-start overflow-y-auto border-r border-set-line-rail bg-set-rail px-4 py-[22px] md:block">
          <div className="px-2 pb-[22px] font-serif text-[30px] tracking-[-0.01em] text-set-fg">
            {t('navigation.header')}
          </div>

          <div className="set-eyebrow px-2 pb-2.5">{t('navigation.organization')}</div>
          <nav className="flex flex-col gap-px pb-[22px]">
            {visibleNav.map((item) => (
              <NavItem
                key={item.id}
                href={item.href}
                icon={item.icon}
                label={t(`navigation.${item.id}`)}
                isActive={pathname.includes(item.href)}
              />
            ))}
          </nav>

          <div className="set-eyebrow px-2 pb-2.5">{t('navigation.personal')}</div>
          <nav className="flex flex-col gap-px">
            <NavItem
              href="/settings/profile"
              icon={User}
              label={t('navigation.my_profile')}
              isActive={isProfile}
            />
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </SettingsToastProvider>
  );
}
