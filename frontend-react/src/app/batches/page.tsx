'use client';

import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useBatches, useCreateBatch, useAssignCoachToBatch, useUpdateBatch, useDeleteBatch } from '@/hooks/useBatches';
import { useUsers } from '@/hooks/useUsers';
import { useCenters } from '@/hooks/useCenters';
import { X, Plus, UserPlus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { BatchCreate } from '@/types';
import { formatDate } from '@/lib/utils';

export default function BatchesPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  
  const { data: batchesData, isLoading } = useBatches();
  const { data: usersData } = useUsers();
  const { data: centersData } = useCenters();
  const createBatchMutation = useCreateBatch();
  const assignCoachMutation = useAssignCoachToBatch();
  const updateBatchMutation = useUpdateBatch();
  const deleteBatchMutation = useDeleteBatch();
  
  const batches = batchesData || [];
  const centers = centersData || [];
  const users = usersData || [];
  const coaches = users.filter(u => u.role === 'coach');
  
  // Form state for creating batch
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
  
  // Form state for assigning coaches
  const [selectedCoachIds, setSelectedCoachIds] = useState<number[]>([]);
  
  // Validation helpers
  const hasScheduleDays = newBatch.is_mon || newBatch.is_tue || newBatch.is_wed || newBatch.is_thu || newBatch.is_fri || newBatch.is_sat || newBatch.is_sun;
  const isFormValid = hasScheduleDays;

  const handleCreateBatch = async () => {
    if (!newBatch.name || !newBatch.center_id || !newBatch.age_category || !newBatch.start_date) {
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
      await createBatchMutation.mutateAsync(newBatch);
      setShowCreateModal(false);
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

  const handleEditBatch = (batch: any) => {
    setSelectedBatch(batch);
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
      coach_ids: batch.coaches?.map((c: any) => c.id) || [],
    });
    setShowEditModal(true);
  };

  const handleUpdateBatch = async () => {
    if (!selectedBatch || !newBatch.name || !newBatch.center_id || !newBatch.age_category) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!newBatch.coach_ids || newBatch.coach_ids.length === 0) {
      toast.error('At least one coach must be assigned to the batch');
      return;
    }
    
    try {
      await updateBatchMutation.mutateAsync({
        batchId: selectedBatch.id,
        data: newBatch,
      });
      setShowEditModal(false);
      setSelectedBatch(null);
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
      setSelectedBatch(null);
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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📅 Batch Management</h1>
            <p className="text-gray-600 mt-2">Manage training batches and coach assignments</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-md"
          >
            <Plus className="h-5 w-5" />
            Add New Batch
          </button>
        </div>

        {/* Batches Table */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-600">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-600 mb-4">No batches created yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
            >
              Create Your First Batch
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Center
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coaches
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {batch.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getCenterName(batch.center_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.age_category}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {getScheduleDisplay(batch)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {batch.start_date ? `Started: ${formatDate(batch.start_date)}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {batch.is_active !== false ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.max_capacity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.start_time && batch.end_time
                          ? `${batch.start_time} - ${batch.end_time}`
                          : 'Not set'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {batch.coaches && batch.coaches.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {batch.coaches.map((coach) => (
                              <span
                                key={coach.id}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                              >
                                {coach.full_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No coaches assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditBatch(batch)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-sm font-medium"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBatchId(batch.id);
                              setSelectedBatch(batch);
                              setShowDeleteModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors text-sm font-medium"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBatchId(batch.id);
                              setSelectedCoachIds(batch.coaches?.map(c => c.id) || []);
                              setShowAssignModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg transition-colors text-sm font-medium"
                          >
                            <UserPlus className="h-4 w-4" />
                            Assign
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

        {/* Create Batch Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Create New Batch</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value={0}>Select Center</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age Category *
                    </label>
                    <select
                      value={newBatch.age_category}
                      onChange={(e) => setNewBatch({ ...newBatch, age_category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select Age Category</option>
                      <option value="U7">U7</option>
                      <option value="U9">U9</option>
                      <option value="U11">U11</option>
                      <option value="U13">U13</option>
                      <option value="U15">U15</option>
                      <option value="U17">U17</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBatch.is_active}
                      onChange={(e) => setNewBatch({ ...newBatch, is_active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="block text-sm font-medium text-gray-700">
                      Active Status (Uncheck to make batch inactive)
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Assign Coaches to Batch</h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBatchId(null);
                    setSelectedCoachIds([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
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
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assignCoachMutation.isPending ? 'Assigning...' : 'Assign Coaches'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Batch Modal */}
        {showEditModal && selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Edit Batch</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBatch(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value={0}>Select Center</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age Category *
                    </label>
                    <select
                      value={newBatch.age_category}
                      onChange={(e) => setNewBatch({ ...newBatch, age_category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select Age Category</option>
                      <option value="U7">U7</option>
                      <option value="U9">U9</option>
                      <option value="U11">U11</option>
                      <option value="U13">U13</option>
                      <option value="U15">U15</option>
                      <option value="U17">U17</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
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
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBatch.is_active}
                      onChange={(e) => setNewBatch({ ...newBatch, is_active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="block text-sm font-medium text-gray-700">
                      Active Status (Uncheck to make batch inactive)
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBatch(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBatch}
                  disabled={updateBatchMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateBatchMutation.isPending ? 'Updating...' : 'Update Batch'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedBatchId && selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Delete Batch</h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedBatchId(null);
                    setSelectedBatch(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete the batch <span className="font-semibold">"{selectedBatch.name}"</span>?
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
                    setSelectedBatch(null);
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
        )}
      </div>
    </MainLayout>
  );
}

