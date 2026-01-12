import { cn } from '@/lib/utils';
import { PauseCircle } from 'lucide-react';
import type { LeadStatus } from '@/types';

interface StatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

const statusConfig: Record<LeadStatus, { bg: string; text: string; icon: string | React.ComponentType<{ className?: string }> }> = {
  'New': {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    icon: '🆕',
  },
  'Called': {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    icon: '📞',
  },
  'Followed up with message': {
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    icon: '💬',
  },
  'Trial Scheduled': {
    bg: 'bg-green-100',
    text: 'text-green-800',
    icon: '📅',
  },
  'Trial Attended': {
    bg: 'bg-lime-100',
    text: 'text-lime-800',
    icon: '🎯',
  },
  'Joined': {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    icon: '✅',
  },
  'On Break': {
    bg: 'bg-sky-100',
    text: 'text-sky-800',
    icon: PauseCircle,
  },
  'Nurture': {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    icon: '🌱',
  },
  'Dead/Not Interested': {
    bg: 'bg-red-100',
    text: 'text-red-800',
    icon: '❌',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['New'];
  const IconComponent = typeof config.icon === 'string' ? null : config.icon;
  const iconEmoji = typeof config.icon === 'string' ? config.icon : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold',
        config.bg,
        config.text,
        className
      )}
    >
      {IconComponent ? (
        <IconComponent className="h-4 w-4" />
      ) : (
        <span>{iconEmoji}</span>
      )}
      <span>{status}</span>
    </span>
  );
}


