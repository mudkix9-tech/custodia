"use client";
import DOMPurify from 'dompurify';

import React, { useEffect, useState } from 'react';
import { Search, Bell, ExternalLink, ChevronRight } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { isDetailRoute, routeHref, routeTitleKey } from './navigation';

type Notification = {
  id: string;
  status: string;
  createdAt: string;
  actionUrl?: string;
  title: string;
  body?: string;
};

export function Header() {
  const t = useTranslations('shared');
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);

  // ⌘K is not the shortcut on Windows, where most of these users are. Resolved
  // after mount so the server and client markup agree.
  const [modKey, setModKey] = useState('Ctrl');
  useEffect(() => {
    setModKey(/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl');
  }, []);

  const { data: notificationsResp } = trpc.notifications.listInApp.useQuery({ limit: 50 }, {
    refetchInterval: 30000 // Poll every 30s
  });
  // `listInApp` returns its rows as `unknown[]` (the shared paginated-query
  // helper does not carry the row type through), which is what the file's old
  // `@ts-nocheck` was hiding. Narrowed here rather than across the whole file.
  const notifications = (notificationsResp?.data ?? []) as Notification[];
  const utils = trpc.useUtils();
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onMutate: async ({ ids }) => {
      await utils.notifications.listInApp.cancel();
      const previousData = utils.notifications.listInApp.getData({ limit: 50 });
      if (previousData) {
        utils.notifications.listInApp.setData({ limit: 50 }, {
          ...previousData,
          data: (previousData.data as Notification[]).map((n) =>
            ids.includes(n.id) ? { ...n, status: 'read' } : n
          )
        } as unknown as typeof previousData);
      }
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        utils.notifications.listInApp.setData({ limit: 50 }, context.previousData);
      }
    },
    onSettled: () => {
      utils.notifications.listInApp.invalidate();
    }
  });
  const unreadCount = notifications.filter((n) => n.status === 'pending').length;

  const { data: orgSettings } = trpc.settings.getOrgSettings.useQuery();

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => n.status === 'pending').map((n) => n.id);
    if (unreadIds.length > 0) {
      markReadMutation.mutate({ ids: unreadIds });
    }
  };

  // The header was an empty bar with two icons pushed right. With no title here,
  // every page below invented its own — five different treatments across the
  // product — and a detail page told you nothing about where you were.
  const titleKey = routeTitleKey(pathname);
  const onDetail = isDetailRoute(pathname);

  return (
    <div className="relative z-20 bg-[#08090A] border-b border-white/10 px-4 py-3 flex items-center justify-between gap-4">
      {/* Page identity. The mobile menu button lives in the Sidebar, which owns
          the drawer it opens; the one that used to be here did nothing, and
          below 768px both were on screen at once. */}
      <div className="min-w-0 flex items-center gap-1.5 pl-12 md:pl-0">
        {titleKey && onDetail && (
          <>
            <Link
              href={routeHref(titleKey)}
              className="text-[13.5px] text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors truncate"
            >
              {t(`navigation.${titleKey}`)}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 flex-none text-[#6E747A]" aria-hidden="true" />
            <span className="text-[13.5px] font-medium text-[#F4F5F6] truncate">Detail</span>
          </>
        )}
        {titleKey && !onDetail && (
          <h1 className="text-[15px] font-medium text-[#F4F5F6] truncate">
            {t(`navigation.${titleKey}`)}
          </h1>
        )}
      </div>

      {/* Desktop Search & Notifications */}
      <div className="flex items-center gap-3 flex-none">
        {/* Global Search Button */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#0A0B0D] border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-lg text-sm text-[#6E747A] transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-2 font-mono text-[10px] font-semibold tracking-wider">{modKey}K</kbd>
        </button>

        {/* Mobile Search Button */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="lg:hidden p-2 rounded-md hover:bg-white/5 text-[#9BA1A6]"
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        {/* Priority Support */}
        {orgSettings?.subscriptionTier === 'enterprise' && (
          <Link
            href="/support"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 rounded-lg text-sm font-medium transition-colors border border-[#C9A227]/30"
          >
            <span>Priority Support</span>
          </Link>
        )}

        {/* Notification Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            aria-expanded={showNotifications}
            className="p-2 rounded-md hover:bg-white/5 text-[#9BA1A6] relative"
          >
            <Bell size={20} />
            {/* A bare dot said only "something happened". The count is the thing
                worth knowing before deciding whether to open the tray. */}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-[#C9A227] text-[10px] font-semibold tabular-nums text-[#08090A] border-2 border-[#08090A]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 bg-[#0D0F11] rounded-2xl shadow-panel-elevated border border-white/10 z-40 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-semibold text-[#F4F5F6] text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#C9A227] font-medium hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.map((notification) => {
                    const isUnread = notification.status === 'pending';
                    const timeAgo = notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : '';

                    return (
                      <div
                        key={notification.id}
                        onClick={() => {
                          if (isUnread) markReadMutation.mutate({ ids: [notification.id] });
                          if (notification.actionUrl) window.location.href = notification.actionUrl;
                        }}
                        className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group ${isUnread ? 'bg-white/[0.03]' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            {isUnread && <span className="w-2 h-2 rounded-full bg-[#C9A227] shrink-0" />}
                            <h4 className="text-sm font-medium text-[#E6E8EA] leading-tight group-hover:text-[#C9A227] transition-colors">{notification.title}</h4>
                          </div>
                          {notification.actionUrl && <ExternalLink className="w-3 h-3 text-[#6E747A] opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        <p className="text-xs text-[#9BA1A6] mt-1 leading-snug" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notification.body || '') }} />
                        <p className="text-[10px] text-[#6E747A] mt-2 font-medium">{timeAgo}</p>
                      </div>
                    );
                  })}
                  {notifications.length === 0 && (
                    <div className="p-8 text-center text-[#6E747A] text-sm">No notifications</div>
                  )}
                </div>
                {/* Was a <button> with no handler and no route behind it. */}
                <div className="p-3 text-center border-t border-white/10 bg-[#0A0B0D]">
                  <Link
                    href="/settings/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-medium text-[#9BA1A6] hover:text-[#E6E8EA] transition-colors"
                  >
                    Notification settings
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
