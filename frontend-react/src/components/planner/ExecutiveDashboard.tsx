'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscriptionsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface ExecutiveData {
  attendance_leaderboard: Array<{
    center_id: number;
    center_name: string;
    average_attendance_pct: number;
    total_attendance: number;
    expected_attendance: number;
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
  const [isRunningExpiryCheck, setIsRunningExpiryCheck] = useState(false);
  
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
    // Navigate to Leads page with filter for center_id=null
    // Since backend doesn't support center_id=null filter directly, we'll use a special approach
    // For now, navigate to leads page - the user can manually filter
    router.push('/leads?status=New,Called');
  };
  
  const handleOrphanedBatchesClick = () => {
    // Navigate to Batches management page
    router.push('/batches');
  };
  
  return (
    <div className="space-y-6">
      {/* Data Health Alerts */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">🚨 Data Health Alerts</h2>
            <p className="text-sm text-gray-600 mt-1">Monitor and maintain data quality</p>
          </div>
          <button
            onClick={handleSyncSubscriptions}
            disabled={isRunningExpiryCheck}
            className="px-4 py-2 bg-white border-2 border-purple-500 text-purple-600 hover:bg-purple-50 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        {((executiveData.orphaned_leads_count && executiveData.orphaned_leads_count > 0) || 
          (executiveData.orphaned_batches_count && executiveData.orphaned_batches_count > 0)) && (
          <>
            <p className="text-sm text-gray-600 mb-4">Found orphaned data that needs attention</p>
          <div className="space-y-3">
            {executiveData.orphaned_leads_count && executiveData.orphaned_leads_count > 0 && (
              <div 
                className="p-4 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                onClick={handleOrphanedLeadsClick}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-900">
                        Leads with no Center assigned
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {executiveData.orphaned_leads_count} lead{executiveData.orphaned_leads_count !== 1 ? 's' : ''} with status 'New' or 'Called' have no center assigned
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-600">
                    {executiveData.orphaned_leads_count}
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-2 italic">Click to view and assign centers</p>
              </div>
            )}
            {executiveData.orphaned_batches_count && executiveData.orphaned_batches_count > 0 && (
              <div 
                className="p-4 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                onClick={handleOrphanedBatchesClick}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-900">
                        Batches with no Coach assigned
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {executiveData.orphaned_batches_count} batch{executiveData.orphaned_batches_count !== 1 ? 'es' : ''} have no coaches assigned
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-600">
                    {executiveData.orphaned_batches_count}
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-2 italic">Click to view and assign coaches</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* This Month's Performance */}
      {(executiveData.top_closers || executiveData.speed_demons || executiveData.coach_compliance_list) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">📊 This Month's Performance</h2>
          
          {/* Sales All-Stars Section */}
          {(executiveData.top_closers || executiveData.speed_demons) && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales All-Stars</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Closers */}
                {executiveData.top_closers && executiveData.top_closers.length > 0 && (
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-yellow-50 to-orange-50">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">🏆 Top Closers</h4>
                    <div className="space-y-3">
                      {executiveData.top_closers.map((closer, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div key={closer.user_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{medals[index] || `${index + 1}.`}</span>
                              <div>
                                <p className="font-semibold text-gray-900">{closer.user_name}</p>
                                <p className="text-sm text-gray-600">{closer.joined_count} Join{closer.joined_count !== 1 ? 's' : ''}</p>
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
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">⚡ Speed Demons</h4>
                    <div className="space-y-3">
                      {executiveData.speed_demons.map((demon, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div key={demon.user_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{medals[index] || `${index + 1}.`}</span>
                              <div>
                                <p className="font-semibold text-gray-900">{demon.user_name}</p>
                                <p className="text-sm text-gray-600">{demon.avg_minutes}m avg contact</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Coaching Excellence Section */}
          {executiveData.coach_compliance_list && executiveData.coach_compliance_list.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Coaching Excellence</h3>
              <div className="space-y-4">
                {executiveData.coach_compliance_list.map((coach) => (
                  <div key={coach.coach_id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{coach.coach_name}</span>
                        {coach.compliance_pct < 70 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                            ⚠️ Needs Follow-up
                          </span>
                        )}
                      </div>
                      <span className={`text-lg font-bold ${
                        coach.compliance_pct >= 90 ? 'text-green-600' : 
                        coach.compliance_pct < 70 ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {coach.compliance_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          coach.compliance_pct >= 90 ? 'bg-green-600' : 
                          coach.compliance_pct < 70 ? 'bg-red-600' : 'bg-yellow-600'
                        }`}
                        style={{ width: `${Math.min(coach.compliance_pct, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {coach.sessions_with_attendance} / {coach.total_scheduled} sessions recorded
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Attendance Leaderboard */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Attendance Leaderboard</h2>
        <p className="text-sm text-gray-600 mb-4">Average attendance % for last 7 days by center</p>
        <div className="space-y-3">
          {executiveData.attendance_leaderboard.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No attendance data available</p>
          ) : (
            executiveData.attendance_leaderboard.map((center) => (
              <div key={center.center_id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-900">{center.center_name}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {center.average_attendance_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(center.average_attendance_pct, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {center.total_attendance} / {center.expected_attendance} present
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Batch Utilization */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">⚖️ Batch Utilization Alerts</h2>
        <p className="text-sm text-gray-600 mb-4">Batches with utilization &gt;90% (overcrowded) or &lt;30% (empty)</p>
        <div className="space-y-3">
          {executiveData.batch_utilization.length === 0 ? (
            <p className="text-green-600 text-center py-4">✅ All batches are optimally utilized</p>
          ) : (
            executiveData.batch_utilization.map((batch) => (
              <div
                key={batch.batch_id}
                className={`border-l-4 rounded-lg p-4 ${
                  batch.status === 'overcrowded'
                    ? 'border-red-500 bg-red-50'
                    : 'border-yellow-500 bg-yellow-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-gray-900">{batch.batch_name}</span>
                    <span className="text-sm text-gray-600 ml-2">({batch.center_name})</span>
                  </div>
                  <span
                    className={`text-lg font-bold ${
                      batch.status === 'overcrowded' ? 'text-red-600' : 'text-yellow-600'
                    }`}
                  >
                    {batch.utilization_pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {batch.current_students} / {batch.max_capacity} students
                  {batch.status === 'overcrowded' && (
                    <span className="text-red-600 font-semibold ml-2">⚠️ Overcrowded</span>
                  )}
                  {batch.status === 'empty' && (
                    <span className="text-yellow-600 font-semibold ml-2">📉 Low Capacity</span>
                  )}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Coach Compliance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">✅ Coach Compliance</h2>
        <p className="text-sm text-gray-600 mb-4">Batches that happened in last 24h but have no attendance records</p>
        <div className="space-y-3">
          {executiveData.coach_compliance.length === 0 ? (
            <p className="text-green-600 text-center py-4">✅ All batches have attendance records</p>
          ) : (
            executiveData.coach_compliance.map((batch, index) => (
              <div
                key={`${batch.batch_id}-${batch.date}-${index}`}
                className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-gray-900">{batch.batch_name}</span>
                    <span className="text-sm text-gray-600 ml-2">({batch.center_name})</span>
                  </div>
                  <span className="text-sm text-red-600 font-semibold">⚠️ Missing</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Date: {new Date(batch.date).toLocaleDateString()} • Expected: {batch.expected_students} students
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Loss Analysis */}
      {executiveData.loss_analysis && executiveData.loss_analysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📉 Loss Analysis</h2>
          <p className="text-sm text-gray-600 mb-4">
            Breakdown of why leads are marked as Dead/Not Interested
            {executiveData.total_dead_leads && (
              <span className="ml-2 text-gray-500">
                (Total: {executiveData.total_dead_leads} leads)
              </span>
            )}
          </p>
          
          {/* Top Loss Reason Warning */}
          {executiveData.top_loss_reason && executiveData.top_loss_reason.percentage >= 30 && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-start">
                <span className="text-2xl mr-3">⚠️</span>
                <div>
                  <p className="font-semibold text-red-900">
                    Warning: {executiveData.top_loss_reason.percentage}% of losses are due to "{executiveData.top_loss_reason.reason}"
                  </p>
                  <p className="text-sm text-red-700 mt-1">
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
                className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all"
                onClick={() => handleLossReasonClick(item.reason || 'Unknown')}
                title={`Click to view all leads with loss reason: ${item.reason || 'Unknown'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-900 hover:text-blue-600">
                    {item.reason || 'Unknown'}
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">{item.count}</span>
                    <span className="text-sm text-gray-600 ml-2">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-red-600 h-2.5 rounded-full transition-all hover:bg-red-700"
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

