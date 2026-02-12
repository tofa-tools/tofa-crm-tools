'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useStudents } from '@/hooks/useStudents';
import { useLeads } from '@/hooks/useLeads';
import { useCenters } from '@/hooks/useCenters';
import { useBatches } from '@/hooks/useBatches';
import { useAuth } from '@/context/AuthContext';
import { LeadUpdateModal } from '@/components/leads/LeadUpdateModal';
import { formatDate } from '@/lib/utils';
import { isRenewalDueWithinDays } from '@tofa/core';
import { attendanceAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, Phone, Mail, MessageCircle, Trophy } from 'lucide-react';

const MILESTONE_SESSIONS = [9, 24, 49];

type QuickFilter = 'all' | 'at_risk' | 'renewals' | 'milestones';

function StudentsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get('filter');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(
    urlFilter === 'milestones' ? 'milestones' : urlFilter === 'renewals' ? 'renewals' : 'all'
  );

  useEffect(() => {
    if (urlFilter === 'milestones' && quickFilter !== 'milestones') setQuickFilter('milestones');
    if (urlFilter === 'renewals' && quickFilter !== 'renewals') setQuickFilter('renewals');
  }, [urlFilter]);

  // Roster access: only team_lead, team_member, observer. Coach has no access.
  useEffect(() => {
    if (user && user.role === 'coach') {
      router.replace('/coach/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('graduated') === '1') {
      toast.success('Student joined successfully! 🎉');
      window.history.replaceState({}, '', '/students');
    }
  }, []);

  const { data: studentsData = [], isLoading } = useStudents({
    is_active: true,
    enabled: !!user && user.role !== 'coach',
  });
  const { data: centers = [] } = useCenters();
  const { data: batchesData = [] } = useBatches();

  const [attendanceMap, setAttendanceMap] = useState<Record<number, { lastPresent: string | null; daysSince: number; sessionsAttended: number }>>({});
  const [contactPopoverId, setContactPopoverId] = useState<number | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);

  useEffect(() => {
    if (studentsData.length === 0) return;
    studentsData.forEach((s: any) => {
      attendanceAPI.getHistory(s.lead_id).then((res) => {
        const attendance = res.attendance || [];
        const presentDates = attendance
          .filter((a: any) => a.status === 'Present')
          .map((a: any) => a.date)
          .sort()
          .reverse();
        const lastPresent = presentDates[0] || null;
        const daysSince = lastPresent
          ? Math.floor((Date.now() - new Date(lastPresent).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        const sessionsAttended = attendance.filter((a: any) => a.status === 'Present').length;
        setAttendanceMap((prev) => ({ ...prev, [s.lead_id]: { lastPresent, daysSince, sessionsAttended } }));
      }).catch(() => {});
    });
  }, [studentsData]);

  const { data: leadsForModal } = useLeads(
    expandedLeadId ? { status: 'Joined', limit: 500 } : undefined
  );
  const selectedLead = expandedLeadId && leadsForModal?.leads
    ? leadsForModal.leads.find((l: any) => l.id === expandedLeadId)
    : null;

  const { atRiskCount, renewalsCount, milestonesCount } = useMemo(() => {
    let atRisk = 0;
    let renewals = 0;
    let milestones = 0;
    for (const s of studentsData) {
      const att = attendanceMap[s.lead_id];
      const daysSince = att?.daysSince ?? 999;
      const sessionsAttended = att?.sessionsAttended ?? 0;
      const expiry = s.subscription_end_date;
      if (daysSince > 10) atRisk += 1;
      if (s.in_grace_period || (expiry && isRenewalDueWithinDays(expiry, 7))) renewals += 1;
      if (MILESTONE_SESSIONS.includes(sessionsAttended)) milestones += 1;
    }
    return { atRiskCount: atRisk, renewalsCount: renewals, milestonesCount: milestones };
  }, [studentsData, attendanceMap]);

  const filteredStudents = useMemo(() => {
    let list = [...studentsData];
    if (quickFilter === 'at_risk') {
      list = list.filter((s: any) => {
        const att = attendanceMap[s.lead_id];
        return att && att.daysSince > 10;
      });
    } else if (quickFilter === 'renewals') {
      list = list.filter((s: any) => {
        if (s.in_grace_period) return true;
        const end = s.subscription_end_date;
        if (!end) return false;
        return isRenewalDueWithinDays(end, 7);
      });
    } else if (quickFilter === 'milestones') {
      list = list.filter((s: any) => {
        const att = attendanceMap[s.lead_id];
        const sessionsAttended = att?.sessionsAttended ?? 0;
        return MILESTONE_SESSIONS.includes(sessionsAttended);
      });
    }
    return list;
  }, [studentsData, quickFilter, attendanceMap]);

  const handleRowClick = (leadId: number) => {
    setExpandedLeadId(leadId);
  };

  // Coach has no access to Student Roster
  if (user?.role === 'coach') {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </MainLayout>
    );
  }

  const showContactCard = user?.role !== 'coach';
  const isObserver = user?.role === 'observer';
  const canEdit = user?.role !== 'observer';

  const getBatchNames = (batchIds: number[] | undefined) => {
    if (!batchIds?.length) return '—';
    return batchIds
      .map((id) => batchesData.find((b: any) => b.id === id)?.name)
      .filter(Boolean)
      .join(', ') || '—';
  };

  const getHeadCoach = (batchIds: number[] | undefined) => {
    if (!batchIds?.length) return '—';
    const firstBatch = batchesData.find((b: any) => b.id === batchIds[0]);
    const coaches = firstBatch?.coaches || [];
    return coaches[0]?.full_name || '—';
  };

  if (isLoading && studentsData.length === 0) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading Student Roster...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen">
        <PageHeader
          title="STUDENT ROSTER"
          subtitle={`${filteredStudents.length} active student${filteredStudents.length !== 1 ? 's' : ''}`}
          actions={
            isObserver ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-100 text-yellow-800 text-sm font-bold rounded-full border-2 border-yellow-400">
                👀 Read-Only Access
              </span>
            ) : undefined
          }
        />

        <div className="p-8 space-y-6">
          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setQuickFilter('all')}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                quickFilter === 'all'
                  ? 'bg-brand-accent text-brand-primary shadow-lg'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              All ({studentsData.length})
            </button>
            <button
              onClick={() => setQuickFilter('at_risk')}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                quickFilter === 'at_risk'
                  ? 'bg-amber-100 text-amber-900 border-2 border-amber-400'
                  : 'bg-white border border-gray-200 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              At Risk ({atRiskCount})
            </button>
            <button
              onClick={() => setQuickFilter('renewals')}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                quickFilter === 'renewals'
                  ? 'bg-orange-100 text-orange-900 border-2 border-orange-400'
                  : 'bg-white border border-gray-200 hover:bg-orange-50'
              }`}
            >
              <Clock className="w-4 h-4" />
              Renewals ({renewalsCount})
            </button>
            <button
              onClick={() => setQuickFilter('milestones')}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                quickFilter === 'milestones'
                  ? 'bg-amber-100 text-amber-900 border-2 border-amber-400'
                  : 'bg-white border border-gray-200 hover:bg-amber-50'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Milestones ({milestonesCount})
            </button>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4 text-left">Player Name</th>
                    <th className="px-6 py-4 text-left">Center</th>
                    <th className="px-6 py-4 text-left min-w-[3rem]">Age</th>
                    <th className="px-6 py-4 text-left">DOB</th>
                    <th className="px-6 py-4 text-left min-w-[100px]">Batches</th>
                    <th className="px-6 py-4 text-left">Head Coach</th>
                    <th className="px-6 py-4 text-left">Joined</th>
                    <th className="px-6 py-4 text-left">Subscription Plan</th>
                    <th className="px-6 py-4 text-left min-w-[6rem]">Expiry Date</th>
                    <th className="px-6 py-4 text-left min-w-[8rem]">Recent Attendance</th>
                    {showContactCard && <th className="px-6 py-4 text-left w-16">Contact</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student: any) => {
                      const att = attendanceMap[student.lead_id];
                      const lastPresent = att?.lastPresent || null;
                      const daysSince = att?.daysSince ?? null;
                      return (
                        <tr
                          key={student.id}
                          onClick={() => handleRowClick(student.lead_id)}
                          className="group hover:bg-brand-accent/10 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">
                            {student.lead_player_name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                            {centers.find((c: any) => c.id === student.center_id)?.display_name || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap tabular-nums">
                            {student.lead_player_age ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {student.lead_date_of_birth ? formatDate(student.lead_date_of_birth) : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 min-w-[100px] max-w-[140px] truncate" title={getBatchNames(student.student_batch_ids)}>
                            {getBatchNames(student.student_batch_ids)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {getHeadCoach(student.student_batch_ids)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {student.created_at ? formatDate(student.created_at) : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {student.subscription_plan || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-medium whitespace-nowrap">
                            {student.subscription_end_date
                              ? formatDate(student.subscription_end_date)
                              : '—'}
                            {student.in_grace_period && (
                              <span className="ml-2 text-xs text-amber-600 font-semibold">Grace</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {lastPresent ? (
                              <span>
                                {formatDate(lastPresent)}
                                {daysSince !== null && daysSince > 10 && (
                                  <span className="ml-2 text-amber-600 font-semibold">
                                    ({daysSince}d ago)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">No records</span>
                            )}
                          </td>
                          {showContactCard && (
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setContactPopoverId(contactPopoverId === student.id ? null : student.id)}
                                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                  title="Contact"
                                  aria-label="Show contact"
                                >
                                  <Phone className="w-4 h-4" />
                                </button>
                                {contactPopoverId === student.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      aria-hidden="true"
                                      onClick={() => setContactPopoverId(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-1 z-50 w-64 p-4 bg-white rounded-xl shadow-xl border border-gray-200">
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contact</p>
                                      {student.lead_phone && (
                                        <a
                                          href={`https://wa.me/${student.lead_phone.replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-600 mb-2"
                                        >
                                          <MessageCircle className="w-4 h-4" />
                                          {student.lead_phone}
                                        </a>
                                      )}
                                      {student.lead_email && (
                                        <a
                                          href={`mailto:${student.lead_email}`}
                                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600"
                                        >
                                          <Mail className="w-4 h-4" />
                                          {student.lead_email}
                                        </a>
                                      )}
                                      {!student.lead_phone && !student.lead_email && (
                                        <p className="text-sm text-gray-400 italic">No contact info</p>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={showContactCard ? 10 : 9} className="px-6 py-20 text-center text-gray-400 font-medium italic">
                        No students match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <LeadUpdateModal
          lead={selectedLead || null}
          isOpen={!!selectedLead}
          onClose={() => setExpandedLeadId(null)}
        />
      </div>
    </MainLayout>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>}>
      <StudentsContent />
    </Suspense>
  );
}
