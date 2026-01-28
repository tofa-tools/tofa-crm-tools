'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useCoachBatches } from '@/hooks/useBatches';
import { authAPI } from '@/lib/api';
import { useCenters } from '@/hooks/useCenters';
import { Calendar, Clock, Users, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import type { Batch } from '@tofa/core';

export default function CoachDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Fetch coach's batches
  const { data: coachBatchesData, isLoading } = useCoachBatches();
  const coachBatches = coachBatchesData?.batches || [];

  // Fetch current user data for name
  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authAPI.getCurrentUser(),
    enabled: !!user,
  });

  // Fetch centers for center names
  const { data: centersData } = useCenters();
  const centers = centersData || [];

  // Get today's day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const today = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Convert to our format: 0 = Monday, 6 = Sunday
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, []);

  // Filter batches scheduled for today
  const todayBatches = useMemo(() => {
    return coachBatches.filter((batch: Batch) => {
      // Check if batch is scheduled for today based on day of week
      const dayFlags = [
        batch.is_mon,
        batch.is_tue,
        batch.is_wed,
        batch.is_thu,
        batch.is_fri,
        batch.is_sat,
        batch.is_sun,
      ];
      return dayFlags[today] && batch.is_active;
    });
  }, [coachBatches, today]);

  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Get coach name
  const coachName = currentUserData?.full_name || user?.email?.split('@')[0] || 'Coach';

  // Get current date formatted (MUST be before any early returns)
  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, []);

  // Sort batches by start time (MUST be before any early returns)
  const sortedBatches = useMemo(() => {
    return [...todayBatches].sort((a, b) => {
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [todayBatches]);

  // Format time from HH:MM:SS to HH:MM AM/PM
  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return 'TBD';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Get center name for a batch
  const getCenterName = (batch: Batch): string => {
    const center = centers.find(c => c.id === batch.center_id);
    return center?.display_name || 'Unknown Center';
  };

  // Format schedule days
  const formatScheduleDays = (batch: Batch): string => {
    const days = [];
    if (batch.is_mon) days.push('Mon');
    if (batch.is_tue) days.push('Tue');
    if (batch.is_wed) days.push('Wed');
    if (batch.is_thu) days.push('Thu');
    if (batch.is_fri) days.push('Fri');
    if (batch.is_sat) days.push('Sat');
    if (batch.is_sun) days.push('Sun');
    return days.join(', ') || 'No schedule';
  };

  // Redirect if not a coach
  useEffect(() => {
    if (user && user.role !== 'coach') {
      router.push('/command-center');
    }
  }, [user, router]);

  if (user?.role !== 'coach') {
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tofa-gold mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your sessions...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pb-24 flex flex-col">
        <PageHeader
          title={`${greeting}, ${coachName}`}
          subtitle={currentDate}
          actions={
            <div className="px-3 py-1.5 bg-tofa-gold/20 backdrop-blur-sm rounded-full border-2 border-tofa-gold/40 flex items-center gap-1.5">
              <Calendar size={16} />
              <span className="text-sm font-black">{sortedBatches.length}</span>
            </div>
          }
        />

        {/* Compact Timeline List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sortedBatches.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="h-12 w-12 text-gray-300 mx-auto mb-3">
                  <Calendar size={48} />
                </div>
                <h3 className="text-sm font-black text-gray-600 uppercase tracking-wide mb-1">No Sessions Today</h3>
                <p className="text-xs text-gray-500">You don&apos;t have any batches scheduled for today.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedBatches.map((batch: Batch, index: number) => (
                <div
                  key={batch.id}
                  className="rounded-lg px-3 py-2.5 border-2 border-gray-200 bg-white hover:border-tofa-gold hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {/* Left: Time Badge */}
                    <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${
                      batch.start_time ? (
                        parseInt(batch.start_time.split(':')[0], 10) < 12 
                          ? 'from-blue-500 to-blue-600' 
                          : parseInt(batch.start_time.split(':')[0], 10) < 17
                          ? 'from-indigo-500 to-indigo-600'
                          : 'from-purple-500 to-purple-600'
                      ) : 'from-gray-400 to-gray-500'
                    } flex items-center justify-center shadow-lg border-2 border-white flex-shrink-0`}>
                      <div className="text-center">
                        <div className="text-xs font-black text-white leading-tight">
                          {formatTime(batch.start_time)}
                        </div>
                      </div>
                    </div>

                    {/* Center: Batch Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="text-base font-black text-gray-900 uppercase tracking-tight truncate">
                          {batch.name}
                        </h3>
                        {batch.age_category && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100 rounded uppercase tracking-wide flex-shrink-0">
                            {batch.age_category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-gray-500 truncate">
                          {getCenterName(batch)}
                        </span>
                      </div>
                    </div>

                    {/* Right: START Button */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => router.push(`/check-in?batchId=${batch.id}`)}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black rounded-lg hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all duration-200 flex items-center gap-1.5 shadow-lg hover:shadow-xl text-xs uppercase tracking-wide"
                      >
                        <CheckCircle2 size={16} />
                        <span>START</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

