'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useBatches, useCreateBatch, useAssignCoachToBatch, useUpdateBatch, useDeleteBatch } from '@/hooks/useBatches';
import { useUsers } from '@/hooks/useUsers';
import { useCenters } from '@/hooks/useCenters';
import { X, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { BatchCreate } from '@tofa/core';
import { formatDate } from '@/lib/utils';

export default function BatchesPage() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const { user } = useAuth();
  const router = useRouter();
  
  // State hooks - ALL must be before any conditional returns
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [updatingBatchId, setUpdatingBatchId] = useState<number | null>(null);
  const [selectedAgeCategories, setSelectedAgeCategories] = useState<string[]>([]);
  const [editModalInitialized, setEditModalInitialized] = useState(false);
  const [newBatch, setNewBatch] = useState<BatchCreate>({
    name: '',
    center_id: 0,
    age_category: '',
    max_capacity: 20,
    is_mon: false,
    is_tue: false,
    is_wed: false,
    is_thu: false,
    is_fri: false,
    is_sat: false,
    is_sun: false,
    start_time: null,
    end_time: null,
    start_date: new Date().toISOString().split('T')[0], // Default to today
    is_active: true,
    coach_ids: [], // Multiple coach selection
  });
  const [selectedCoachIds, setSelectedCoachIds] = useState<number[]>([]);
  
  // Data fetching hooks - ALL must be before any conditional returns
  const { data: batchesData, isLoading } = useBatches();
  const { data: usersData } = useUsers();
  const { data: centersData } = useCenters();
  
  // Mutation hooks - ALL must be before any conditional returns
  const createBatchMutation = useCreateBatch();
  const assignCoachMutation = useAssignCoachToBatch();
  const updateBatchMutation = useUpdateBatch();
  const deleteBatchMutation = useDeleteBatch();
  
  // Derived data - computed before early return
  const batches = batchesData || [];
  const centers = centersData || [];
  const users = usersData || [];
  const coaches = users.filter(u => u.role === 'coach');
  const ageCategoryOptions = ['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'Senior'];
  
  // Route protection: Redirect non-team-leads
  useEffect(() => {
    if (user && user.role !== 'team_lead') {
      toast.error('Access denied. Only team leads can manage batches.');
      router.push('/command-center');
    }
  }, [user, router]);
  
  // Initialize edit modal form when batch is selected
  useEffect(() => {
    if (showEditModal && selectedBatchId) {
      const batch = batches.find(b => b.id === selectedBatchId);
      if (batch && !editModalInitialized) {
        setSelectedAgeCategories(batch.age_category ? batch.age_category.split(',').map((s: string) => s.trim()) : []);
        setNewBatch({
          name: batch.name,
          center_id: batch.center_id,
          age_category: batch.age_category,
          max_capacity: batch.max_capacity,
          is_mon: batch.is_mon,
          is_tue: batch.is_tue,
          is_wed: batch.is_wed,
          is_thu: batch.is_thu,
          is_fri: batch.is_fri,
          is_sat: batch.is_sat,
          is_sun: batch.is_sun,
          start_time: batch.start_time ? batch.start_time.substring(0, 5) : null,
          end_time: batch.end_time ? batch.end_time.substring(0, 5) : null,
          start_date: batch.start_date || new Date().toISOString().split('T')[0],
          is_active: batch.is_active === true,
          coach_ids: batch.coaches?.map((c: any) => c.id) || [],
        });
        setEditModalInitialized(true);
      }
    } else {
      setEditModalInitialized(false);
    }
  }, [showEditModal, selectedBatchId, batches, editModalInitialized]);
  
  // Show access denied message if not team lead (AFTER all hooks)
  if (!user || user.role !== 'team_lead') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">Only team leads can access batch management.</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  // Validation helpers
  const hasScheduleDays = newBatch.is_mon || newBatch.is_tue || newBatch.is_wed || newBatch.is_thu || newBatch.is_fri || newBatch.is_sat || newBatch.is_sun;
  const isFormValid = hasScheduleDays;

  const handleCreateBatch = async () => {
    if (!newBatch.name || !newBatch.center_id || selectedAgeCategories.length === 0 || !newBatch.start_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!hasScheduleDays) {
      toast.error('Please select at least one schedule day');
      return;
    }
    
    if (!newBatch.coach_ids || newBatch.coach_ids.length === 0) {
      toast.error('At least one coach must be assigned to the batch');
      return;
    }
    
    try {
      await createBatchMutation.mutateAsync({
        ...newBatch,
        age_category: selectedAgeCategories.join(','),
      });
      setShowCreateModal(false);
      setSelectedAgeCategories([]);
      setNewBatch({
        name: '',
        center_id: 0,
        age_category: '',
        max_capacity: 20,
        is_mon: false,
        is_tue: false,
        is_wed: false,
        is_thu: false,
        is_fri: false,
        is_sat: false,
        is_sun: false,
        start_time: null,
        end_time: null,
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
        coach_ids: [],
      });
    } catch (error) {
      // Error handled in hook
    }
  };
  
  const handleAssignCoach = async () => {
    if (!selectedBatchId || selectedCoachIds.length === 0) {
      toast.error('Please select at least one coach');
      return;
    }
    
    try {
      await assignCoachMutation.mutateAsync({
        batchId: selectedBatchId,
        coachIds: selectedCoachIds,
      });
      setShowAssignModal(false);
      setSelectedBatchId(null);
      setSelectedCoachIds([]);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditBatch = (batchId: number) => {
    setSelectedBatchId(batchId);
    setShowEditModal(true);
  };

  const handleUpdateBatch = async () => {
    if (!selectedBatchId || !newBatch.name || !newBatch.center_id || selectedAgeCategories.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!newBatch.coach_ids || newBatch.coach_ids.length === 0) {
      toast.error('At least one coach must be assigned to the batch');
      return;
    }
    
    try {
      await updateBatchMutation.mutateAsync({
        batchId: selectedBatchId,
        data: {
          ...newBatch,
          age_category: selectedAgeCategories.join(','),
        },
      });
      setShowEditModal(false);
      setSelectedBatchId(null);
      setSelectedAgeCategories([]);
      setNewBatch({
        name: '',
        center_id: 0,
        age_category: '',
        max_capacity: 20,
        is_mon: false,
        is_tue: false,
        is_wed: false,
        is_thu: false,
        is_fri: false,
        is_sat: false,
        is_sun: false,
        start_time: null,
        end_time: null,
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
        coach_ids: [],
      });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatchId) return;
    
    try {
      await deleteBatchMutation.mutateAsync(selectedBatchId);
      setShowDeleteModal(false);
      setSelectedBatchId(null);
    } catch (error) {
      // Error handled in hook
    }
  };
  
  const getScheduleDisplay = (batch: any) => {
    const days = [];
    if (batch.is_mon) days.push('Mon');
    if (batch.is_tue) days.push('Tue');
    if (batch.is_wed) days.push('Wed');
    if (batch.is_thu) days.push('Thu');
    if (batch.is_fri) days.push('Fri');
    if (batch.is_sat) days.push('Sat');
    if (batch.is_sun) days.push('Sun');
    return days.length > 0 ? days.join(', ') : 'No schedule';
  };
  
  const getCenterName = (centerId: number | null | undefined) => {
    if (!centerId) return 'N/A';
    const center = centers.find(c => c.id === centerId);
    return center?.display_name || `Center ${centerId}`;
  };
  
  if (!user || user.role !== 'team_lead') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">Access Restricted</p>
            <p className="text-sm text-gray-500">This page is for team leads only.</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <PageHeader
        title="BATCH MANAGEMENT"
        subtitle="Manage training batches and coach assignments"
        actions={
          user?.role === 'team_lead' && (
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              size="md"
              className="flex items-center gap-2"
            >
              <Plus size={20} />
              Add New Batch
            </Button>
          )
        }
      />
      <div className="p-8 space-y-6">

        {/* Batches Table */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-600">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-xl">
            <p className="text-gray-600 mb-4">No batches created yet.</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              size="md"
            >
              Create Your First Batch
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-tofa-navy">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Center
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Age Category
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Coaches
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => {
                    const isUpdating = updatingBatchId === batch.id && updateBatchMutation.isPending;
                    return (
                    <tr 
                      key={batch.id} 
                      className={`hover:bg-gray-50 ${isUpdating ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {batch.name}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {getCenterName(batch.center_id)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {batch.age_category ? batch.age_category.split(',').map((cat: string) => cat.trim()).join(', ') : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 whitespace-normal">
                        {getScheduleDisplay(batch)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <label className={`relative inline-flex items-center ${user?.role === 'team_lead' ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            checked={batch.is_active === true}
                            onChange={async (e) => {
                              if (user?.role !== 'team_lead') return;
                              const newStatus = e.target.checked;
                              setUpdatingBatchId(batch.id);
                              try {
                                await updateBatchMutation.mutateAsync({
                                  batchId: batch.id,
                                  data: { is_active: newStatus },
                                });
                                toast.success(`Batch ${newStatus ? 'activated' : 'deactivated'} successfully!`);
                              } catch (err: any) {
                                const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to update batch status';
                                toast.error(`Failed to update batch: ${errorMessage}`);
                              } finally {
                                setUpdatingBatchId(null);
                              }
                            }}
                            className="sr-only peer"
                            disabled={isUpdating || user?.role !== 'team_lead'}
                            readOnly={user?.role !== 'team_lead'}
                          />
                          <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent ${user?.role !== 'team_lead' ? 'opacity-50' : ''}`}></div>
                          <span className="ml-3 text-sm font-medium text-gray-700">
                            {batch.is_active === true ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {batch.max_capacity}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {batch.start_time && batch.end_time
                          ? `${batch.start_time} - ${batch.end_time}`
                          : 'Not set'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {batch.coaches && batch.coaches.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {batch.coaches.map((coach) => (
                              <span
                                key={coach.id}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-brand-accent/20 text-brand-primary text-xs font-medium"
                              >
                                {coach.full_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No coaches assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {user?.role === 'team_lead' && (
                          <button
                            onClick={() => handleEditBatch(batch.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-brand-accent/20 text-brand-primary hover:bg-brand-accent/30 rounded-lg transition-colors text-sm font-medium"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Batch Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 font-sans">Create New Batch</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <div className="text-gray-500">
                    <X size={20} />
                  </div>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Name *
                  </label>
                  <input
                    type="text"
                    value={newBatch.name}
                    onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    placeholder="e.g., U9 Morning Batch"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Center *
                    </label>
                    <select
                      value={newBatch.center_id}
                      onChange={(e) => setNewBatch({ ...newBatch, center_id: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    >
                      <option value={0}>Select Center</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age Categories *
                  </label>
                  <div className="flex flex-wrap gap-2 border border-gray-300 rounded-lg p-3 min-h-[3rem]">
                    {ageCategoryOptions.map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgeCategories.includes(category)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgeCategories([...selectedAgeCategories, category]);
                            } else {
                              setSelectedAgeCategories(selectedAgeCategories.filter(cat => cat !== category));
                            }
                          }}
                          className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    ))}
                  </div>
                  {selectedAgeCategories.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Please select at least one age category</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    value={newBatch.max_capacity}
                    onChange={(e) => setNewBatch({ ...newBatch, max_capacity: parseInt(e.target.value) || 20 })}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={newBatch.start_date}
                    onChange={(e) => setNewBatch({ ...newBatch, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule (Days) *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'is_mon', label: 'Mon' },
                      { key: 'is_tue', label: 'Tue' },
                      { key: 'is_wed', label: 'Wed' },
                      { key: 'is_thu', label: 'Thu' },
                      { key: 'is_fri', label: 'Fri' },
                      { key: 'is_sat', label: 'Sat' },
                      { key: 'is_sun', label: 'Sun' },
                    ].map((day) => (
                      <label key={day.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(newBatch as any)[day.key]}
                          onChange={(e) =>
                            setNewBatch({ ...newBatch, [day.key]: e.target.checked })
                          }
                          className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={newBatch.start_time || ''}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, start_time: e.target.value || null })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={newBatch.end_time || ''}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, end_time: e.target.value || null })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Coaches <span className="text-red-500">*</span>
                  </label>
                  {coaches.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-2">
                      No coaches available. Create a coach account first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {coaches.map((coach) => (
                        <label
                          key={coach.id}
                          className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={newBatch.coach_ids?.includes(coach.id) || false}
                            onChange={(e) => {
                              const currentIds = newBatch.coach_ids || [];
                              if (e.target.checked) {
                                setNewBatch({ ...newBatch, coach_ids: [...currentIds, coach.id] });
                              } else {
                                setNewBatch({ ...newBatch, coach_ids: currentIds.filter(id => id !== coach.id) });
                              }
                            }}
                            className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                          />
                          <span className="text-sm">{coach.full_name || coach.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {newBatch.coach_ids && newBatch.coach_ids.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">At least one coach must be assigned</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBatch.is_active}
                      onChange={(e) => setNewBatch({ ...newBatch, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {newBatch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBatch}
                  disabled={createBatchMutation.isPending || !isFormValid}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {createBatchMutation.isPending ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Coach Modal */}
        {showAssignModal && selectedBatchId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 font-sans">Assign Coaches to Batch</h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBatchId(null);
                    setSelectedCoachIds([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <div className="text-gray-500">
                    <X size={20} />
                  </div>
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Coaches <span className="text-red-500">*</span>
                  </label>
                  {coaches.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-4">
                      No coaches found. Create a coach account first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {coaches.map((coach) => (
                        <label
                          key={coach.id}
                          className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCoachIds.includes(coach.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCoachIds([...selectedCoachIds, coach.id]);
                              } else {
                                setSelectedCoachIds(selectedCoachIds.filter(id => id !== coach.id));
                              }
                            }}
                            className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                          />
                          <span className="text-sm">{coach.full_name || coach.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedCoachIds.length === 0 && (
                    <p className="text-sm text-red-600 mt-2">At least one coach must be assigned</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBatchId(null);
                    setSelectedCoachIds([]);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignCoach}
                  disabled={assignCoachMutation.isPending || selectedCoachIds.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {assignCoachMutation.isPending ? 'Assigning...' : 'Assign Coaches'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Batch Modal */}
        {showEditModal && selectedBatchId && (() => {
          // Get live batch data from query cache
          const batch = batches.find(b => b.id === selectedBatchId);
          
          if (!batch) {
            return null;
          }
          
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 font-sans">Edit Batch</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedBatchId(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <div className="text-gray-500">
                    <X size={20} />
                  </div>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Name *
                  </label>
                  <input
                    type="text"
                    value={newBatch.name}
                    onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    placeholder="e.g., U9 Morning Batch"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Center *
                    </label>
                    <select
                      value={newBatch.center_id}
                      onChange={(e) => setNewBatch({ ...newBatch, center_id: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    >
                      <option value={0}>Select Center</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age Categories *
                  </label>
                  <div className="flex flex-wrap gap-2 border border-gray-300 rounded-lg p-3 min-h-[3rem]">
                    {ageCategoryOptions.map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgeCategories.includes(category)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgeCategories([...selectedAgeCategories, category]);
                            } else {
                              setSelectedAgeCategories(selectedAgeCategories.filter(cat => cat !== category));
                            }
                          }}
                          className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    ))}
                  </div>
                  {selectedAgeCategories.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Please select at least one age category</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    value={newBatch.max_capacity}
                    onChange={(e) => setNewBatch({ ...newBatch, max_capacity: parseInt(e.target.value) || 20 })}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={newBatch.start_date}
                    onChange={(e) => setNewBatch({ ...newBatch, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule (Days) *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'is_mon', label: 'Mon' },
                      { key: 'is_tue', label: 'Tue' },
                      { key: 'is_wed', label: 'Wed' },
                      { key: 'is_thu', label: 'Thu' },
                      { key: 'is_fri', label: 'Fri' },
                      { key: 'is_sat', label: 'Sat' },
                      { key: 'is_sun', label: 'Sun' },
                    ].map((day) => (
                      <label key={day.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(newBatch as any)[day.key]}
                          onChange={(e) =>
                            setNewBatch({ ...newBatch, [day.key]: e.target.checked })
                          }
                          className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={newBatch.start_time || ''}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, start_time: e.target.value || null })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={newBatch.end_time || ''}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, end_time: e.target.value || null })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Coaches <span className="text-red-500">*</span>
                  </label>
                  {coaches.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-2">
                      No coaches available. Create a coach account first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {coaches.map((coach) => (
                        <label
                          key={coach.id}
                          className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={newBatch.coach_ids?.includes(coach.id) || false}
                            onChange={(e) => {
                              const currentIds = newBatch.coach_ids || [];
                              if (e.target.checked) {
                                setNewBatch({ ...newBatch, coach_ids: [...currentIds, coach.id] });
                              } else {
                                setNewBatch({ ...newBatch, coach_ids: currentIds.filter(id => id !== coach.id) });
                              }
                            }}
                            className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                          />
                          <span className="text-sm">{coach.full_name || coach.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {newBatch.coach_ids && newBatch.coach_ids.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">At least one coach must be assigned</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBatch.is_active}
                      onChange={(e) => setNewBatch({ ...newBatch, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {newBatch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBatchId(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBatch}
                  disabled={updateBatchMutation.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {updateBatchMutation.isPending ? 'Updating...' : 'Update Batch'}
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedBatchId && (() => {
          const batch = batches.find(b => b.id === selectedBatchId);
          if (!batch) {
            setShowDeleteModal(false);
            setSelectedBatchId(null);
            return null;
          }
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 font-bebas">Delete Batch</h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedBatchId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <div className="text-gray-500">
                    <X size={20} />
                  </div>
                </button>
              </div>

              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete the batch <span className="font-semibold">"{batch.name}"</span>?
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  This action cannot be undone. Coach assignments will be removed, but leads associated with this batch will not be deleted.
                </p>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedBatchId(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteBatch}
                  disabled={deleteBatchMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteBatchMutation.isPending ? 'Deleting...' : 'Delete Batch'}
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </MainLayout>
  );
}

