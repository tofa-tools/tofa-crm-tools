'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { BatchCreate } from '@tofa/core';
import { AGE_CATEGORIES } from '@tofa/core';

interface Center {
  id: number;
  display_name: string;
}
interface Coach {
  id: number;
  full_name?: string;
  email: string;
}

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BatchCreate & { age_category: string }) => Promise<void>;
  centers: Center[];
  coaches: Coach[];
  isSubmitting?: boolean;
}

const SCHEDULE_DAYS = [
  { key: 'is_mon', label: 'Mon' },
  { key: 'is_tue', label: 'Tue' },
  { key: 'is_wed', label: 'Wed' },
  { key: 'is_thu', label: 'Thu' },
  { key: 'is_fri', label: 'Fri' },
  { key: 'is_sat', label: 'Sat' },
  { key: 'is_sun', label: 'Sun' },
] as const;

const defaultBatch: BatchCreate & { age_category?: string } = {
  name: '',
  center_id: 0,
  age_category: '',
  max_capacity: 20,
  is_mon: false,
  is_tue: false,
  is_wed: false,
  is_thu: false,
  is_fri: false,
  is_sat: false,
  is_sun: false,
  start_time: null,
  end_time: null,
  start_date: new Date().toISOString().split('T')[0],
  is_active: true,
  coach_ids: [],
};

export function CreateBatchModal({
  isOpen,
  onClose,
  onSubmit,
  centers,
  coaches,
  isSubmitting = false,
}: CreateBatchModalProps) {
  const [form, setForm] = useState(defaultBatch);
  const [selectedAgeCategories, setSelectedAgeCategories] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...defaultBatch, start_date: new Date().toISOString().split('T')[0] });
      setSelectedAgeCategories([]);
    }
  }, [isOpen]);

  const hasScheduleDays =
    form.is_mon || form.is_tue || form.is_wed || form.is_thu ||
    form.is_fri || form.is_sat || form.is_sun;
  const isFormValid =
    !!form.name && form.center_id > 0 && selectedAgeCategories.length > 0 && !!form.start_date && hasScheduleDays &&
    (form.coach_ids?.length ?? 0) > 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    await onSubmit({ ...form, age_category: selectedAgeCategories.join(',') });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 font-sans">Create New Batch</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
              placeholder="e.g., U9 Morning Batch"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Center *</label>
            <select
              value={form.center_id}
              onChange={(e) => setForm({ ...form, center_id: parseInt(e.target.value, 10) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent outline-none"
            >
              <option value={0}>Select Center</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Age Categories *</label>
            <div className="flex flex-wrap gap-2 border border-gray-300 rounded-lg p-3 min-h-[3rem]">
              {AGE_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedAgeCategories.includes(category)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAgeCategories([...selectedAgeCategories, category]);
                      else setSelectedAgeCategories(selectedAgeCategories.filter((c) => c !== category));
                    }}
                    className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                  />
                  <span className="text-sm">{category}</span>
                </label>
              ))}
            </div>
            {selectedAgeCategories.length === 0 && <p className="text-xs text-red-500 mt-1">Please select at least one age category</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Capacity</label>
            <input
              type="number"
              value={form.max_capacity}
              onChange={(e) => setForm({ ...form, max_capacity: parseInt(e.target.value, 10) || 20 })}
              min={1}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule (Days) *</label>
            <div className="grid grid-cols-4 gap-2">
              {SCHEDULE_DAYS.map((day) => (
                <label key={day.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(form as Record<string, unknown>)[day.key]}
                    onChange={(e) => setForm({ ...form, [day.key]: e.target.checked })}
                    className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                  />
                  <span className="text-sm text-gray-700">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input type="time" value={form.start_time || ''} onChange={(e) => setForm({ ...form, start_time: e.target.value || null })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input type="time" value={form.end_time || ''} onChange={(e) => setForm({ ...form, end_time: e.target.value || null })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign Coaches *</label>
            {coaches.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">No coaches available. Create a coach account first.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                {coaches.map((coach) => (
                  <label key={coach.id} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={form.coach_ids?.includes(coach.id) ?? false}
                      onChange={(e) => {
                        const ids = form.coach_ids ?? [];
                        if (e.target.checked) setForm({ ...form, coach_ids: [...ids, coach.id] });
                        else setForm({ ...form, coach_ids: ids.filter((id) => id !== coach.id) });
                      }}
                      className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                    />
                    <span className="text-sm">{coach.full_name || coach.email}</span>
                  </label>
                ))}
              </div>
            )}
            {(form.coach_ids?.length ?? 0) === 0 && <p className="text-sm text-red-600 mt-1">At least one coach must be assigned</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent" />
              <span className="ml-3 text-sm font-medium text-gray-700">{form.is_active ? 'Active' : 'Inactive'}</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !isFormValid} className="px-4 py-2 bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
            {isSubmitting ? 'Creating...' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}
