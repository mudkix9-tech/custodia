"use client";

import React from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Building2, Users, Bell, Plug, CreditCard, Shield, Database, User } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { trpc } from '@/utils/trpc';
import { cn } from '@/utils/cn';

/** The `trpc.useUtils()` handle, so nav entries can declare their own warm-up. */
type SettingsUtils = ReturnType<typeof trpc.useUtils>;

/**
 * `prefetch` names the queries the target page renders a skeleton *instead of*,
 * warmed on hover/focus so the ~200ms of pointer travel covers the request
 * rather than the user watching it. Secondary queries are deliberately absent —
 * warming what does not gate the skeleton buys no perceived speed. Billing has
 * no entry on purpose: its only query is `enabled: isLocked`, so for an account
 * in good standing there is nothing to fetch.
 */
const SETTINGS_NAV: Array<{
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles: string[];
  prefetch?: (utils: SettingsUtils) => void;
}> = [
  {
    id: 'organization', icon: Building2, href: '/settings/organization',
    roles: ['viewer', 'member', 'admin', 'owner'],
    prefetch: (u) => void u.settings.getOrgSettings.prefetch(),
  },
  {
    id: 'team', icon: Users, href: '/settings/team',
    roles: ['viewer', 'member', 'admin', 'owner'],
    prefetch: (u) => void u.team.list.prefetch(),
  },
  {
    id: 'notifications', icon: Bell, href: '/settings/notifications',
    roles: ['viewer', 'member', 'admin', 'owner'],
    prefetch: (u) => {
      void u.settings.getOrgSettings.prefetch();
      void u.settings.getUserSettings.prefetch();
    },
  },
  {
    id: 'integrations', icon: Plug, href: '/settings/integrations',
    roles: ['viewer', 'member', 'admin', 'owner'],
    prefetch: (u) => {
      void u.integrations.listProviders.prefetch();
      void u.integrations.listConnections.prefetch();
    },
  },
  { id: 'billing', icon: CreditCard, href: '/settings/billing', roles: ['admin', 'owner'] },
  {
    id: 'security', icon: Shield, href: '/settings/security',
    roles: ['viewer', 'member', 'admin', 'owner'],
    prefetch: (u) => {
      void u.security.listSessions.prefetch();
      void u.settings.getUserSettings.prefetch();
    },
  },
  {
    id: 'data_privacy', icon: Database, href: '/settings/data',
    roles: ['admin', 'owner'],
    prefetch: (u) => void u.settings.getOrgSettings.prefetch(),
  },
];

function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  onWarm,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onWarm?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      // Focus as well as hover, so the warm-up is not mouse-only. Both are
      // no-ops once the data is inside the QueryClient staleTime.
      onMouseEnter={onWarm}
      onFocus={onWarm}
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
  const utils = trpc.useUtils();
  const t = useTranslations('settings');
  const userRole = (session?.user as { role?: string } | undefined)?.role || 'member';

  const visibleNav = SETTINGS_NAV.filter((nav) => nav.roles.includes(userRole));
  const isProfile = pathname.includes('/settings/profile');

  return (
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
                onWarm={item.prefetch ? () => item.prefetch!(utils) : undefined}
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
              onWarm={() => void utils.settings.getUserSettings.prefetch()}
            />
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
  );
}
