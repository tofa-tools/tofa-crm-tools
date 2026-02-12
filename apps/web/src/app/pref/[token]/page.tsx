'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MapPin, Phone, Clock, Calendar } from 'lucide-react';
import { LOSS_REASONS } from '@tofa/core';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

interface Batch {
  id: number;
  name: string;
  schedule: string;
  time: string;
  max_capacity: number;
}

interface PreferencesData {
  player_name: string;
  center_name: string;
  preferences_submitted?: boolean;
  link_expired?: boolean;
  location_link?: string | null;
  center_head?: { name: string; phone?: string | null } | null;
  batches: Batch[];
  preferred_batch_id: number | null;
  preferred_call_time: string | null;
  preferred_timing_notes: string | null;
  status?: string;
  reschedule_count?: number;
}

export default function PreferencePage() {
  const params = useParams();
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
  const [submittedNotInterested, setSubmittedNotInterested] = useState(false);

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
    if (lossReason === 'Other' && showLossReason && !lossReasonNotes.trim()) {
      toast.error('Please provide details for "Other"');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/public/lead-preferences/${token}`, {
        preferred_batch_id: selectedBatchId || null,
        preferred_demo_batch_id: null,
        preferred_call_time: callTime || null,
        preferred_timing_notes: notes || null,
        loss_reason: showLossReason ? lossReason : null,
        loss_reason_notes: showLossReason && lossReasonNotes ? lossReasonNotes : null,
      });
      setSubmitted(true);
      if (showLossReason) setSubmittedNotInterested(true);
      toast.success(showLossReason ? 'Thank you for your feedback. We have noted your preference and will not contact you further.' : 'Preferences saved successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSubmitting(false);
    }
  };

  const lossReasonOptions = LOSS_REASONS;

  const canShowRescheduleOptions = data?.status === 'Trial Scheduled' || data?.status === 'Trial Attended';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
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

  if (data.link_expired) {
    const mapsUrl = data.location_link || '';
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center mb-4">
            <div className="text-6xl mb-4">⏱️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">This link has expired</h1>
            <p className="text-gray-600 mb-2">
              For your security and to ensure you see our latest schedule, please reach out to your Center Head for a fresh link.
            </p>
          </div>
          {(mapsUrl || data.center_head) && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3 text-center">Contact Center Head</p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-5 min-h-[44px] bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 rounded-xl font-semibold text-slate-800 text-sm shadow-sm border border-slate-200/60 transition-all active:scale-[0.98]"
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    Find us on Maps
                  </a>
                )}
                {data.center_head && (
                  <div className="flex flex-col sm:items-center">
                    <p className="text-xs text-gray-500 mb-0.5">👤 {data.center_head.name}</p>
                    {data.center_head.phone && (
                      <a
                        href={`tel:${data.center_head.phone.replace(/\D/g, '')}`}
                        className="inline-flex items-center justify-center gap-2 py-3 px-5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
                      >
                        <Phone className="h-4 w-4" />
                        Call for a fresh link
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const showThankYou = submitted || !!data.preferences_submitted;
  if (showThankYou) {
    const mapsUrl = data.location_link || '';
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${submittedNotInterested ? 'bg-gradient-to-br from-slate-50 to-gray-100' : 'bg-gradient-to-br from-green-50 to-emerald-100'}`}>
        <div className="max-w-xl w-full mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center mb-4">
            <div className="text-6xl mb-4">{submittedNotInterested ? '👋' : '✅'}</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{submittedNotInterested ? 'Noted' : 'Thank You!'}</h1>
            <p className="text-gray-600 mb-2">
              {submittedNotInterested ? (
                <>We have noted that you are no longer interested. Hope to see you again soon!</>
              ) : (
                <>We have received your preferences for <span className="font-semibold">{data.player_name}</span>! Our team will call you shortly.</>
              )}
            </p>
            {!submittedNotInterested && <p className="text-sm text-gray-500 mt-4">We look forward to meeting you on the field!</p>}
          </div>
          {(mapsUrl || data.center_head) && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-5 min-h-[44px] bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 rounded-xl font-semibold text-slate-800 text-sm shadow-sm border border-slate-200/60 transition-all active:scale-[0.98]"
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    Find us on Maps
                  </a>
                )}
                {data.center_head && (
                  <div className="sm:text-right">
                    <p className="text-xs text-gray-500 mb-0.5">👤 Center Head: <span className="font-semibold text-gray-800">{data.center_head.name}</span></p>
                    {data.center_head.phone && (
                      <a
                        href={`tel:${data.center_head.phone.replace(/\D/g, '')}`}
                        className="inline-block text-lg font-bold text-blue-600 hover:text-blue-700 hover:underline mt-0.5"
                      >
                        📞 {data.center_head.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const mapsUrl = data.location_link || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-3 px-3 sm:px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-2 text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-1">🚀 TOFA</h1>
          <p className="text-gray-600 text-sm">
            Hello! Help us schedule <span className="font-semibold">{data.player_name}</span>&apos;s trial session
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{data.center_name}</p>
        </div>

        {/* Center Info Card - Premium single card */}
        {(mapsUrl || data.center_head) && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-5 min-h-[44px] bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 rounded-xl font-semibold text-slate-800 text-sm shadow-sm border border-slate-200/60 transition-all active:scale-[0.98]"
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    Find us on Maps
                  </a>
                )}
              </div>
              {data.center_head && (
                <div className="flex-1 sm:text-right">
                  <p className="text-xs text-gray-500 mb-0.5">👤 Center Head: <span className="font-semibold text-gray-800">{data.center_head.name}</span></p>
                  {data.center_head.phone && (
                    <a
                      href={`tel:${data.center_head.phone.replace(/\D/g, '')}`}
                      className="inline-block text-lg font-bold text-blue-600 hover:text-blue-700 hover:underline mt-0.5"
                    >
                      📞 {data.center_head.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Select Your Preferred Batch *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {data.batches.length === 0 ? (
                <p className="text-gray-500 text-center py-6 text-sm">
                  No batches available at this center
                </p>
              ) : (
                data.batches.map((batch) => {
                  const isLastFew = batch.max_capacity <= 20;
                  return (
                    <label
                      key={batch.id}
                      className={`relative flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all min-h-[52px] ${
                        selectedBatchId === batch.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="batch"
                        value={batch.id}
                        checked={selectedBatchId === batch.id}
                        onChange={() => setSelectedBatchId(batch.id)}
                        className="mt-1 h-6 w-6 min-w-[24px] min-h-[24px] text-blue-600 focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="ml-3 flex-1 min-w-0 pr-16">
                        <span className="font-bold text-brand-primary text-sm leading-tight block">{batch.name}</span>
                        <p className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                          {batch.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {batch.time}
                            </span>
                          )}
                          {batch.time && batch.schedule && <span className="text-gray-300">|</span>}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {batch.schedule}
                          </span>
                        </p>
                      </div>
                      {isLastFew && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 rounded-full whitespace-nowrap">
                          🔥 Last few slots!
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label htmlFor="callTime" className="block text-sm font-medium text-gray-700 mb-1">
              Best time for us to call?
            </label>
            <select
              id="callTime"
              value={callTime}
              onChange={(e) => setCallTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            >
              <option value="">Select a time...</option>
              {callTimeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Any specific requirements or notes?
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedBatchId}
            className={`w-full py-3.5 px-4 rounded-lg font-semibold text-white transition-all min-h-[48px] ${
              submitting || !selectedBatchId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Preferences'}
          </button>
        </form>

        {/* Reschedule/Cancel (Trial Scheduled / Trial Attended only) */}
        {canShowRescheduleOptions && !showLossReason && (
          <div className="bg-white rounded-lg shadow-md p-4 mt-3">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Need to reschedule or cancel?</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors min-h-[44px]"
              >
                📅 Reschedule Trial
              </button>
              <button
                type="button"
                onClick={() => setShowLossReason(true)}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors min-h-[44px]"
              >
                ❌ I am no longer interested
              </button>
            </div>
          </div>
        )}

        {/* Pre-trial off-ramp: always show so parents can opt out before talking to anyone */}
        {!showLossReason && !canShowRescheduleOptions && (
          <div className="bg-white rounded-lg shadow-md p-4 mt-3 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Changed your mind?</p>
            <button
              type="button"
              onClick={() => setShowLossReason(true)}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 font-semibold rounded-lg transition-colors min-h-[44px] border border-gray-200"
            >
              I am no longer interested
            </button>
          </div>
        )}

        {/* Loss Reason Form */}
        {showLossReason && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mt-2">
            <h2 className="text-base font-semibold text-gray-900 mb-2">We&apos;re sorry to see you go</h2>
            <p className="text-sm text-gray-600 mb-3">Please let us know why. This helps us improve.</p>
            <div className="mb-3">
              <label htmlFor="lossReason" className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <select
                id="lossReason"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 min-h-[44px]"
              >
                <option value="">Select a reason...</option>
                {lossReasonOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            {lossReason === 'Other' && (
              <div className="mb-3">
                <label htmlFor="lossReasonNotes" className="block text-sm font-medium text-gray-700 mb-1">Details *</label>
                <textarea
                  id="lossReasonNotes"
                  value={lossReasonNotes}
                  onChange={(e) => setLossReasonNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Please tell us more..."
                  required
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLossReason(false);
                  setLossReason('');
                  setLossReasonNotes('');
                }}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !lossReason || (lossReason === 'Other' && !lossReasonNotes)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-white min-h-[44px] ${
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

        <div className="text-center mt-3 text-xs text-gray-500">
          {data.center_head ? (
            <p>
              Questions? Contact <span className="font-semibold text-gray-700">{data.center_head.name}</span>
              {data.center_head.phone ? (
                <> at{' '}
                  <a
                    href={`tel:${data.center_head.phone.replace(/\D/g, '')}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {data.center_head.phone}
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p>Questions? Contact us at your center</p>
          )}
        </div>
      </div>
    </div>
  );
}
