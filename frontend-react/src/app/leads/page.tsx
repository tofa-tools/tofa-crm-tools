'use client';

import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLeads, useUpdateLead } from '@/hooks/useLeads';
import { formatDate } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types';

export default function LeadsPage() {
  const { data: leads, isLoading } = useLeads();
  const updateLeadMutation = useUpdateLead();
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [updateStatus, setUpdateStatus] = useState<LeadStatus>('New');
  const [updateNextDate, setUpdateNextDate] = useState('');
  const [updateComment, setUpdateComment] = useState('');

  const leadsData = leads || [];

  // Initialize filters with all statuses
  const availableStatuses = useMemo(() => {
    const statuses = new Set<LeadStatus>(leadsData.map((lead) => lead.status));
    return Array.from(statuses);
  }, [leadsData]);

  // Initialize statusFilter on first load
  useMemo(() => {
    if (statusFilter.length === 0 && availableStatuses.length > 0) {
      setStatusFilter(availableStatuses);
    }
  }, [availableStatuses, statusFilter.length]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    let filtered = leadsData;

    if (statusFilter.length > 0) {
      filtered = filtered.filter((lead) => statusFilter.includes(lead.status));
    }

    if (searchTerm) {
      filtered = filtered.filter((lead) =>
        lead.player_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [leadsData, statusFilter, searchTerm]);

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      await updateLeadMutation.mutateAsync({
        leadId: selectedLead.id,
        update: {
          status: updateStatus,
          next_date: updateNextDate || null,
          comment: updateComment || null,
        },
      });
      // Reset form
      setSelectedLead(null);
      setUpdateStatus('New');
      setUpdateNextDate('');
      setUpdateComment('');
      alert('✅ Lead updated successfully!');
    } catch (error) {
      alert('❌ Failed to update lead');
    }
  };

  const handleStatusFilterChange = (status: LeadStatus, checked: boolean) => {
    if (checked) {
      setStatusFilter([...statusFilter, status]);
    } else {
      setStatusFilter(statusFilter.filter((s) => s !== status));
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">👥 Lead Management</h1>
          <p className="text-gray-600 mt-2">View and manage your leads</p>
        </div>

        {leadsData.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            📭 No leads found.
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Filter by Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableStatuses.map((status) => (
                      <label
                        key={status}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={statusFilter.includes(status)}
                          onChange={(e) =>
                            handleStatusFilterChange(status, e.target.checked)
                          }
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <StatusBadge status={status} />
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔎 Search by Name
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Leads Table */}
            {filteredLeads.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Player Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Next Follow-up
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Age Category
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {lead.player_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.phone}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={lead.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(lead.next_followup_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lead.player_age_category}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
                No leads match your filters.
              </div>
            )}

            {/* Update Lead Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                ✏️ Update Lead
              </h2>

              {selectedLead ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">👤 Name</p>
                      <p className="font-medium text-gray-900">
                        {selectedLead.player_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">📞 Phone</p>
                      <p className="font-medium text-gray-900">
                        {selectedLead.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">🏢 Center ID</p>
                      <p className="font-medium text-gray-900">
                        {selectedLead.center_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">📅 Age Category</p>
                      <p className="font-medium text-gray-900">
                        {selectedLead.player_age_category || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Status *
                      </label>
                      <select
                        value={updateStatus}
                        onChange={(e) =>
                          setUpdateStatus(e.target.value as LeadStatus)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      >
                        <option value="New">New</option>
                        <option value="Called">Called</option>
                        <option value="Trial Scheduled">Trial Scheduled</option>
                        <option value="Joined">Joined</option>
                        <option value="Dead/Not Interested">
                          Dead/Not Interested
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Follow Up Date
                      </label>
                      <input
                        type="date"
                        value={updateNextDate}
                        onChange={(e) => setUpdateNextDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📝 Add Call Notes
                    </label>
                    <textarea
                      value={updateComment}
                      onChange={(e) => setUpdateComment(e.target.value)}
                      placeholder="Enter notes from your call..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <button
                    onClick={handleUpdateLead}
                    disabled={updateLeadMutation.isPending}
                    className="w-full bg-gradient-primary text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {updateLeadMutation.isPending
                      ? 'Updating...'
                      : '💾 Update Status'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a lead from the table above to update
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}


