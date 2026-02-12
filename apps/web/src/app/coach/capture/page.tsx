'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { authAPI, stagingAPI, centersAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import { brandConfig } from '@tofa/core';

export default function CoachCapturePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [phone, setPhone] = useState('');
  const [centerId, setCenterId] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authAPI.getCurrentUser(),
    enabled: !!user,
  });

  const { data: allCenters = [] } = useQuery({
    queryKey: ['centers'],
    queryFn: () => centersAPI.getCenters(),
    enabled: !!user,
  });

  // Restrict to coach's assigned centers only; default to first assigned
  const assignedCenterIds = currentUser?.center_ids ?? [];
  const centers = useMemo(
    () => (assignedCenterIds.length > 0
      ? allCenters.filter((c: { id: number }) => assignedCenterIds.includes(c.id))
      : allCenters),
    [allCenters, assignedCenterIds]
  );

  // Smart center: if coach has exactly one center, auto-select and hide dropdown
  const hasSingleCenter = centers.length === 1;
  useEffect(() => {
    if (centers.length > 0 && centerId === '') {
      const firstId = centers[0]?.id;
      if (firstId != null) setCenterId(firstId);
    }
  }, [centers, centerId]);

  useEffect(() => {
    if (user && user.role !== 'coach') {
      router.push('/command-center');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !phone.trim() || !centerId) {
      toast.error('Please fill Player Name, Contact Number, and Center');
      return;
    }

    setIsSubmitting(true);
    try {
      await stagingAPI.createStagingLead({
        player_name: playerName.trim(),
        phone: phone.trim(),
        age: age !== '' ? Number(age) : undefined,
        center_id: Number(centerId),
      });
      setShowSuccess(true);
      setPlayerName('');
      setAge('');
      setPhone('');
      setTimeout(() => {
        setShowSuccess(false);
      }, 2500);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save';
      toast.error(typeof msg === 'string' ? msg : 'Failed to save lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || user.role !== 'coach') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <p className="text-gray-600">Access restricted.</p>
        </div>
      </MainLayout>
    );
  }

  if (showSuccess) {
    return (
      <MainLayout>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-emerald-50 to-white">
          <div className="animate-bounce mb-4">
            <span className="text-6xl">🙌</span>
          </div>
          <h2 className="text-2xl font-black text-emerald-800 uppercase tracking-tight text-center">
            Sent to Center Head!
          </h2>
          <p className="text-gray-600 mt-2 text-center">Lead added. Ready for the next walk-in.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen px-4 py-4 sm:py-6 pb-24 flex flex-col items-center justify-start">
        <div className="w-full max-w-xl">
          <div className="bg-[#0A192F] text-white rounded-xl sm:rounded-2xl shadow-xl border-2 border-brand-accent/30 overflow-hidden mb-4">
            <div className="px-4 sm:px-6 py-3 sm:py-4">
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                ➕ Add Walk-In Lead
              </h1>
              <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">
                Quick capture for {brandConfig.name} · High speed
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl sm:rounded-2xl border-2 border-brand-accent/20 shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Player Name *</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent font-medium"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  min={4}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value, 10) : '')}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent font-medium"
                />
              </div>
              {!hasSingleCenter && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Center *</label>
                  <select
                    value={centerId}
                    onChange={(e) => setCenterId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent font-medium"
                  >
                    <option value="">Select center</option>
                    {centers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.display_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <button
                type="submit"
                disabled={isSubmitting || !playerName.trim() || !phone.trim() || !centerId}
                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-brand-accent to-amber-600 text-[#0A192F] font-bold rounded-xl shadow-lg hover:from-amber-500 hover:to-brand-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting ? (
                  <span className="animate-spin h-5 w-5 border-2 border-[#0A192F] border-t-transparent rounded-full" />
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    Save & Send to Center Head
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
