'use client';

import { useState } from 'react';
import { X, MessageCircle } from 'lucide-react';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  leadId: number;
  parentName?: string; // Optional, can use player name if not available
}

export function ReferralModal({
  isOpen,
  onClose,
  playerName,
  leadId,
  parentName,
}: ReferralModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate referral link with query parameter
  // Use the current origin for the referral link
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}?ref=${leadId}`
    : `https://tofa.com?ref=${leadId}`; // Fallback for SSR

  // Generate WhatsApp message template
  const displayParentName = parentName || playerName;
  const whatsappMessage = `Hi ${displayParentName}, we are so excited to have ${playerName} join the TOFA family! If you have any friends who might want to join a trial, feel free to share this link with them: ${referralLink}`;

  // Generate WhatsApp URL (opens WhatsApp with pre-filled message)
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
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

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            Great job! <span className="font-semibold">{playerName}</span> has joined. 
            Ask the parent for a referral?
          </p>

          {/* Referral Link Preview */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Referral Link:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* WhatsApp Preview */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-2">WhatsApp Message Preview:</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {whatsappMessage}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              Send Referral Request
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

