'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useCoachBatches } from '@/hooks/useBatches';
import { useRecordAttendance } from '@/hooks/useAttendance';
import { attendanceAPI } from '@/lib/api';
import { useLeads } from '@/hooks/useLeads';
import { useStudents } from '@/hooks/useStudents';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ArrowLeft, CheckCircle2, PhoneCall, BarChart3, Clock, Users } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { SkillReportModal } from '@/components/leads/SkillReportModal';
import { studentsAPI } from '@/lib/api';
import { EMERGENCY_SUPPORT_CONFIG } from '@/lib/config/crm';

export default function CheckInPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  // Get batchId from URL parameter
  const urlBatchId = searchParams.get('batchId');
  
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentForSkillReport, setSelectedStudentForSkillReport] = useState<{ leadId: number; name: string; studentId?: number } | null>(null);
  const [milestoneData, setMilestoneData] = useState<Record<number, any>>({});
  const [attendanceHistoryData, setAttendanceHistoryData] = useState<Record<number, any>>({});
  
  // Fetch coach's batches
  const { data: coachBatchesData, isLoading: batchesLoading } = useCoachBatches();
  const coachBatches = coachBatchesData?.batches || [];
  
  // Phase 3: Auto-select batch from URL parameter or localStorage
  useEffect(() => {
    if (urlBatchId && !selectedBatchId) {
      const batchId = parseInt(urlBatchId, 10);
      if (!isNaN(batchId) && coachBatches.some(b => b.id === batchId)) {
        setSelectedBatchId(batchId);
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastSelectedBatchId', String(batchId));
        }
      }
    } else if (!urlBatchId && !selectedBatchId && coachBatches.length > 0) {
      // Check localStorage for last selected batch
      if (typeof window !== 'undefined') {
        const lastBatchId = localStorage.getItem('lastSelectedBatchId');
        if (lastBatchId) {
          const batchId = parseInt(lastBatchId, 10);
          if (!isNaN(batchId) && coachBatches.some(b => b.id === batchId)) {
            setSelectedBatchId(batchId);
            // Update URL without reload
            router.push(`/check-in?batchId=${batchId}`, { scroll: false });
          }
        }
      }
    }
  }, [urlBatchId, selectedBatchId, coachBatches, router]);
  
  // Fetch all leads (for trial students)
  const { data: leadsResponse, isLoading: leadsLoading } = useLeads({
    limit: 1000, // Large limit for check-in
  });
  
  // Fetch all students (for active students)
  const { data: studentsData, isLoading: studentsLoading } = useStudents({
    is_active: true,
  });
  
  const allLeads = leadsResponse?.leads || [];
  const allStudents = studentsData || [];
  
  // Combine students and leads for selected batch
  const batchParticipants = useMemo(() => {
    if (!selectedBatchId) return [];
    
    // Get trial leads assigned to this batch
    const trialLeads = allLeads
      .filter(lead => lead.trial_batch_id === selectedBatchId && lead.status === 'Trial Scheduled')
      .map(lead => ({
        id: lead.id,
        name: lead.player_name,
        ageCategory: lead.player_age_category,
        type: 'trial' as const,
        studentId: null as number | null,
        leadId: lead.id,
        // Include lead data for skill reports
        lead: lead,
      }));
    
    // Get active students assigned to this batch
    const activeStudents = allStudents
      .filter((student: any) => {
        const batchIds = student.student_batch_ids || [];
        return batchIds.includes(selectedBatchId);
      })
      .map((student: any) => {
        // Find the associated lead for skill reports
        const associatedLead = allLeads.find((l: any) => l.id === student.lead_id);
        return {
          id: student.lead_id, // Use lead_id for compatibility with existing UI
          name: student.lead_player_name || 'Unknown',
          ageCategory: student.lead_player_age_category || '', // Get from lead data
          type: 'student' as const,
          studentId: student.id,
          leadId: student.lead_id,
          inGracePeriod: student.in_grace_period || false, // Include grace period status
          // Include lead data for skill reports
          lead: associatedLead,
        };
      });
    
    // Combine and return
    return [...trialLeads, ...activeStudents];
  }, [allLeads, allStudents, selectedBatchId]);

  // Filter by search term
  const filteredParticipants = useMemo(() => {
    if (!searchTerm) return batchParticipants;
    
    const searchLower = searchTerm.toLowerCase();
    return batchParticipants.filter(participant =>
      participant.name.toLowerCase().includes(searchLower)
    );
  }, [batchParticipants, searchTerm]);

  // Phase 2: Fetch milestone data and attendance history for all active students
  useEffect(() => {
    const fetchMilestonesAndHistory = async () => {
      const milestonePromises: Promise<any>[] = [];
      const historyPromises: Promise<any>[] = [];
      const milestoneMap: Record<number, any> = {};
      const historyMap: Record<number, any> = {};
      
      filteredParticipants.forEach(participant => {
        if (participant.type === 'student' && participant.studentId) {
          // Fetch milestones
          milestonePromises.push(
            studentsAPI.getMilestones(participant.studentId)
              .then(data => {
                milestoneMap[participant.studentId!] = data;
              })
              .catch(error => {
                console.error(`Error fetching milestones for student ${participant.studentId}:`, error);
              })
          );
        }
        
        // Fetch attendance history for all participants (students and trials)
        if (participant.leadId) {
          historyPromises.push(
            attendanceAPI.getHistory(participant.leadId)
              .then(data => {
                historyMap[participant.leadId] = data;
              })
              .catch(error => {
                console.error(`Error fetching attendance history for lead ${participant.leadId}:`, error);
              })
          );
        }
      });
      
      await Promise.all([...milestonePromises, ...historyPromises]);
      setMilestoneData(milestoneMap);
      setAttendanceHistoryData(historyMap);
    };
    
    if (filteredParticipants.length > 0) {
      fetchMilestonesAndHistory();
    }
  }, [filteredParticipants]);
  
  // Track attendance state for each lead
  const [attendanceStatus, setAttendanceStatus] = useState<Record<number, 'Present' | 'Absent' | null>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  
  // Calculate attendance summary
  const attendanceSummary = useMemo(() => {
    const total = filteredParticipants.length;
    const marked = Object.values(attendanceStatus).filter(s => s !== null).length;
    return {
      total,
      marked,
      remaining: total - marked,
    };
  }, [filteredParticipants, attendanceStatus]);
  
  // Check if all participants have attendance marked
  const allMarked = filteredParticipants.length > 0 && attendanceSummary.marked === filteredParticipants.length;
  
  const recordAttendanceMutation = useRecordAttendance();
  
  // Emergency SOS handler
  const handleEmergencySOS = (participantName: string) => {
    // Use default support number from config
    const supportPhone = EMERGENCY_SUPPORT_CONFIG.DEFAULT_SUPPORT_PHONE;
    
    // Clean phone number for tel: protocol (remove non-digits except +)
    const cleanPhone = supportPhone.replace(/[^\d+]/g, '');
    
    // Show safety toast
    toast('Calling Academy Support... stay calm and assist the student.', {
      icon: '🆘',
      duration: 4000,
      style: {
        background: '#fee2e2',
        color: '#991b1b',
        border: '2px solid #dc2626',
        fontWeight: 'bold',
      },
    });
    
    // Trigger device call
    window.location.href = `tel:${cleanPhone}`;
  };
  
  const handleAttendanceClick = async (
    participantId: number,
    participantType: 'trial' | 'student',
    studentId: number | null,
    leadId: number,
    batchId: number,
    status: 'Present' | 'Absent'
  ) => {
    if (!selectedBatchId) {
      toast.error('Please select a batch first');
      return;
    }
    
    // Update local state immediately for better UX
    setAttendanceStatus(prev => ({ ...prev, [participantId]: status }));
    
    try {
      // Use student_id for active students, lead_id for trial students
      await recordAttendanceMutation.mutateAsync({
        student_id: participantType === 'student' && studentId ? studentId : undefined,
        lead_id: participantType === 'trial' ? leadId : undefined,
        batch_id: batchId,
        status,
      });
      // Success toast is handled in the hook
    } catch (error) {
      // Revert state on error
      setAttendanceStatus(prev => ({ ...prev, [participantId]: null }));
      // Error toast is handled in the hook
      console.error('Error recording attendance:', error);
    }
  };
  
  const handleCompleteSession = async () => {
    if (!selectedBatchId) {
      toast.error('Please select a batch first');
      return;
    }
    
    if (!allMarked) {
      toast.error('Please mark attendance for all students before checking out');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // All attendance is already recorded (we record on each button click)
      // Just show success screen
      setShowSuccessScreen(true);
      
      // Invalidate command center analytics to refresh metrics
      queryClient.invalidateQueries({ queryKey: ['analytics', 'command-center'] });
    } catch (error) {
      toast.error('Error completing session');
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Generate gradient colors for player avatars based on name
  const getAvatarGradient = (name: string): string => {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-emerald-500 to-teal-600',
      'from-blue-500 to-cyan-600',
      'from-pink-500 to-rose-600',
      'from-orange-500 to-amber-600',
      'from-violet-500 to-purple-600',
      'from-green-500 to-emerald-600',
      'from-red-500 to-pink-600',
    ];
    const index = name.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  // Get player initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format time from HH:MM:SS to HH:MM AM/PM
  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return 'TBD';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const handleBackToCommandCenter = () => {
    router.push('/command-center');
  };
  
  const handleNewSession = () => {
    setAttendanceStatus({});
    setShowSuccessScreen(false);
    setSelectedBatchId(null);
    router.push('/check-in');
  };
  
  if (!user || user.role !== 'coach') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">Access Restricted</p>
            <p className="text-sm text-gray-500">This page is for coaches only.</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  const selectedBatch = coachBatches.find(b => b.id === selectedBatchId);
  
  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-50 pb-24 flex flex-col">
        {/* Compact Sticky Header with Batch Info */}
        {selectedBatchId && selectedBatch && (
          <div className="sticky top-0 z-20 bg-gradient-to-r from-tofa-navy to-indigo-950 text-white shadow-2xl border-b-4 border-tofa-gold/30">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <ArrowLeft 
                    onClick={handleBackToCommandCenter}
                    className="h-5 w-5 cursor-pointer hover:text-tofa-gold transition-colors flex-shrink-0" 
                  />
                  {/* Small Logo */}
                  <div className="flex-shrink-0">
                    <Image
                      src="/logo.png"
                      alt="TOFA Logo"
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-black uppercase tracking-tight truncate flex items-center gap-2">
                      <span>CHECK-IN</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs font-bold text-white/80">{selectedBatch.name}</span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white/70">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatTime(selectedBatch.start_time)}</span>
                      </div>
                      <span className="text-xs font-semibold text-white/70">{selectedBatch.age_category}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ml-3 px-3 py-1.5 bg-tofa-gold/20 backdrop-blur-sm rounded-full border-2 border-tofa-gold/40 flex items-center gap-1.5 flex-shrink-0">
                <Users className="h-4 w-4" />
                <span className="text-sm font-black">{attendanceSummary.total}</span>
              </div>
            </div>
            
            {/* Slim Search Bar - Pinned Below Header */}
            <div className="px-4 pb-2.5 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none font-medium"
              />
            </div>
          </div>
        )}

        {/* Batch Selector - Show when no batch selected */}
        {!selectedBatchId && (
          <div className="p-4 bg-slate-900 text-white border-b-4 border-indigo-500">
            <div className="mb-4">
              <h1 className="text-xl font-black uppercase tracking-tight mb-1">✅ Check-In</h1>
              <p className="text-sm font-medium text-gray-300">Select a batch to mark attendance</p>
            </div>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => {
                const newBatchId = e.target.value ? parseInt(e.target.value, 10) : null;
                setSelectedBatchId(newBatchId);
                if (newBatchId) {
                  router.push(`/check-in?batchId=${newBatchId}`, { scroll: false });
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('lastSelectedBatchId', String(newBatchId));
                  }
                } else {
                  router.push('/check-in', { scroll: false });
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('lastSelectedBatchId');
                  }
                }
              }}
              className="w-full px-4 py-2.5 border-2 border-indigo-500 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm bg-white text-gray-900 font-bold"
              disabled={batchesLoading}
            >
              <option value="">Choose a batch...</option>
              {coachBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} ({batch.age_category})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedBatchId && selectedBatch && (
          <>

            {/* Compact Roster List - High Density */}
            {(leadsLoading || studentsLoading) ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500 font-medium">Loading participants...</p>
                </div>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-600">
                    {searchTerm ? 'No participants found' : 'No participants assigned to this batch.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  <div className="space-y-1.5">
                    {filteredParticipants.map((participant, index) => {
                      const isPresent = attendanceStatus[participant.id] === 'Present';
                      const isAbsent = attendanceStatus[participant.id] === 'Absent';
                      const avatarGradient = getAvatarGradient(participant.name);
                      const initials = getInitials(participant.name);
                      
                      return (
                      <div
                        key={`${participant.type}-${participant.id}`}
                        className={`rounded-lg px-3 py-2.5 border-2 transition-all duration-200 ${
                          isPresent 
                            ? 'bg-emerald-50 border-emerald-300 shadow-sm' 
                            : isAbsent
                            ? 'bg-rose-50 border-rose-300 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Left Side: Avatar + Name + Badges + Icons */}
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* Circular Avatar with Gradient */}
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-lg border-2 border-white flex-shrink-0`}>
                              <span className="text-sm font-black text-white">
                                {initials}
                              </span>
                            </div>
                            
                            {/* Name and Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight truncate">
                                  {participant.name}
                                </h3>
                                
                                {/* Skills Icon - Inline */}
                                {participant.type === 'student' && (() => {
                                  const lead = (participant as any).lead;
                                  if (!lead || !lead.extra_data) return null;
                                  
                                  const extraData = lead.extra_data as any;
                                  const skillReports = extraData.skill_reports || [];
                                  
                                  let lastReportDate: Date | null = null;
                                  if (Array.isArray(skillReports) && skillReports.length > 0) {
                                    const lastReport = skillReports[skillReports.length - 1];
                                    if (lastReport.date) {
                                      lastReportDate = new Date(lastReport.date);
                                    }
                                  }
                                  
                                  const daysSinceLastReport = lastReportDate 
                                    ? Math.floor((new Date().getTime() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24))
                                    : Infinity;
                                  
                                  const needsUpdate = daysSinceLastReport > 30;
                                  
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedStudentForSkillReport({
                                          leadId: participant.leadId,
                                          name: participant.name,
                                          studentId: participant.studentId || undefined,
                                        });
                                      }}
                                      className={`p-1 rounded transition-all ${
                                        needsUpdate
                                          ? 'bg-orange-100 text-orange-600 animate-pulse'
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      }`}
                                      title={needsUpdate 
                                        ? `Last report: ${daysSinceLastReport} days ago`
                                        : lastReportDate 
                                          ? `Last report: ${lastReportDate.toLocaleDateString()}`
                                          : 'No skill report yet'}
                                    >
                                      <BarChart3 className="h-4 w-4" />
                                    </button>
                                  );
                                })()}
                                
                                {/* Emergency SOS - Inline Small Icon */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEmergencySOS(participant.name);
                                  }}
                                  className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                  title={`Call ${EMERGENCY_SUPPORT_CONFIG.SUPPORT_LABEL}`}
                                >
                                  <PhoneCall className="h-4 w-4" />
                                </button>
                                
                                {/* Type Badge */}
                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wide flex-shrink-0 ${
                                  participant.type === 'student' 
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                                    : 'bg-blue-100 text-blue-700 border border-blue-300'
                                }`}>
                                  {participant.type === 'student' ? 'Active' : 'Trial'}
                                </span>
                              </div>
                              
                              {/* Age and Attendance Indicator - Compact */}
                              <div className="flex items-center gap-2 mt-0.5">
                                {participant.ageCategory && (
                                  <span className="text-xs font-bold text-gray-600">{participant.ageCategory}</span>
                                )}
                                
                                {/* Compact Attendance History */}
                                {(() => {
                                  const history = attendanceHistoryData[participant.leadId];
                                  if (!history || !history.attendance || history.attendance.length === 0) {
                                    return null;
                                  }
                                  
                                  const presentRecords = history.attendance
                                    .filter((r: any) => r.status === 'Present')
                                    .sort((a: any, b: any) => {
                                      const dateA = new Date(a.date).getTime();
                                      const dateB = new Date(b.date).getTime();
                                      return dateB - dateA;
                                    })
                                    .slice(0, 5);
                                  
                                  if (presentRecords.length === 0) return null;
                                  
                                  const lastDate = new Date(presentRecords[0].date);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const lastDateOnly = new Date(lastDate);
                                  lastDateOnly.setHours(0, 0, 0, 0);
                                  const daysSince = Math.floor((today.getTime() - lastDateOnly.getTime()) / (1000 * 60 * 60 * 24));
                                  
                                  const recentRecords = history.attendance
                                    .sort((a: any, b: any) => {
                                      const dateA = new Date(a.date).getTime();
                                      const dateB = new Date(b.date).getTime();
                                      return dateB - dateA;
                                    })
                                    .slice(0, 3);
                                  
                                  const recentAbsences = recentRecords.filter((r: any) => r.status === 'Absent').length;
                                  
                                  if (recentAbsences >= 2) {
                                    return <span className="text-[10px] font-bold text-red-600">⚠️ Missed {recentAbsences}</span>;
                                  } else if (daysSince === 0) {
                                    return <span className="text-[10px] font-bold text-emerald-600">✓ Today</span>;
                                  } else if (daysSince === 1) {
                                    return <span className="text-[10px] text-gray-500">Yesterday</span>;
                                  } else {
                                    return <span className="text-[10px] text-gray-500">{daysSince}d ago</span>;
                                  }
                                })()}
                                
                                {/* Milestone Alert - Compact */}
                                {participant.type === 'student' && participant.studentId && milestoneData[participant.studentId] && (() => {
                                  const milestone = milestoneData[participant.studentId];
                                  if (milestone.next_milestone && milestone.sessions_until_next === 1) {
                                    return (
                                      <span className="px-1.5 py-0.5 text-[10px] font-black bg-yellow-400 text-yellow-900 rounded-full">
                                        🥇 {milestone.next_milestone}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                                
                                {/* Grace Period - Compact */}
                                {participant.type === 'student' && (participant as any).inGracePeriod && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700 rounded border border-yellow-300">
                                    ⚠️ Payment
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Right Side: Compact Square Buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() =>
                                handleAttendanceClick(
                                  participant.id,
                                  participant.type,
                                  participant.studentId,
                                  participant.leadId,
                                  selectedBatchId,
                                  'Present'
                                )
                              }
                              disabled={recordAttendanceMutation.isPending || isPresent}
                              className={`w-11 h-11 rounded-lg font-black text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center ${
                                isPresent
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-300/50 border-2 border-emerald-700'
                                  : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg border-2 border-emerald-600'
                              }`}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() =>
                                handleAttendanceClick(
                                  participant.id,
                                  participant.type,
                                  participant.studentId,
                                  participant.leadId,
                                  selectedBatchId,
                                  'Absent'
                                )
                              }
                              disabled={recordAttendanceMutation.isPending || isAbsent}
                              className={`w-11 h-11 rounded-lg font-black text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center ${
                                isAbsent
                                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-300/50 border-2 border-rose-700'
                                  : 'bg-rose-500 text-white hover:bg-rose-600 shadow-md hover:shadow-lg border-2 border-rose-600'
                              }`}
                            >
                              ✗
                            </button>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>

                {/* Floating Checkout Bar - Fixed at Bottom */}
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t-4 border-indigo-500 shadow-2xl safe-area-inset-bottom">
                  <div className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-xs font-black uppercase tracking-wide">
                        {attendanceSummary.remaining > 0 ? (
                          <span className="text-orange-600">
                            {attendanceSummary.remaining} remaining
                          </span>
                        ) : (
                          <span className="text-emerald-600">✓ All marked</span>
                        )}
                      </div>
                      <button
                        onClick={handleCompleteSession}
                        disabled={!allMarked || isSubmitting}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black rounded-lg shadow-lg hover:from-indigo-700 hover:to-blue-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wide flex items-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isSubmitting ? 'Submitting...' : 'Check-out'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!selectedBatchId && !batchesLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-gray-600 mb-1">Select a batch to mark attendance</p>
              {coachBatches.length === 0 && (
                <p className="text-xs text-gray-500">You don't have any batches assigned yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Skill Report Modal */}
        {selectedStudentForSkillReport && (
          <SkillReportModal
            isOpen={!!selectedStudentForSkillReport}
            onClose={() => setSelectedStudentForSkillReport(null)}
            leadId={selectedStudentForSkillReport.leadId}
            playerName={selectedStudentForSkillReport.name}
            onSuccess={() => {
              // Refresh leads data to get updated skill reports
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              setSelectedStudentForSkillReport(null);
            }}
          />
        )}

        {/* Success Screen */}
        {showSuccessScreen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Session Complete!</h2>
              <p className="text-gray-600 mb-6">
                Great work, Coach! Attendance has been recorded for all {attendanceSummary.total} students.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleBackToCommandCenter}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back to Command Center
                </button>
                <button
                  onClick={handleNewSession}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  New Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
