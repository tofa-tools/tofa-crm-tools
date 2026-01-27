'use client';

import { formatDistanceToNow, parseISO } from 'date-fns';
import { getLeadFreshness, getFreshnessColor } from '@/lib/config/crm';
import { cn } from '@/lib/utils';
import type { Lead } from '@tofa/core';

interface FreshnessIndicatorProps {
  lead: Lead;
}

export function FreshnessIndicator({ lead }: FreshnessIndicatorProps) {
  // Use last_updated if available, otherwise fall back to created_time
  const lastUpdated = lead.last_updated ? parseISO(lead.last_updated) : parseISO(lead.created_time);
  const freshness = getLeadFreshness(lastUpdated.toISOString());
  const colorClass = getFreshnessColor(freshness);

  // Use date-fns formatDistanceToNow for relative time (e.g., "3 hours ago", "2 days ago")
  const relativeTime = formatDistanceToNow(lastUpdated, { addSuffix: true });

  // Add pulse animation for rotten (red) indicators
  const isRotten = freshness === 'rotten';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        colorClass,
        isRotten && 'animate-pulse'
      )}
      title={`Last updated: ${lastUpdated.toLocaleString()}`}
    >
      <span className="mr-1">
        {freshness === 'fresh' ? '🟢' : freshness === 'stale' ? '🟡' : '🔴'}
      </span>
      {relativeTime}
    </span>
  );
}

