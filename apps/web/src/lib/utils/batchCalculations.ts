/**
 * Utility functions for batch date and session calculations.
 */

export interface BatchSchedule {
  is_mon: boolean;
  is_tue: boolean;
  is_wed: boolean;
  is_thu: boolean;
  is_fri: boolean;
  is_sat: boolean;
  is_sun: boolean;
}

/**
 * Calculate the number of sessions between start_date and end_date based on schedule.
 * @param startDate Start date (inclusive)
 * @param endDate End date (inclusive)
 * @param schedule Batch schedule (days of week)
 * @returns Total number of sessions
 */
export function calculateTotalSessions(
  startDate: Date,
  endDate: Date,
  schedule: BatchSchedule
): number {
  if (endDate < startDate) return 0;

  const dayFlags = [
    schedule.is_sun, // 0 = Sunday
    schedule.is_mon, // 1 = Monday
    schedule.is_tue, // 2 = Tuesday
    schedule.is_wed, // 3 = Wednesday
    schedule.is_thu, // 4 = Thursday
    schedule.is_fri, // 5 = Friday
    schedule.is_sat, // 6 = Saturday
  ];

  let sessionCount = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayFlags[dayOfWeek]) {
      sessionCount++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessionCount;
}

/**
 * Calculate end_date from start_date, total_sessions, and schedule.
 * @param startDate Start date
 * @param totalSessions Number of sessions
 * @param schedule Batch schedule (days of week)
 * @returns End date (inclusive)
 */
export function calculateEndDate(
  startDate: Date,
  totalSessions: number,
  schedule: BatchSchedule
): Date {
  if (totalSessions <= 0) return startDate;

  const dayFlags = [
    schedule.is_sun, // 0 = Sunday
    schedule.is_mon, // 1 = Monday
    schedule.is_tue, // 2 = Tuesday
    schedule.is_wed, // 3 = Wednesday
    schedule.is_thu, // 4 = Thursday
    schedule.is_fri, // 5 = Friday
    schedule.is_sat, // 6 = Saturday
  ];

  let sessionCount = 0;
  const currentDate = new Date(startDate);
  
  while (sessionCount < totalSessions) {
    const dayOfWeek = currentDate.getDay();
    if (dayFlags[dayOfWeek]) {
      sessionCount++;
      if (sessionCount >= totalSessions) {
        return new Date(currentDate);
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return currentDate;
}

