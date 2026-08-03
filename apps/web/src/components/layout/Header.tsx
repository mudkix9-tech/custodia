// @ts-nocheck
"use client";
import DOMPurify from 'dompurify';

import React, { useState } from 'react';
import { Menu, Search, Bell, ExternalLink } from 'lucide-react';
import { Logo } from './Sidebar';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: notificationsResp } = trpc.notifications.listInApp.useQuery({ limit: 50 }, {
    refetchInterval: 30000 // Poll every 30s
  });
  const notifications = notificationsResp?.data || [];
  const utils = trpc.useUtils();
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onMutate: async ({ ids }) => {
      await utils.notifications.listInApp.cancel();
      const previousData = utils.notifications.listInApp.getData({ limit: 50 });
      if (previousData) {
        utils.notifications.listInApp.setData({ limit: 50 }, {
          ...previousData,
          data: previousData.data.map((n: { id: string, status: string }) =>
            ids.includes(n.id) ? { ...n, status: 'read' } : n
          )
        } as unknown as { data: { id: string, status: string }[], nextCursor?: string });
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
  const unreadCount = notifications.filter((n: { status: string }) => n.status === 'pending').length;

  const { data: orgSettings } = trpc.settings.getOrgSettings.useQuery();

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n: { status: string, id: string }) => n.status === 'pending').map((n: { id: string }) => n.id);
    if (unreadIds.length > 0) {
      markReadMutation.mutate({ ids: unreadIds });
    }
  };

  return (
    <div className="relative z-20 bg-[#08090A] border-b border-white/10 px-4 py-3 flex items-center justify-between lg:justify-end">
      {/* Mobile Logo & Menu */}
      <div className="flex items-center gap-2 lg:hidden">
        <button className="p-2 -ml-2 rounded-md hover:bg-[#0D0F11]/5 text-[#9BA1A6]">
          <Menu size={20} />
        </button>
        <Logo />
      </div>

      {/* Desktop Search & Notifications */}
      <div className="flex items-center gap-3">
        {/* Global Search Button */}
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#0A0B0D] border border-white/10 hover:border-white/20 hover:bg-[#0D0F11]/5 rounded-lg text-sm text-[#6E747A] transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-2 font-mono text-[10px] font-semibold tracking-wider">⌘K</kbd>
        </button>

        {/* Mobile Search Button */}
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="lg:hidden p-2 rounded-md hover:bg-[#0D0F11]/5 text-[#9BA1A6]"
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
            className="p-2 rounded-md hover:bg-[#0D0F11]/5 text-[#9BA1A6] relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500/100 rounded-full border-2 border-[#08090A]" />
            )}
          </button>

          {showNotifications && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowNotifications(false)} 
              />
              <div className="absolute right-0 mt-2 w-80 bg-[#0D0F11] rounded-2xl shadow-panel-elevated border border-white/10 z-40 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0D0F11]/5">
                  <h3 className="font-semibold text-[#F4F5F6] text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span onClick={handleMarkAllRead} className="text-xs text-[#C9A227] font-medium cursor-pointer hover:underline">Mark all read</span>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.map((notification: { id: string, status: string, createdAt: string, actionUrl?: string, title: string, body?: string }) => {
                    const isUnread = notification.status === 'pending';
                    const timeAgo = notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : '';
                    
                    return (
                      <div 
                        key={notification.id} 
                        onClick={() => {
                          if (isUnread) markReadMutation.mutate({ ids: [notification.id] });
                          if (notification.actionUrl) window.location.href = notification.actionUrl;
                        }}
                        className={`p-4 border-b border-white/5 hover:bg-[#0D0F11]/5 transition-colors cursor-pointer group ${isUnread ? 'bg-[#0D0F11]/5' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500/100 shrink-0" />}
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
                <div className="p-3 text-center border-t border-white/10 bg-[#0A0B0D]">
                  <button className="text-xs font-medium text-[#9BA1A6] hover:text-[#E6E8EA]">View all notifications</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
