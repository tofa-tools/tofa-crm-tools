/**
 * Pure lead workflow and status transition logic for shared use across web and mobile
 */

import type { LeadStatus } from '../types';

/**
 * Status flow in the lead conversion process
 */
export const STATUS_FLOW: LeadStatus[] = [
  'New',
  'Followed up with message',
  'Called',
  'Trial Scheduled',
  'Trial Attended',
  'Joined',
];

/**
 * Get the previous status in the workflow
 */
export function getPreviousStatus(currentStatus: LeadStatus): LeadStatus | null {
  const index = STATUS_FLOW.indexOf(currentStatus);
  return index > 0 ? STATUS_FLOW[index - 1] : null;
}

/**
 * Calculate effective status - Smart Skip logic for leads with parent preferences
 * If lead is 'New' but has parent preferences, effective status is 'Followed up with message'
 */
export function calculateEffectiveStatus(
  currentStatus: LeadStatus,
  hasParentPreferences: boolean
): LeadStatus {
  if (currentStatus === 'New' && hasParentPreferences) {
    return 'Followed up with message';
  }
  return currentStatus;
}

/**
 * Check if guided workflow should be shown for a status
 * Guided workflow is NOT shown for: Joined, Dead/Not Interested, Nurture, On Break
 */
export function shouldShowGuidedWorkflow(status: LeadStatus): boolean {
  return status !== 'Joined' 
    && status !== 'Dead/Not Interested' 
    && status !== 'Nurture' 
    && status !== 'On Break';
}

/**
 * Check if a status can be reverted
 */
export function canRevertStatus(status: LeadStatus): boolean {
  return getPreviousStatus(status) !== null;
}

/**
 * Requirements for off-ramp statuses (Nurture, Dead/Not Interested, On Break)
 */
export interface OffRampRequirements {
  requiresNote: boolean;
  requiresReason: boolean;
  requiresReturnDate: boolean;
  noteMinLength?: number;
}

/**
 * Get requirements for an off-ramp status
 */
export function getOffRampRequirements(
  status: 'Nurture' | 'Dead/Not Interested' | 'On Break'
): OffRampRequirements {
  switch (status) {
    case 'On Break':
      return {
        requiresNote: true,
        requiresReason: true,
        requiresReturnDate: true,
      };
    case 'Dead/Not Interested':
      return {
        requiresNote: true,
        requiresReason: true,
        requiresReturnDate: false,
      };
    case 'Nurture':
      return {
        requiresNote: true,
        requiresReason: false,
        requiresReturnDate: false,
      };
    default:
      return {
        requiresNote: false,
        requiresReason: false,
        requiresReturnDate: false,
      };
  }
}

/**
 * Check if a status is an off-ramp status
 */
export function isOffRampStatus(status: LeadStatus): status is 'Nurture' | 'Dead/Not Interested' | 'On Break' {
  return status === 'Nurture' || status === 'Dead/Not Interested' || status === 'On Break';
}

