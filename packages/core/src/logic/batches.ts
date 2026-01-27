/**
 * Pure batch filtering and scheduling logic for shared use across web and mobile
 */

import type { Batch } from '../types';

/**
 * Filter batches by age category and center
 * Only returns active batches that match the age category
 */
export function filterBatchesByAgeCategory(
  batches: Batch[],
  ageCategory: string,
  centerId: number
): Batch[] {
  return batches.filter(batch => {
    // Must match center and be active
    if (batch.center_id !== centerId || !batch.is_active) {
      return false;
    }
    
    // Check if batch age categories include the lead's age category
    const batchAgeCategories = batch.age_category.toLowerCase().split(',').map((cat: string) => cat.trim());
    return batchAgeCategories.includes(ageCategory.toLowerCase());
  });
}

/**
 * Day of week flag mapping (0 = Sunday, 6 = Saturday)
 */
const DAY_FLAGS = {
  0: 'is_sun',
  1: 'is_mon',
  2: 'is_tue',
  3: 'is_wed',
  4: 'is_thu',
  5: 'is_fri',
  6: 'is_sat',
} as const;

/**
 * Get batches scheduled for a specific date based on day-of-week flags
 * Checks if batch is active on that day and within start/end date range
 */
export function getBatchesForDate(batches: Batch[], date: Date | string): Batch[] {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = dateObj.getDay();
  const dayFlag = DAY_FLAGS[dayOfWeek as keyof typeof DAY_FLAGS];
  
  // Normalize date to start of day for comparison
  const selectedDate = new Date(dateObj);
  selectedDate.setHours(0, 0, 0, 0);
  
  return batches.filter(batch => {
    // Check if batch runs on this day of week
    if (!batch[dayFlag as keyof Batch]) {
      return false;
    }
    
    // Check if batch has started (start_date must be <= selected date)
    if ('start_date' in batch && batch.start_date) {
      const startDate = new Date(batch.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (selectedDate < startDate) {
        return false;
      }
    }
    
    // Check if batch has ended (end_date must be >= selected date, or null for ongoing)
    if ('end_date' in batch && batch.end_date) {
      const endDate = new Date(batch.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (selectedDate > endDate) {
        return false;
      }
    }
    
    return true;
  });
}

