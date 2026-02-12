'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { brandConfig } from '@tofa/core';
import { uploadFile } from '@/lib/api';
import { CheckCircle2, Camera, Smartphone, X, HelpCircle } from 'lucide-react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

interface JoinDataLead {
  type: 'lead';
  lead_id: number;
  player_name: string;
  center_name: string;
  plan_price?: number | null;
  link_expires_at?: string | null;
  batches?: Array<{ id: number; name: string; schedule: string; time: string }>;
}

interface JoinDataStudent {
  type: 'student';
  lead_id: number;
  student_id: number;
  player_name: string;
  center_name: string;
  plan_name: string;
  plan_price?: number | null;
}

type JoinData = JoinDataLead | JoinDataStudent;

const KIT_SIZES = ['S', 'M', 'L', 'XL'];

const academyName = brandConfig.name || 'TOFA Academy';

function UTRGuide({ amount = 2500 }: { amount?: number }) {
  return (
    <div className="rounded-2xl border-2 border-[#D4AF37]/30 bg-black/60 backdrop-blur-md overflow-hidden max-w-[280px] mx-auto">
      {/* Phone frame */}
      <div className="p-3 border border-white/10 rounded-xl bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="h-1.5 w-12 rounded-full bg-slate-600 mx-auto mb-3" />
        <div className="bg-emerald-500/20 border border-emerald-400/50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-emerald-200/90 uppercase tracking-wider">Success</p>
            <p className="text-white font-semibold">Paid to {academyName}</p>
            <p className="text-emerald-200 text-sm">₹{amount.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-3 p-2 bg-slate-800/80 rounded-lg space-y-1 text-xs text-white/80">
          <p className="text-[10px] font-bold text-red-400 uppercase">This is your UTR / Ref number</p>
          <span className="inline-block animate-pulse px-2 py-1.5 rounded border-2 border-red-500 bg-red-500/20 text-white font-mono font-bold tracking-wider">
            4059 1234 5678
          </span>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<JoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [paymentClicked, setPaymentClicked] = useState(false);
  const [showUtrGuide, setShowUtrGuide] = useState(false);

  const [email, setEmail] = useState('');
  const [batchId, setBatchId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [kitSize, setKitSize] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');
  const [medicalInfo, setMedicalInfo] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    axios
      .get<JoinData>(`${API_URL}/public/join/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        toast.error(err.response?.data?.detail || 'Invalid or expired link');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const isLead = data?.type === 'lead';
  const leadData = isLead ? (data as JoinDataLead) : null;
  const batches = leadData?.batches ?? [];
  const linkExpiresAt = leadData?.link_expires_at;
  const isExpired = linkExpiresAt ? new Date(linkExpiresAt) < new Date() : false;

  const plans = brandConfig.enrollmentPlans ?? [
    { value: 'Monthly', label: 'Monthly', months: 1, price: 2500 },
    { value: '3 Months', label: '3 Months', months: 3, price: 5000 },
    { value: '6 Months', label: '6 Months', months: 6, price: 11000 },
    { value: 'Yearly', label: 'Yearly', months: 12, price: 17500 },
  ];
  const planPrice = selectedPlan ? plans.find((p) => p.value === selectedPlan)?.price ?? 0 : 0;
  const utrDigits = utrNumber.replace(/\D/g, '');
  const utrInvalid = utrDigits.length > 0 && utrDigits.length !== 12;

  const handlePaymentClick = () => {
    const upiId = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_UPI_PAYEE_ID) ? process.env.NEXT_PUBLIC_UPI_PAYEE_ID : (brandConfig.upiId || 'yourname@ybl');
    const am = String(planPrice || 2500);
    const pn = brandConfig.shortName || 'TOFA';
    const tn = `${pn}-${leadData?.lead_id ?? 0}`;
    const u = new URL('upi://pay');
    u.searchParams.set('pa', upiId);
    u.searchParams.set('pn', pn);
    u.searchParams.set('am', am);
    u.searchParams.set('tn', tn);
    u.searchParams.set('cu', 'INR');
    window.location.href = u.toString();
    setPaymentClicked(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image (screenshot)');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, 'payment-proofs');
      setPaymentProofUrl(url);
      toast.success('Screenshot uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveScreenshot = () => {
    setPaymentProofUrl(null);
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email?.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!batchId) {
      toast.error('Please select a batch');
      return;
    }
    if (!startDate) {
      toast.error('Please select a start date');
      return;
    }
    if (!selectedPlan) {
      toast.error('Please select a subscription plan');
      return;
    }
    const hasUtr = utrDigits.length === 12;
    const hasScreenshot = !!paymentProofUrl;
    if (!hasUtr && !hasScreenshot) {
      toast.error('Provide at least one: UTR (12 digits) or payment screenshot');
      return;
    }
    if (utrDigits.length > 0 && utrDigits.length !== 12) {
      toast.error('UTR must be exactly 12 digits');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/public/lead-enrollment/${token}`, {
        email: email.trim(),
        subscription_plan: selectedPlan,
        start_date: startDate,
        batch_id: batchId,
        utr_number: utrDigits.length === 12 ? utrDigits : undefined,
        payment_proof_url: paymentProofUrl || undefined,
        kit_size: kitSize.trim() || undefined,
        medical_info: medicalInfo.trim() || undefined,
        secondary_contact: secondaryContact.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Submitted! We will verify your payment and get in touch.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasUtr = utrDigits.length === 12;
    const hasScreenshot = !!paymentProofUrl;
    if (!hasUtr && !hasScreenshot) {
      toast.error('Provide at least one: UTR (12 digits) or payment screenshot');
      return;
    }
    if (utrDigits.length > 0 && utrDigits.length !== 12) {
      toast.error('UTR must be exactly 12 digits');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/public/join/${token}`, {
        kit_size: kitSize.trim() || undefined,
        secondary_contact: secondaryContact.trim() || undefined,
        medical_info: medicalInfo.trim() || undefined,
        utr_number: utrDigits.length === 12 ? utrDigits : undefined,
        payment_proof_url: paymentProofUrl || undefined,
      });
      setSubmitted(true);
      toast.success('Submitted! Welcome to the family.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    'w-full px-4 py-3.5 text-white bg-[#0f2744] border border-[#D4AF37]/30 rounded-xl placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition';

  const cardClass = 'rounded-2xl border border-[#D4AF37]/40 bg-white/5 backdrop-blur-md p-5 sm:p-6';

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A192F] px-4">
        <p className="text-[#D4AF37]/90">{loading ? 'Loading...' : 'Invalid or expired link.'}</p>
      </div>
    );
  }

  if (isLead && isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0A192F]">
        <div className={`${cardClass} max-w-md w-full text-center`}>
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-black text-[#D4AF37] uppercase tracking-tight">Link Expired</h1>
          <p className="text-white/90 mt-2">This enrollment link has expired. Please contact the Academy to request a new one.</p>
        </div>
      </div>
    );
  }

  if (submitted && isLead) {
    const batch = batches.find((b) => b.id === batchId);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#0A192F]">
        <div className={`${cardClass} max-w-md w-full text-center`}>
          <div className="text-6xl mb-4">⚽</div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#D4AF37] uppercase tracking-tight">
            ⚽ Welcome to the squad!
          </h1>
          <p className="text-white/90 mt-3">
            Thanks for enrolling. We&apos;ll verify your payment and get in touch soon.
          </p>
          {batch && (
            <div className="mt-6 p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30">
              <p className="text-xs text-[#D4AF37]/90 uppercase tracking-wider">Your batch</p>
              <p className="text-white font-bold mt-1">{batch.name}</p>
              <p className="text-white/80 text-sm mt-0.5">{batch.schedule}{batch.time ? ` · ${batch.time}` : ''}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (submitted && !isLead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0A192F]">
        <div className={`${cardClass} max-w-md w-full text-center`}>
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-black text-[#D4AF37] uppercase tracking-tight">Payment Received!</h1>
          <p className="text-white/90 mt-2">Thank you. We will verify your payment and get in touch.</p>
        </div>
      </div>
    );
  }

  if (!isLead) {
    const studentData = data as JoinDataStudent;
    const planPriceVal = studentData.plan_price ?? 2500;
    const handleRenewalPaymentClick = () => {
      const upiId = process.env?.NEXT_PUBLIC_UPI_PAYEE_ID ?? brandConfig.upiId ?? 'yourname@ybl';
      const u = new URL('upi://pay');
      u.searchParams.set('pa', upiId);
      u.searchParams.set('pn', brandConfig.shortName || 'TOFA');
      u.searchParams.set('am', String(planPriceVal));
      u.searchParams.set('tn', `renew-${studentData.lead_id}`);
      u.searchParams.set('cu', 'INR');
      window.location.href = u.toString();
      setPaymentClicked(true);
    };
    return (
      <div className="min-h-screen bg-[#0A192F] py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className={`${cardClass} mb-6 text-center`}>
            <h1 className="text-xl font-black text-[#D4AF37] uppercase tracking-tight">Enrollment & Payment</h1>
            <p className="text-white/90 mt-2">Renewing for {studentData.player_name} · {studentData.plan_name}</p>
          </div>
          <form onSubmit={handleSubmitRenewal} className="space-y-5">
            <div className={cardClass}>
              <button type="button" onClick={handleRenewalPaymentClick} className="w-full py-4 bg-gradient-to-r from-[#D4AF37] via-amber-500 to-[#D4AF37] text-[#0A192F] font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg">
                <Smartphone className="w-5 h-5" />
                Pay via UPI
              </button>
              {paymentClicked && (
                <>
                  <p className="text-white/70 text-sm mt-3">UTR or screenshot (at least one required). Both accepted.</p>
                  <div className="mt-2">
                    <input type="text" inputMode="numeric" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit UTR (optional if you upload screenshot)" maxLength={12} className={inputBase} />
                    {utrDigits.length > 0 && utrDigits.length !== 12 && <p className="text-red-400 text-sm mt-1">UTR must be exactly 12 digits.</p>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full py-3.5 border-2 border-dashed border-[#D4AF37]/40 rounded-xl text-[#D4AF37]/90 flex items-center justify-center gap-2 mt-3">
                    {paymentProofUrl ? <><CheckCircle2 /> Success</> : uploading ? 'Uploading...' : <><Camera /> Upload Screenshot</>}
                  </button>
                </>
              )}
            </div>
            <button type="submit" disabled={submitting || !paymentClicked || !(utrDigits.length === 12 || paymentProofUrl)} className="w-full py-4 bg-[#0A192F] text-[#D4AF37] font-bold rounded-xl border-2 border-[#D4AF37]/50 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const hasUtrOrScreenshot = utrDigits.length === 12 || !!paymentProofUrl;
  const canSubmit =
    !!email.trim() &&
    !!selectedPlan &&
    !!batchId &&
    !!startDate &&
    paymentClicked &&
    hasUtrOrScreenshot;

  return (
    <div className="min-h-screen bg-[#0A192F] py-6 sm:py-8 px-4 sm:px-5">
      <div className="max-w-lg mx-auto">
        <div className={`${cardClass} mb-6 text-center`}>
          <h1 className="text-xl font-black text-[#D4AF37] uppercase tracking-tight">Welcome to {brandConfig.name || 'TOFA'}</h1>
          <p className="text-white/90 mt-2">{leadData!.player_name} · {leadData!.center_name}</p>
        </div>

        <form onSubmit={handleSubmitLead} className="space-y-6">
          {/* 1. PROFILE VERIFICATION */}
          <div className={cardClass}>
            <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black">1</span>
              Profile verification
            </h2>
            <label className="block text-white/80 text-sm mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required className={`${inputBase} mb-1`} />
          </div>

          {/* 2. PLAN SELECTION */}
          <div className={cardClass}>
            <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black">2</span>
              Plan selection
            </h2>
            <p className="text-white/70 text-sm mb-3">Choose your membership</p>
            <div className="grid grid-cols-2 gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => setSelectedPlan(plan.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === plan.value
                      ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                      : 'border-[#D4AF37]/25 text-white/90 hover:border-[#D4AF37]/50 bg-white/5'
                  }`}
                >
                  <div className="font-bold text-sm">{plan.label}</div>
                  <div className="text-lg font-black text-white mt-0.5">₹{plan.price.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. ACADEMY DETAILS */}
          <div className={cardClass}>
            <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black">3</span>
              Academy details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-1">Batch</label>
                <select value={batchId} onChange={(e) => setBatchId(e.target.value ? Number(e.target.value) : '')} required className={inputBase}>
                  <option value="">Select batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-[#0f2744] text-white">{b.name} · {b.schedule} {b.time ? `· ${b.time}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} className={inputBase} />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Kit size (optional)</label>
                <select value={kitSize} onChange={(e) => setKitSize(e.target.value)} className={inputBase}>
                  <option value="">Select</option>
                  {KIT_SIZES.map((s) => <option key={s} value={s} className="bg-[#0f2744] text-white">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Medical / allergy info (optional)</label>
                <textarea value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} placeholder="Any allergies or conditions we should know" rows={2} className={inputBase} />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Secondary contact (optional)</label>
                <input type="tel" value={secondaryContact} onChange={(e) => setSecondaryContact(e.target.value)} placeholder="Phone" className={inputBase} />
              </div>
            </div>
          </div>

          {/* 4. PAYMENT & CONFIRMATION */}
          <div className={cardClass}>
            <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black">4</span>
              Payment & confirmation
            </h2>
            <button type="button" onClick={handlePaymentClick} disabled={!selectedPlan} className="w-full py-4 bg-gradient-to-r from-[#D4AF37] via-amber-500 to-[#D4AF37] text-[#0A192F] font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              <Smartphone className="w-5 h-5" />
              Pay ₹{planPrice.toLocaleString()} via UPI
            </button>
            {paymentClicked && (
              <div className="mt-5 space-y-4">
                <p className="text-white/70 text-sm">UTR or screenshot (at least one required). Both accepted.</p>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-white/80 text-sm">12-digit UTR / Reference number (optional if you upload screenshot)</label>
                    <button type="button" onClick={() => setShowUtrGuide(!showUtrGuide)} className="text-[#D4AF37]/90 text-xs flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showUtrGuide ? 'Hide guide' : 'Need help finding UTR?'}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    onFocus={() => setShowUtrGuide(true)}
                    placeholder="Enter 12 digits"
                    maxLength={12}
                    className={`${inputBase} font-mono ${utrInvalid ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  />
                  {utrInvalid && <p className="text-red-400 text-sm mt-1">UTR must be exactly 12 digits.</p>}
                  {showUtrGuide && (
                    <div className="mt-4">
                      <UTRGuide amount={planPrice} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-white/80 text-sm block mb-1">Payment screenshot (optional if you enter UTR)</label>
                  {paymentProofUrl ? (
                    <div className="relative inline-block">
                      <img src={paymentProofUrl} alt="Payment proof" className="h-20 w-20 object-cover rounded-xl border-2 border-[#D4AF37]/30" />
                      <button type="button" onClick={handleRemoveScreenshot} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center" aria-label="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full py-3.5 border-2 border-dashed border-[#D4AF37]/40 rounded-xl text-[#D4AF37]/90 flex items-center justify-center gap-2">
                        {uploading ? 'Uploading...' : <><Camera className="w-5 h-5" /> Upload payment screenshot</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={submitting || !canSubmit} className="w-full mt-6 py-4 bg-[#0A192F] text-[#D4AF37] font-black rounded-xl border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#D4AF37]">
              {submitting ? 'Submitting...' : 'Submit enrollment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
