/**
 * Pure attendance calculation and logic functions for shared use across web and mobile
 */

import type { Lead } from '../types';

/**
 * Attendance status type
 */
export type AttendanceStatus = 'Present' | 'Absent' | null;

/**
 * Participant type (trial or student)
 */
export type ParticipantType = 'trial' | 'student';

/**
 * Participant data structure
 */
export interface Participant {
  id: number;
  name: string;
  ageGroup?: string;
  type: ParticipantType;
  studentId: number | null;
  leadId: number;
  lead?: Lead;
  inGracePeriod?: boolean;
}

/**
 * Attendance summary
 */
export interface AttendanceSummary {
  total: number;
  marked: number;
  remaining: number;
}

/**
 * Calculate attendance summary from participants and status map
 */
export function calculateAttendanceSummary(
  participants: Participant[],
  statusMap: Record<number, AttendanceStatus>
): AttendanceSummary {
  const total = participants.length;
  const marked = Object.values(statusMap).filter(s => s !== null).length;
  return {
    total,
    marked,
    remaining: total - marked,
  };
}

/**
 * Check if all attendance has been marked
 */
export function isAllAttendanceMarked(summary: AttendanceSummary): boolean {
  return summary.total > 0 && summary.marked === summary.total;
}

/**
 * Determine participant type based on lead and student data
 */
export function determineParticipantType(
  lead: Lead | null,
  student: any | null,
  batchId: number
): ParticipantType {
  // If lead has status 'Trial Scheduled' and trial_batch_id matches, it's a trial
  if (lead?.status === 'Trial Scheduled' && lead.trial_batch_id === batchId) {
    return 'trial';
  }
  
  // If student has batch_ids that include this batchId, it's a student
  if (student?.student_batch_ids?.includes(batchId)) {
    return 'student';
  }
  
  // Default to trial if we have a lead but status doesn't match
  return lead ? 'trial' : 'student';
}

/**
 * Attendance payload structure
 */
export interface AttendancePayload {
  student_id?: number;
  lead_id?: number;
  batch_id: number;
  status: 'Present' | 'Absent';
}

/**
 * Build attendance payload for API call
 */
export function buildAttendancePayload(
  participantType: ParticipantType,
  studentId: number | null,
  leadId: number,
  batchId: number,
  status: 'Present' | 'Absent'
): AttendancePayload {
  const payload: AttendancePayload = {
    batch_id: batchId,
    status,
  };
  
  if (participantType === 'student' && studentId) {
    payload.student_id = studentId;
  } else if (participantType === 'trial') {
    payload.lead_id = leadId;
  }
  
  return payload;
}

/**
 * Attendance history record
 */
export interface AttendanceRecord {
  date: string;
  status: 'Present' | 'Absent';
}

/**
 * Calculate days since last attendance
 */
export function calculateDaysSinceLastAttendance(lastAttendanceDate: string): number {
  const lastDate = new Date(lastAttendanceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDateOnly = new Date(lastDate);
  lastDateOnly.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - lastDateOnly.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Count recent absences from attendance history
 */
export function countRecentAbsences(
  attendanceHistory: AttendanceRecord[],
  recentCount: number = 3
): number {
  // Sort by date descending (most recent first)
  const recentRecords = [...attendanceHistory]
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    })
    .slice(0, recentCount);
  
  return recentRecords.filter(record => record.status === 'Absent').length;
}

/**
 * Attendance status indicator result
 */
export interface AttendanceStatusIndicator {
  text: string;
  color: string;
  icon: string;
}

/**
 * Get attendance status indicator based on history
 * Returns null if no attendance history or no present records
 */
export function getAttendanceStatusIndicator(
  history: AttendanceRecord[]
): AttendanceStatusIndicator | null {
  if (!history || history.length === 0) {
    return null;
  }

  // Get present records sorted by date (most recent first)
  const presentRecords = history
    .filter(record => record.status === 'Present')
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    })
    .slice(0, 5);

  // If no present records, return null
  if (presentRecords.length === 0) {
    return null;
  }

  // Get the most recent present date
  const lastDate = presentRecords[0].date;
  const daysSince = calculateDaysSinceLastAttendance(lastDate);

  // Get recent records (last 3) sorted by date
  const recentRecords: AttendanceRecord[] = history
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    })
    .slice(0, 3);

  const recentAbsences = countRecentAbsences(recentRecords, 3);

  // Priority: Show absences warning first, then days since
  if (recentAbsences >= 2) {
    return {
      text: `Missed ${recentAbsences}`,
      color: 'text-red-600',
      icon: '⚠️',
    };
  } else if (daysSince === 0) {
    return {
      text: 'Today',
      color: 'text-emerald-600',
      icon: '✓',
    };
  } else if (daysSince === 1) {
    return {
      text: 'Yesterday',
      color: 'text-gray-500',
      icon: '',
    };
  } else {
    return {
      text: `${daysSince}d ago`,
      color: 'text-gray-500',
      icon: '',
    };
  }
}
