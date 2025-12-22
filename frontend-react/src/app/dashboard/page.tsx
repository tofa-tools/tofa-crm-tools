'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/ui/MetricCard';
import { useLeads } from '@/hooks/useLeads';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { LeadStatus } from '@/types';

export default function DashboardPage() {
  const { data: leads, isLoading, error } = useLeads();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Error loading dashboard data
        </div>
      </MainLayout>
    );
  }

  const leadsData = leads || [];
  const totalLeads = leadsData.length;
  const newLeads = leadsData.filter((lead) => lead.status === 'New').length;
  const trialScheduled = leadsData.filter(
    (lead) => lead.status === 'Trial Scheduled'
  ).length;
  const joined = leadsData.filter((lead) => lead.status === 'Joined').length;

  // Status distribution for chart
  const statusCounts: Record<LeadStatus, number> = {
    New: 0,
    Called: 0,
    'Trial Scheduled': 0,
    Joined: 0,
    'Dead/Not Interested': 0,
  };

  leadsData.forEach((lead) => {
    statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
  });

  const chartData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Recent leads (top 5)
  const recentLeads = [...leadsData]
    .sort(
      (a, b) =>
        new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
    )
    .slice(0, 5);

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Academy Overview</h1>
          <p className="text-gray-600 mt-2">Monitor your leads and performance</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Total Leads" value={totalLeads} icon="👥" />
          <MetricCard
            title="New Leads"
            value={newLeads}
            delta={`${newLeads} pending`}
            icon="🆕"
          />
          <MetricCard
            title="Trials Scheduled"
            value={trialScheduled}
            icon="📅"
          />
          <MetricCard title="Joined" value={joined} icon="✅" />
        </div>

        {leadsData.length > 0 ? (
          <>
            {/* Status Distribution Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                📈 Lead Status Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#667eea" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Leads */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                🕒 Recent Leads
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {lead.player_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(lead.created_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
            📭 No leads found. Start by importing data!
          </div>
        )}
      </div>
    </MainLayout>
  );
}


