'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadScoreProps {
  score: number; // 0-5
  className?: string;
}

export function LeadScore({ score, className }: LeadScoreProps) {
  const scoreValue = Math.max(0, Math.min(5, score)); // Ensure between 0-5
  
  const getScoreColor = () => {
    if (scoreValue >= 4) return 'text-yellow-500'; // Gold for 4-5 stars
    if (scoreValue === 3) return 'text-gray-400'; // Silver for 3
    return 'text-amber-700'; // Bronze for 1-2
  };
  
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((starNum) => (
        <Star
          key={starNum}
          className={cn(
            'w-4 h-4',
            starNum <= scoreValue
              ? getScoreColor()
              : 'text-gray-300'
          )}
          fill={starNum <= scoreValue ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}

