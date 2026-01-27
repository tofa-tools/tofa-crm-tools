/**
 * Pure validation functions for shared use across web and mobile
 * These functions return validation results instead of showing toasts directly
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate call summary (minimum 3 characters)
 */
export function validateCallSummary(summary: string | null | undefined): ValidationResult {
  if (!summary || !summary.trim()) {
    return {
      isValid: false,
      error: 'Please confirm you called and provide a call summary',
    };
  }
  
  if (summary.trim().length < 3) {
    return {
      isValid: false,
      error: 'Please provide a call summary (min 3 characters)',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate trial scheduling (batch ID required)
 */
export function validateTrialScheduling(batchId: number | null | undefined): ValidationResult {
  if (!batchId) {
    return {
      isValid: false,
      error: 'Please select a trial batch',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate joining completion data
 */
export interface JoiningData {
  paymentConfirmed: boolean;
  studentBatchIds: number[] | null | undefined;
  subscriptionPlan: string | null | undefined;
  subscriptionStartDate: string | null | undefined;
}

export function validateJoiningComplete(data: JoiningData): ValidationResult {
  if (!data.paymentConfirmed) {
    return {
      isValid: false,
      error: 'Please confirm payment',
    };
  }
  
  if (!data.studentBatchIds || data.studentBatchIds.length === 0) {
    return {
      isValid: false,
      error: 'Please select at least one batch for the student',
    };
  }
  
  if (!data.subscriptionPlan || !data.subscriptionStartDate) {
    return {
      isValid: false,
      error: 'Please select subscription plan and start date',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate off-ramp data
 */
export interface OffRampData {
  status: 'Nurture' | 'Dead/Not Interested' | 'On Break';
  note: string | null | undefined;
  reason?: string | null | undefined;
  returnDate?: string | null | undefined;
}

export function validateOffRamp(data: OffRampData): ValidationResult {
  if (!data.note || !data.note.trim()) {
    if (data.status === 'On Break') {
      return {
        isValid: false,
        error: 'Please provide both a reason and return date',
      };
    }
    return {
      isValid: false,
      error: data.status === 'Dead/Not Interested' 
        ? 'Please provide a reason' 
        : 'Please provide a note',
    };
  }
  
  if (data.status === 'On Break') {
    if (!data.reason || !data.reason.trim()) {
      return {
        isValid: false,
        error: 'Please provide a reason for the break',
      };
    }
    
    if (!data.returnDate) {
      return {
        isValid: false,
        error: 'Please provide a return date',
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate reversal request (minimum 5 characters)
 */
export function validateReversalRequest(reason: string | null | undefined): ValidationResult {
  if (!reason || !reason.trim()) {
    return {
      isValid: false,
      error: 'Please provide a reason',
    };
  }
  
  if (reason.trim().length < 5) {
    return {
      isValid: false,
      error: 'Please provide a reason (minimum 5 characters)',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate batch selection
 */
export function validateBatchSelection(batchId: number | null | undefined): ValidationResult {
  if (!batchId) {
    return {
      isValid: false,
      error: 'Please select a batch first',
    };
  }
  
  return { isValid: true };
}

