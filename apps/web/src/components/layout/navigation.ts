import {
  LayoutDashboard, Users, Database, Building2, UserCircle, GraduationCap,
  FileText, Cookie, AlertTriangle, ShieldCheck, Sparkles, BarChart3, Scale,
  Settings, LifeBuoy, Code2, ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = { id: string; icon: LucideIcon; href: string };

/**
 * Ten flat items under a single "Workspace" heading gave no sense of what the
 * product is for, and four shipped modules — Copilot, Regulatory Updates,
 * Analytics and Support — had no entry at all, reachable only by typing the URL.
 *
 * Grouped by what a DPO is doing rather than by module name: what the position
 * is, what is on the record, what is in flight, what has to be demonstrable.
 */
export const NAV_GROUPS: { id: string; items: NavItem[] }[] = [
  {
    id: 'group_overview',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { id: 'analytics', icon: BarChart3, href: '/analytics' },
    ],
  },
  {
    id: 'group_records',
    items: [
      { id: 'ropa', icon: Database, href: '/ropa' },
      // F57. The DPIA module had no entry because it had no route: the whole
      // capability was one tab inside an activity, so an assessment covering four
      // activities had to be reached through whichever one happened to be linked.
      { id: 'dpia', icon: ShieldAlert, href: '/dpia' },
      { id: 'vendors', icon: Building2, href: '/vendors' },
      { id: 'clients', icon: Users, href: '/clients' },
    ],
  },
  {
    id: 'group_requests',
    items: [
      { id: 'dsars', icon: UserCircle, href: '/dsar' },
      { id: 'breaches', icon: AlertTriangle, href: '/breaches' },
    ],
  },
  {
    id: 'group_compliance',
    items: [
      { id: 'policies', icon: FileText, href: '/policies' },
      { id: 'consent', icon: Cookie, href: '/consent' },
      { id: 'audit', icon: ShieldCheck, href: '/audit' },
      { id: 'training', icon: GraduationCap, href: '/training' },
    ],
  },
  {
    id: 'group_intelligence',
    items: [
      { id: 'copilot', icon: Sparkles, href: '/copilot' },
      { id: 'updates', icon: Scale, href: '/updates' },
    ],
  },
];

/** Routes that are reachable but sit outside the main nav. */
const EXTRA_ROUTES: NavItem[] = [
  { id: 'settings', icon: Settings, href: '/settings' },
  { id: 'support', icon: LifeBuoy, href: '/support' },
  { id: 'group', icon: Building2, href: '/group' },
  { id: 'developers', icon: Code2, href: '/developers' },
];

const ALL_ROUTES: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...EXTRA_ROUTES];

/**
 * The i18n key for the current page's title, or null on a route we have no name
 * for. The header carried no title at all, which is why every page below it
 * grew its own — five different treatments across the product.
 *
 * Longest match wins, so `/settings/team` resolves to Settings rather than to
 * whichever shorter prefix happens to be listed first.
 */
export function routeTitleKey(pathname: string): string | null {
  const match = ALL_ROUTES
    .filter((r) => pathname === r.href || pathname.startsWith(`${r.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.id : null;
}

/** True when the path is a detail page under a section, e.g. `/vendors/<id>`. */
export function isDetailRoute(pathname: string): boolean {
  const key = routeTitleKey(pathname);
  if (!key) return false;
  const route = ALL_ROUTES.find((r) => r.id === key)!;
  return pathname !== route.href && pathname.startsWith(`${route.href}/`);
}

export function routeHref(id: string): string {
  return ALL_ROUTES.find((r) => r.id === id)?.href ?? '/dashboard';
}
