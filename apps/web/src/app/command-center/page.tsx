'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionGrid } from '@/components/planner/ActionGrid';
import { CalendarHeatmap } from '@/components/planner/CalendarHeatmap';
import { StrategicIntelligence } from '@/components/planner/StrategicIntelligence';
import { CommandCenterSidebar } from '@/components/planner/CommandCenterSidebar';
import { ExecutiveDashboard } from '@/components/planner/ExecutiveDashboard';
import { UnverifiedPaymentsView } from '@/components/planner/UnverifiedPaymentsView';
import { useQuery } from '@tanstack/react-query';
import { useCalendarMonth } from '@/hooks/useCalendar';
import { useCommandCenterAnalytics } from '@/hooks/useAnalytics';
import { ReactivationBroadcastModal } from '@/components/leads/ReactivationBroadcastModal';
import { useAuth } from '@/context/AuthContext';
import { studentsAPI } from '@/lib/api';

export default function CommandCenterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isTeamLead = user?.role === 'team_lead';

  // Redirect coaches to their dashboard
  useEffect(() => {
    if (user?.role === 'coach') {
      router.push('/coach/dashboard');
    }
  }, [user, router]);
  
  if (user?.role === 'coach') {
    return null;
  }
  const [currentView, setCurrentView] = useState<'sales' | 'executive' | 'unverified'>('sales');
  
  // Force sales view if user is not team_lead
  useEffect(() => {
    if (user?.role !== 'team_lead' && (currentView === 'executive' || currentView === 'unverified')) {
      setCurrentView('sales');
    }
  }, [user?.role, currentView]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedReactivationBatch, setSelectedReactivationBatch] = useState<any>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch calendar data
  const { data: calendarData = {} } = useCalendarMonth(year, month);

  // Fetch command center analytics
  const { data: analyticsData } = useCommandCenterAnalytics(selectedDate);

  // Fetch unverified payments count for badge (Team Lead only)
  const { data: paymentUnverified = [] } = useQuery({
    queryKey: ['students', 'payment-unverified'],
    queryFn: () => studentsAPI.getPaymentUnverified(),
    enabled: isTeamLead,
  });
  const unverifiedCount = paymentUnverified.length;

  const handleDateSelect = (date: string) => setSelectedDate(date);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentDate(new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1));
  };

  return (
    <MainLayout>
      <PageHeader
        title="COMMAND CENTER"
        subtitle="Your action-oriented hub"
      />
      <div className="p-8 space-y-10">

        {/* Tab Switcher (Team Lead only) */}
        {isTeamLead && (
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCurrentView('sales')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'sales'
                    ? 'border-tofa-gold text-tofa-gold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sales View
              </button>
              <button
                onClick={() => setCurrentView('executive')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'executive'
                    ? 'border-tofa-gold text-tofa-gold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Executive View
              </button>
              <button
                onClick={() => setCurrentView('unverified')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  currentView === 'unverified'
                    ? 'border-tofa-gold text-tofa-gold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Unverified Payments
                {unverifiedCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold text-white bg-amber-500 rounded-full">
                    {unverifiedCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        )}

        {/* Sales View */}
        {currentView === 'sales' && (
          <>
            {/* New Batch Opportunity Alert */}
            {analyticsData?.new_batch_opportunities && analyticsData.new_batch_opportunities.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">✨</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">New Batch Opportunity</h3>
                      <p className="text-sm text-gray-700">
                        {analyticsData.new_batch_opportunities.length} new batch{analyticsData.new_batch_opportunities.length !== 1 ? 'es' : ''} created in your centers
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {analyticsData.new_batch_opportunities.map((opp: any) => (
                    <div
                      key={opp.batch_id}
                      className="bg-white rounded-lg p-4 border border-yellow-200 hover:border-yellow-400 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedReactivationBatch(opp);
                        setShowBroadcastModal(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{opp.batch_name}</p>
                          <p className="text-sm text-gray-600">{opp.center_name} • {opp.min_age != null && opp.max_age != null ? `${opp.min_age}–${opp.max_age}` : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-yellow-600">{opp.reactivation_count}</p>
                          <p className="text-xs text-gray-600">leads match</p>
                        </div>
                      </div>
                      <p className="text-xs text-yellow-700 mt-2 italic">Click to view and send WhatsApp messages</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Main Content: Action Grid + Intelligence, Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
              <div className="lg:col-span-3 space-y-10">
                <ActionGrid analyticsData={analyticsData} />
                <StrategicIntelligence />
              </div>
              <div className="lg:col-span-1">
                <CommandCenterSidebar>
                  <CalendarHeatmap
                    year={year}
                    month={month}
                    calendarData={calendarData}
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    onMonthChange={handleMonthChange}
                    compact={true}
                  />
                </CommandCenterSidebar>
              </div>
            </div>
          </>
        )}

        {/* Executive View (Team Lead only) */}
        {isTeamLead && currentView === 'executive' && (
          <ExecutiveDashboard executiveData={analyticsData?.executive_data} />
        )}

        {/* Unverified Payments (Team Lead only) */}
        {isTeamLead && currentView === 'unverified' && (
          <UnverifiedPaymentsView />
        )}

        {/* Reactivation Broadcast Modal */}
        {showBroadcastModal && selectedReactivationBatch && (
          <ReactivationBroadcastModal
            isOpen={showBroadcastModal}
            onClose={() => {
              setShowBroadcastModal(false);
              setSelectedReactivationBatch(null);
            }}
            batchId={selectedReactivationBatch.batch_id}
            batchName={selectedReactivationBatch.batch_name}
            centerName={selectedReactivationBatch.center_name}
            ageGroup={selectedReactivationBatch.min_age != null && selectedReactivationBatch.max_age != null ? `${selectedReactivationBatch.min_age}–${selectedReactivationBatch.max_age}` : ''}
            batchSchedule="Monday-Friday"  // Would need actual batch schedule from batch data
            batchTime="4:00 PM - 6:00 PM"  // Would need actual batch time from batch data
          />
        )}
      </div>
    </MainLayout>
  );
}

