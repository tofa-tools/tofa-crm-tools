'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { subscriptionsAPI, approvalsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { ArrowUp, ArrowDown, Minus, MessageCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface ExecutiveData {
  attendance_leaderboard: Array<{
    center_id: number;
    center_name: string;
    average_attendance_pct: number;
    total_attendance: number;
    expected_attendance: number;
    previous_week_pct?: number;
    trend?: 'up' | 'down' | 'stable';
  }>;
  batch_utilization: Array<{
    batch_id: number;
    batch_name: string;
    center_name: string;
    utilization_pct: number;
    current_students: number;
    max_capacity: number;
    status: 'overcrowded' | 'empty';
  }>;
  coach_compliance: Array<{
    batch_id: number;
    batch_name: string;
    center_name: string;
    date: string;
    expected_students: number;
    coaches?: Array<{
      coach_id: number;
      coach_name: string;
      coach_phone?: string | null;
    }>;
  }>;
  loss_analysis?: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  top_loss_reason?: {
    reason: string;
    count: number;
    percentage: number;
  } | null;
  total_dead_leads?: number;
  orphaned_leads_count?: number;
  orphaned_batches_count?: number;
  orphaned_batches?: Array<{
    batch_id: number;
    batch_name: string;
    center_name: string;
  }>;
  top_closers?: Array<{
    user_id: number;
    user_name: string;
    joined_count: number;
  }>;
  speed_demons?: Array<{
    user_id: number;
    user_name: string;
    avg_minutes: number;
    lead_count: number;
  }>;
  coach_compliance_list?: Array<{
    coach_id: number;
    coach_name: string;
    compliance_pct: number;
    sessions_with_attendance: number;
    total_scheduled: number;
  }>;
}

interface ExecutiveDashboardProps {
  executiveData?: ExecutiveData;
}

