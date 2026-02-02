'use client';

import { useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { calculateAgeCategory } from '@tofa/core';
import { leadsAPI } from '@/lib/api';

interface AgeMigrationAlertProps {
  leadId: number;
  currentCategory: string;
  dateOfBirth: string | null | undefined;
  playerName: string;
  onCategoryUpdated?: () => void;
}

export function AgeMigrationAlert({
  leadId,
  currentCategory,
  dateOfBirth,
  playerName,
  onCategoryUpdated,
}: AgeMigrationAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate correct age category
  const calculatedCategory = dateOfBirth ? calculateAgeCategory(dateOfBirth) : null;

  // Only show alert if DOB exists and categories don't match
  if (!dateOfBirth || !calculatedCategory || calculatedCategory === currentCategory) {
    return null;
  }

  const handleConfirmMigration = async () => {
    setIsUpdating(true);
    try {
      // Update lead status to trigger a refresh - we'll need to use updateLead with status unchanged
      // Actually, we need a way to update just the age_category field
      // For now, let's use the updateLead endpoint with the same status
      
      // We need an endpoint to update age_category - for MVP, we can update via status endpoint
      // but we need to add a field update endpoint. For now, let's use a workaround:
      // We'll need to update via the metadata or add a new endpoint
      
      // Update age category via API
      await leadsAPI.updateAgeCategory(leadId, calculatedCategory);
      
      setIsOpen(false);
      if (onCategoryUpdated) {
        onCategoryUpdated();
      }
    } catch (error) {
      console.error('Failed to update age category:', error);
      alert('Failed to update age category. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center text-amber-600 hover:text-amber-700 transition-colors"
        title={`Age category should be ${calculatedCategory} (currently ${currentCategory})`}
      >
        <ArrowUpCircle className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          <div className="flex items-start">
            <ArrowUpCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Age Category Migration
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Move {playerName} from <span className="font-medium">{currentCategory}</span> to{' '}
                <span className="font-medium">{calculatedCategory}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmMigration}
                  disabled={isUpdating}
                  className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Updating...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

