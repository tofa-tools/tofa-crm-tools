'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { approvalsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { MessageCircle } from 'lucide-react';
import { LOSS_REASONS } from '@tofa/core';

interface CenterPerformance {
  center_id: number;
  center_name: string;
  average_attendance_pct: number;
  total_attendance: number;
  expected_attendance: number;
  previous_week_pct?: number;
  trend?: 'up' | 'down' | 'stable';
  compliance_status: 'compliant' | 'missing';
  missing_sessions_count: number;
  missing_sessions: Array<{
    batch_id: number;
    batch_name: string;
    center_name: string;
    date: string;
    expected_students: number;
    coaches?: Array<{ coach_id: number; coach_name: string; coach_phone?: string | null }>;
  }>;
}

interface ExecutiveData {
  center_performance?: CenterPerformance[];
  attendance_leaderboard?: Array<{ center_id: number; center_name: string; average_attendance_pct: number; total_attendance: number; expected_attendance: number; previous_week_pct?: number; trend?: string }>;
  batch_utilization: Array<{
    batch_id: number;
    batch_name: string;
    center_name: string;
    utilization_pct: number;
    current_students: number;
    max_capacity: number;
    status: 'overcrowded' | 'empty';
  }>;
  coach_compliance?: Array<{ batch_id: number; batch_name: string; center_name: string; date: string; expected_students: number; coaches?: Array<{ coach_id: number; coach_name: string; coach_phone?: string | null }> }>;
  loss_analysis?: Array<{ reason: string; count: number; percentage: number }>;
  top_loss_reason?: { reason: string; count: number; percentage: number } | null;
  /** Center-wise loss reason counts (Dead + Nurture). Keys: center name, values: { reason -> count } */
  loss_by_center?: Record<string, Record<string, number>>;
  /** Stage-wise loss (lifecycle stage at loss). Keys: status_at_loss, values: { reason -> count } */
  loss_by_stage?: Record<string, Record<string, number>>;
  /** Nested: center -> stage -> reason -> count */
  loss_by_center_and_stage?: Record<string, Record<string, Record<string, number>>>;
  total_dead_leads?: number;
  orphaned_leads_count?: number;
  orphaned_batches_count?: number;
  orphaned_batches?: Array<{ batch_id: number; batch_name: string; center_name: string }>;
  top_closers?: Array<{ user_id: number; user_name: string; joined_count: number }>;
  speed_demons?: Array<{ user_id: number; user_name: string; avg_minutes: number; lead_count: number }>;
}

interface ExecutiveDashboardProps {
  executiveData?: ExecutiveData;
}

const sectionHeader = 'text-sm font-black text-tofa-gold uppercase tracking-widest mb-3';