export function ExecutiveDashboard({ executiveData }: ExecutiveDashboardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRunningExpiryCheck, setIsRunningExpiryCheck] = useState(false);

  // Restrict access to team_lead only
  if (user?.role !== 'team_lead') {
    return null;
  }

  // Fetch pending approvals count (team leads only)
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsAPI.getPendingRequests(),
    enabled: user?.role === 'team_lead',
    refetchInterval: 60000, // Refetch every minute
  });
  
  const pendingApprovalsCount = pendingApprovalsData?.count || 0;
  
  if (!executiveData) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading executive data...
      </div>
    );
  }

  const handleSyncSubscriptions = async () => {
    setIsRunningExpiryCheck(true);
    try {
      const result = await subscriptionsAPI.runExpiryCheck();
      toast.success(`Subscription statuses updated! ${result.expired_count} subscription${result.expired_count !== 1 ? 's' : ''} expired.`);
      // Refresh the command center data
      queryClient.invalidateQueries({ queryKey: ['command-center'] });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to sync subscriptions');
    } finally {
      setIsRunningExpiryCheck(false);
    }
  };

  const handleLossReasonClick = (reason: string) => {
    // Navigate to Leads Management page with status filter for Dead/Not Interested and loss_reason filter
    const params = new URLSearchParams();
    params.set('status', 'Dead/Not Interested');
    params.set('loss_reason', reason);
    router.push(`/leads?${params.toString()}`);
  };

  const handleOrphanedLeadsClick = () => {
    router.push('/leads?status=New,Called');
  };
  
  const handleOrphanedBatchesClick = () => {
    router.push('/batches');
  };

  // Calculate Data Quality Score
  const totalDataPoints = (executiveData.orphaned_leads_count || 0) + (executiveData.orphaned_batches_count || 0);
  const dataQualityScore = totalDataPoints === 0 ? 100 : Math.max(0, 100 - (totalDataPoints * 2)); // Simple scoring: -2 points per issue

  // WhatsApp message handler
  const handleWhatsAppCoach = (coachName: string, batchName: string, coachPhone?: string | null) => {
    const message = `Hi ${coachName}, our records show the ${batchName} session hasn&apos;t had attendance marked. Please update the system!`;
    const encodedMessage = encodeURIComponent(message);
    
    if (coachPhone) {
      // Remove any non-digit characters and add country code if needed
      const cleanPhone = coachPhone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
    } else {
      // If no phone, just copy message to clipboard
      navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Approvals Metric Card (Team Leads Only) */}
      {user?.role === 'team_lead' && pendingApprovalsCount > 0 && (
        <div
          onClick={() => router.push('/approvals')}
          className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border-2 border-yellow-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-4xl">⚖️</span>
              <div>
                <h2 className="text-xl font-bold text-white">Pending Approvals</h2>
                <p className="text-yellow-100 text-sm mt-1">Status reversal requests awaiting your review</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-5xl font-black text-white">{pendingApprovalsCount}</p>
              <p className="text-yellow-100 text-sm mt-1">
                {pendingApprovalsCount === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>
          <p className="text-yellow-100 text-xs mt-4 italic">Click to review and approve/reject requests</p>
        </div>
      )}

      {/* Data Health Alerts - Emergency Banner Style */}
      <div className="bg-gradient-to-r from-slate-950 to-indigo-950 rounded-2xl shadow-2xl border-4 border-yellow-500/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-yellow-500 uppercase tracking-tight mb-2">🚨 Data Health Intelligence</h2>
            <p className="text-sm text-gray-300">Monitor and maintain data quality across all centers</p>
          </div>
          <button
            onClick={handleSyncSubscriptions}
            disabled={isRunningExpiryCheck}
            className="px-4 py-2 bg-yellow-500/20 border-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 uppercase tracking-wide text-sm"
          >
            {isRunningExpiryCheck ? (
              <>
                <span className="animate-spin">🔄</span>
                Syncing...
              </>
            ) : (
              <>
                🔄 Sync Subscriptions
              </>
            )}
          </button>
        </div>

        {/* Data Quality Score Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-yellow-500/30 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider mb-2">Data Quality Score</h3>
              <div className="flex items-baseline gap-3">
                <span className={`text-5xl font-black ${
                  dataQualityScore >= 95 ? 'text-emerald-400' :
                  dataQualityScore >= 80 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {dataQualityScore}%
                </span>
                <span className="text-sm text-gray-400 font-medium">
                  {dataQualityScore >= 95 ? 'Excellent' :
                   dataQualityScore >= 80 ? 'Good' :
                   'Needs Attention'}
                </span>
              </div>
            </div>
            <div className="w-32 h-32 relative">
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-700"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - dataQualityScore / 100)}`}
                  className={
                    dataQualityScore >= 95 ? 'text-emerald-400' :
                    dataQualityScore >= 80 ? 'text-yellow-400' :
                    'text-red-400'
                  }
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Orphaned Data Issues - Scrollable - Only show if score < 100% */}
          {dataQualityScore < 100 && ((executiveData.orphaned_leads_count ?? 0) > 0 || 
            (executiveData.orphaned_batches_count ?? 0) > 0) && (
            <div className="mt-4 max-h-48 overflow-y-auto space-y-2 px-4">
              {(executiveData.orphaned_leads_count ?? 0) > 0 && (
                <div 
                  className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg cursor-pointer hover:bg-red-500/30 transition-colors"
                  onClick={handleOrphanedLeadsClick}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <p className="font-semibold text-red-300 text-sm">
                          Leads with no Center assigned
                        </p>
                        <p className="text-xs text-red-200 mt-0.5">
                          {executiveData.orphaned_leads_count} lead{executiveData.orphaned_leads_count !== 1 ? 's' : ''} need center assignment
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-red-400">
                      {executiveData.orphaned_leads_count}
                    </span>
                  </div>
                </div>
              )}
              {(executiveData.orphaned_batches_count ?? 0) > 0 && (
                <div 
                  className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg cursor-pointer hover:bg-red-500/30 transition-colors"
                  onClick={handleOrphanedBatchesClick}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <p className="font-semibold text-red-300 text-sm">
                          Batches with no Coach assigned
                        </p>
                        <p className="text-xs text-red-200 mt-0.5">
                          {executiveData.orphaned_batches_count} batch{executiveData.orphaned_batches_count !== 1 ? 'es' : ''} need coach assignment
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-red-400">
                      {executiveData.orphaned_batches_count}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Attendance Leaderboard + Sales All-Stars */}
        <div className="space-y-6">
          {/* Attendance Leaderboard */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 rounded-2xl shadow-2xl border-2 border-yellow-500/30 p-6">
            <h2 className="text-xl font-black text-yellow-500 uppercase tracking-tight mb-4 flex items-center gap-2">
              <TrendingUp className="h-[18px] w-[18px] text-yellow-500" />
              Attendance Leaderboard
            </h2>
            <p className="text-sm text-gray-300 mb-4">Average attendance % for last 7 days by center</p>
            <div className="space-y-3">
              {executiveData.attendance_leaderboard.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No attendance data available</p>
              ) : (
                executiveData.attendance_leaderboard.map((center) => (
                  <div key={center.center_id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{center.center_name}</span>
                        {center.trend && center.trend !== 'stable' && (
                          <span className="flex items-center gap-1">
                            {center.trend === 'up' && (
                              <ArrowUp className="h-[18px] w-[18px] text-emerald-400" />
                            )}
                            {center.trend === 'down' && (
                              <ArrowDown className="h-[18px] w-[18px] text-red-400" />
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <span className={`text-lg font-black ${
                          center.average_attendance_pct >= 80 ? 'text-emerald-400' :
                          center.average_attendance_pct >= 60 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {center.average_attendance_pct.toFixed(1)}%
                        </span>
                        {center.previous_week_pct !== undefined && center.previous_week_pct > 0 && (
                          <p className="text-xs text-gray-400">
                            Last week: {center.previous_week_pct.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          center.average_attendance_pct >= 80 ? 'bg-emerald-400' :
                          center.average_attendance_pct >= 60 ? 'bg-yellow-400' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(center.average_attendance_pct, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {center.total_attendance} / {center.expected_attendance} present
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sales All-Stars */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 rounded-2xl shadow-2xl border-2 border-yellow-500/30 p-6">
            <h2 className="text-xl font-black text-yellow-500 uppercase tracking-tight mb-4 flex items-center gap-2">
              <span>⭐</span>
              Sales All-Stars
            </h2>
            {(!executiveData.top_closers || executiveData.top_closers.length === 0) && 
             (!executiveData.speed_demons || executiveData.speed_demons.length === 0) ? (
              <p className="text-gray-400 text-center py-6">No closing activity recorded for this month yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Closers */}
                {executiveData.top_closers && executiveData.top_closers.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/20 shadow-yellow-500/20 shadow-lg">
                    <h4 className="text-md font-black text-yellow-400 uppercase tracking-wide mb-3">🏆 Top Closers</h4>
                    <div className="space-y-2">
                      {executiveData.top_closers.map((closer, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div key={closer.user_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-yellow-500/10">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{medals[index] || `${index + 1}.`}</span>
                              <div>
                                <p className="font-bold text-white text-sm">{closer.user_name}</p>
                                <p className="text-xs text-gray-300">{closer.joined_count} Join{closer.joined_count !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Speed Demons */}
                {executiveData.speed_demons && executiveData.speed_demons.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/20 shadow-yellow-500/20 shadow-lg">
                    <h4 className="text-md font-black text-yellow-400 uppercase tracking-wide mb-3">⚡ Speed Demons</h4>
                    <div className="space-y-2">
                      {executiveData.speed_demons.map((demon, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div key={demon.user_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-yellow-500/10">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{medals[index] || `${index + 1}.`}</span>
                              <div>
                                <p className="font-bold text-white text-sm">{demon.user_name}</p>
                                <p className="text-xs text-gray-300">{demon.avg_minutes}m avg contact</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Batch Utilization + Coach Compliance */}
        <div className="space-y-6">
          {/* Batch Utilization */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 rounded-2xl shadow-2xl border-2 border-yellow-500/30 p-6">
            <h2 className="text-xl font-black text-yellow-500 uppercase tracking-tight mb-4 flex items-center gap-2">
              <span>⚖️</span>
              Batch Utilization Alerts
            </h2>
            <p className="text-sm text-gray-300 mb-4">Batches with utilization &gt;90% (overcrowded) or &lt;30% (empty)</p>
            <div className="space-y-3">
              {executiveData.batch_utilization.length === 0 ? (
                <p className="text-emerald-400 text-center py-4 font-semibold">✅ All batches are optimally utilized</p>
              ) : (
                executiveData.batch_utilization.map((batch) => {
                  const isCritical = batch.utilization_pct < 30;
                  const isElite = batch.utilization_pct > 90;
                  const label = isCritical ? '🔴 CRITICAL: Underutilized' : isElite ? '👑 ELITE: At Capacity' : '';
                  
                  return (
                    <div
                      key={batch.batch_id}
                      className={`border-l-4 rounded-lg p-4 bg-white/10 backdrop-blur-sm border ${
                        batch.status === 'overcrowded'
                          ? 'border-l-emerald-500 border-emerald-500/20'
                          : 'border-l-red-500 border-red-500/20'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-white">{batch.batch_name}</span>
                          <span className="text-sm text-gray-300 ml-2">({batch.center_name})</span>
                          {label && (
                            <div className="mt-1">
                              <span className={`text-xs font-black uppercase tracking-wide ${
                                isCritical ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {label}
                              </span>
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-lg font-black ${
                            batch.status === 'overcrowded' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {batch.utilization_pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${
                            batch.status === 'overcrowded' ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(batch.utilization_pct, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-300">
                        {batch.current_students} / {batch.max_capacity} students
                        {isCritical && (
                          <span className="text-red-400 font-semibold ml-2">💡 Suggests running ads</span>
                        )}
                        {isElite && (
                          <span className="text-emerald-400 font-semibold ml-2">💡 Suggests opening a new batch</span>
                        )}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coach Compliance */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 rounded-2xl shadow-2xl border-2 border-yellow-500/30 p-6">
            <h2 className="text-xl font-black text-yellow-500 uppercase tracking-tight mb-4 flex items-center gap-2">
              <span>✅</span>
              Coach Compliance
            </h2>
            <p className="text-sm text-gray-300 mb-4">Batches that happened in last 24h but have no attendance records</p>
            <div className="space-y-3">
              {executiveData.coach_compliance.length === 0 ? (
                <p className="text-emerald-300 text-center py-6 font-medium">✅ All batches have attendance records</p>
              ) : (
                executiveData.coach_compliance.map((batch, index) => (
                  <div
                    key={`${batch.batch_id}-${batch.date}-${index}`}
                    className="border-l-4 border-red-500 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-red-500/20"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-white">{batch.batch_name}</span>
                        <span className="text-sm text-gray-300 ml-2">({batch.center_name})</span>
                      </div>
                      <span className="text-sm text-red-400 font-bold">⚠️ Missing</span>
                    </div>
                    <p className="text-xs text-gray-300 mb-3">
                      Date: {new Date(batch.date).toLocaleDateString()} • Expected: {batch.expected_students} students
                    </p>
                    {/* WhatsApp Coach Buttons */}
                    {batch.coaches && batch.coaches.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {batch.coaches.map((coach) => (
                          <button
                            key={coach.coach_id}
                            onClick={() => handleWhatsAppCoach(coach.coach_name, batch.batch_name, coach.coach_phone)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 rounded-lg transition-colors text-xs font-bold uppercase tracking-wide"
                          >
                            <MessageCircle className="h-[18px] w-[18px] text-emerald-300" />
                            WhatsApp {coach.coach_name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loss Analysis - Full Width */}
      {executiveData.loss_analysis && executiveData.loss_analysis.length > 0 && (
        <div className="bg-gradient-to-br from-slate-950 to-indigo-950 rounded-2xl shadow-2xl border-2 border-yellow-500/30 p-6">
          <h2 className="text-xl font-black text-yellow-500 uppercase tracking-tight mb-4 flex items-center gap-2">
            <TrendingDown className="h-[18px] w-[18px] text-yellow-500" />
            Loss Analysis
          </h2>
          <p className="text-sm text-gray-300 mb-4">
            Breakdown of why leads are marked as Dead/Not Interested
            {executiveData.total_dead_leads && (
              <span className="ml-2 text-gray-400">
                (Total: {executiveData.total_dead_leads} leads)
              </span>
            )}
          </p>
          
          {/* Top Loss Reason Warning */}
          {executiveData.top_loss_reason && executiveData.top_loss_reason.percentage >= 30 && (
            <div className="mb-4 p-4 bg-red-500/20 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-start">
                <span className="text-2xl mr-3">⚠️</span>
                <div>
                  <p className="font-bold text-red-300">
                    Warning: {executiveData.top_loss_reason.percentage}% of losses are due to "{executiveData.top_loss_reason.reason}"
                  </p>
                  <p className="text-sm text-red-200 mt-1">
                    This indicates a potential systemic issue. Consider reviewing your processes for this area.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loss Reason Chart */}
          <div className="space-y-3">
            {executiveData.loss_analysis.map((item, index) => (
              <div 
                key={item.reason || `unknown-${index}`} 
                className="border border-yellow-500/20 rounded-lg p-4 cursor-pointer hover:bg-white/5 hover:border-yellow-500/50 transition-all bg-white/5"
                onClick={() => handleLossReasonClick(item.reason || 'Unknown')}
                title={`Click to view all leads with loss reason: ${item.reason || 'Unknown'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-white hover:text-yellow-400">
                    {item.reason || 'Unknown'}
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-black text-white">{item.count}</span>
                    <span className="text-sm text-gray-300 ml-2">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-red-500 h-2.5 rounded-full transition-all hover:bg-red-400"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
