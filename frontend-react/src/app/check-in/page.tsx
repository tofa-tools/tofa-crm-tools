'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useCoachBatches } from '@/hooks/useBatches';
import { useRecordAttendance } from '@/hooks/useAttendance';
import { useLeads } from '@/hooks/useLeads';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ArrowLeft, CheckCircle2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { SkillRatingForm } from '@/components/coach/SkillRatingForm';

export default function CheckInPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  // Get batchId from URL parameter
  const urlBatchId = searchParams.get('batchId');
  
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadForRating, setSelectedLeadForRating] = useState<{ id: number; name: string } | null>(null);
  
  // Fetch coach's batches
  const { data: coachBatchesData, isLoading: batchesLoading } = useCoachBatches();
  const coachBatches = coachBatchesData?.batches || [];
  
  // Auto-select batch from URL parameter
  useEffect(() => {
    if (urlBatchId && !selectedBatchId) {
      const batchId = parseInt(urlBatchId, 10);
      if (!isNaN(batchId) && coachBatches.some(b => b.id === batchId)) {
        setSelectedBatchId(batchId);
      }
    }
  }, [urlBatchId, selectedBatchId, coachBatches]);
  
  // Fetch all leads (coaches only see their batch leads via backend filtering)
  const { data: leadsResponse, isLoading: leadsLoading } = useLeads({
    limit: 1000, // Large limit for check-in
  });
  
  const allLeads = leadsResponse?.leads || [];
  
  // Filter leads for selected batch
  const batchLeads = useMemo(() => {
    if (!selectedBatchId) return [];
    
    return allLeads.filter(
      lead => lead.trial_batch_id === selectedBatchId || lead.permanent_batch_id === selectedBatchId
    );
  }, [allLeads, selectedBatchId]);
  
  // Filter by search term
  const filteredLeads = useMemo(() => {
    if (!searchTerm) return batchLeads;
    
    const searchLower = searchTerm.toLowerCase();
    return batchLeads.filter(lead =>
      lead.player_name.toLowerCase().includes(searchLower)
    );
  }, [batchLeads, searchTerm]);
  
  // Track attendance state for each lead
  const [attendanceStatus, setAttendanceStatus] = useState<Record<number, 'Present' | 'Absent' | null>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  
  // Calculate attendance summary
  const attendanceSummary = useMemo(() => {
    const total = filteredLeads.length;
    const marked = Object.values(attendanceStatus).filter(s => s !== null).length;
    return {
      total,
      marked,
      remaining: total - marked,
    };
  }, [filteredLeads, attendanceStatus]);
  
  // Check if all students have attendance marked
  const allMarked = filteredLeads.length > 0 && attendanceSummary.marked === filteredLeads.length;
  
  const recordAttendanceMutation = useRecordAttendance();
  
  const handleAttendanceClick = async (
    leadId: number,
    batchId: number,
    status: 'Present' | 'Absent'
  ) => {
    if (!selectedBatchId) {
      toast.error('Please select a batch first');
      return;
    }
    
    // Update local state immediately for better UX
    setAttendanceStatus(prev => ({ ...prev, [leadId]: status }));
    
    try {
      await recordAttendanceMutation.mutateAsync({
        lead_id: leadId,
        batch_id: batchId,
        status,
      });
      // Success toast is handled in the hook
    } catch (error) {
      // Revert state on error
      setAttendanceStatus(prev => ({ ...prev, [leadId]: null }));
      // Error toast is handled in the hook
      console.error('Error recording attendance:', error);
    }
  };
  
  const handleCompleteSession = async () => {
    if (!selectedBatchId) {
      toast.error('Please select a batch first');
      return;
    }
    
    if (!allMarked) {
      toast.error('Please mark attendance for all students before checking out');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // All attendance is already recorded (we record on each button click)
      // Just show success screen
      setShowSuccessScreen(true);
      
      // Invalidate command center analytics to refresh metrics
      queryClient.invalidateQueries({ queryKey: ['analytics', 'command-center'] });
    } catch (error) {
      toast.error('Error completing session');
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleBackToCommandCenter = () => {
    router.push('/command-center');
  };
  
  const handleNewSession = () => {
    setAttendanceStatus({});
    setShowSuccessScreen(false);
    setSelectedBatchId(null);
    router.push('/check-in');
  };
  
  if (!user || user.role !== 'coach') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">Access Restricted</p>
            <p className="text-sm text-gray-500">This page is for coaches only.</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  const selectedBatch = coachBatches.find(b => b.id === selectedBatchId);
  
  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        {/* Back Button */}
        <button
          onClick={handleBackToCommandCenter}
          className="mb-6 flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors group"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-base font-medium">Back to Command Center</span>
        </button>
        
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">✅ Check-In</h1>
          <p className="text-gray-600">Mark attendance for your batch</p>
        </header>

        {/* Batch Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Batch
          </label>
          <select
            value={selectedBatchId || ''}
            onChange={(e) => {
              const newBatchId = e.target.value ? parseInt(e.target.value, 10) : null;
              setSelectedBatchId(newBatchId);
              // Update URL without reload
              if (newBatchId) {
                router.push(`/check-in?batchId=${newBatchId}`, { scroll: false });
              } else {
                router.push('/check-in', { scroll: false });
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base bg-white"
            disabled={batchesLoading}
          >
            <option value="">Choose a batch...</option>
            {coachBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.age_category})
              </option>
            ))}
          </select>
        </div>

        {selectedBatchId && selectedBatch && (
          <>
            {/* Selection Summary */}
            <div className="mb-6 bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedBatch.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedBatch.age_category} • {selectedBatch.start_time ? new Date(`2000-01-01T${selectedBatch.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Time TBD'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{attendanceSummary.total}</div>
                  <div className="text-sm text-gray-600">Students</div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search player name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
              />
            </div>

            {/* Attendance List */}
            {leadsLoading ? (
              <div className="text-center py-8 text-gray-600">Loading students...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                {searchTerm ? 'No students found matching your search.' : 'No students assigned to this batch.'}
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white rounded-lg shadow-md p-5 border border-gray-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <h2 className="text-xl font-semibold text-gray-900 mb-1">
                            {lead.player_name}
                          </h2>
                          <p className="text-gray-600 text-sm">
                            Age: {lead.player_age_category}
                          </p>
                        </div>
                        
                        {/* Attendance Buttons */}
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <button
                              onClick={() =>
                                handleAttendanceClick(
                                  lead.id,
                                  selectedBatchId,
                                  'Present'
                                )
                              }
                              disabled={recordAttendanceMutation.isPending || attendanceStatus[lead.id] === 'Present'}
                              className={`flex-1 px-6 py-3 font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base ${
                                attendanceStatus[lead.id] === 'Present'
                                  ? 'bg-green-700 text-white'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              ✅ Present
                            </button>
                            <button
                              onClick={() =>
                                handleAttendanceClick(
                                  lead.id,
                                  selectedBatchId,
                                  'Absent'
                                )
                              }
                              disabled={recordAttendanceMutation.isPending || attendanceStatus[lead.id] === 'Absent'}
                              className={`flex-1 px-6 py-3 font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base ${
                                attendanceStatus[lead.id] === 'Absent'
                                  ? 'bg-red-700 text-white'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              ❌ Absent
                            </button>
                          </div>
                          {/* Rate Performance Button - Only show if attendance is marked */}
                          {attendanceStatus[lead.id] && (
                            <button
                              onClick={() => setSelectedLeadForRating({ id: lead.id, name: lead.player_name })}
                              className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                            >
                              <Star className="h-4 w-4" />
                              Rate Performance
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Complete Session Button */}
                <div className="sticky bottom-0 bg-gray-100 pt-4 pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 border-t border-gray-200">
                  <div className="mb-3 text-sm text-gray-600 text-center">
                    {attendanceSummary.remaining > 0 ? (
                      <span className="text-orange-600 font-medium">
                        {attendanceSummary.remaining} student{attendanceSummary.remaining !== 1 ? 's' : ''} remaining
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium">✓ All students marked</span>
                    )}
                  </div>
                  <button
                    onClick={handleCompleteSession}
                    disabled={!allMarked || isSubmitting}
                    className="w-full px-6 py-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {isSubmitting ? 'Submitting...' : 'Submit & Check-out'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {!selectedBatchId && !batchesLoading && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Select a batch to mark attendance</p>
            {coachBatches.length === 0 && (
              <p className="text-sm">You don't have any batches assigned yet.</p>
            )}
          </div>
        )}

        {/* Success Screen */}
        {showSuccessScreen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Session Complete!</h2>
              <p className="text-gray-600 mb-6">
                Great work, Coach! Attendance has been recorded for all {attendanceSummary.total} students.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleBackToCommandCenter}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back to Command Center
                </button>
                <button
                  onClick={handleNewSession}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  New Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
