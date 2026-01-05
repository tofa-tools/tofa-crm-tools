'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { FileText, ArrowRight, X } from 'lucide-react';

export function PendingStudentReports() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'pending-student-reports'],
    queryFn: () => analyticsAPI.getPendingStudentReports(),
  });

  const pendingCount = data?.count || 0;
  const pendingStudents = data?.pending_students || [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (pendingCount === 0) {
    return null; // Don't show the card if there are no pending reports
  }

  return (
    <>
      <div 
        className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-green-500 rounded-full p-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Pending Student Reports
              </h3>
              <p className="text-gray-700 mt-1">
                {pendingCount} {pendingCount === 1 ? 'Student' : 'Students'} have new evaluations ready to be shared.
              </p>
            </div>
          </div>
          <ArrowRight className="h-6 w-6 text-green-600" />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Pending Student Reports
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {pendingStudents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No pending student reports
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingStudents.map((student) => (
                    <div
                      key={student.lead_id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {student.player_name}
                            </h3>
                            {student.batch_name && (
                              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                {student.batch_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Evaluation ready • {student.total_evaluations} evaluation{student.total_evaluations !== 1 ? 's' : ''} total
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowModal(false);
                            router.push(`/leads?status=Joined`);
                            // Navigate to the lead detail - the leads page will handle selection via URL or state
                          }}
                          className="ml-4 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          View & Send Report
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

