/**
 * Pure date calculation functions for shared use across web and mobile
 */

/**
 * Calculate the number of days remaining from today until an end date
 */
export function calculateDaysRemaining(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a given date is today
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Get a date N days from now
 */
export function getDateNDaysFromNow(n: number, fromDate?: Date): Date {
  const baseDate = fromDate || new Date();
  const result = new Date(baseDate);
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Get a date N days ago from today (or specified date)
 */
export function getDateNDaysAgo(n: number, fromDate?: Date): Date {
  const baseDate = fromDate || new Date();
  const result = new Date(baseDate);
  result.setDate(result.getDate() - n);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Check if a date is within the last N hours
 */
export function isWithinLastNHours(date: Date | string, hours: number): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const threshold = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return dateObj >= threshold;
}

/**
 * Calculate days since a given date
 */
export function calculateDaysSince(date: Date | string): number {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(dateObj);
  dateOnly.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - dateOnly.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

