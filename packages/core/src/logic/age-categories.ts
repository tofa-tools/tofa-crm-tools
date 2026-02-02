/**
 * Age category constants and calculator for shared use across web and mobile.
 * Standard categories: U5, U7, U9, U11, U13, U15, U17, Senior.
 *
 * Age bands (as of August 1 cutoff):
 * - U5:  under 5
 * - U7:  5–6
 * - U9:  7–8
 * - U11: 9–10
 * - U13: 11–12
 * - U15: 13–14
 * - U17: 15–16
 * - Senior: 17+
 */

/**
 * Master list of age categories in display order.
 * Single source of truth; Web, Mobile, and Backend must stay in sync.
 */
export const AGE_CATEGORIES = [
  'U5',
  'U7',
  'U9',
  'U11',
  'U13',
  'U15',
  'U17',
  'Senior',
] as const;

/** Literal union type for valid age category strings. */
export type AgeCategory = (typeof AGE_CATEGORIES)[number];

/**
 * Check if a string is a valid age category from the master list.
 */
export function isValidAgeCategory(category: string): category is AgeCategory {
  return (AGE_CATEGORIES as readonly string[]).includes(category);
}

const CUTOFF_MONTH = 7; // August (0-indexed)
const CUTOFF_DAY = 1;

/**
 * Calculate the child's age category from date of birth.
 * Uses cutoff date (August 1): age is computed as of the most recent cutoff.
 *
 * Mapping: U5 (<5), U7 (5–6), U9 (7–8), U11 (9–10), U13 (11–12), U15 (13–14), U17 (15–16), Senior (17+).
 *
 * @param dob - Date of birth string (YYYY-MM-DD or ISO)
 * @returns Category string (e.g. 'U9') or null if invalid/missing DOB
 */
export function calculateAgeCategory(dob: string | null | undefined): string | null {
  if (!dob || typeof dob !== 'string' || dob.trim() === '') return null;

  try {
    const birth = new Date(dob.trim());
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;

    if (today.getMonth() < CUTOFF_MONTH || (today.getMonth() === CUTOFF_MONTH && today.getDate() < CUTOFF_DAY)) {
      if (birth.getMonth() > CUTOFF_MONTH || (birth.getMonth() === CUTOFF_MONTH && birth.getDate() >= CUTOFF_DAY)) {
        age--;
      }
    }

    if (age < 5) return 'U5';
    if (age < 7) return 'U7';
    if (age < 9) return 'U9';
    if (age < 11) return 'U11';
    if (age < 13) return 'U13';  // 11–12
    if (age < 15) return 'U15';  // 13–14
    if (age < 17) return 'U17';  // 15–16
    return 'Senior';             // 17+
  } catch {
    return null;
  }
}
