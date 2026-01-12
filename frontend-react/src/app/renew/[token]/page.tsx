'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const LOSS_REASON_OPTIONS = [
  'Timing Mismatch',
  'Price/Fees',
  'Location',
  'Kid lost interest',
  'Other',
];

interface StudentData {
  id: number;
  lead_player_name: string | null;
  subscription_end_date: string | null;
  lead_email: string | null;
  renewal_intent: boolean;
}

export default function RenewalPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoForm, setShowNoForm] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonNotes, setLossReasonNotes] = useState('');
  
  useEffect(() => {
    if (!token) {
      setError('Invalid renewal link');
      setLoading(false);
      return;
    }
    
    // Fetch student data
    axios.get(`${API_URL}/students/by-token/${token}`)
      .then(response => {
        setStudent(response.data);
        if (response.data.renewal_intent) {
          setSubmitted(true);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Invalid renewal link');
        setLoading(false);
      });
  }, [token]);
  
  const handleRenewal = async () => {
    if (!token) return;
    
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/students/renew/${token}`);
      setSubmitted(true);
      setStudent(prev => prev ? { ...prev, renewal_intent: true } : null);
      toast.success('Renewal intent recorded! Our team will follow up with you shortly.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit renewal intent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotRenewing = async () => {
    if (!token || !lossReason) {
      toast.error('Please select a reason');
      return;
    }
    
    setSubmitting(true);
    try {
      // Use the feedback endpoint to record loss reason and deactivate student
      await axios.put(`${API_URL}/public/lead-feedback/${token}`, {
        loss_reason: lossReason,
        loss_reason_notes: lossReasonNotes || null,
      });
      setSubmitted(true);
      const playerName = student?.lead_player_name || 'Your child';
      toast.success(`We have recorded your feedback and ${playerName} has been removed from the roster. We hope to see you again soon!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <p className="text-gray-600">No student data found</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {submitted ? (
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-900 mb-4">Thank You!</h1>
            <p className="text-lg text-gray-700 mb-2">
              {lossReason ? (
                <>
                  We have recorded your feedback and {student.lead_player_name || 'Your child'} has been removed from the roster. We hope to see you again soon!
                </>
              ) : (
                <>
                  Thank you for confirming your renewal intent!
                </>
              )}
            </p>
            <p className="text-sm text-gray-600">
              {lossReason ? (
                'We have removed you from our contact list.'
              ) : (
                'Our team will follow up with you shortly to complete the payment process.'
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🎾</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Hi {student.lead_email ? student.lead_email.split('@')[0] : 'Parent'},
              </h1>
              <p className="text-lg text-gray-700">
                <span className="font-semibold">{student.lead_player_name || 'Your child'}'s</span> subscription ends on{' '}
                <span className="font-bold text-green-700">
                  {formatDate(student.subscription_end_date)}
                </span>.
              </p>
              <p className="text-lg text-gray-700 mt-4 font-medium">
                Ready for the next term?
              </p>
            </div>
            
            {!showNoForm ? (
              <>
                <button
                  onClick={handleRenewal}
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      <span>Yes, I am renewing!</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowNoForm(true)}
                  disabled={submitting}
                  className="w-full py-3 mt-3 bg-gray-100 text-gray-700 font-semibold text-base rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  I am not renewing
                </button>
                
                <p className="text-xs text-gray-500 text-center mt-4">
                  By clicking "Yes, I am renewing!", you confirm your intent to renew the subscription.
                  Our team will contact you to complete the payment.
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="lossReason" className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason for not renewing <span className="text-red-500">*</span>
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
                
                {(lossReason === 'Other' || lossReason) && (
                  <div>
                    <label htmlFor="lossReasonNotes" className="block text-sm font-semibold text-gray-700 mb-2">
                      {lossReason === 'Other' ? 'Please provide more details' : 'Additional comments (optional)'}
                    </label>
                    <textarea
                      id="lossReasonNotes"
                      value={lossReasonNotes}
                      onChange={(e) => setLossReasonNotes(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder={lossReason === 'Other' ? 'Tell us more about your reason...' : 'Any additional feedback...'}
                    />
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={handleNotRenewing}
                    disabled={submitting || !lossReason}
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNoForm(false);
                      setLossReason('');
                      setLossReasonNotes('');
                    }}
                    disabled={submitting}
                    className="px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

