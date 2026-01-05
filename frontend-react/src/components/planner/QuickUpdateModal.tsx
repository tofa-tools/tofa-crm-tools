'use client';

import { useState, useMemo } from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { Lead, LeadStatus } from '@/types';
import { useCenters } from '@/hooks/useCenters';

interface QuickUpdateModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (leadId: number, update: { status?: LeadStatus; next_date?: string | null }) => Promise<void>;
  onSendMessage?: (phone: string, playerName: string) => void;
}

const STATUS_OPTIONS: LeadStatus[] = [
  'New',
  'Called',
  'Trial Scheduled',
  'Trial Attended',
  'Joined',
  'Dead/Not Interested',
];

export function QuickUpdateModal({
  lead,
  isOpen,
  onClose,
  onUpdate,
  onSendMessage,
}: QuickUpdateModalProps) {
  const { data: centersData } = useCenters();
  const allCenters = centersData || [];
  
  const [status, setStatus] = useState<LeadStatus>(lead.status as LeadStatus);
  const [nextDate, setNextDate] = useState<string>(
    lead.next_followup_date
      ? new Date(lead.next_followup_date).toISOString().split('T')[0]
      : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Generate message template with preference link automatically included
  const message = useMemo(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const prefUrl = lead.public_token ? `${baseUrl}/pref/${lead.public_token}` : '';
    return `Hello! I wanted to follow up on ${lead.player_name}'s interest in joining TOFA Academy. 

Please click the link below and select your preferred demo class and let us know your preferred time to discuss further: ${prefUrl}`;
  }, [lead.player_name, lead.public_token]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onUpdate(lead.id, {
        status,
        next_date: nextDate || null,
      });
      onClose();
    } catch (error) {
      // Error handling is done in the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppLink = (phone: string, messageText: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(messageText);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  };

  const handleOpenWhatsApp = () => {
    if (lead.phone && message.trim()) {
      const whatsappLink = generateWhatsAppLink(lead.phone, message.trim());
      window.open(whatsappLink, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {lead.player_name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lead Details Section */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Age Category</p>
              <p className="text-sm font-medium text-gray-900">{lead.player_age_category || 'N/A'}</p>
            </div>
            {lead.created_time && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Recorded in System</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(lead.created_time).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            )}
            {lead.phone && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <p className="text-sm font-medium text-gray-900">{lead.phone}</p>
              </div>
            )}
            {lead.email && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900">{lead.email}</p>
              </div>
            )}
            {lead.center_id && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Center</p>
                <p className="text-sm font-medium text-gray-900">
                  {allCenters.find(c => c.id === lead.center_id)?.display_name || `Center ${lead.center_id}`}
                </p>
              </div>
            )}
            {lead.next_followup_date && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Next Follow-up</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(lead.next_followup_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {lead.preferred_call_time && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Preferred Call Time</p>
                <p className="text-sm font-medium text-blue-700">{lead.preferred_call_time}</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Template Section */}
        {lead.phone && (
          <div className="p-4 border-b border-gray-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Template
              </label>
              <textarea
                value={message}
                readOnly
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!message.trim() || !lead.phone}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Open WhatsApp</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Next Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Follow-up Date
            </label>
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => setNextDate('')}
              className="mt-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear date
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

