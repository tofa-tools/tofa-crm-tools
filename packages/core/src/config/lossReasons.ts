/**
 * Standardized Loss Reasons - shared across Internal CRM and Public Pages.
 * Use for "Lead is not joining", preference page "Not interested", and renewal "Not renewing".
 */

export const LOSS_REASONS = [
  'Expensive fee',
  'Timing Mismatch',
  'Days Mismatch',
  'Duration too long',
  'Location/Distance',
  'Transportation problem',
  'Coaching Quality',
  'Age not suitable',
  'Kid lost interest',
  'Other',
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_REASON_OTHER = 'Other' as const;
