'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const LOSS_REASON_OPTIONS = [
  'Timing Mismatch',
  'Days Mismatch',
  'Duration too long',
  'Location/Distance',
  'Coaching Quality',
  'Price/Fees',
  'Kid lost interest',
  'Other',
];

interface FeedbackData {
  player_name: string;
  center_name: string;
}

export default function FeedbackPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [lossReason, setLossReason] = useState('');
  const [lossReasonNotes, setLossReasonNotes] = useState('');
  
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Feedback link is missing a token.');
      return;
    }
    
    // Fetch lead data to display player name
    const fetchLeadData = async () => {
      try {
        const response = await axios.get(`${API_URL}/public/lead-preferences/${token}`);
        setData({
          player_name: response.data.player_name,
          center_name: response.data.center_name,
        });
      } catch (err: any) {
        console.error('Error fetching lead data:', err);
        // Don't show error if token is invalid - just show the form
        setData({
          player_name: 'Player',
          center_name: 'TOFA Academy',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeadData();
  }, [token]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lossReason) {
      toast.error('Please select a reason');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await axios.put(
        `${API_URL}/public/lead-feedback/${token}`,
        {
          loss_reason: lossReason,
          loss_reason_notes: lossReasonNotes || null,
        }
      );
      
      toast.success(response.data.message);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      toast.error(err.response?.data?.detail || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }
  
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">Thank You!</h1>
            <p className="text-gray-700">
              Thank you for your feedback. We have removed you from our contact list.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              We&apos;ll miss you at TOFA!
            </h1>
            <p className="text-lg text-gray-600">
              Help us improve by telling us why you aren&apos;t joining today.
            </p>
          </div>
          
          {data && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{data.player_name}</span> at <span className="font-semibold">{data.center_name}</span>
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="lossReason" className="block text-sm font-semibold text-gray-700 mb-2">
                Reason for not joining <span className="text-red-500">*</span>
              </label>
              <select
                id="lossReason"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                required
              >
                <option value="">Select a reason...</option>
                {LOSS_REASON_OPTIONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            
            {lossReason === 'Other' && (
              <div>
                <label htmlFor="lossReasonNotes" className="block text-sm font-semibold text-gray-700 mb-2">
                  Please provide more details
                </label>
                <textarea
                  id="lossReasonNotes"
                  value={lossReasonNotes}
                  onChange={(e) => setLossReasonNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Tell us more about your reason..."
                />
              </div>
            )}
            
            {lossReason && lossReason !== 'Other' && (
              <div>
                <label htmlFor="lossReasonNotes" className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional comments (optional)
                </label>
                <textarea
                  id="lossReasonNotes"
                  value={lossReasonNotes}
                  onChange={(e) => setLossReasonNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Any additional feedback..."
                />
              </div>
            )}
            
            <button
              type="submit"
              disabled={submitting || !lossReason}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

