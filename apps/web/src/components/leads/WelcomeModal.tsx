'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Mail } from 'lucide-react';
import { studentsAPI } from '@/lib/api';
import { useBatches } from '@/hooks/useBatches';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  leadId: number;
  parentName?: string;
}

export function WelcomeModal({
  isOpen,
  onClose,
  playerName,
  leadId,
}: WelcomeModalProps) {
  const queryClient = useQueryClient();
  const [emailSent, setEmailSent] = useState(false);
  const { data: batchesData = [] } = useBatches();

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['studentByLead', leadId],
    queryFn: () => studentsAPI.getStudentByLeadId(leadId),
    enabled: isOpen && !!leadId,
  });

  const batchNames = useMemo(() => {
    if (!student?.student_batch_ids?.length) return '—';
    return student.student_batch_ids
      .map((id: number) => batchesData.find((b: any) => b.id === id)?.name)
      .filter(Boolean)
      .join(', ') || '—';
  }, [student?.student_batch_ids, batchesData]);

  const sendWelcomeMutation = useMutation({
    mutationFn: (studentId: number) => studentsAPI.sendWelcomeEmail(studentId),
    onSuccess: (data) => {
      toast.success(data?.to ? `Welcome email sent to ${data.to}!` : 'Welcome email sent!');
      setEmailSent(true);
      queryClient.invalidateQueries({ queryKey: ['studentByLead', leadId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to send email';
      toast.error(msg);
    },
  });

  const handleSendWelcomeEmail = () => {
    if (!student?.id) return;
    sendWelcomeMutation.mutate(student.id);
  };

  if (!isOpen) return null;

  const startDate = student?.created_at
    ? formatDate(student.created_at)
    : student?.subscription_start_date
      ? formatDate(student.subscription_start_date)
      : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            🎉 Congratulations!
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-6">
            Great job! <span className="font-semibold">{playerName}</span> has joined.
          </p>

          {loadingStudent ? (
            <p className="text-sm text-gray-500 mb-6">Loading enrollment details...</p>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Enrollment summary
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Batch:</span> {batchNames}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-medium">Start date:</span> {startDate}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSendWelcomeEmail}
              disabled={!student?.id || sendWelcomeMutation.isPending || emailSent}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="h-5 w-5" />
              {sendWelcomeMutation.isPending
                ? 'Sending…'
                : emailSent
                  ? 'Email sent'
                  : '📧 Send Welcome Email'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
