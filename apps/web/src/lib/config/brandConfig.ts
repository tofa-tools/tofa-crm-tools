/**
 * Brand Configuration - White-label Ready
 * 
 * This file centralizes all branding strings and message templates to support multiple academies.
 * For white-label deployment, update these values or use environment variables.
 */

export const brandConfig = {
  name: process.env.NEXT_PUBLIC_ACADEMY_NAME || 'TOFA Academy',
  shortName: process.env.NEXT_PUBLIC_ACADEMY_SHORT_NAME || 'TOFA',
  logo: process.env.NEXT_PUBLIC_LOGO_PATH || '/logo.png',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+91XXXXXXXXXX',
  
  /**
   * Message Templates - WhatsApp & Communication
   * 
   * Use placeholders like {{playerName}}, {{academyName}}, {{preferenceLink}}, etc.
   * These will be replaced with actual data using the formatMessage utility.
   */
  messages: {
    /**
     * Initial follow-up message when sending preference link to new leads
     */
    preferenceLink: `Hey! We are following up on your interest for {{playerName}} to join {{academyName}}

Please click the link to check our preferred class Schedule and also please mention your preferred time for a quick call to discuss further

{{preferenceLink}}`,

    /**
     * Quick follow-up message for general inquiries
     */
    quickFollowUp: `Hello! I wanted to follow up on {{playerName}}'s interest in joining {{academyName}}. 

Please click the link below and select your preferred demo class and let us know your preferred time to discuss further: {{preferenceLink}}`,

    /**
     * General enrollment inquiry message
     */
    enrollmentInquiry: `Hi! This is regarding {{playerName}}'s enrollment at {{academyName}}.`,

    /**
     * Welcome back nudge for students returning from break
     */
    welcomeBackNudge: `Hi {{parentName}}, we hope {{playerName}}'s break was good! We've saved his spot in the {{batchName}} batch. Are you ready to reactivate his training this {{returnDateFormatted}}?`,

    /**
     * Renewal reminder message
     */
    renewalReminder: `Hi {{parentName}}! {{playerName}}'s subscription at {{academyName}} is ending soon. Would you like to renew and continue the training journey?`,

    /**
     * Milestone celebration message
     */
    milestoneCelebration: `Congratulations {{parentName}}! {{playerName}} has reached a new milestone at {{academyName}}. Keep up the great work!`,

    /**
     * Trial scheduled confirmation
     */
    trialScheduled: `Hi {{parentName}}! We've scheduled {{playerName}}'s trial session at {{academyName}}. Looking forward to seeing you!`,

    /**
     * Re-engagement nudge for inactive students
     */
    reengagementNudge: `Hi! We miss {{playerName}} at {{academyName}}! Want to get back to the field?

✅ Yes: {{preferenceLink}}
❌ No: {{feedbackLink}}`,

    /**
     * Renewal intent confirmation request
     */
    renewalIntentRequest: `Hi! {{playerName}}'s subscription is ending soon. Please confirm your renewal intent: {{renewalLink}}`,

    /**
     * Grace period activation notification
     */
    gracePeriodActivated: `Hi! {{playerName}}'s subscription expired today. We've activated a 4-day grace period!`,

    /**
     * Grace period final reminder
     */
    gracePeriodFinalReminder: `Hi! Last day of grace period! Settle the invoice today to keep {{playerName}} on the roster.`,
  },
} as const;

