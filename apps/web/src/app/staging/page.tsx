'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { stagingAPI, authAPI, centersAPI } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { StagingPromotionModal } from '@/components/leads/StagingPromotionModal';
import { Sparkles, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface StagingLead {
  id: number;
  player_name: string;
  phone: string;
  email?: string;
  center_id: number;
  created_at: string;
  center?: {
    id: number;
    display_name: string;
  };
}

export default function StagingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<StagingLead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { user } = useAuth();

  const [addForm, setAddForm] = useState({
    playerName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    centerId: '' as number | '',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authAPI.getCurrentUser(),
    enabled: !!user && (user.role === 'team_lead' || user.role === 'team_member'),
  });
  const { data: allCenters = [] } = useQuery({
    queryKey: ['centers'],
    queryFn: () => centersAPI.getCenters(),
    enabled: !!user,
  });

  const assignedCenterIds = (currentUser as { center_ids?: number[] })?.center_ids ?? [];
  const centers = useMemo(
    () => (assignedCenterIds.length > 0
      ? allCenters.filter((c: { id: number }) => assignedCenterIds.includes(c.id))
      : allCenters),
    [allCenters, assignedCenterIds]
  );

  useEffect(() => {
    if (user && user.role !== 'team_lead' && user.role !== 'team_member') {
      router.push('/command-center');
    }
  }, [user, router]);

  useEffect(() => {
    if (showAddModal && centers.length > 0 && addForm.centerId === '') {
      setAddForm((f) => ({ ...f, centerId: centers[0]?.id ?? '' }));
    }
  }, [showAddModal, centers, addForm.centerId]);

  const { data: stagingLeads = [], isLoading } = useQuery({
    queryKey: ['stagingLeads'],
    queryFn: () => stagingAPI.getStagingLeads(),
    enabled: !!user && (user.role === 'team_lead' || user.role === 'team_member'),
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.playerName.trim() || !addForm.phone.trim() || !addForm.centerId) {
      toast.error('Player name, contact number, and center are required');
      return;
    }
    const isTeamMember = user?.role === 'team_member';
    if (isTeamMember && !addForm.dateOfBirth) {
      toast.error('Date of birth is required to add directly to pipeline');
      return;
    }
    let age: number | undefined;
    if (addForm.dateOfBirth) {
      const dob = new Date(addForm.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear();
      if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age -= 1;
    }
    setAddSubmitting(true);
    try {
      const created = await stagingAPI.createStagingLead({
        player_name: addForm.playerName.trim(),
        phone: addForm.phone.trim(),
        center_id: Number(addForm.centerId),
        email: addForm.email.trim() || undefined,
        age,
      });
      if (isTeamMember && created?.id) {
        await stagingAPI.promoteStagingLead(created.id, {
          date_of_birth: addForm.dateOfBirth || undefined,
          email: addForm.email.trim() || undefined,
        });
        toast.success('Lead added to pipeline (Trial Attended)');
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dailyQueue'] });
      } else {
        toast.success('Field capture added');
      }
      setShowAddModal(false);
      setAddForm({ playerName: '', phone: '', email: '', dateOfBirth: '', centerId: '' });
      queryClient.invalidateQueries({ queryKey: ['stagingLeads'] });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to add';
      toast.error(typeof msg === 'string' ? msg : 'Failed to add field capture');
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen">
        <PageHeader
          title="FIELD CAPTURES"
          subtitle={`${stagingLeads.length} walk-in${stagingLeads.length !== 1 ? 's' : ''} to process`}
          actions={
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-brand-primary font-bold rounded-xl border-2 border-white/80 hover:bg-brand-accent/20 transition-all shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add New Field Capture
            </button>
          }
        />

        <div className="p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
                <p className="ml-4 text-gray-600">Loading field captures...</p>
              </div>
            ) : stagingLeads.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No walk-in leads to process</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {stagingLeads.map((lead: StagingLead) => (
                  <div
                    key={lead.id}
                    className="p-6 hover:bg-brand-accent/5 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                      <h3 className="font-bold text-gray-900 text-lg">{lead.player_name}</h3>
                      <p className="text-gray-600 mt-1">{lead.phone}</p>
                      {lead.email && (
                        <p className="text-sm text-gray-500 mt-1">{lead.email}</p>
                      )}
                      {lead.center && (
                        <p className="text-sm text-gray-400 mt-1">{lead.center.display_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <p className="text-sm text-gray-400">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLead(lead);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-yellow-700 transition-all shadow-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                        Promote to Lead
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedLead && (
          <StagingPromotionModal
            isOpen={!!selectedLead}
            onClose={() => {
              setSelectedLead(null);
              queryClient.invalidateQueries({ queryKey: ['stagingLeads'] });
            }}
            stagingLead={selectedLead}
          />
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/50 min-h-full py-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-xl my-auto border-2 border-brand-accent/20 overflow-hidden">
              <div className="flex items-center justify-between gap-2 py-3 px-4 sm:px-6 bg-[#0A192F] text-white">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold">➕ Add New Field Capture</h2>
                  {user?.role === 'team_member' && (
                    <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">Adds directly to Leads (Trial Attended)</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Player Name *</label>
                    <input
                      type="text"
                      value={addForm.playerName}
                      onChange={(e) => setAddForm((f) => ({ ...f, playerName: e.target.value }))}
                      placeholder=""
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Number *</label>
                    <input
                      type="tel"
                      value={addForm.phone}
                      onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder=""
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Center *</label>
                    <select
                      value={addForm.centerId}
                      onChange={(e) => setAddForm((f) => ({ ...f, centerId: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                      required
                    >
                      <option value="">Select center</option>
                      {centers.map((c: { id: number; display_name: string }) => (
                        <option key={c.id} value={c.id}>{c.display_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {user?.role === 'team_member' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={addForm.dateOfBirth}
                        onChange={(e) => setAddForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Email (Optional)</label>
                      <input
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="Optional"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-4 sm:mt-5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 px-4 min-h-10 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting || !addForm.playerName.trim() || !addForm.phone.trim() || !addForm.centerId || (user?.role === 'team_member' && !addForm.dateOfBirth)}
                    className="flex-1 py-2.5 px-4 min-h-10 bg-gradient-to-r from-brand-accent to-amber-600 text-[#0A192F] font-bold rounded-xl hover:from-amber-500 hover:to-brand-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {addSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
