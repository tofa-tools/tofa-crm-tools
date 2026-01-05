'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { skillsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface SkillRatingFormProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number;
  playerName: string;
  onSuccess?: () => void;
}

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

function StarRating({ value, onChange, label }: StarRatingProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-transform active:scale-110"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`h-10 w-10 ${
                star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              } transition-colors`}
            />
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs text-gray-500">{value} / 5</p>
      )}
    </div>
  );
}

export function SkillRatingForm({
  isOpen,
  onClose,
  leadId,
  playerName,
  onSuccess,
}: SkillRatingFormProps) {
  const [technicalScore, setTechnicalScore] = useState(0);
  const [fitnessScore, setFitnessScore] = useState(0);
  const [teamworkScore, setTeamworkScore] = useState(0);
  const [disciplineScore, setDisciplineScore] = useState(0);
  const [coachNotes, setCoachNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all scores are selected
    if (!technicalScore || !fitnessScore || !teamworkScore || !disciplineScore) {
      toast.error('Please rate all categories');
      return;
    }

    setIsSubmitting(true);

    try {
      await skillsAPI.createEvaluation(leadId, {
        technical_score: technicalScore,
        fitness_score: fitnessScore,
        teamwork_score: teamworkScore,
        discipline_score: disciplineScore,
        coach_notes: coachNotes || undefined,
      });

      toast.success('✅ Skill evaluation saved!');
      
      // Reset form
      setTechnicalScore(0);
      setFitnessScore(0);
      setTeamworkScore(0);
      setDisciplineScore(0);
      setCoachNotes('');

      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTechnicalScore(0);
      setFitnessScore(0);
      setTeamworkScore(0);
      setDisciplineScore(0);
      setCoachNotes('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const allRated = technicalScore > 0 && fitnessScore > 0 && teamworkScore > 0 && disciplineScore > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Rate Performance</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="mb-4">
            <p className="text-lg font-semibold text-gray-900">{playerName}</p>
            <p className="text-sm text-gray-600">Rate each category from 1 to 5 stars</p>
          </div>

          <StarRating
            value={technicalScore}
            onChange={setTechnicalScore}
            label="Technical Skills"
          />

          <StarRating
            value={fitnessScore}
            onChange={setFitnessScore}
            label="Fitness & Conditioning"
          />

          <StarRating
            value={teamworkScore}
            onChange={setTeamworkScore}
            label="Teamwork"
          />

          <StarRating
            value={disciplineScore}
            onChange={setDisciplineScore}
            label="Discipline & Attitude"
          />

          <div>
            <label htmlFor="coach-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Quick Note (Optional)
            </label>
            <textarea
              id="coach-notes"
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Add any notes about this evaluation..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!allRated || isSubmitting}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

