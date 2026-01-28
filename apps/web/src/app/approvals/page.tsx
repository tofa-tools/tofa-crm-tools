'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { approvalsAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, X, Clock, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ApprovalRequest {
  id: number;
  lead_id: number;
  lead_name: string;
  requested_by_name: string;
  current_status: string;
  requested_status: string;
  reason: string;
  created_at: string;
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Redirect if not team lead
  useEffect(() => {
    if (user && user.role !== 'team_lead') {
      router.push('/command-center');
    }
  }, [user, router]);

  // Fetch pending requests
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsAPI.getPendingRequests(),
    enabled: user?.role === 'team_lead',
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Resolve request mutation
  const resolveMutation = useMutation({
    mutationFn: ({ requestId, approved }: { requestId: number; approved: boolean }) =>
      approvalsAPI.resolveRequest(requestId, approved),
    onSuccess: (data, variables) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to resolve request');
    },
  });

  const handleResolve = (requestId: number, approved: boolean) => {
    if (approved) {
      if (confirm('Are you sure you want to approve this status reversal?')) {
        resolveMutation.mutate({ requestId, approved });
      }
    } else {
      resolveMutation.mutate({ requestId, approved });
    }
  };

  if (!user || user.role !== 'team_lead') {
    return (
      <MainLayout>
        <div className="p-8 text-center">
          <p className="text-gray-500">Access Denied. Team leads only.</p>
        </div>
      </MainLayout>
    );
  }

  const requests = data?.requests || [];
  const count = data?.count || 0;

  return (
    <MainLayout>
      <PageHeader
        title="PENDING APPROVALS"
        subtitle="Review and resolve status change requests"
      />
      <div className="p-8 space-y-6">

        {/* Requests Table */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 flex items-center justify-center animate-spin text-tofa-gold">
              <Loader2 size={32} />
            </div>
            <span className="ml-3 text-gray-600">Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
              <Clock size={64} />
            </div>
            <p className="text-lg font-semibold text-gray-600">No Pending Requests</p>
            <p className="text-sm text-gray-500 mt-2">
              All status reversal requests have been resolved.
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
                      Reversal Path
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Requested
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((request: ApprovalRequest) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-semibold text-gray-900">{request.lead_name}</p>
                          <p className="text-xs text-gray-500">ID: #{request.lead_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-sm text-gray-700">{request.requested_by_name}</p>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                            {request.current_status}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                            {request.requested_status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-sm text-gray-600 max-w-md">{request.reason}</p>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-xs text-gray-500">
                          {request.created_at ? formatDate(request.created_at) : 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleResolve(request.id, true)}
                            disabled={resolveMutation.isPending}
                            variant="primary"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <Check size={16} />
                            Approve
                          </Button>
                          <button
                            onClick={() => handleResolve(request.id, false)}
                            disabled={resolveMutation.isPending}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <X size={16} />
                            Reject
                          </button>
                        </div>
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

