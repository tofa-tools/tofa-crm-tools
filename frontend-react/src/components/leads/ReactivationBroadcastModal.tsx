'use client';

import { useState, useEffect } from 'react';
import { X, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import type { Lead } from '@/types';
import { leadsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface ReactivationBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads?: Lead[];
  batchId?: number;
  batchName: string;
  centerName: string;
  ageCategory: string;
  batchSchedule: string;
  batchTime: string;
  batchPublicLink?: string;
}

export function ReactivationBroadcastModal({
  isOpen,
  onClose,
  leads: providedLeads,
  batchId,
  batchName,
  centerName,
  ageCategory,
  batchSchedule,
  batchTime,
  batchPublicLink,
}: ReactivationBroadcastModalProps) {
  const [reactivationLeads, setReactivationLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentLeads, setSentLeads] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen && batchId) {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      axios.get(`${API_URL}/batches/${batchId}/potential-reactivations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(response => {
          const leads = response.data.leads || [];
          setReactivationLeads(leads);
          setCurrentIndex(0);
          setSentLeads(new Set());
        })
        .catch(error => {
          console.error('Error fetching reactivation leads:', error);
          setReactivationLeads([]);
          toast.error('Failed to load reactivation leads');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, batchId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setSentLeads(new Set());
      setReactivationLeads([]);
    }
  }, [isOpen]);

  const displayLeads = (providedLeads && providedLeads.length > 0) ? providedLeads : reactivationLeads;
  const currentLead = displayLeads[currentIndex] || null;
  const remainingCount = displayLeads.length - (currentIndex + 1);

  if (!isOpen) return null;

  const generateWhatsAppMessage = (lead: Lead) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const prefUrl = lead.public_token ? `${baseUrl}/pref/${lead.public_token}` : (batchPublicLink || `${baseUrl}/batches`);
    const parentName = lead.player_name.split(' ')[0];
    
    const message = `Hi ${parentName}, great news! We just launched a NEW ${ageCategory} batch at TOFA ${centerName} on ${batchSchedule} at ${batchTime}. Since you were interested before, we wanted to give you priority! 

Choose your preferred slot here: ${prefUrl}`;
    
    return message;
  };

  const handleSendNudge = async () => {
    if (!currentLead) return;
    
    const cleanPhone = currentLead.phone?.replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error('No phone number available for this lead');
      return;
    }
    
    setIsSending(true);
    
    try {
      // Increment nudge_count via API
      await leadsAPI.sendNudge(currentLead.id);
      
      // Generate WhatsApp message with preference link
      const message = generateWhatsAppMessage(currentLead);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');
      
      // Mark as sent and move to next
      setSentLeads(prev => new Set(prev).add(currentLead.id));
      
      // Auto-advance to next lead after a short delay
      setTimeout(() => {
        if (currentIndex < displayLeads.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // All leads processed
          toast.success(`✅ All ${displayLeads.length} nudges sent!`);
        }
        setIsSending(false);
      }, 500);
      
      toast.success(`Nudge sent to ${currentLead.player_name.split(' ')[0]}'s parent`);
    } catch (error: any) {
      console.error('Error sending nudge:', error);
      toast.error(error.message || 'Failed to send nudge');
      setIsSending(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < displayLeads.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Last lead was skipped - show completion
      setCurrentIndex(displayLeads.length);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                📱 Re-activation Broadcast
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Batch Info */}
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg">
              <p className="text-sm font-semibold text-indigo-900 mb-2">✨ New Batch Details:</p>
              <p className="text-base font-bold text-indigo-800">
                {batchName} ({ageCategory})
              </p>
              <p className="text-sm text-indigo-700 mt-1">
                📍 {centerName} • 🗓️ {batchSchedule} at {batchTime}
              </p>
            </div>

            {/* Queue Interface */}
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Loading potential reactivations...</p>
              </div>
            ) : displayLeads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No leads found to re-activate</p>
                <p className="text-sm text-gray-400 mt-2">
                  Leads must be in 'Nurture', 'On Break', or 'Dead' (with 'Timing Mismatch' reason)
                </p>
              </div>
            ) : !currentLead ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-900 mb-2">
                  ✅ All Done!
                </p>
                <p className="text-gray-600">
                  Successfully sent {displayLeads.length} re-activation nudges
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Progress Indicator */}
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <span className="font-medium">
                    Lead {currentIndex + 1} of {displayLeads.length}
                  </span>
                  {remainingCount > 0 && (
                    <span className="text-gray-500">
                      {remainingCount} remaining
                    </span>
                  )}
                </div>

                {/* Current Lead Card */}
                <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-lg">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-bold text-gray-900">
                        {currentLead.player_name}
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        currentLead.status === 'Nurture' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : currentLead.status === 'On Break'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {currentLead.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Parent: {currentLead.phone || 'No phone number'}
                    </p>
                    {currentLead.loss_reason && (
                      <p className="text-xs text-gray-500 mt-1">
                        Previous reason: {currentLead.loss_reason}
                      </p>
                    )}
                    {currentLead.nudge_count && currentLead.nudge_count > 0 && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        ⚠️ Nudge {currentLead.nudge_count} of 3
                      </p>
                    )}
                  </div>

                  {/* Message Preview */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-2">Message Preview:</p>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">
                      {generateWhatsAppMessage(currentLead)}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSkip}
                      disabled={isSending}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Skip
                    </button>
                    <button
                      onClick={handleSendNudge}
                      disabled={isSending || !currentLead.phone || sentLeads.has(currentLead.id)}
                      className="flex-1 px-6 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-lg"
                    >
                      {isSending ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Sending...
                        </>
                      ) : sentLeads.has(currentLead.id) ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Sent ✓
                        </>
                      ) : (
                        <>
                          <Phone className="h-5 w-5" />
                          📱 Send Nudge to {currentLead.player_name.split(' ')[0]}'s Parent
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remaining Leads Preview */}
                {remainingCount > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      Next: {displayLeads[currentIndex + 1]?.player_name || 'None'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

