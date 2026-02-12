'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { notificationsAPI, leadsAPI } from '@/lib/api';
import { getNotificationStyle } from '@tofa/core';
import { Bell, TrendingUp, Activity, DollarSign, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { NotificationType } from '@tofa/core';
import { cn } from '@/lib/utils';

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Activity,
  DollarSign,
  ShieldCheck,
  Bell,
};

const styleMap: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
};

/** Priority dot color by notification content: Red = payment/approval; Gold = preferences/walk-in; Blue = else */
function getPriorityDotColor(n: { type?: string; title?: string }): 'red' | 'gold' | 'blue' {
  const t = (n.title ?? '').toLowerCase();
  const type = (n.type ?? '').toUpperCase();
  if (
    t.includes('payment') ||
    t.includes('approval') ||
    type === 'FINANCE_ALERT' ||
    type === 'GOVERNANCE_ALERT'
  )
    return 'red';
  if (
    t.includes('preferences') ||
    t.includes('intent') ||
    t.includes('walk-in')
  )
    return 'gold';
  return 'blue';
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'page', { limit: 100, hours: 48 }],
    queryFn: () => notificationsAPI.getNotifications({ limit: 100, hours: 48 }),
  });

  const markRead = async (id: number) => {
    await notificationsAPI.markAsRead(id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleNotificationClick = async (n: {
    id: number;
    target_url: string | null;
    link: string | null;
    is_read: boolean;
    title: string;
  }) => {
    const url = n.target_url || n.link || null;
    if (!url) {
      if (!n.is_read) markRead(n.id);
      return;
    }
    const path = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url;
    const isLeads = path.startsWith('/leads');
    const searchMatch = path.match(/[?&]search=([^&]+)/);
    const searchTerm = searchMatch ? decodeURIComponent(searchMatch[1]) : null;

    if (isLeads && searchTerm) {
      try {
        const res = await leadsAPI.getMyLeads({ search: searchTerm, limit: 5 });
        const leads = res?.leads ?? [];
        const completedStatuses = ['Joined', 'Dead/Not Interested', 'Nurture'];
        if (leads.length === 1 && completedStatuses.includes(leads[0].status)) {
          setToast('✅ Action already completed');
          if (!n.is_read) markRead(n.id);
          setTimeout(() => setToast(null), 3000);
          return;
        }
      } catch {
        // proceed to navigate
      }
    }

    if (!n.is_read) markRead(n.id);
    if (url.startsWith('http')) {
      window.location.href = url;
    } else {
      router.push(path);
    }
  };

  return (
    <MainLayout>
      <PageHeader title="RECENT ALERTS" subtitle="Last 48 hours" />
      <div className="p-6">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-medium">
            {toast}
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-tofa-gold border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            No notifications in the last 48 hours.
          </div>
        ) : (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {notifications.map((n) => {
              const style = getNotificationStyle(n.type as NotificationType);
              const IconComponent = NOTIFICATION_ICONS[style.icon] ?? Bell;
              const colorClass = styleMap[style.color] ?? styleMap.gray;
              const dotColor = getPriorityDotColor(n);
              const dotClass =
                dotColor === 'red'
                  ? 'bg-red-500'
                  : dotColor === 'gold'
                    ? 'bg-amber-500'
                    : 'bg-blue-500';
              const hasLink = !!(n.target_url || n.link);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full flex gap-3 px-4 py-3 text-left transition-colors',
                      hasLink && 'hover:bg-gray-50 cursor-pointer',
                      !hasLink && 'cursor-default'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center border', colorClass)}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <span className={cn('absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white', dotClass)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                      {n.created_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {hasLink && (
                      <span className="text-xs text-tofa-gold font-medium flex-shrink-0">Open →</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MainLayout>
  );
}
