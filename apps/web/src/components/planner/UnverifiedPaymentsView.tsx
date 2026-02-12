'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { studentsAPI, leadsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const sectionHeader = 'text-sm font-black text-tofa-gold uppercase tracking-widest mb-3';

export function UnverifiedPaymentsView() {
  const { user } = useAuth();

  if (user?.role !== 'team_lead') return null;

  const { data: paymentUnverified = [], refetch: refetchPaymentUnverified } = useQuery({
    queryKey: ['students', 'payment-unverified'],
    queryFn: () => studentsAPI.getPaymentUnverified(),
    enabled: user?.role === 'team_lead',
  });

  const { data: leadsPendingResponse, refetch: refetchLeadsPending } = useQuery({
    queryKey: ['leads', { status: 'Payment Pending Verification' }],
    queryFn: () => leadsAPI.getMyLeads({ status: 'Payment Pending Verification', limit: 50 }),
    enabled: user?.role === 'team_lead',
  });
  const leadsPending: any[] = leadsPendingResponse?.leads ?? [];

  const verifyPaymentMutation = useMutation({
    mutationFn: (studentId: number) => studentsAPI.verifyPayment(studentId),
    onSuccess: () => {
      refetchPaymentUnverified();
      toast.success('Payment verified');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to verify'),
  });

  const verifyAndEnrollMutation = useMutation({
    mutationFn: (leadId: number) => leadsAPI.verifyAndEnroll(leadId),
    onSuccess: () => {
      refetchLeadsPending();
      toast.success('Student enrolled! Welcome email sent.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to verify'),
  });

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const copyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    toast.success('UTR copied');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-tofa-navy to-tofa-navy-900 border-2 border-tofa-gold/20 overflow-hidden">
        <div className="p-6">
          <h1 className="text-xl font-black text-tofa-gold uppercase tracking-tight">Unverified Payments</h1>
          <p className="text-sm text-tofa-gold/70 mt-1">Review and verify payments submitted by parents</p>
        </div>
      </div>

      {/* 📋 Enrollment Pending Verification (leads from enrollment page) */}
      <div className="bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-xl p-5 border-2 border-tofa-gold/20">
        <h2 className={sectionHeader}>📋 Enrollment Pending Verification</h2>
        <p className="text-[10px] text-tofa-gold/70 mb-3">Parent submitted enrollment — verify & enroll</p>
        {leadsPending.length > 0 ? (
          <ul className="space-y-2">
            {leadsPending.map((l: any) => {
              const pending = l.pending_subscription_data;
              if (!pending || typeof pending !== 'object') return null;
              return (
                <li key={l.id} className="flex items-center gap-3 py-2 px-3 bg-white/5 rounded-lg border border-tofa-gold/10">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-white text-sm block truncate flex items-center gap-2">
                      {l.player_name}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 shrink-0">🆕 New</span>
                    </span>
                    <span className="text-[10px] text-gray-400">{pending.subscription_plan || '—'}</span>
                    <span className="text-[10px] text-gray-500 ml-2">{pending.start_date ? new Date(pending.start_date).toLocaleDateString() : '—'}</span>
                    <button
                      type="button"
                      onClick={() => copyUtr(pending.utr_number || '')}
                      className="text-[10px] text-gray-400 font-mono hover:text-tofa-gold cursor-pointer text-left block"
                      title="Copy UTR"
                    >
                      {pending.utr_number ? `${pending.utr_number} (copy)` : '—'}
                    </button>
                  </div>
                  {pending.payment_proof_url ? (
                    <button
                      type="button"
                      onClick={() => setLightboxImage(pending.payment_proof_url)}
                      className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-tofa-gold/30 hover:border-tofa-gold bg-black/20"
                    >
                      <img src={pending.payment_proof_url} alt="Proof" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <span className="flex-shrink-0 text-[10px] text-gray-500">No image</span>
                  )}
                  <button
                    type="button"
                    onClick={() => verifyAndEnrollMutation.mutate(l.id)}
                    disabled={verifyAndEnrollMutation.isPending}
                    className="flex-shrink-0 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    ✅ Verify & Enroll
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic py-4">No enrollments pending verification</p>
        )}
      </div>

      {/* 💰 Student Payments (UTR reported — verify to clear) */}
      <div className="bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-xl p-5 border-2 border-tofa-gold/20">
        <h2 className={sectionHeader}>💰 Student Payments (Renewal UTR)</h2>
        <p className="text-[10px] text-tofa-gold/70 mb-3">UTR reported — verify to clear</p>
        {paymentUnverified.length > 0 ? (
          <ul className="space-y-2">
            {paymentUnverified.map((s: { id: number; player_name: string; utr_number: string; payment_proof_url?: string | null; date?: string | null; amount?: string | number | null }) => (
              <li key={s.id} className="flex items-center gap-3 py-2 px-3 bg-white/5 rounded-lg border border-tofa-gold/10">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-white text-sm block truncate flex items-center gap-2">
                    {s.player_name}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-400/50 shrink-0">🔄 Renewal</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyUtr(s.utr_number)}
                    className="text-[10px] text-gray-400 font-mono hover:text-tofa-gold cursor-pointer text-left"
                    title="Copy UTR"
                  >
                    {s.utr_number} (copy)
                  </button>
                  <span className="text-[10px] text-gray-500 ml-2">{s.amount != null ? (typeof s.amount === 'number' ? `₹${s.amount}` : s.amount) : '—'}</span>
                  <span className="text-[10px] text-gray-500 ml-2">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</span>
                </div>
                {s.payment_proof_url ? (
                  <button
                    type="button"
                    onClick={() => setLightboxImage(s.payment_proof_url!)}
                    className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-tofa-gold/30 hover:border-tofa-gold bg-black/20"
                  >
                    <img src={s.payment_proof_url} alt="Proof" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <span className="flex-shrink-0 text-[10px] text-gray-500">No image</span>
                )}
                <button
                  type="button"
                  onClick={() => verifyPaymentMutation.mutate(s.id)}
                  disabled={verifyPaymentMutation.isPending}
                  className="flex-shrink-0 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  ✅ Verify
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic py-4">No payments pending verification</p>
        )}
      </div>

      {/* Lightbox for payment proof */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white text-2xl font-bold z-10"
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={lightboxImage}
            alt="Payment proof"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
