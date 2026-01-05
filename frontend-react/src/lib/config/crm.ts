/**
 * CRM Configuration Constants
 * Centralized configuration for CRM business logic
 */

export const LEAD_FRESHNESS_THRESHOLDS = {
  /** Green: Immediate action needed (< 4 hours) */
  FRESH_HOURS: 4,
  /** Yellow: Needs attention today (4-24 hours) */
  STALE_HOURS: 24,
  // Red: > 24 hours (rotting)
} as const;

export const PAGINATION_OPTIONS = {
  DEFAULT_SIZE: 50,
  OPTIONS: [25, 50, 100] as const,
} as const;

/**
 * Determine the freshness status of a lead based on last update time
 * @param lastUpdated - ISO string or Date of last update
 * @returns 'fresh' | 'stale' | 'rotting'
 */
export function getLeadFreshness(lastUpdated: string | Date | null): 'fresh' | 'stale' | 'rotting' {
  if (!lastUpdated) return 'rotting';
  
  const lastUpdateTime = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate < LEAD_FRESHNESS_THRESHOLDS.FRESH_HOURS) {
    return 'fresh';
  } else if (hoursSinceUpdate < LEAD_FRESHNESS_THRESHOLDS.STALE_HOURS) {
    return 'stale';
  } else {
    return 'rotting';
  }
}

/**
 * Get color class for freshness indicator
 */
export function getFreshnessColor(freshness: 'fresh' | 'stale' | 'rotting'): string {
  switch (freshness) {
    case 'fresh':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'stale':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'rotting':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}

/**
 * Get human-readable label for freshness
 */
export function getFreshnessLabel(freshness: 'fresh' | 'stale' | 'rotting'): string {
  switch (freshness) {
    case 'fresh':
      return 'Fresh';
    case 'stale':
      return 'Needs Attention';
    case 'rotting':
      return 'Overdue';
  }
}

