'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { stagingAPI } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface StagingLead {
  id: number;
  player_name: string;
  phone: string;
  email?: string;
  age?: number;
  date_of_birth?: string; // YYYY-MM-DD when set on staging
  center_id: number;
  created_at: string;
  center?: {
    id: number;
    display_name: string;
  };
}

interface StagingPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagingLead: StagingLead | null;
}

export function StagingPromotionModal({ isOpen, onClose, stagingLead }: StagingPromotionModalProps) {
  const queryClient = useQueryClient();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState(stagingLead?.email || '');
  const [address, setAddress] = useState('');

  const promoteMutation = useMutation({
    mutationFn: (data: { date_of_birth?: string; email?: string; address?: string }) =>
      stagingAPI.promoteStagingLead(stagingLead!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagingLeads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dailyQueue'] });
      toast.success('Lead promoted to pipeline successfully!');
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to promote lead';
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (stagingLead) {
      setEmail(stagingLead.email || '');
      setAddress('');
      if (stagingLead.date_of_birth) {
        setDateOfBirth(stagingLead.date_of_birth);
      } else if (stagingLead.age != null) {
        const year = new Date().getFullYear() - stagingLead.age;
        setDateOfBirth(`${year}-01-01`);
      } else {
        setDateOfBirth('');
      }
    }
  }, [stagingLead?.id]);

  const handleClose = () => {
    setDateOfBirth('');
    setEmail('');
    setAddress('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateOfBirth && !stagingLead?.age) {
      toast.error('Please enter date of birth');
      return;
    }
    promoteMutation.mutate({
      date_of_birth: dateOfBirth || undefined,
      email: email || undefined,
      address: address.trim() || undefined,
    });
  };

  const canPromote = dateOfBirth || stagingLead?.age != null;

  if (!isOpen || !stagingLead) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/50 min-h-full py-6">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-xl flex flex-col my-auto border-2 border-brand-accent/20 overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between gap-2 py-3 px-4 sm:px-6 bg-[#0A192F] text-white">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold font-bebas">✨ Clean & Promote to Lead</h2>
            <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">Trial Attended · Hot: Ready to Join</p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6">
            {/* Coach-captured data (read-only) */}
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">From field capture</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-y-3 mb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Player Name</p>
                <p className="text-sm text-gray-900 font-medium truncate">{stagingLead.player_name}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Phone</p>
                <p className="text-sm text-gray-900 font-medium truncate">{stagingLead.phone}</p>
              </div>
              {stagingLead?.age != null && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">Age (guess)</p>
                  <p className="text-sm text-gray-900 font-medium">{stagingLead.age} years</p>
                </div>
              )}
            </div>

            {/* Mandatory: DOB. Optional: Email, Address/Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date of Birth *</label>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email (Optional)</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Optional"
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Address / Pincode (Optional)</label>
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Optional"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex-shrink-0 flex gap-3 py-3 px-4 sm:px-6 sm:py-4 border-t border-gray-200 bg-gray-50/50">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1 min-h-10"
              disabled={promoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1 min-h-10"
              disabled={promoteMutation.isPending || !canPromote}
            >
              {promoteMutation.isPending ? 'Promoting...' : '✨ Promote to Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

