'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BulkActionsToolbar } from '@/components/leads/BulkActionsToolbar';
import { PlannerPane } from '@/components/leads/PlannerPane';
import { WelcomeModal } from '@/components/leads/WelcomeModal';
import { SkillReportModal } from '@/components/leads/SkillReportModal';
import { LeadUpdateModal } from '@/components/leads/LeadUpdateModal';
import { useLeads, usePrefetchNextPage } from '@/hooks/useLeads';
import { useBatches } from '@/hooks/useBatches';
import { useCenters } from '@/hooks/useCenters';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import { PAGINATION_OPTIONS } from '@/lib/config/crm';
import type { Lead, LeadStatus } from '@tofa/core';
import { calculateAge } from '@tofa/core';
import { CreateLeadModal } from '@/components/leads/CreateLeadModal';
import { stagingAPI } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Calendar, Ghost, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Plus, AlertTriangle } from 'lucide-react';

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // --- URL & Pagination Params ---
  const pageSize = parseInt(searchParams.get('pageSize') || String(PAGINATION_OPTIONS.DEFAULT_SIZE), 10);
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const statusFilter = searchParams.get('status')?.split(',').filter(Boolean) as LeadStatus[] || [];
  const searchTerm = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'status';
  const sortDirection = searchParams.get('sortDirection') || 'asc'; // 'asc' or 'desc'
  const nextFollowupDateFilter = searchParams.get('next_follow_up_date') || null;
  const lossReasonFilter = searchParams.get('loss_reason') || null;
  const specialFilter = searchParams.get('filter') || null;  // "overdue" | "at-risk" | "new"
  const shouldOpenCreate = searchParams.get('create') === '1';
  const offset = (currentPage - 1) * pageSize;

  // --- UI State ---
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [joinedLeadId, setJoinedLeadId] = useState<number | null>(null);
  const [joinedPlayerName, setJoinedPlayerName] = useState<string>('');
  const [showSkillReportModal, setShowSkillReportModal] = useState(false);
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState(searchTerm);

  useEffect(() => {
    if (shouldOpenCreate) setShowCreateLeadModal(true);
  }, [shouldOpenCreate]);

  // --- Data Fetching ---
  // Backend only supports 'created_time' or 'freshness'
  // For 'status' sorting, we use 'created_time' as backend sort and handle status sorting on frontend
  // Fallback to 'created_time' if invalid sortBy value is provided
  const backendSortBy = sortBy === 'status' || sortBy === 'score' ? 'created_time' : sortBy;
  
  const queryParams = {
    limit: pageSize,
    offset,
    sort_by: backendSortBy,
    ...(statusFilter.length === 1 && !specialFilter && { status: statusFilter[0] }),
    ...(searchTerm && { search: searchTerm }),
    ...(nextFollowupDateFilter && { next_follow_up_date: nextFollowupDateFilter }),
    ...(lossReasonFilter && { loss_reason: lossReasonFilter }),
    ...(specialFilter && { filter: specialFilter }),
  };

  // Fetch leads only (Leads Management = non-Joined leads; Students are on /students)
  const { data: leadsResponse, isLoading: leadsLoading } = useLeads({
    ...queryParams,
    status: specialFilter ? undefined : (statusFilter.length > 0 && !statusFilter.includes('Joined' as LeadStatus) ? statusFilter.join(',') : undefined),
  });
  
  const isLoading = leadsLoading;
  
  const { data: stagingLeadsData } = useQuery({
    queryKey: ['stagingLeads'],
    queryFn: () => stagingAPI.getStagingLeads(),
    enabled: user?.role === 'team_lead' || user?.role === 'team_member',
  });

  const prefetchNextPage = usePrefetchNextPage(queryParams, pageSize);

  // Leads Management: only non-Joined leads (Students are on /students)
  const leadsData = (leadsResponse?.leads || []).filter((lead: Lead) => lead.status !== 'Joined');
  const totalLeads = leadsResponse?.total ?? leadsData.length;
  const totalPages = Math.ceil(totalLeads / pageSize);
  const stagingLeads = stagingLeadsData || [];
  
  const { data: batchesData } = useBatches();
  const allBatches = batchesData || [];
  const { data: centersData } = useCenters();
  const centers = centersData || [];

  const selectedLead = useMemo(() => 
    leadsData.find((l: Lead) => l.id === expandedLeadId) || null
  , [expandedLeadId, leadsData]);


  // --- Actions & Helpers ---
  const updateURLParams = useCallback((updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value && value !== 'asc' && value !== 'desc') params.delete(key);
      else params.set(key, String(value));
    });
    if (updates.status !== undefined || updates.search !== undefined || updates.sortBy !== undefined) params.set('page', '1');
    router.push(`/leads?${params.toString()}`);
  }, [router, searchParams]);

  const handleJoined = (leadId: number, playerName: string) => {
    setJoinedLeadId(leadId);
    setJoinedPlayerName(playerName);
    setShowReferralModal(true);
  };

  // Handle column header click for sorting
  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      // Toggle direction if same column
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      updateURLParams({ sortBy: column, sortDirection: newDirection });
    } else {
      // New column, default to ascending
      updateURLParams({ sortBy: column, sortDirection: 'asc' });
    }
  }, [sortBy, sortDirection, updateURLParams]);

  // --- Frontend Sorting Logic ---
  const sortedLeadsData = useMemo(() => {
    if (!leadsData || leadsData.length === 0) return [];
    
    const sorted = [...leadsData];
    const statusOrder: Record<string, number> = { 
      'New': 0, 
      'Called': 1, 
      'Trial Scheduled': 2, 
      'Trial Attended': 3, 
      'Joined': 4, 
      'Nurture': 5, 
      'Dead/Not Interested': 6 
    };
    
    const isAsc = sortDirection === 'asc';
    
    if (sortBy === 'status') {
      sorted.sort((a, b) => {
        const aOrder = statusOrder[a.status] ?? 99;
        const bOrder = statusOrder[b.status] ?? 99;
        return isAsc ? aOrder - bOrder : bOrder - aOrder;
      });
    } else if (sortBy === 'created_time') {
      sorted.sort((a, b) => {
        const aTime = a.created_time ? new Date(a.created_time).getTime() : 0;
        const bTime = b.created_time ? new Date(b.created_time).getTime() : 0;
        return isAsc ? aTime - bTime : bTime - aTime;
      });
    } else if (sortBy === 'player_name') {
      sorted.sort((a, b) => {
        const aName = (a.player_name || '').toLowerCase();
        const bName = (b.player_name || '').toLowerCase();
        return isAsc ? aName.localeCompare(bName) : bName.localeCompare(aName);
      });
    } else if (sortBy === 'next_followup_date') {
      sorted.sort((a, b) => {
        const aDate = a.next_followup_date ? new Date(a.next_followup_date).getTime() : 0;
        const bDate = b.next_followup_date ? new Date(b.next_followup_date).getTime() : 0;
        return isAsc ? aDate - bDate : bDate - aDate;
      });
    }
    
    return sorted;
  }, [leadsData, sortBy, sortDirection]);

  // --- Effects ---
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInputValue !== searchTerm) updateURLParams({ search: searchInputValue || null });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInputValue, searchTerm, updateURLParams]);


  // --- Render ---
  if (isLoading && !leadsData.length) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading Leads...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen">
        <PageHeader
          title="LEADS MANAGEMENT"
          subtitle={`${totalLeads} prospect${totalLeads !== 1 ? 's' : ''}`}
          actions={
            <div className="flex items-center gap-3">
              {/* Add Lead Button (Team Leads and Team Members) */}
              {(user?.role === 'team_lead' || user?.role === 'team_member') && (
                <button
                  onClick={() => setShowCreateLeadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-brand-primary rounded-xl shadow-lg hover:shadow-xl font-semibold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Lead
                </button>
              )}
              <button 
                onClick={() => setIsPlannerOpen(!isPlannerOpen)} 
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 font-medium"
              >
                <Calendar className="w-4 h-4" />
                {isPlannerOpen ? 'Close Planner' : 'Open Planner'}
              </button>
            </div>
          }
        />

        <div className="p-8 space-y-6">

        {/* Staging Banner (Restored) */}
        {stagingLeads.length > 0 && (user?.role === 'team_lead' || user?.role === 'team_member') && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Ghost className="w-8 h-8 opacity-80" />
              <div>
                <h3 className="text-lg font-bold">New Field Leads ({stagingLeads.length})</h3>
                <p className="text-white/80 text-sm">Review walk-ins from coaches.</p>
              </div>
            </div>
            <button onClick={() => router.push('/staging')} className="px-6 py-2 bg-white text-brand-primary font-bold rounded-lg shadow-sm hover:scale-105 transition-transform">Process</button>
          </div>
        )}

        {/* Filter Toolbar (Restored) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <select 
            value={sortBy} 
            onChange={(e) => updateURLParams({ sortBy: e.target.value })}
                    className="p-2 border rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="status">Sort by Status</option>
            <option value="created_time">Sort by Date</option>
          </select>
          <select 
            value={pageSize} 
            onChange={(e) => updateURLParams({ pageSize: e.target.value, page: 1 })}
            className="p-2 border rounded-xl bg-gray-50 text-sm font-medium"
          >
            {[25, 50, 100].map(size => <option key={size} value={size}>{size} per page</option>)}
          </select>
        </div>

        {user?.role !== 'observer' && (
          <BulkActionsToolbar selectedLeadIds={Array.from(selectedLeadIds)} onClearSelection={() => setSelectedLeadIds(new Set())} />
        )}

        {/* Leads Table (100% Feature Restored) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4 w-10">
                    <input type="checkbox" disabled={user?.role === 'observer'} className="rounded border-gray-300 text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed" onChange={(e) => {
                      if (e.target.checked) setSelectedLeadIds(new Set(sortedLeadsData.map((l: Lead) => l.id)));
                      else setSelectedLeadIds(new Set());
                    }} />
                  </th>
                  <th 
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('player_name')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Player Name</span>
                      {sortBy === 'player_name' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">Center</th>
                  <th className="px-6 py-4 text-left">Phone</th>
                  <th 
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      {sortBy === 'status' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">Trial Batch</th>
                  <th 
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('created_time')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Freshness</span>
                      {sortBy === 'created_time' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('next_followup_date')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Next Follow-up</span>
                      {sortBy === 'next_followup_date' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedLeadsData.length > 0 ? sortedLeadsData.map((lead: Lead) => (
                  <tr key={lead.id} onClick={() => setExpandedLeadId(lead.id)} className="group hover:bg-brand-accent/10 cursor-pointer transition-colors">
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedLeadIds.has(lead.id)} disabled={user?.role === 'observer'} className="disabled:opacity-50 disabled:cursor-not-allowed" onChange={() => {
                        const next = new Set(selectedLeadIds);
                        if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
                        setSelectedLeadIds(next);
                      }} className="rounded border-gray-300 text-brand-accent" />
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        {lead.player_name}
                        {lead.date_of_birth == null && (
                          <span
                            className="inline-flex text-amber-500"
                            title="Missing date of birth"
                          >
                            <AlertTriangle className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                      {centers.find(c => c.id === lead.center_id)?.display_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{user?.role === 'coach' ? '🔒 HIDDEN' : lead.phone || 'N/A'}</td>
                    <td className="px-6 py-4"><StatusBadge status={lead.status} /></td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                      {(() => {
                        if (!lead.trial_batch_id) {
                          if (lead.status === 'Trial Scheduled') {
                            return <span className="text-red-600 font-semibold">⚠️ No Batch Assigned</span>;
                          }
                          return '—';
                        }
                        const batch = allBatches.find(b => b.id === lead.trial_batch_id);
                        return batch?.name || `[ID: ${lead.trial_batch_id}]`;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">{formatDate(lead.created_time)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">{formatDate(lead.next_followup_date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {lead.date_of_birth ? (calculateAge(lead.date_of_birth) ?? '—') : '—'}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={10} className="px-6 py-20 text-center text-gray-400 font-medium italic">No leads match your current search/filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Logic */}
        {totalPages > 1 && (
           <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-gray-100">
              <button disabled={currentPage === 1} onClick={() => updateURLParams({ page: currentPage - 1 })} className="px-4 py-2 border rounded-xl text-sm font-bold disabled:opacity-30 hover:bg-gray-50">Previous</button>
              <span className="text-sm font-bold text-gray-500 tracking-widest uppercase">Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => updateURLParams({ page: currentPage + 1 })} className="px-4 py-2 border rounded-xl text-sm font-bold disabled:opacity-30 hover:bg-gray-50">Next</button>
           </div>
        )}
      </div>

      {/* Planner Integration (Restored properly) */}
      <PlannerPane
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        selectedDate={nextFollowupDateFilter}
        onDateSelect={(d) => updateURLParams({ next_follow_up_date: d })}
        onLeadClick={(id) => { setExpandedLeadId(id); if (typeof window !== 'undefined' && window.innerWidth < 768) setIsPlannerOpen(false); }}
      />

      {/* Lead Update Modal */}
      <LeadUpdateModal
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setExpandedLeadId(null)}
        onJoined={handleJoined}
      />

      {/* Overlays */}
      {joinedLeadId && <WelcomeModal isOpen={showReferralModal} onClose={() => setShowReferralModal(false)} playerName={joinedPlayerName} leadId={joinedLeadId} />}
      <SkillReportModal isOpen={showSkillReportModal} onClose={() => setShowSkillReportModal(false)} leadId={selectedLead?.id || 0} playerName={selectedLead?.player_name || ""} existingReport={null} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leads'] })} />
      <CreateLeadModal isOpen={showCreateLeadModal} onClose={() => setShowCreateLeadModal(false)} />
      </div>
    </MainLayout>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LeadsContent />
    </Suspense>
  );
}