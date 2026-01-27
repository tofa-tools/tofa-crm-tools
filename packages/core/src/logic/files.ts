/**
 * Pure file utility functions
 * Platform-agnostic - no browser dependencies
 */

/**
 * Generate unique filename with timestamp and random string
 * @param originalName - Original file name (used to extract extension)
 * @returns Unique filename in format: {timestamp}-{random}.{ext}
 */
export function generateUniqueFileName(originalName: string): string {
  const fileExt = originalName.split('.').pop() || 'file';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}.${fileExt}`;
}

/**
 * Extract file extension from filename
 * @param filename - File name
 * @returns File extension (without dot) or empty string
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Get file name without extension
 * @param filename - File name
 * @returns File name without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