export function ExecutiveDashboard({ executiveData }: ExecutiveDashboardProps) {
  const router = useRouter();
  const { user } = useAuth();

  if (user?.role !== 'team_lead') return null;

  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsAPI.getPendingRequests(),
    enabled: user?.role === 'team_lead',
    refetchInterval: 60000,
  });

  const pendingApprovalsCount = pendingApprovalsData?.count || 0;
  const orphanedLeads = executiveData?.orphaned_leads_count ?? 0;
  const orphanedBatches = executiveData?.orphaned_batches_count ?? 0;
  const hasOrphanedData = orphanedLeads > 0 || orphanedBatches > 0;

  const handleOrphanedLeadsClick = () => router.push('/leads?status=New,Called');
  const handleOrphanedBatchesClick = () => router.push('/batches');

  const handleWhatsAppCoach = (coachName: string, batchName: string, coachPhone?: string | null) => {
    const message = `Hi ${coachName}, our records show the ${batchName} session hasn't had attendance marked. Please update the system!`;
    if (coachPhone) {
      const cleanPhone = coachPhone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard!');
    }
  };

  const handleLossReasonClick = (reason: string) => {
    const params = new URLSearchParams();
    params.set('status', 'Dead/Not Interested');
    params.set('loss_reason', reason);
    router.push(`/leads?${params.toString()}`);
  };

  let centerPerf: CenterPerformance[] = executiveData?.center_performance ?? [];
  if (centerPerf.length === 0 && executiveData?.attendance_leaderboard?.length) {
    const comp = executiveData.coach_compliance ?? [];
    const compByCenter: Record<string, typeof comp> = {};
    comp.forEach((item) => {
      if (!compByCenter[item.center_name]) compByCenter[item.center_name] = [];
      compByCenter[item.center_name].push(item);
    });
    centerPerf = executiveData.attendance_leaderboard.map((a: any) => {
      const missing = compByCenter[a.center_name] ?? [];
      return {
        ...a,
        compliance_status: (missing.length > 0 ? 'missing' : 'compliant') as 'compliant' | 'missing',
        missing_sessions_count: missing.length,
        missing_sessions: missing,
      };
    });
  }
  const batchUtil = executiveData?.batch_utilization ?? [];
  const topClosers = executiveData?.top_closers ?? [];
  const speedDemons = executiveData?.speed_demons ?? [];

  // Loss Analysis: center + stage selectors and derived data (Executive Loss Map)
  const lossByCenter = executiveData?.loss_by_center ?? {};
  const lossByStage = executiveData?.loss_by_stage ?? {};
  const lossByCenterAndStage = executiveData?.loss_by_center_and_stage ?? {};
  const lossCenterOptions = useMemo(() => {
    const names = Object.keys(lossByCenter).filter((c) => c !== 'Unknown').sort();
    if (names.length === 0 && Object.keys(lossByCenter).length > 0) return ['Unknown', 'All Centers'];
    return ['All Centers', ...names];
  }, [lossByCenter]);
  const lossStageOptions = useMemo(() => {
    const stages = Object.keys(lossByStage).filter((s) => s !== 'Unknown').sort();
    if (stages.length === 0 && Object.keys(lossByStage).length > 0) return ['Unknown', 'All Stages'];
    return ['All Stages', ...stages];
  }, [lossByStage]);
  const [selectedLossCenter, setSelectedLossCenter] = useState<string>('All Centers');
  const [selectedLossStage, setSelectedLossStage] = useState<string>('All Stages');

  const { lossReasonCountsForView, totalLossForView, topLossForView } = useMemo(() => {
    let counts: Record<string, number> = {};
    const centerSelected = selectedLossCenter !== 'All Centers';
    const stageSelected = selectedLossStage !== 'All Stages';
    if (centerSelected && stageSelected && lossByCenterAndStage[selectedLossCenter]?.[selectedLossStage]) {
      counts = { ...lossByCenterAndStage[selectedLossCenter][selectedLossStage] };
    } else if (centerSelected && lossByCenter[selectedLossCenter]) {
      counts = { ...lossByCenter[selectedLossCenter] };
    } else if (stageSelected && lossByStage[selectedLossStage]) {
      counts = { ...lossByStage[selectedLossStage] };
    } else {
      // All Centers (and All Stages): aggregate from loss_by_center
      Object.values(lossByCenter).forEach((byReason) => {
        Object.entries(byReason).forEach(([reason, n]) => {
          counts[reason] = (counts[reason] ?? 0) + n;
        });
      });
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // Show all LOSS_REASONS; use 0 for any reason not in counts. Sort by count desc so non-zero appear first.
    const entries: [string, number][] = LOSS_REASONS.map((reason) => [reason, counts[reason] ?? 0]).sort((a, b) => b[1] - a[1]);
    const top = entries.find(([, n]) => n > 0);
    const topLossForView = top ? { reason: top[0], count: top[1], percentage: total > 0 ? Math.round((top[1] / total) * 1000) / 10 : 0 } : null;
    return {
      lossReasonCountsForView: entries,
      totalLossForView: total,
      topLossForView,
    };
  }, [lossByCenter, lossByStage, lossByCenterAndStage, selectedLossCenter, selectedLossStage]);

  const hasLossData = lossReasonCountsForView.length > 0;

  if (!executiveData) {
    return <div className="text-center py-8 text-gray-500">Loading executive data...</div>;
  }

  return (
    <div className="relative">
      {/* Data Health: Small red badge top-right only if orphaned data */}
      {hasOrphanedData && (
        <div className="absolute top-0 right-0 z-10 flex gap-2">
          {orphanedLeads > 0 && (
            <button
              onClick={handleOrphanedLeadsClick}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full border-2 border-red-400 shadow-lg flex items-center gap-2"
            >
              ⚠️ {orphanedLeads} lead{orphanedLeads !== 1 ? 's' : ''} no center
            </button>
          )}
          {orphanedBatches > 0 && (
            <button
              onClick={handleOrphanedBatchesClick}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full border-2 border-red-400 shadow-lg flex items-center gap-2"
            >
              ⚠️ {orphanedBatches} batch{orphanedBatches !== 1 ? 'es' : ''} no coach
            </button>
          )}
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovalsCount > 0 && (
        <div
          onClick={() => router.push('/approvals')}
          className="mb-6 bg-gradient-to-r from-tofa-gold/30 to-amber-500/20 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-tofa-gold/50"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-tofa-navy">⚖️ Pending Approvals</span>
            <span className="text-2xl font-black text-tofa-navy">{pendingApprovalsCount}</span>
          </div>
          <p className="text-xs text-tofa-navy/70 mt-1">Click to review</p>
        </div>
      )}

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1: Sales All-Stars (Positive News - First) */}
        <div className="bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-xl p-5 border-2 border-tofa-gold/20">
          <h2 className={sectionHeader}>⭐ Sales All-Stars</h2>
          {topClosers.length === 0 && speedDemons.length === 0 ? (
            <div className="py-8 flex items-center justify-center bg-white/5 rounded-lg border border-tofa-gold/10">
              <p className="text-tofa-gold/60 text-xs font-medium">No Data for this Month</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topClosers.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-tofa-gold/80 uppercase tracking-wider mb-2">🏆 Top Closers</h4>
                  <div className="space-y-1.5">
                    {topClosers.map((c, i) => (
                      <div key={c.user_id} className="flex items-center justify-between py-1.5 px-2 bg-white/5 rounded border border-tofa-gold/10">
                        <span className="text-white font-semibold text-sm">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`} {c.user_name}</span>
                        <span className="text-tofa-gold text-xs font-bold">{c.joined_count} Join{c.joined_count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {speedDemons.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-tofa-gold/80 uppercase tracking-wider mb-2">⚡ Speed Demons</h4>
                  <div className="space-y-1.5">
                    {speedDemons.map((d, i) => (
                      <div key={d.user_id} className="flex items-center justify-between py-1.5 px-2 bg-white/5 rounded border border-tofa-gold/10">
                        <span className="text-white font-semibold text-sm">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`} {d.user_name}</span>
                        <span className="text-tofa-gold text-xs font-bold">{d.avg_minutes}m avg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Col 2: Center Performance (Attendance + Compliance) */}
        <div className="bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-xl p-5 border-2 border-tofa-gold/20">
          <h2 className={sectionHeader}>Center Performance</h2>
          {centerPerf.length === 0 ? (
            <div className="py-8 flex items-center justify-center bg-white/5 rounded-lg border border-tofa-gold/10">
              <p className="text-tofa-gold/60 text-xs font-medium">No data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {centerPerf.map((c: any) => {
                const isMerged = 'compliance_status' in c;
                const missing = isMerged ? (c.missing_sessions ?? []) : [];
                const status = isMerged ? c.compliance_status : 'compliant';
                const missingCount = isMerged ? (c.missing_sessions_count ?? 0) : 0;
                const firstMissing = missing[0];
                const coaches = firstMissing?.coaches ?? [];

                return (
                  <div key={c.center_id} className="bg-white/5 rounded-lg p-3 border border-tofa-gold/10">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-bold text-white text-sm">{c.center_name}</span>
                      {status === 'compliant' ? (
                        <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/20">✅ Compliant</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-red-400 px-2 py-0.5 rounded bg-red-500/20">⚠️ {missingCount} Session{missingCount !== 1 ? 's' : ''} Missing</span>
                          {coaches.length > 0 && (
                            <button
                              onClick={() => handleWhatsAppCoach(coaches[0].coach_name, firstMissing.batch_name, coaches[0].coach_phone)}
                              className="p-1 rounded bg-tofa-gold/20 hover:bg-tofa-gold/30 text-tofa-gold"
                              title="WhatsApp coach"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          c.average_attendance_pct >= 80 ? 'bg-emerald-400' : c.average_attendance_pct >= 60 ? 'bg-tofa-gold' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(c.average_attendance_pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{c.total_attendance} / {c.expected_attendance} • {c.average_attendance_pct?.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Col 3: Batch Utilization */}
        <div className="bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-xl p-5 border-2 border-tofa-gold/20">
          <h2 className={sectionHeader}>Batch Utilization</h2>
          {batchUtil.length === 0 ? (
            <div className="py-8 flex items-center justify-center bg-white/5 rounded-lg border border-tofa-gold/10">
              <p className="text-emerald-400 text-xs font-medium">✅ All batches optimal</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...batchUtil]
                .sort((a, b) => {
                  const ua = a.utilization_pct, ub = b.utilization_pct;
                  if (ua < 30 && ub < 30) return ua - ub;
                  if (ua > 90 && ub > 90) return ub - ua;
                  if (ua < 30) return -1;
                  if (ub < 30) return 1;
                  if (ua > 90) return -1;
                  if (ub > 90) return 1;
                  return ua - ub;
                })
                .slice(0, 5)
                .map((b) => {
                  const isCrit = b.utilization_pct < 30;
                  const isElite = b.utilization_pct > 90;
                  return (
                    <div key={b.batch_id} className={`rounded-lg p-2.5 bg-white/5 border-l-4 ${b.status === 'overcrowded' ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-white text-xs">{b.batch_name}</span>
                        <span className={`text-sm font-black ${b.status === 'overcrowded' ? 'text-emerald-400' : 'text-red-400'}`}>{b.utilization_pct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${b.status === 'overcrowded' ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${Math.min(b.utilization_pct, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {b.current_students}/{b.max_capacity}
                        {isCrit && <span className="text-red-400 ml-1">💡 Run ads</span>}
                        {isElite && <span className="text-emerald-400 ml-1">💡 New batch</span>}
                      </p>
                    </div>
                  );
                })}
              {batchUtil.length > 5 && (
                <button
                  onClick={() => router.push('/batches')}
                  className="w-full mt-2 py-2 px-3 bg-tofa-gold/20 border border-tofa-gold/40 text-tofa-gold hover:bg-tofa-gold/30 font-semibold rounded-lg text-xs"
                >
                  View All Batches
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loss Analysis – Executive Loss Map (center-wise, horizontal bar chart, TOFA theme) */}
      {(hasLossData || (executiveData.loss_analysis && executiveData.loss_analysis.length > 0)) && (
        <div className="mt-6 bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-xl p-5 border-2 border-tofa-gold/20">
          <h2 className={sectionHeader}>Loss Analysis</h2>

          {hasLossData && (
            <>
              {/* Strategic Insight: Top reason for selected center */}
              {topLossForView && (
                <div
                  className="mb-4 p-3 rounded-lg border-2 border-tofa-gold/40 bg-tofa-gold/10 text-left"
                  role="alert"
                >
                  <span className="text-tofa-gold font-bold text-sm">
                    ⚠️ Top reason for loss
                    {selectedLossCenter !== 'All Centers' ? ` at ${selectedLossCenter}` : ''}
                    {selectedLossStage !== 'All Stages' ? ` (stage: ${selectedLossStage})` : ''}: {topLossForView.reason} ({topLossForView.percentage}%)
                  </span>
                </div>
              )}

              {/* Center and Stage filters */}
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-tofa-gold/80 text-xs font-semibold uppercase tracking-wider">Center</span>
                  <select
                    value={selectedLossCenter}
                    onChange={(e) => setSelectedLossCenter(e.target.value)}
                    className="bg-tofa-navy-900/80 border border-tofa-gold/40 text-white text-sm font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-tofa-gold/50 focus:border-tofa-gold"
                  >
                    {lossCenterOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-tofa-gold/80 text-xs font-semibold uppercase tracking-wider">Stage</span>
                  <select
                    value={selectedLossStage}
                    onChange={(e) => setSelectedLossStage(e.target.value)}
                    className="bg-tofa-navy-900/80 border border-tofa-gold/40 text-white text-sm font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-tofa-gold/50 focus:border-tofa-gold"
                  >
                    {lossStageOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Horizontal bar chart – TOFA Navy & Gold */}
              <div className="space-y-2 max-w-2xl">
                {lossReasonCountsForView.map(([reason, count], i) => {
                  const pct = totalLossForView > 0 ? (count / totalLossForView) * 100 : 0;
                  return (
                    <div
                      key={reason}
                      onClick={() => handleLossReasonClick(reason)}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <span className="text-white text-sm font-medium w-44 shrink-0 truncate group-hover:text-tofa-gold transition-colors">
                        {reason}
                      </span>
                      <div className="flex-1 h-6 bg-tofa-navy-900/80 rounded overflow-hidden border border-tofa-gold/20">
                        <div
                          className="h-full rounded bg-gradient-to-r from-tofa-gold/90 to-tofa-gold"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-tofa-gold text-sm font-bold w-16 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Fallback: legacy loss_analysis grid when no loss_by_center data */}
          {!hasLossData && executiveData.loss_analysis && executiveData.loss_analysis.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {executiveData.loss_analysis.slice(0, 6).map((item, i) => (
                <div
                  key={item.reason || i}
                  onClick={() => handleLossReasonClick(item.reason || 'Unknown')}
                  className="flex justify-between items-center py-2 px-3 bg-white/5 rounded border border-tofa-gold/10 hover:bg-white/10 cursor-pointer"
                >
                  <span className="text-white text-sm font-medium truncate">{item.reason || 'Unknown'}</span>
                  <span className="text-tofa-gold text-sm font-bold">{item.count} ({item.percentage}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
