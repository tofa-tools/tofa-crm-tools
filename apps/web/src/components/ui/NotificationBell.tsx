'use client';

import Link from 'next/link';
import React, { useRef, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getNotificationStyle } from '@tofa/core';
import { Bell, TrendingUp, Activity, DollarSign, ShieldCheck, ChevronRight } from 'lucide-react';
import type { NotificationType } from '@tofa/core';

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Activity,
  DollarSign,
  ShieldCheck,
  Bell,
};

interface NotificationBellProps {
  /** Optional class for the button (e.g. "text-white hover:bg-white/20" for PageHeader). */
  buttonClassName?: string;
}

export function NotificationBell({ buttonClassName }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', { limit: 5 }],
    queryFn: () => notificationsAPI.getNotifications({ limit: 5 }),
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsAPI.getUnreadCount(),
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count ?? 0;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markRead = async (id: number) => {
    await notificationsAPI.markAsRead(id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = async () => {
    await notificationsAPI.markAllAsRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setOpen(false);
  };

  const styleMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    violet: 'bg-violet-100 text-violet-800 border-violet-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const navUrl = (n: { target_url?: string | null; link?: string | null }) => (n.target_url || n.link) || '#';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors touch-manipulation',
          buttonClassName ?? 'text-tofa-navy hover:bg-tofa-navy/10'
        )}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold ring-2 ring-white shadow-md">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 max-h-96 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => {
                const style = getNotificationStyle(n.type as NotificationType);
                const IconComponent = NOTIFICATION_ICONS[style.icon] ?? Bell;
                const colorClass = styleMap[style.color] ?? styleMap.gray;
                const content = (
                  <>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center border flex-shrink-0', colorClass)}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
                      {n.created_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </>
                );
                const href = navUrl(n);
                const isExternal = typeof href === 'string' && href.startsWith('http');
                return (
                  <li key={n.id}>
                    {href !== '#' ? (
                      isExternal ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => { if (!n.is_read) markRead(n.id); setOpen(false); }}
                          className="flex gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          href={href}
                          onClick={() => { if (!n.is_read) markRead(n.id); setOpen(false); }}
                          className="flex gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                        >
                          {content}
                        </Link>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => { if (!n.is_read) markRead(n.id); }}
                        className="w-full flex gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-gray-100 mt-1">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-tofa-navy hover:bg-gray-50 transition-colors"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
