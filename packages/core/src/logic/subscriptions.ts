/**
 * Pure subscription calculation functions for shared use across web and mobile
 */

export interface SubscriptionPlan {
  value: string;
  label: string;
  months: number;
}

/**
 * Available subscription plans with their duration in months
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { value: 'Monthly', label: 'Monthly', months: 1 },
  { value: 'Quarterly', label: 'Quarterly', months: 3 },
  { value: '6 Months', label: '6 Months', months: 6 },
  { value: 'Yearly', label: 'Yearly', months: 12 },
];

/**
 * Calculate subscription end date from start date and plan duration
 */
export function calculateSubscriptionEndDate(startDate: string, planMonths: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + planMonths);
  return end.toISOString().split('T')[0];
}

/**
 * Check if a subscription end date is within the renewal window (within N days from today)
 */
export function isRenewalDueWithinDays(endDate: string, daysWindow: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromToday = new Date(today);
  sevenDaysFromToday.setDate(sevenDaysFromToday.getDate() + daysWindow);
  sevenDaysFromToday.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const endTimestamp = end.getTime();
  const todayTimestamp = today.getTime();
  const windowTimestamp = sevenDaysFromToday.getTime();
  
  // >= today AND <= today + N days
  return endTimestamp >= todayTimestamp && endTimestamp <= windowTimestamp;
}

/**
 * Get subscription plan by value
 */
export function getSubscriptionPlanByValue(value: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.value === value);
}

