'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';

interface PlayerReportCardProps {
  playerName: string;
  ageCategory: string;
  centerName: string;
  technicalScore: number;
  fitnessScore: number;
  teamworkScore: number;
  disciplineScore: number;
  className?: string;
}

export function PlayerReportCard({
  playerName,
  ageCategory,
  centerName,
  technicalScore,
  fitnessScore,
  teamworkScore,
  disciplineScore,
  className = '',
}: PlayerReportCardProps) {
  const scores = [
    { label: 'Technical', value: technicalScore, color: 'bg-blue-500' },
    { label: 'Fitness', value: fitnessScore, color: 'bg-green-500' },
    { label: 'Teamwork', value: teamworkScore, color: 'bg-purple-500' },
    { label: 'Discipline', value: disciplineScore, color: 'bg-orange-500' },
  ];

  const maxScore = 5;
  const averageScore = (technicalScore + fitnessScore + teamworkScore + disciplineScore) / 4;

  return (
    <div
      className={`bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl shadow-2xl overflow-hidden ${className}`}
      style={{ width: '400px', height: '600px' }}
      id="player-report-card"
    >
      {/* Header */}
      <div className="bg-black bg-opacity-30 p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">{playerName}</h1>
          <div className="text-right">
            <div className="text-3xl font-bold">{ageCategory}</div>
            <div className="text-xs opacity-90">Age Category</div>
          </div>
        </div>
        <p className="text-sm opacity-90">{centerName}</p>
      </div>

      {/* Main Content */}
      <div className="p-6 bg-white bg-opacity-95 h-full">
        {/* Overall Rating */}
        <div className="mb-6 text-center">
          <div className="text-5xl font-bold text-indigo-600 mb-1">{averageScore.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Overall Rating</div>
          <div className="flex justify-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(averageScore)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Skill Bars */}
        <div className="space-y-4">
          {scores.map((skill) => (
            <div key={skill.label}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">{skill.label}</span>
                <span className="text-sm font-bold text-gray-900">{skill.value.toFixed(1)} / {maxScore}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full ${skill.color} transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${(skill.value / maxScore) * 100}%` }}
                >
                  {skill.value >= 3 && (
                    <Star className="h-4 w-4 text-white" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <div className="text-xs text-gray-500 mb-3">TOFA Academy Progress Report</div>
          <div className="text-xs text-gray-400 mb-4">
            Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          
          {/* TOFA Logo Placeholder */}
          <div className="mb-3">
            <div className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
              TOFA
            </div>
          </div>
          
          {/* Join Today QR Code/URL */}
          <div className="bg-gray-50 rounded-lg p-3 mt-2">
            <div className="text-xs font-semibold text-gray-700 mb-1">Join Today!</div>
            <div className="text-xs text-indigo-600 font-medium">www.tofa.academy/join</div>
            {/* QR Code placeholder - will be rendered as a simple visual pattern */}
            <div className="mt-2 inline-block bg-white p-2 rounded border-2 border-gray-300">
              <div className="grid grid-cols-4 gap-1" style={{ width: '60px', height: '60px' }}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={i % 3 === 0 || i % 5 === 0 ? 'bg-black' : 'bg-white'}
                    style={{ width: '100%', height: '100%' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

