'use client';

import React, { useState } from 'react';
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

const AGE_CATEGORIES = ['U9', 'U11', 'U13', 'U15', 'U17+'];

export function StagingPromotionModal({ isOpen, onClose, stagingLead }: StagingPromotionModalProps) {
  const queryClient = useQueryClient();
  const [playerAgeCategory, setPlayerAgeCategory] = useState('');
  const [email, setEmail] = useState(stagingLead?.email || '');
  const [address, setAddress] = useState('');

  const promoteMutation = useMutation({
    mutationFn: (data: { player_age_category: string; email?: string; address?: string }) =>
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

  const handleClose = () => {
    setPlayerAgeCategory('');
    setEmail('');
    setAddress('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerAgeCategory) {
      toast.error('Please select an age category');
      return;
    }

    promoteMutation.mutate({
      player_age_category: playerAgeCategory,
      email: email || undefined,
      address: address || undefined,
    });
  };

  if (!isOpen || !stagingLead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 font-bebas">Confirm Field Lead</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            {/* @ts-expect-error - React types mismatch between lucide-react and @types/react */}
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Player Name</p>
            <p className="text-base text-gray-900 font-medium">{stagingLead.player_name}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Phone</p>
            <p className="text-base text-gray-900 font-medium">{stagingLead.phone}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Email</p>
            <p className="text-base text-gray-900 font-medium">{stagingLead.email || 'Not provided'}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Center</p>
            <p className="text-base text-gray-900 font-medium">
              {stagingLead.center?.display_name || 'Unknown'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age Category *
            </label>
            <Select
              value={playerAgeCategory}
              onChange={(e) => setPlayerAgeCategory(e.target.value)}
              required
            >
              <option value="">Select age category</option>
              {AGE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email (Optional)
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address (Optional)
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
              disabled={promoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={promoteMutation.isPending || !playerAgeCategory}
            >
              {promoteMutation.isPending ? 'Promoting...' : 'Confirm & Add to Pipeline'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

