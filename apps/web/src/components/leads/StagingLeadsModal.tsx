'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { stagingAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Lead } from '@tofa/core';

interface StagingLead {
  id: number;
  player_name: string;
  phone: string;
  center_id: number;
  date_of_birth?: string;
  created_at: string;
}

interface StagingLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcess: (stagingLead: StagingLead) => void;
}

export function StagingLeadsModal({ isOpen, onClose, onProcess }: StagingLeadsModalProps) {
  const queryClient = useQueryClient();
  
  const { data: stagingLeads = [], isLoading } = useQuery({
    queryKey: ['staging-leads'],
    queryFn: () => stagingAPI.getStagingLeads(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Field Leads - Pending Processing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading staging leads...</div>
          ) : stagingLeads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-gray-600">No pending field leads</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stagingLeads.map((lead: StagingLead) => (
                <div
                  key={lead.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{lead.player_name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>📞 {lead.phone}</p>
                        {lead.date_of_birth && (
                          <p>📅 DOB: {new Date(lead.date_of_birth).toLocaleDateString()}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Captured: {new Date(lead.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onProcess(lead);
                        onClose();
                      }}
                      className="ml-4 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Process
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

