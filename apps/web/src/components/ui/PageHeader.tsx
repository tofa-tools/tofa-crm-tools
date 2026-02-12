'use client';

import { ReactNode } from 'react';
import { NotificationBell } from '@/components/ui/NotificationBell';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-brand-primary border-b-4 border-brand-accent shadow-lg">
      <div className="px-8 py-6 flex items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white uppercase tracking-[0.1m] font-sans">
            {title}
          </h1>
          {subtitle && (
            <p className="text-gray-300 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <NotificationBell buttonClassName="text-white hover:bg-white/20" />
          {actions}
        </div>
      </div>
    </div>
  );
}

