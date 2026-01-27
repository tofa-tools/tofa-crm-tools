'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { stagingAPI } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StagingPromotionModal } from './StagingPromotionModal';

interface StagingLead {
  id: number;
  player_name: string;
  phone: string;
  email?: string;
  center_id: number;
  created_at: string;
  center?: {
    id: number;
    display_name: string;
  };
}

interface StagingLeadsListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StagingLeadsListModal({ isOpen, onClose }: StagingLeadsListModalProps) {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<StagingLead | null>(null);
  
  const { data: stagingLeads = [], isLoading } = useQuery({
    queryKey: ['stagingLeads'],
    queryFn: () => stagingAPI.getStagingLeads(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 font-bebas">New Field Leads</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
                <p className="ml-3 text-gray-600">Loading staging leads...</p>
              </div>
            ) : stagingLeads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No new field leads to process</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stagingLeads.map((lead: StagingLead) => (
                  <div
                    key={lead.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:border-brand-accent transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{lead.player_name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{lead.phone}</p>
                        {lead.email && (
                          <p className="text-sm text-gray-500 mt-1">{lead.email}</p>
                        )}
                        {lead.center && (
                          <p className="text-xs text-gray-400 mt-1">{lead.center.display_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedLead && (
        <StagingPromotionModal
          isOpen={!!selectedLead}
          onClose={() => {
            setSelectedLead(null);
            queryClient.invalidateQueries({ queryKey: ['stagingLeads'] });
          }}
          stagingLead={selectedLead}
        />
      )}
    </>
  );
}

