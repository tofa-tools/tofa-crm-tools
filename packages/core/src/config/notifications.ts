/**
 * Notification "DNA" - Universal notification types, templates, and styling.
 * Shared across Web and Mobile via @tofa/core.
 */

export const NOTIFICATION_TYPES = {
  SALES_ALERT: 'SALES_ALERT',
  OPS_ALERT: 'OPS_ALERT',
  FINANCE_ALERT: 'FINANCE_ALERT',
  GOVERNANCE_ALERT: 'GOVERNANCE_ALERT',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_TEMPLATES: Record<string, { title: string; message: string }> = {
  NEW_LEAD: {
    title: 'New Lead',
    message: 'A new lead has been added and is ready for follow-up.',
  },
  TRIAL_ATTENDED: {
    title: 'Trial Attended',
    message: 'A trial was marked attended. Lead is ready for closing.',
  },
  MILESTONE_REACHED: {
    title: 'Milestone Reached',
    message: 'A student has reached a new session milestone.',
  },
  APPROVAL_REQUIRED: {
    title: 'Approval Required',
    message: 'A team member has requested your approval.',
  },
};

export interface NotificationStyle {
  color: string;
  icon: string;
}

/**
 * Returns color and icon name for a notification type (for UI styling).
 */
export function getNotificationStyle(type: NotificationType): NotificationStyle {
  switch (type) {
    case NOTIFICATION_TYPES.SALES_ALERT:
      return { color: 'emerald', icon: 'TrendingUp' };
    case NOTIFICATION_TYPES.OPS_ALERT:
      return { color: 'blue', icon: 'Activity' };
    case NOTIFICATION_TYPES.FINANCE_ALERT:
      return { color: 'amber', icon: 'DollarSign' };
    case NOTIFICATION_TYPES.GOVERNANCE_ALERT:
      return { color: 'violet', icon: 'ShieldCheck' };
    default:
      return { color: 'gray', icon: 'Bell' };
  }
}
