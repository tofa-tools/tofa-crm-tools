'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { approvalsAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, X, Clock, Loader2, RotateCcw, Trash2, Building2, UserCog } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ApprovalRequestItem {
  id: number;
  request_type: string;
  lead_id?: number;
  student_id?: number;
  lead_name: string;
  requested_by_name: string;
  current_value: string;
  requested_value: string;
  reason: string;
  status: string;
  created_at: string;
}

const REQUEST_TYPE_ICONS: Record<string, React.ReactNode> = {
  STATUS_REVERSAL: <RotateCcw className="w-4 h-4" />,
  DEACTIVATE: <Trash2 className="w-4 h-4" />,
  CENTER_TRANSFER: <Building2 className="w-4 h-4" />,
  AGE_GROUP: <UserCog className="w-4 h-4" />,
  DATA_UPDATE: <Clock className="w-4 h-4" />,
  DATE_OF_BIRTH: <UserCog className="w-4 h-4" />,
  BATCH_UPDATE: <Clock className="w-4 h-4" />,
  SUBSCRIPTION_UPDATE: <Clock className="w-4 h-4" />,
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  STATUS_REVERSAL: 'Status Reversal',
  DEACTIVATE: 'Deactivation',
  CENTER_TRANSFER: 'Transfer',
  AGE_GROUP: 'Age Group Change',
  DATA_UPDATE: 'Data Update',
  DATE_OF_BIRTH: 'Date of Birth',
  BATCH_UPDATE: 'Batch Update',
  SUBSCRIPTION_UPDATE: 'Subscription Update',
};

type FilterTab = 'all' | 'data_correction' | 'center_transfer' | 'batch_subscription' | 'deactivations';
const FILTER_TABS: { key: FilterTab; label: string; types: string[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'data_correction', label: 'Data Correction', types: ['AGE_GROUP', 'DATA_UPDATE', 'DATE_OF_BIRTH'] },
  { key: 'center_transfer', label: 'Center Transfer', types: ['CENTER_TRANSFER'] },
  { key: 'batch_subscription', label: 'Batch/Subscription', types: ['BATCH_UPDATE', 'SUBSCRIPTION_UPDATE'] },
  { key: 'deactivations', label: 'Deactivations', types: ['DEACTIVATE'] },
];

export default function ApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsAPI.getPendingRequests(),
    enabled: user?.role === 'team_lead' || user?.role === 'team_member',
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ requestId, approved }: { requestId: number; approved: boolean }) =>
      approvalsAPI.resolveApprovalRequest(requestId, approved),
    onSuccess: () => {
      toast.success('Request resolved');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      refetch();
    },
    onError: (error: unknown) => {
      toast.error((error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to resolve request');
    },
  });

  const handleResolve = (request: ApprovalRequestItem, approved: boolean) => {
    const msg = approved
      ? `Approve this ${REQUEST_TYPE_LABELS[request.request_type] || request.request_type} request?`
      : 'Reject this request?';
    if (approved && !confirm(msg)) return;
    resolveMutation.mutate({ requestId: request.id, approved });
  };

  if (!user || (user.role !== 'team_lead' && user.role !== 'team_member')) {
    return (
      <MainLayout>
        <div className="p-8 text-center">
          <p className="text-gray-500">Access Denied.</p>
        </div>
      </MainLayout>
    );
  }

  const isTeamLead = user.role === 'team_lead';
  const allRequests = (data?.requests || []) as ApprovalRequestItem[];
  const totalCount = data?.count ?? allRequests.length;

  const filterConfig = FILTER_TABS.find((t) => t.key === filterTab);
  const requests =
    filterConfig?.types.length === 0
      ? allRequests
      : allRequests.filter((r) => filterConfig && filterConfig.types.includes(r.request_type));
  const filteredCount = requests.length;

  return (
    <MainLayout>
      <PageHeader
        title="PENDING APPROVALS"
        subtitle={
          filterTab === 'all'
            ? `${filteredCount} request${filteredCount !== 1 ? 's' : ''} • ${isTeamLead ? 'Review and resolve' : 'View status of your requests'}`
            : `${filteredCount} of ${totalCount} • ${filterConfig?.label ?? filterTab}`
        }
      />
      <div className="p-8 space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filterTab === tab.key
                  ? 'bg-tofa-navy text-tofa-gold border-2 border-tofa-gold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-tofa-gold" />
            <span className="ml-3 text-gray-600">Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-600">
              {filterTab === 'all' ? 'No Pending Requests' : `No ${filterConfig?.label ?? filterTab} requests`}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {filterTab === 'all' ? 'All requests have been resolved.' : 'Try another filter or clear the filter.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-tofa-navy">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Lead
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Requested By
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Change
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((request) => (
                    <tr key={`${request.request_type}-${request.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{request.lead_name}</p>
                        <p className="text-xs text-gray-500">ID: #{request.lead_id ?? request.student_id ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{request.requested_by_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">
                            {REQUEST_TYPE_ICONS[request.request_type] ?? <Clock className="w-4 h-4" />}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                            {request.current_value}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                            {request.requested_value}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700 max-w-xs font-medium">{request.reason}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">
                          {request.created_at ? formatDate(request.created_at) : 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {isTeamLead ? (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleResolve(request, true)}
                              disabled={resolveMutation.isPending}
                              variant="primary"
                              size="sm"
                              className="flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              Approve
                            </Button>
                            <button
                              onClick={() => handleResolve(request, false)}
                              disabled={resolveMutation.isPending}
                              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Pending team lead review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
