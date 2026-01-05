'use client';

import { useState } from 'react';
import { useBulkUpdateStatus, useBulkAssignCenter } from '@/hooks/useBulkActions';
import { useCenters } from '@/hooks/useCenters';
import { useAuth } from '@/context/AuthContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import type { LeadStatus } from '@/types';

interface BulkActionsToolbarProps {
  selectedLeadIds: number[] | Set<number>;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({ selectedLeadIds, onClearSelection }: BulkActionsToolbarProps) {
  const { user } = useAuth();
  const { data: centers = [] } = useCenters();
  const bulkUpdateStatusMutation = useBulkUpdateStatus();
  const bulkAssignCenterMutation = useBulkAssignCenter();
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCenterMenu, setShowCenterMenu] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('New');
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showCenterConfirm, setShowCenterConfirm] = useState(false);

  const isTeamLead = user?.role === 'team_lead';
  const leadIdsArray = Array.isArray(selectedLeadIds) ? selectedLeadIds : Array.from(selectedLeadIds);
  const hasSelection = leadIdsArray.length > 0;

  const handleBulkStatusUpdate = async () => {
    if (!hasSelection) return;
    
    await bulkUpdateStatusMutation.mutateAsync({
      leadIds: leadIdsArray,
      newStatus: selectedStatus,
    });
    onClearSelection();
    setShowStatusMenu(false);
    setShowStatusConfirm(false);
  };

  const handleBulkCenterAssign = async () => {
    if (!hasSelection || !selectedCenterId) return;
    
    await bulkAssignCenterMutation.mutateAsync({
      leadIds: leadIdsArray,
      centerId: selectedCenterId,
    });
    onClearSelection();
    setShowCenterMenu(false);
    setShowCenterConfirm(false);
  };

  const handleStatusUpdateClick = () => {
    setShowStatusConfirm(true);
    setShowStatusMenu(false);
  };

  const handleCenterAssignClick = () => {
    setShowCenterConfirm(true);
    setShowCenterMenu(false);
  };

  const selectedCenter = centers.find(c => c.id === selectedCenterId);

  if (!hasSelection) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-indigo-900">
            {leadIdsArray.length} lead(s) selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-sm text-indigo-600 hover:text-indigo-800 underline"
          >
            Clear selection
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk Status Update */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStatusMenu(!showStatusMenu);
                setShowCenterMenu(false);
              }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Change Status →
            </button>
            
            {showStatusMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as LeadStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                  >
                    <option value="New">New</option>
                    <option value="Called">Called</option>
                    <option value="Trial Scheduled">Trial Scheduled</option>
                    <option value="Joined">Joined</option>
                    <option value="Dead/Not Interested">Dead/Not Interested</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleStatusUpdateClick}
                      disabled={bulkUpdateStatusMutation.isPending}
                      className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => setShowStatusMenu(false)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bulk Center Assignment (Team Leads Only) */}
          {isTeamLead && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowCenterMenu(!showCenterMenu);
                  setShowStatusMenu(false);
                }}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Assign Center →
              </button>
              
              {showCenterMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <select
                      value={selectedCenterId || ''}
                      onChange={(e) => setSelectedCenterId(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                    >
                      <option value="">Select center...</option>
                      {centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.display_name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCenterAssignClick}
                        disabled={bulkAssignCenterMutation.isPending || !selectedCenterId}
                        className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => setShowCenterMenu(false)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Close menus when clicking outside */}
      {(showStatusMenu || showCenterMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowStatusMenu(false);
            setShowCenterMenu(false);
          }}
        />
      )}

      {/* Status Update Confirmation Modal */}
      <ConfirmationModal
        isOpen={showStatusConfirm}
        onClose={() => setShowStatusConfirm(false)}
        onConfirm={handleBulkStatusUpdate}
        title="Confirm Bulk Status Update"
        message={`Update ${leadIdsArray.length} lead(s) to status "${selectedStatus}"?`}
        confirmText="Update Status"
        cancelText="Cancel"
        isLoading={bulkUpdateStatusMutation.isPending}
      />

      {/* Center Assignment Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCenterConfirm}
        onClose={() => setShowCenterConfirm(false)}
        onConfirm={handleBulkCenterAssign}
        title="Confirm Bulk Center Assignment"
        message={`Assign ${leadIdsArray.length} lead(s) to "${selectedCenter?.display_name || 'selected center'}"?`}
        confirmText="Assign Center"
        cancelText="Cancel"
        isLoading={bulkAssignCenterMutation.isPending}
      />
    </div>
  );
}

