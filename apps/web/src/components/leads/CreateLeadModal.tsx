'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AGE_CATEGORIES, calculateAgeCategory } from '@tofa/core';
import { leadsAPI } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useCenters } from '@/hooks/useCenters';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LEAD_STATUSES = ['New', 'Called', 'Trial Scheduled', 'Trial Attended', 'Joined', 'Nurture', 'Dead/Not Interested'];

export function CreateLeadModal({ isOpen, onClose }: CreateLeadModalProps) {
  const queryClient = useQueryClient();
  const { data: centers = [] } = useCenters();
  
  const [playerName, setPlayerName] = useState('');
  const [playerAgeCategory, setPlayerAgeCategory] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [centerId, setCenterId] = useState<number | ''>('');
  const [status, setStatus] = useState('New');

  const createLeadMutation = useMutation({
    mutationFn: (data: {
      player_name: string;
      player_age_category: string;
      phone: string;
      email?: string;
      address?: string;
      date_of_birth?: string;
      center_id: number;
      status: string;
    }) => leadsAPI.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dailyQueue'] });
      toast.success('Lead created successfully!');
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to create lead';
      toast.error(errorMessage);
    },
  });

  // When DOB is set and age category is empty, auto-suggest category from DOB (do not overwrite if user already chose)
  const suggestedCategory = dateOfBirth ? calculateAgeCategory(dateOfBirth) : null;
  useEffect(() => {
    if (suggestedCategory && !playerAgeCategory) {
      setPlayerAgeCategory(suggestedCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only suggest when DOB changes; do not overwrite user's category
  }, [dateOfBirth, suggestedCategory]);

  const handleClose = () => {
    setPlayerName('');
    setPlayerAgeCategory('');
    setDateOfBirth('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCenterId('');
    setStatus('New');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName || !phone || !playerAgeCategory || !centerId) {
      toast.error('Please fill in all required fields');
      return;
    }

    createLeadMutation.mutate({
      player_name: playerName,
      player_age_category: playerAgeCategory,
      phone: phone,
      email: email || undefined,
      address: address || undefined,
      date_of_birth: dateOfBirth || undefined,
      center_id: Number(centerId),
      status: status,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-6 bg-brand-accent"></div>
            <h2 className="text-xl font-semibold text-gray-900">Add New Lead</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Player Name *
              </label>
              <Input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter player name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
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
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Date of Birth (Optional)
              </label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                placeholder="YYYY-MM-DD"
              />
              {suggestedCategory && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Child will be placed in <span className="font-medium text-gray-700">{suggestedCategory}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Phone *
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Center *
              </label>
              <Select
                value={centerId === '' ? '' : centerId}
                onChange={(e) => setCenterId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="" disabled>
                  Select center
                </option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.display_name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Address
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
              disabled={createLeadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={createLeadMutation.isPending || !playerName || !phone || !playerAgeCategory || !centerId}
            >
              {createLeadMutation.isPending ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

