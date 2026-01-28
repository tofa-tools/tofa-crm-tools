'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useCoachBatches } from '@/hooks/useBatches';
import { useStudents } from '@/hooks/useStudents';
import { useLeads } from '@/hooks/useLeads';
import { SkillReportModal } from '@/components/leads/SkillReportModal';
import { Search, AlertTriangle, User, Users, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import { studentsAPI } from '@/lib/api';
import { brandConfig } from '@tofa/core';

interface StudentWithLead {
  id: number;
  lead_id: number;
  subscription_end_date?: string | null;
  lead?: any;
  lastSkillReportDate?: Date | null;
  daysSinceLastReport?: number;
  daysUntilExpiry?: number;
  needsFinalReport?: boolean;
  reportUnlocked?: boolean;
  sessionsUntilNextReport?: number | null;
  hasMilestoneDebt?: boolean;
  highestUnreportedMilestone?: number | null;
  [key: string]: any;
}

export default function CoachPlayersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ leadId: number; name: string; studentId?: number } | null>(null);

  // Fetch coach's batches
  const { data: coachBatchesData, isLoading: batchesLoading } = useCoachBatches();
  const coachBatches = coachBatchesData?.batches || [];
  const coachBatchIds = coachBatches.map(b => b.id);

  // Fetch all active students
  const { data: studentsData, isLoading: studentsLoading } = useStudents({ is_active: true });
  const allStudents = studentsData || [];

  // Fetch all leads (to get skill report data)
  const { data: leadsResponse, isLoading: leadsLoading } = useLeads({ limit: 1000 });
  const allLeads = leadsResponse?.leads || [];

  // State to store milestone data for each student
  const [studentMilestones, setStudentMilestones] = useState<Record<number, any>>({});

  // Fetch milestone data for all students
  useEffect(() => {
    const fetchMilestones = async () => {
      if (allStudents.length === 0 || coachBatchIds.length === 0) return;
      
      const milestonePromises: Promise<any>[] = [];
      const milestoneMap: Record<number, any> = {};
      
      allStudents.forEach((student: any) => {
        const studentBatchIds = student.student_batch_ids || [];
        const assignedBatchIds = studentBatchIds.filter((batchId: number) => coachBatchIds.includes(batchId));
        
        if (assignedBatchIds.length > 0 && student.id) {
          milestonePromises.push(
            studentsAPI.getMilestones(student.id)
              .then(data => {
                milestoneMap[student.id] = data;
              })
              .catch(error => {
                console.error(`Error fetching milestones for student ${student.id}:`, error);
              })
          );
        }
      });
      
      await Promise.all(milestonePromises);
      setStudentMilestones(milestoneMap);
    };
    
    fetchMilestones();
  }, [allStudents, coachBatchIds]);

  // Filter students assigned to coach's batches and enrich with skill report data
  // Group by batch for better organization
  const studentsByBatch = useMemo(() => {
    if (!coachBatchIds.length) return {};

    const grouped: Record<number, StudentWithLead[]> = {};
    
    // Initialize groups for each batch
    coachBatches.forEach((batch: any) => {
      grouped[batch.id] = [];
    });

    allStudents.forEach((student: any) => {
      // Check if student is assigned to any of coach's batches
      const studentBatchIds = student.student_batch_ids || [];
      const assignedBatchIds = studentBatchIds.filter((batchId: number) => coachBatchIds.includes(batchId));
      
      if (assignedBatchIds.length === 0) return;

      // Find associated lead
      const lead = allLeads.find((l: any) => l.id === student.lead_id);
      
      // Get last skill report date
      const extraData = lead?.extra_data || {};
      const skillReports = extraData.skill_reports || [];
      let lastSkillReportDate: Date | null = null;
      let daysSinceLastReport: number | null = null;

      if (skillReports.length > 0) {
        // Sort by date (newest first)
        const sortedReports = [...skillReports].sort((a: any, b: any) => 
          new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime()
        );
        if (sortedReports[0]?.date || sortedReports[0]?.timestamp) {
          lastSkillReportDate = new Date(sortedReports[0].date || sortedReports[0].timestamp);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - lastSkillReportDate.getTime());
          daysSinceLastReport = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }

      // Check if student needs final report (within 7 days of subscription expiry)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let daysUntilExpiry: number | null = null;
      let needsFinalReport = false;

      if (student.subscription_end_date) {
        const expiryDate = new Date(student.subscription_end_date);
        expiryDate.setHours(0, 0, 0, 0);
        const diffTime = expiryDate.getTime() - now.getTime();
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Needs final report if within 7 days of expiry
        needsFinalReport = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
      }

      // Get milestone data for this student
      const milestoneData = studentMilestones[student.id] || {};
      const reportUnlocked = milestoneData.report_unlocked || false;
      const sessionsUntilNextReport = milestoneData.sessions_until_next_report ?? null;
      const hasMilestoneDebt = milestoneData.has_milestone_debt || false;
      const highestUnreportedMilestone = milestoneData.highest_unreported_milestone || null;

      const enrichedStudent: StudentWithLead = {
        ...student,
        lead,
        lastSkillReportDate,
        daysSinceLastReport,
        daysUntilExpiry,
        needsFinalReport,
        reportUnlocked,
        sessionsUntilNextReport,
        hasMilestoneDebt,
        highestUnreportedMilestone,
      };

      // Add student to each batch they're assigned to
      assignedBatchIds.forEach((batchId: number) => {
        if (grouped[batchId]) {
          grouped[batchId].push(enrichedStudent);
        }
      });
    });

    return grouped;
  }, [allStudents, coachBatchIds, coachBatches, allLeads, studentMilestones]);

  // Flatten for search (all students across all batches)
  const allCoachStudents: StudentWithLead[] = useMemo(() => {
    return Object.values(studentsByBatch).flat();
  }, [studentsByBatch]);

  // Filter by search term and group by batch
  const filteredStudentsByBatch = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    const filtered: Record<number, StudentWithLead[]> = {};
    
    Object.entries(studentsByBatch).forEach(([batchId, students]) => {
      if (term) {
        const matching = students.filter((student: StudentWithLead) => {
          const playerName = student.lead?.player_name || '';
          return playerName.toLowerCase().includes(term);
        });
        if (matching.length > 0) {
          filtered[Number(batchId)] = matching;
        }
      } else {
        filtered[Number(batchId)] = students;
      }
    });
    
    return filtered;
  }, [studentsByBatch, searchTerm]);

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

  // Redirect if not a coach
  useEffect(() => {
    if (user && user.role !== 'coach') {
      router.push('/command-center');
    }
  }, [user, router]);

  if (user?.role !== 'coach') {
    return null;
  }

  if (batchesLoading || studentsLoading || leadsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading player roster...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-50 pb-24 flex flex-col">
        {/* Compact Dark Header */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-brand-primary to-brand-primary/90 text-white shadow-2xl border-b-4 border-brand-accent/30">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              {/* Small Logo */}
              <div className="flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt={`${brandConfig.name} Logo`}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <h1 className="text-lg font-black uppercase tracking-tight">PLAYER ROSTER</h1>
            </div>
            {/* Slim Search Bar - Pinned Below Header */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm text-white placeholder:text-gray-300 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none font-medium"
              />
            </div>
          </div>
        </div>

        {/* Compact Roster List - High Density */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {Object.keys(filteredStudentsByBatch).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="h-12 w-12 text-gray-300 mx-auto mb-3">
                  <User size={48} />
                </div>
                <h3 className="text-sm font-black text-gray-600 uppercase tracking-wide mb-1">
                  {searchTerm ? 'No students found' : 'No students assigned'}
                </h3>
                <p className="text-xs text-gray-500">
                  {searchTerm 
                    ? 'Try a different search term'
                    : 'You don\'t have any students assigned to your batches yet.'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(filteredStudentsByBatch).map(([batchId, students], batchIndex) => {
                const batch = coachBatches.find((b: any) => b.id === Number(batchId));
                const batchName = batch?.name || `Batch ${batchId}`;
                
                return (
                  <div key={batchId}>
                    {/* Slim Batch Separator */}
                    <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 mb-1.5">
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">
                        BATCH: {batchName}
                      </span>
                    </div>

                    {/* Student Rows - Compact */}
                    {students.map((student: StudentWithLead) => {
                      const playerName = student.lead?.player_name || 'Unknown';
                      const avatarGradient = getAvatarGradient(playerName);
                      const initials = getInitials(playerName);

                      // Check if skill report is needed (> 30 days old)
                      const lead = student.lead;
                      let lastReportDate: Date | null = null;
                      let daysSinceLastReport: number | null = null;
                      let needsUpdate = false;

                      if (lead?.extra_data) {
                        const extraData = lead.extra_data as any;
                        const skillReports = extraData.skill_reports || [];
                        
                        if (Array.isArray(skillReports) && skillReports.length > 0) {
                          const lastReport = skillReports[skillReports.length - 1];
                          if (lastReport.date) {
                            lastReportDate = new Date(lastReport.date);
                            daysSinceLastReport = Math.floor((new Date().getTime() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24));
                            needsUpdate = daysSinceLastReport > 30;
                          }
                        } else {
                          needsUpdate = true; // No reports yet
                        }
                      }

                      return (
                        <div
                          key={`${batchId}-${student.id}`}
                          className="rounded-lg px-3 py-2.5 border-2 border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
                          onClick={() => {
                            if (student.lead?.id) {
                              setSelectedStudent({
                                leadId: student.lead.id,
                                name: playerName,
                                studentId: student.id,
                              });
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {/* Left: Avatar */}
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-lg border-2 border-white flex-shrink-0`}>
                              <span className="text-sm font-black text-white">
                                {initials}
                              </span>
                            </div>

                            {/* Center: Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight truncate">
                                  {playerName}
                                </h3>
                                {student.lead?.player_age_category && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100 rounded uppercase tracking-wide flex-shrink-0">
                                    {student.lead.player_age_category}
                                  </span>
                                )}
                                {student.needsFinalReport && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-black bg-orange-400 text-orange-900 rounded-full">
                                    ⭐ Due
                                  </span>
                                )}
                              </div>
                              
                              {/* Subscription & Last Report Indicators */}
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {student.subscription_end_date && (
                                  <span className="text-[10px] text-gray-500 font-medium">
                                    Sub: {new Date(student.subscription_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                                {lastReportDate ? (
                                  <span className={`text-[10px] font-medium ${
                                    needsUpdate ? 'text-orange-600' : 'text-gray-500'
                                  }`}>
                                    Report: {lastReportDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-orange-600">
                                    No report yet
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: Skill Report Icon */}
                            {(student.reportUnlocked || needsUpdate) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (student.lead?.id) {
                                    setSelectedStudent({
                                      leadId: student.lead.id,
                                      name: playerName,
                                      studentId: student.id,
                                    });
                                  }
                                }}
                                className={`p-1.5 rounded transition-all ${
                                  needsUpdate || (student as any).hasMilestoneDebt
                                    ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 animate-pulse'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                title={
                                  needsUpdate || (student as any).hasMilestoneDebt
                                    ? `⚠️ Report due: ${daysSinceLastReport ? `${daysSinceLastReport} days ago` : 'No report yet'}`
                                    : lastReportDate 
                                      ? `Last report: ${lastReportDate.toLocaleDateString()}`
                                      : 'Skill report available'}
                              >
                                <BarChart3 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Skill Report Modal */}
      {selectedStudent && (
        <SkillReportModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          leadId={selectedStudent.leadId}
          playerName={selectedStudent.name}
          onSuccess={() => {
            // Refresh data
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
        />
      )}
    </MainLayout>
  );
}

