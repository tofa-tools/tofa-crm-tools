'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface Batch {
  id: number;
  name: string;
  age_category: string;
  schedule: string;
  time: string;
  max_capacity: number;
  is_different_age?: boolean;  // Flag if this is a nearest age batch, not exact match
}

interface PreferencesData {
  player_name: string;
  center_name: string;
  player_age_category?: string;
  batches: Batch[];
  demo_batches?: Batch[];
  preferred_batch_id: number | null;
  preferred_demo_batch_id?: number | null;
  preferred_call_time: string | null;
  preferred_timing_notes: string | null;
  status?: string;
  reschedule_count?: number;
}

export default function PreferencePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  
  const [data, setData] = useState<PreferencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [callTime, setCallTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showLossReason, setShowLossReason] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonNotes, setLossReasonNotes] = useState('');
  
  const callTimeOptions = [
    'Morning (9 AM - 12 PM)',
    'Afternoon (12 PM - 4 PM)',
    'Evening (4 PM - 7 PM)',
    'Evenings after 6 PM',
    'Anytime',
  ];
  
  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_URL}/public/lead-preferences/${token}`);
        setData(response.data);
        setSelectedBatchId(response.data.preferred_batch_id);
        setCallTime(response.data.preferred_call_time || '');
        setNotes(response.data.preferred_timing_notes || '');
      } catch (error: any) {
        toast.error(error.response?.data?.detail || 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBatchId && !showLossReason) {
      toast.error('Please select a batch');
      return;
    }
    
    if (showLossReason && !lossReason) {
      toast.error('Please select a reason');
      return;
    }
    
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/public/lead-preferences/${token}`, {
        preferred_batch_id: selectedBatchId || null,
        preferred_demo_batch_id: null, // Removed - no longer used
        preferred_call_time: callTime || null,
        preferred_timing_notes: notes || null,
        loss_reason: showLossReason ? lossReason : null,
        loss_reason_notes: showLossReason && lossReasonNotes ? lossReasonNotes : null,
      });
      
      setSubmitted(true);
      toast.success(showLossReason ? 'Thank you for your feedback!' : 'Preferences saved successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSubmitting(false);
    }
  };
  
  const lossReasonOptions = [
    'Timing Mismatch',
    'Days Mismatch',
    'Duration too long',
    'Location/Distance',
    'Coaching Quality',
    'Price/Fees',
    'Kid lost interest',
    'Other',
  ];
  
  const canShowRescheduleOptions = data?.status === 'Trial Scheduled' || data?.status === 'Trial Attended';
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Found</h1>
          <p className="text-gray-600">The preference link is invalid or has expired.</p>
        </div>
      </div>
    );
  }
  
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h1>
          <p className="text-gray-600 mb-2">
            Our team will call you during your preferred time to confirm your trial session.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            We look forward to meeting {data.player_name}!
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🚀 TOFA</h1>
          <p className="text-gray-600">
            Hello! Help us schedule <span className="font-semibold">{data.player_name}</span>'s trial session
          </p>
          <p className="text-sm text-gray-500 mt-1">{data.center_name}</p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Batch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Your Preferred Batch *
            </label>
            <div className="space-y-3">
              {data.batches.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No batches available for this age category</p>
              ) : (
                data.batches.map((batch) => {
                  // TODO: Replace with actual enrollment data when available
                  // For now, using a simple heuristic: show "Almost Full" for batches with small capacity
                  // This should be replaced with: (current_enrollment / max_capacity) >= 0.8
                  const isAlmostFull = batch.max_capacity <= 20; // Simple heuristic - replace with real data
                  
                  return (
                    <label
                      key={batch.id}
                      className={`flex items-start p-5 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedBatchId === batch.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <input
                        type="radio"
                        name="batch"
                        value={batch.id}
                        checked={selectedBatchId === batch.id}
                        onChange={() => setSelectedBatchId(batch.id)}
                        className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-lg text-gray-900">{batch.name}</div>
                          {isAlmostFull && (
                            <span className="px-2 py-1 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full">
                              ⚠️ Almost Full
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {batch.time && (
                            <div className="text-base font-semibold text-gray-800">
                              🕐 <span className="text-blue-600">{batch.time}</span>
                            </div>
                          )}
                          <div className="text-base font-semibold text-gray-800">
                            📅 <span className="text-indigo-600">{batch.schedule}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Age Category: {batch.age_category} • Max Capacity: {batch.max_capacity}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Call Time */}
          <div>
            <label htmlFor="callTime" className="block text-sm font-medium text-gray-700 mb-2">
              When is the best time for our team to call you to confirm?
            </label>
            <select
              id="callTime"
              value={callTime}
              onChange={(e) => setCallTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a time...</option>
              {callTimeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          
          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Any specific requirements or notes?
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="E.g., Prefer weekends, need morning slots, etc."
            />
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !selectedBatchId}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
              submitting || !selectedBatchId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Preferences'}
          </button>
        </form>
        
        {/* Reschedule/Cancel Buttons */}
        {canShowRescheduleOptions && !showLossReason && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4 mt-6">
            <h2 className="text-lg font-semibold text-gray-900">Need to reschedule or cancel?</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  // For reschedule, just show the batch selection form again
                  // The user can select a new batch
                }}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                📅 Reschedule Trial
              </button>
              <button
                type="button"
                onClick={() => setShowLossReason(true)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                ❌ I am no longer interested
              </button>
            </div>
          </div>
        )}

        {/* Loss Reason Form */}
        {showLossReason && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4 mt-6">
            <h2 className="text-lg font-semibold text-gray-900">We&apos;re sorry to see you go</h2>
            <p className="text-sm text-gray-600">Please let us know why you&apos;re no longer interested. This helps us improve.</p>
            
            <div>
              <label htmlFor="lossReason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason *
              </label>
              <select
                id="lossReason"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Select a reason...</option>
                {lossReasonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            
            {lossReason === 'Other' && (
              <div>
                <label htmlFor="lossReasonNotes" className="block text-sm font-medium text-gray-700 mb-2">
                  Please provide more details *
                </label>
                <textarea
                  id="lossReasonNotes"
                  value={lossReasonNotes}
                  onChange={(e) => setLossReasonNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Please tell us more..."
                  required
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLossReason(false);
                  setLossReason('');
                  setLossReasonNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !lossReason || (lossReason === 'Other' && !lossReasonNotes)}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white transition-all ${
                  submitting || !lossReason || (lossReason === 'Other' && !lossReasonNotes)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Questions? Contact us at your center</p>
        </div>
      </div>
    </div>
  );
}

