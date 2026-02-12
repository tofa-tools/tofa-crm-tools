/**
 * Simple age calculation from date of birth.
 * Returns current age as integer (Current Year - Birth Year).
 * Used across web and mobile for displaying and filtering by age group.
 */

/**
 * Calculate age from date of birth.
 * Simple formula: Current Year - Birth Year (no cutoff logic).
 *
 * @param dob - Date of birth string (YYYY-MM-DD or ISO)
 * @returns Age as integer, or null if invalid/missing DOB
 */
export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob || typeof dob !== 'string' || dob.trim() === '') return null;

  try {
    const birth = new Date(dob.trim());
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;

    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}
