'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, RefreshCw } from 'lucide-react';

interface CommandCenterSidebarProps {
  children: React.ReactNode;
}

export function CommandCenterSidebar({ children }: CommandCenterSidebarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const runExpiryMutation = useMutation({
    mutationFn: () => subscriptionsAPI.runExpiryCheck(),
    onSuccess: (data) => {
      toast.success(
        `Subscription statuses updated! ${data.expired_count} subscription${data.expired_count !== 1 ? 's' : ''} expired.`
      );
      queryClient.invalidateQueries({ queryKey: ['command-center'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to sync subscriptions');
    },
  });

  const isTeamLead = user?.role === 'team_lead';

  return (
    <div className="space-y-6">
      {/* Mini Calendar */}
      <div className="bg-white rounded-2xl shadow-xl p-4 border-2 border-tofa-gold/20">
        {children}
      </div>

      {/* Quick Links */}
      <div className="bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-2xl shadow-xl p-4 border-2 border-tofa-gold/20">
        <h3 className="text-sm font-bold text-tofa-gold uppercase tracking-wider border-b border-tofa-gold/30 pb-3 mb-3">
          Quick Links
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => router.push('/leads?create=1')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-tofa-gold/20 text-gray-200 hover:text-tofa-gold transition-all text-left"
          >
            <Plus className="w-5 h-5 text-tofa-gold" />
            <span className="font-medium">Add New Lead</span>
          </button>
          <button
            onClick={() => router.push('/batches?create=1')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-tofa-gold/20 text-gray-200 hover:text-tofa-gold transition-all text-left"
          >
            <LayoutGrid className="w-5 h-5 text-tofa-gold" />
            <span className="font-medium">Create Batch</span>
          </button>
          {isTeamLead && (
            <button
              onClick={() => runExpiryMutation.mutate()}
              disabled={runExpiryMutation.isPending}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-tofa-gold/20 text-gray-200 hover:text-tofa-gold transition-all text-left disabled:opacity-50"
            >
              <RefreshCw
                className={`w-5 h-5 text-tofa-gold ${runExpiryMutation.isPending ? 'animate-spin' : ''}`}
              />
              <span className="font-medium">
                {runExpiryMutation.isPending ? 'Running…' : 'Run Expiry Sync'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
