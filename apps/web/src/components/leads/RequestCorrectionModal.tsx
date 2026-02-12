'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Lead } from '@tofa/core';
import { getPreviousStatus, canRevertStatus, calculateAge, filterBatchesByCenter } from '@tofa/core';
import { approvalsAPI } from '@/lib/api';
import { useCenters } from '@/hooks/useCenters';
import { useBatches } from '@/hooks/useBatches';
import { SUBSCRIPTION_PLANS } from '@tofa/core';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  studentRecord: { id: number; center_id: number; lead_id: number } | null;
  userRole: string;
  onSuccess?: () => void;
}

type RequestType =
  | 'STATUS_REVERSAL'
  | 'DATE_OF_BIRTH'
  | 'CENTER_TRANSFER'
  | 'DEACTIVATE'
  | 'BATCH_UPDATE'
  | 'SUBSCRIPTION_UPDATE'
  | null;

export function RequestCorrectionModal({
  isOpen,
  onClose,
  lead,
  studentRecord,
  userRole,
  onSuccess,
}: RequestCorrectionModalProps) {
  const [selectedType, setSelectedType] = useState<RequestType>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestedDateOfBirth, setRequestedDateOfBirth] = useState('');
  const [requestedCenterId, setRequestedCenterId] = useState<number | null>(null);
  const [requestedBatchIds, setRequestedBatchIds] = useState<number[]>([]);
  const [requestedPlan, setRequestedPlan] = useState('');
  const [requestedStartDate, setRequestedStartDate] = useState('');

  const { data: centers = [] } = useCenters();
  const { data: batchesData = [] } = useBatches();

  if (!isOpen || userRole === 'team_lead') return null;

  const isStudent = lead?.status === 'Joined' && !!studentRecord;
  const currentAge = lead?.date_of_birth ? calculateAge(lead.date_of_birth) : null;
  const currentStatus = lead?.status || '';
  const canRevert = currentStatus && canRevertStatus(currentStatus);
  const previousStatus = canRevert ? getPreviousStatus(currentStatus) : null;

  // For students: show DOB, Transfer Center, Update Batches, Update Subscription, Deactivate. Hide Revert Status.
  const showStatusOption = !isStudent && !!previousStatus;
  const showAgeOption = lead != null;
  const showTransferOption = !!studentRecord && studentRecord.center_id;
  const showDeactivateOption = !!studentRecord;
  const centerId = studentRecord?.center_id ?? lead?.center_id ?? 0;
  const activeBatchesInCenter = centerId ? filterBatchesByCenter(batchesData, centerId) : [];
  const showBatchUpdateOption = isStudent && activeBatchesInCenter.length > 0;
  const showSubscriptionUpdateOption = !!isStudent;

  const options: { value: RequestType; label: string }[] = [];
  if (showStatusOption) options.push({ value: 'STATUS_REVERSAL', label: 'Revert Status' });
  if (showAgeOption) options.push({ value: 'DATE_OF_BIRTH', label: 'Change Date of Birth' });
  if (showTransferOption) options.push({ value: 'CENTER_TRANSFER', label: 'Transfer Center' });
  if (showBatchUpdateOption) options.push({ value: 'BATCH_UPDATE', label: 'Update Assigned Batches' });
  if (showSubscriptionUpdateOption) options.push({ value: 'SUBSCRIPTION_UPDATE', label: 'Update Subscription' });
  if (showDeactivateOption) options.push({ value: 'DEACTIVATE', label: 'Deactivate Student' });

  if (options.length === 0) return null;

  const toggleBatch = (batchId: number) => {
    setRequestedBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    );
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    if (!selectedType) {
      toast.error('Please select what you need');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedType === 'STATUS_REVERSAL' && lead && previousStatus) {
        await approvalsAPI.createApprovalRequest({
          request_type: 'STATUS_REVERSAL',
          lead_id: lead.id,
          reason: reason.trim(),
          current_value: currentStatus,
          requested_value: previousStatus,
        });
      } else if (selectedType === 'DATE_OF_BIRTH' && lead && requestedDateOfBirth.trim()) {
        await approvalsAPI.createApprovalRequest({
          request_type: 'DATE_OF_BIRTH',
          lead_id: lead.id,
          reason: reason.trim(),
          current_value: lead.date_of_birth || '',
          requested_value: requestedDateOfBirth,
        });
      } else if (selectedType === 'CENTER_TRANSFER' && studentRecord && requestedCenterId) {
        await approvalsAPI.createApprovalRequest({
          request_type: 'CENTER_TRANSFER',
          student_id: studentRecord.id,
          reason: reason.trim(),
          current_value: String(studentRecord.center_id),
          requested_value: String(requestedCenterId),
        });
      } else if (selectedType === 'DEACTIVATE' && studentRecord) {
        await approvalsAPI.createApprovalRequest({
          request_type: 'DEACTIVATE',
          student_id: studentRecord.id,
          reason: reason.trim(),
          current_value: 'Active',
          requested_value: 'Deactivated',
        });
      } else if (selectedType === 'BATCH_UPDATE' && studentRecord && requestedBatchIds.length > 0) {
        await approvalsAPI.createApprovalRequest({
          request_type: 'BATCH_UPDATE',
          student_id: studentRecord.id,
          reason: reason.trim(),
          current_value: '',
          requested_value: requestedBatchIds.join(','),
        });
      } else if (selectedType === 'SUBSCRIPTION_UPDATE' && studentRecord && requestedPlan && requestedStartDate) {
        await approvalsAPI.createApprovalRequest({
          request_type: 'SUBSCRIPTION_UPDATE',
          student_id: studentRecord.id,
          reason: reason.trim(),
          current_value: '',
          requested_value: `${requestedPlan}|${requestedStartDate}`,
        });
      } else {
        toast.error('Missing data for this request type');
        setIsSubmitting(false);
        return;
      }
      toast.success('Request submitted. Team lead will review.');
      onSuccess?.();
      onClose();
      setSelectedType(null);
      setReason('');
      setRequestedBatchIds([]);
      setRequestedPlan('');
      setRequestedStartDate('');
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to submit';
      toast.error(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !!reason.trim() &&
    !!selectedType &&
    (selectedType !== 'DATE_OF_BIRTH' || !!requestedDateOfBirth) &&
    (selectedType !== 'CENTER_TRANSFER' || !!requestedCenterId) &&
    (selectedType !== 'BATCH_UPDATE' || requestedBatchIds.length > 0) &&
    (selectedType !== 'SUBSCRIPTION_UPDATE' || (!!requestedPlan && !!requestedStartDate));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">🛠️ Request Data Correction</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">Select what you need and what the correct info should be.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">What needs correction?</label>
            <Select
              value={selectedType || ''}
              onChange={(e) => setSelectedType((e.target.value || null) as RequestType)}
            >
              <option value="">Select...</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {selectedType === 'DATE_OF_BIRTH' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Correct date of birth</label>
              <input
                type="date"
                value={requestedDateOfBirth}
                onChange={(e) => setRequestedDateOfBirth(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl"
              />
              {currentAge != null && <p className="text-xs text-gray-500 mt-1">Current age: {currentAge}</p>}
            </div>
          )}

          {selectedType === 'CENTER_TRANSFER' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Correct center</label>
              <Select
                value={requestedCenterId ?? ''}
                onChange={(e) => setRequestedCenterId(e.target.value ? parseInt(e.target.value, 10) : null)}
              >
                <option value="">Select center...</option>
                {centers.map((c: { id: number; display_name: string }) => (
                  <option key={c.id} value={c.id} disabled={c.id === studentRecord?.center_id}>
                    {c.display_name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {selectedType === 'BATCH_UPDATE' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned batches (multi-select)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                {activeBatchesInCenter.map((batch: { id: number; name: string }) => (
                  <label key={batch.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestedBatchIds.includes(batch.id)}
                      onChange={() => toggleBatch(batch.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-900">{batch.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedType === 'SUBSCRIPTION_UPDATE' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Requested plan</label>
                <Select value={requestedPlan} onChange={(e) => setRequestedPlan(e.target.value)}>
                  <option value="">Select plan...</option>
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Requested start date</label>
                <input
                  type="date"
                  value={requestedStartDate}
                  onChange={(e) => setRequestedStartDate(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain what went wrong..."
              className="w-full p-3 border border-gray-200 rounded-xl min-h-[80px]"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !canSubmit} className="flex-1">
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
