'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { brandConfig } from '@tofa/core';
import { uploadFile } from '@/lib/api';
import { CheckCircle2, Camera, Smartphone, X, HelpCircle } from 'lucide-react';
import { LOSS_REASONS } from '@tofa/core';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

interface StudentData {
  id: number;
  lead_id: number;
  lead_player_name: string | null;
  lead_email: string | null;
  subscription_plan: string;
  subscription_start_date: string;
  subscription_end_date: string | null;
  kit_size: string | null;
  medical_info: string | null;
  secondary_contact: string | null;
  renewal_intent: boolean;
}

const KIT_SIZES = ['S', 'M', 'L', 'XL'];

const academyName = brandConfig.name || 'TOFA Academy';

function UTRGuide({ amount = 2500 }: { amount?: number }) {
  return (
    <div className="rounded-2xl border-2 border-[#D4AF37]/30 bg-black/60 backdrop-blur-md overflow-hidden max-w-[280px] mx-auto">
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

export default function RenewalPage() {
  const params = useParams();
  const token = params?.token as string;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoForm, setShowNoForm] = useState(false);
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonNotes, setLossReasonNotes] = useState('');

  const [email, setEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [kitSize, setKitSize] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');
  const [medicalInfo, setMedicalInfo] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentClicked, setPaymentClicked] = useState(false);
  const [showUtrGuide, setShowUtrGuide] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const plans = brandConfig.enrollmentPlans ?? [
    { value: 'Monthly', label: 'Monthly', months: 1, price: 2500 },
    { value: '3 Months', label: '3 Months', months: 3, price: 5000 },
    { value: '6 Months', label: '6 Months', months: 6, price: 11000 },
    { value: 'Yearly', label: 'Yearly', months: 12, price: 17500 },
  ];
  const planPrice = selectedPlan ? plans.find((p) => p.value === selectedPlan)?.price ?? 0 : 0;
  const utrDigits = utrNumber.replace(/\D/g, '');
  const utrInvalid = utrDigits.length > 0 && utrDigits.length !== 12;
  const hasUtrOrScreenshot = utrDigits.length === 12 || !!paymentProofUrl;
  const canSubmit = !!email.trim() && !!selectedPlan && !!startDate && paymentClicked && hasUtrOrScreenshot;

  useEffect(() => {
    if (!token) {
      setError('Invalid renewal link');
      setLoading(false);
      return;
    }
    axios
      .get<StudentData>(`${API_URL}/students/by-token/${token}`)
      .then((res) => {
        setStudent(res.data);
        if (res.data.renewal_intent) setSubmitted(true);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Invalid renewal link');
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!student || !showRenewForm) return;
    setEmail(student.lead_email ?? '');
    setSelectedPlan(student.subscription_plan || 'Monthly');
    setKitSize(student.kit_size ?? '');
    setMedicalInfo(student.medical_info ?? '');
    setSecondaryContact(student.secondary_contact ?? '');
    if (student.subscription_end_date) {
      const end = new Date(student.subscription_end_date);
      end.setDate(end.getDate() + 1);
      setStartDate(end.toISOString().split('T')[0]);
    } else {
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [student, showRenewForm]);

  const handlePaymentClick = () => {
    const upiId = (process.env.NEXT_PUBLIC_UPI_PAYEE_ID ?? brandConfig.upiId ?? 'yourname@ybl').trim();
    const u = new URL('upi://pay');
    u.searchParams.set('pa', upiId);
    u.searchParams.set('pn', brandConfig.shortName || 'TOFA');
    u.searchParams.set('am', String(planPrice || 2500));
    u.searchParams.set('tn', `renew-${student?.lead_id ?? 0}`);
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

  const handleSubmitRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUtrOrScreenshot) {
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
      await axios.post(`${API_URL}/students/renew-confirm/${token}`, {
        subscription_plan: selectedPlan,
        subscription_start_date: startDate,
        utr_number: utrDigits.length === 12 ? utrDigits : undefined,
        payment_proof_url: paymentProofUrl || undefined,
        kit_size: kitSize.trim() || undefined,
        medical_info: medicalInfo.trim() || undefined,
        secondary_contact: secondaryContact.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Renewal submitted! We will verify your payment and get in touch.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotRenewing = async () => {
    if (!token || !lossReason) {
      toast.error('Please select a reason');
      return;
    }
    if (lossReason === 'Other' && !lossReasonNotes.trim()) {
      toast.error('Please provide details for "Other"');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/public/lead-feedback/${token}`, {
        loss_reason: lossReason,
        loss_reason_notes: lossReasonNotes || null,
      });
      setSubmitted(true);
      toast.success(`We have recorded your feedback. We hope to see you again soon!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass = 'rounded-2xl border border-[#D4AF37]/40 bg-white/5 backdrop-blur-md p-5 sm:p-6';
  const inputBase = 'w-full px-4 py-3.5 text-white bg-[#0f2744] border border-[#D4AF37]/30 rounded-xl placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-4">
        <p className="text-[#D4AF37]/90">Loading...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-4">
        <div className={`${cardClass} max-w-md w-full text-center`}>
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-[#D4AF37]">Invalid Link</h1>
          <p className="text-white/80 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  if (!student) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-4">
        <p className="text-white/80">No student data found</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-4">
        <div className={`${cardClass} max-w-md w-full text-center`}>
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-black text-[#D4AF37] uppercase tracking-tight">Thank you!</h1>
          <p className="text-white/90 mt-2">
            {lossReason
              ? 'We have recorded your feedback. We hope to see you again soon!'
              : 'Renewal submitted. We will verify your payment and get in touch shortly.'}
          </p>
        </div>
      </div>
    );
  }

  if (showRenewForm) {
    return (
      <div className="min-h-screen bg-[#0A192F] py-6 sm:py-8 px-4 sm:px-5">
        <div className="max-w-lg mx-auto">
          <div className={`${cardClass} mb-6 text-center`}>
            <h1 className="text-xl font-black text-[#D4AF37] uppercase tracking-tight">Renew subscription</h1>
            <p className="text-white/90 mt-2">{student.lead_player_name || 'Your child'} · {academyName}</p>
          </div>

          <form onSubmit={handleSubmitRenewal} className="space-y-6">
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black">1</span>
                Profile
              </h2>
              <label className="block text-white/80 text-sm mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required className={inputBase} />
            </div>

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

            <div className={cardClass}>
              <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-black">3</span>
                Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm mb-1">Renewal start date</label>
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
                  <textarea value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} placeholder="Any allergies or conditions" rows={2} className={inputBase} />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-1">Secondary contact (optional)</label>
                  <input type="tel" value={secondaryContact} onChange={(e) => setSecondaryContact(e.target.value)} placeholder="Phone" className={inputBase} />
                </div>
              </div>
            </div>

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
                      <label className="text-white/80 text-sm">12-digit UTR (optional if you upload screenshot)</label>
                      <button type="button" onClick={() => setShowUtrGuide(!showUtrGuide)} className="text-[#D4AF37]/90 text-xs flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" /> {showUtrGuide ? 'Hide guide' : 'Need help?'}
                      </button>
                    </div>
                    <input type="text" inputMode="numeric" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} onFocus={() => setShowUtrGuide(true)} placeholder="Enter 12 digits" maxLength={12} className={`${inputBase} font-mono ${utrInvalid ? 'border-red-500' : ''}`} />
                    {utrInvalid && <p className="text-red-400 text-sm mt-1">UTR must be exactly 12 digits.</p>}
                    {showUtrGuide && <div className="mt-4"><UTRGuide amount={planPrice} /></div>}
                  </div>
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Payment screenshot (optional if you enter UTR)</label>
                    {paymentProofUrl ? (
                      <div className="relative inline-block">
                        <img src={paymentProofUrl} alt="Proof" className="h-20 w-20 object-cover rounded-xl border-2 border-[#D4AF37]/30" />
                        <button type="button" onClick={() => setPaymentProofUrl(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center" aria-label="Remove"><X className="w-3.5 h-3.5" /></button>
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
              <button type="submit" disabled={submitting || !canSubmit} className="w-full mt-6 py-4 bg-[#0A192F] text-[#D4AF37] font-black rounded-xl border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider">
                {submitting ? 'Submitting...' : 'Submit renewal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A192F] py-8 px-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className={`${cardClass} text-center mb-6`}>
          <div className="text-5xl mb-4">🎾</div>
          <h1 className="text-2xl font-bold text-[#D4AF37] mb-2">Hi {student.lead_email ? student.lead_email.split('@')[0] : 'Parent'},</h1>
          <p className="text-white/90">
            <span className="font-semibold">{student.lead_player_name || 'Your child'}'s</span> subscription ends on{' '}
            <span className="font-bold text-[#D4AF37]">{formatDate(student.subscription_end_date)}</span>.
          </p>
          <p className="text-white/80 mt-4 font-medium">Ready for the next term?</p>
        </div>

        {!showNoForm ? (
          <>
            <button
              onClick={() => setShowRenewForm(true)}
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>✅</span> Yes, I want to renew!
            </button>
            <button
              onClick={() => setShowNoForm(true)}
              disabled={submitting}
              className="w-full py-3 mt-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 border border-[#D4AF37]/30"
            >
              I am not renewing
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[#D4AF37]">Reason for not renewing <span className="text-red-400">*</span></label>
            <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className={inputBase} required>
              <option value="">Select a reason...</option>
              {LOSS_REASONS.map((r) => <option key={r} value={r} className="bg-[#0f2744] text-white">{r}</option>)}
            </select>
            {(lossReason === 'Other' || lossReason) && (
              <textarea value={lossReasonNotes} onChange={(e) => setLossReasonNotes(e.target.value)} rows={4} className={inputBase} placeholder={lossReason === 'Other' ? 'Please specify...' : 'Additional comments (optional)'} />
            )}
            <div className="flex gap-3">
              <button onClick={handleNotRenewing} disabled={submitting || !lossReason || (lossReason === 'Other' && !lossReasonNotes.trim())} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <button onClick={() => { setShowNoForm(false); setLossReason(''); setLossReasonNotes(''); }} disabled={submitting} className="px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
