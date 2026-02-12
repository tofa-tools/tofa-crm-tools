/**
 * @tofa/core - Shared business logic, schemas, and types
 * Platform-agnostic package for use in Web and Mobile apps
 */

// Export all logic functions
export * from './logic/api-transform';
export * from './logic/age-groups';
// Export attendance logic with explicit names to avoid conflicts
export {
  calculateAttendanceSummary,
  isAllAttendanceMarked,
  determineParticipantType,
  buildAttendancePayload,
  calculateDaysSinceLastAttendance,
  countRecentAbsences,
  getAttendanceStatusIndicator,
  type AttendanceSummary,
  type Participant,
  type AttendanceRecord,
  type ParticipantType,
  // Rename the conflicting type
  type AttendanceStatus as AttendanceStatusType,
} from './logic/attendance';
export * from './logic/auth';
export * from './logic/batches';
export * from './logic/dates';
export * from './logic/files';
export * from './logic/leads';
export * from './logic/subscriptions';
export * from './logic/validators';

// Export all schemas (these take precedence for AttendanceStatus)
export * from './schemas/attendance';
export * from './schemas/audit';
export * from './schemas/batch';
export * from './schemas/import';
export * from './schemas/lead';
export * from './schemas/user';
export * from './schemas/index';

// Export all types
export * from './types';

// Export brand configuration and messaging utilities
export * from './config/brandConfig';
export * from './config/lossReasons';
export * from './config/messages';
export * from './config/notifications';

// Note: ErrorHandler is platform-specific and not exported from core
// Each platform (web/mobile) implements its own ErrorHandler

