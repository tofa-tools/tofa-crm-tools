import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Calculate age category based on date of birth.
 * Returns categories: U7, U9, U11, U13, U15, U17
 * Based on age cutoff dates (typically August 1st)
 */
export function calculateAgeCategory(dateOfBirth: string | null | undefined): string | null {
  if (!dateOfBirth) return null;
  
  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    
    // Calculate age
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    
    // Adjust age if birthday hasn't occurred this year
    // Age cutoff is typically August 1st for youth soccer
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    
    // Also check if we're before the cutoff date (August 1st)
    // If today is before Aug 1 and birthday is after Aug 1, age should be considered one year less
    const cutoffMonth = 7; // August (0-indexed)
    const cutoffDay = 1;
    
    if (today.getMonth() < cutoffMonth || (today.getMonth() === cutoffMonth && today.getDate() < cutoffDay)) {
      if (dob.getMonth() > cutoffMonth || (dob.getMonth() === cutoffMonth && dob.getDate() >= cutoffDay)) {
        age--;
      }
    }
    
    // Determine age category based on age
    if (age < 7) return 'U7';
    if (age < 9) return 'U9';
    if (age < 11) return 'U11';
    if (age < 13) return 'U13';
    if (age < 15) return 'U15';
    if (age < 17) return 'U17';
    return 'U17+'; // 17 and older
  } catch {
    return null;
  }
}


