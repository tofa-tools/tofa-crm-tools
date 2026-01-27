'use client';

import { useState, useEffect } from 'react';
import { X, Star, Calendar } from 'lucide-react';
import apiClient from '@/lib/api';
import { useLeads } from '@/hooks/useLeads';
import { useQueryClient } from '@tanstack/react-query';

interface SkillReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number;
  playerName: string;
  existingReport?: {
    technical_skill: number;
    fitness: number;
    teamwork: number;
    discipline: number;
    coach_note: string;
    date: string;
  } | null;
  onSuccess?: () => void;
}

const SKILL_LABELS = [
  { key: 'technical_skill', label: 'Technical Skill' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'discipline', label: 'Discipline' },
] as const;

export function SkillReportModal({
  isOpen,
  onClose,
  leadId,
  playerName,
  existingReport,
  onSuccess,
}: SkillReportModalProps) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState({
    technical_skill: 0,
    fitness: 0,
    teamwork: 0,
    discipline: 0,
  });
  const [coachNote, setCoachNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pastReports, setPastReports] = useState<any[]>([]);
  
  // Fetch lead data to get past skill reports
  const { data: leadsResponse } = useLeads({ limit: 1000 });
  const lead = leadsResponse?.leads?.find(l => l.id === leadId);

  // Load existing report and past reports
  useEffect(() => {
    if (existingReport) {
      setRatings({
        technical_skill: existingReport.technical_skill || 0,
        fitness: existingReport.fitness || 0,
        teamwork: existingReport.teamwork || 0,
        discipline: existingReport.discipline || 0,
      });
      setCoachNote(existingReport.coach_note || '');
    } else {
      // Reset form
      setRatings({
        technical_skill: 0,
        fitness: 0,
        teamwork: 0,
        discipline: 0,
      });
      setCoachNote('');
    }
    
    // Load past reports from lead metadata
    if (lead && lead.extra_data && typeof lead.extra_data === 'object') {
      const extraData = lead.extra_data as any;
      const skillReports = extraData.skill_reports || [];
      if (Array.isArray(skillReports)) {
        // Sort by date (newest first) and exclude the current report if editing
        const reports = skillReports
          .filter((r: any) => !existingReport || r.date !== existingReport.date)
          .sort((a: any, b: any) => {
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            return dateB - dateA;
          });
        setPastReports(reports);
      }
    } else {
      setPastReports([]);
    }
  }, [existingReport, isOpen, lead]);

  const handleRatingChange = (skill: string, value: number) => {
    setRatings((prev) => ({ ...prev, [skill]: value }));
  };

  const handleSubmit = async () => {
    // Validate that all ratings are selected
    if (!ratings.technical_skill || !ratings.fitness || !ratings.teamwork || !ratings.discipline) {
      alert('Please rate all skill categories before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create new report
      const newReport = {
        technical_skill: ratings.technical_skill,
        fitness: ratings.fitness,
        teamwork: ratings.teamwork,
        discipline: ratings.discipline,
        coach_note: coachNote || '',
        date: new Date().toISOString().split('T')[0], // Store as YYYY-MM-DD for consistency
      };

      // Backend will append this to existing skill_reports array
      const response = await apiClient.put(`/leads/${leadId}/metadata`, {
        skill_reports: [newReport],
      });

      console.log('Skill report saved successfully:', response.data);

      // Invalidate queries to refresh lead and student data
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      console.error('Failed to save skill report:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save skill report. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            Skill Report: {playerName}
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
          {/* Past Reports Section */}
          {pastReports.length > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Past Reports
              </h3>
              <div className="space-y-4 max-h-60 overflow-y-auto">
                {pastReports.map((report, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        {report.date ? new Date(report.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) : 'Date not available'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {SKILL_LABELS.map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-20 truncate">
                            {label}:
                          </span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < (report[key] || 0)
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {report.coach_note && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        &quot;{report.coach_note}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skill Ratings */}
          <div className="space-y-6 mb-6">
            {SKILL_LABELS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleRatingChange(key, value)}
                      className="focus:outline-none transition-transform hover:scale-110"
                      aria-label={`Rate ${value} stars`}
                    >
                      <Star
                        className={`h-8 w-8 ${
                          value <= ratings[key as keyof typeof ratings]
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    {ratings[key as keyof typeof ratings] > 0
                      ? `${ratings[key as keyof typeof ratings]}/5`
                      : 'Not rated'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Coach's Note */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coach&apos;s Note
            </label>
            <textarea
              value={coachNote}
              onChange={(e) => setCoachNote(e.target.value)}
              placeholder="Add your observations and feedback..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !ratings.technical_skill || !ratings.fitness || !ratings.teamwork || !ratings.discipline}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Report'}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

