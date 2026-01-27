/**
 * Pure functions for API data transformation
 * Platform-agnostic - no browser dependencies
 */

/**
 * Query parameters type - supports arrays for comma-separated values
 */
export interface QueryParams {
  [key: string]: string | number | boolean | string[] | number[] | null | undefined;
}

/**
 * Build URLSearchParams from object
 * Handles arrays by joining with commas
 */
export function buildQueryParams(params: QueryParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    // Skip null, undefined, and empty arrays
    if (value === null || value === undefined) continue;
    
    if (Array.isArray(value)) {
      // Join arrays with commas (e.g., [1, 2, 3] -> "1,2,3")
      if (value.length > 0) {
        searchParams.append(key, value.join(','));
      }
    } else {
      // Convert to string
      searchParams.append(key, String(value));
    }
  }
  
  return searchParams;
}

/**
 * Join array for comma-separated query param
 * Helper function for explicit array joining
 */
export function joinArrayParam(array: (string | number)[]): string {
  return array.join(',');
}

/**
 * Convert object to FormData
 * Handles File objects and arrays
 */
export function buildFormData(data: Record<string, any>): FormData {
  const formData = new FormData();
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    
    if (value instanceof File) {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      // Arrays are JSON stringified for FormData
      formData.append(key, JSON.stringify(value));
    } else if (typeof value === 'object') {
      // Objects are JSON stringified
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  }
  
  return formData;
}

