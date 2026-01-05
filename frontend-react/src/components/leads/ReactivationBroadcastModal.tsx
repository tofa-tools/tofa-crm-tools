'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import type { Lead } from '@/types';

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
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [reactivationLeads, setReactivationLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && batchId) {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      axios.get(`${API_URL}/batches/${batchId}/potential-reactivations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(response => {
          setReactivationLeads(response.data.leads || []);
          setSelectedLeads(new Set(response.data.leads?.map((l: Lead) => l.id) || []));
        })
        .catch(error => {
          console.error('Error fetching reactivation leads:', error);
          setReactivationLeads([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, batchId]);

  const displayLeads = (providedLeads && providedLeads.length > 0) ? providedLeads : reactivationLeads;

  if (!isOpen) return null;

  const generateWhatsAppMessage = (lead: Lead) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const publicLink = batchPublicLink || `${baseUrl}/batches`;
    
    const message = `Hi ${lead.player_name.split(' ')[0]}, great news! We just launched a NEW ${ageCategory} batch at TOFA ${centerName} on ${batchSchedule} at ${batchTime}. Since you were interested before, we wanted to give you priority! View the schedule here: ${publicLink}`;
    
    return message;
  };

  const handleSelectAll = () => {
    if (selectedLeads.size === displayLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(displayLeads.map(l => l.id)));
    }
  };

  const handleToggleLead = (leadId: number) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSendMessage = (lead: Lead) => {
    const cleanPhone = lead.phone?.replace(/\D/g, '');
    if (!cleanPhone) {
      alert('No phone number available for this lead');
      return;
    }
    
    const message = generateWhatsAppMessage(lead);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                ✨ Bulk WhatsApp Broadcast
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">Batch Details:</p>
              <p className="text-sm text-blue-800">
                <strong>{batchName}</strong> ({ageCategory}) at {centerName}
              </p>
              <p className="text-sm text-blue-800">
                Schedule: {batchSchedule} at {batchTime}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                {selectedLeads.size} of {displayLeads.length} leads selected
              </p>
            </div>

            <div className="mb-4">
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                {selectedLeads.size === leads.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-4">
              {isLoading ? (
                <p className="text-center text-gray-500 py-8">Loading potential reactivations...</p>
              ) : displayLeads.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No leads to display</p>
              ) : (
                displayLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className={`p-3 border rounded-lg ${
                      selectedLeads.has(lead.id)
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => handleToggleLead(lead.id)}
                          className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{lead.player_name}</p>
                          <p className="text-sm text-gray-600">{lead.phone || 'No phone'}</p>
                          {lead.loss_reason && (
                            <p className="text-xs text-gray-500 mt-1">
                              Previous reason: {lead.loss_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendMessage(lead)}
                        disabled={!selectedLeads.has(lead.id) || !lead.phone}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          selectedLeads.has(lead.id) && lead.phone
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        📱 Send
                      </button>
                    </div>
                    {selectedLeads.has(lead.id) && (
                      <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-xs text-gray-600">
                        <strong>Preview:</strong> {generateWhatsAppMessage(lead).substring(0, 150)}...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

