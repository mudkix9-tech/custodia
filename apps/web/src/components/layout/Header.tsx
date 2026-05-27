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

  const { data: notificationsResp, refetch } = trpc.notifications.listInApp.useQuery({ limit: 50 }, {
    refetchInterval: 30000 // Poll every 30s
  });
  const notifications = notificationsResp?.data || [];
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch()
  });
  const unreadCount = notifications.filter((n: any) => n.status === 'pending').length;

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n: any) => n.status === 'pending').map((n: any) => n.id);
    if (unreadIds.length > 0) {
      markReadMutation.mutate({ ids: unreadIds });
    }
  };

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-ink-900/10 px-4 py-3 flex items-center justify-between lg:justify-end">
      {/* Mobile Logo & Menu */}
      <div className="flex items-center gap-2 lg:hidden">
        <button className="p-2 -ml-2 rounded-md hover:bg-bone-100 text-ink-600">
          <Menu size={20} />
        </button>
        <Logo />
      </div>

      {/* Desktop Search & Notifications */}
      <div className="flex items-center gap-3">
        {/* Global Search Button */}
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-bone-50 border border-ink-900/10 hover:border-ink-900/20 hover:bg-bone-100 rounded-lg text-sm text-ink-400 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-2 font-mono text-[10px] font-semibold tracking-wider">⌘K</kbd>
        </button>

        {/* Mobile Search Button */}
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="lg:hidden p-2 rounded-md hover:bg-bone-100 text-ink-600"
        >
          <Search size={20} />
        </button>

        {/* Notification Center */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-md hover:bg-bone-100 text-ink-600 relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>

          {showNotifications && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowNotifications(false)} 
              />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-ink-900/10 z-40 overflow-hidden">
                <div className="p-4 border-b border-ink-900/10 flex justify-between items-center bg-bone-50/50">
                  <h3 className="font-semibold text-ink-900 text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span onClick={handleMarkAllRead} className="text-xs text-sage-600 font-medium cursor-pointer hover:underline">Mark all read</span>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.map((notification: any) => {
                    const isUnread = notification.status === 'pending';
                    const timeAgo = notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : '';
                    
                    return (
                      <div 
                        key={notification.id} 
                        onClick={() => {
                          if (isUnread) markReadMutation.mutate({ ids: [notification.id] });
                          if (notification.actionUrl) window.location.href = notification.actionUrl;
                        }}
                        className={`p-4 border-b border-ink-900/5 hover:bg-bone-50 transition-colors cursor-pointer group ${isUnread ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                            <h4 className="text-sm font-medium text-ink-900 leading-tight group-hover:text-sage-700 transition-colors">{notification.title}</h4>
                          </div>
                          {notification.actionUrl && <ExternalLink className="w-3 h-3 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        <p className="text-xs text-ink-600 mt-1 leading-snug" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notification.body || '') }} />
                        <p className="text-[10px] text-ink-400 mt-2 font-medium">{timeAgo}</p>
                      </div>
                    );
                  })}
                  {notifications.length === 0 && (
                    <div className="p-8 text-center text-ink-500 text-sm">No notifications</div>
                  )}
                </div>
                <div className="p-3 text-center border-t border-ink-900/10 bg-bone-50">
                  <button className="text-xs font-medium text-ink-600 hover:text-ink-900">View all notifications</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
