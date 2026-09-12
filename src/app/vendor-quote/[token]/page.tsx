'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  Users,
  CheckCircle2,
  Send,
  Loader2,
  Clock,
  Sparkles,
  AlertCircle,
  Phone,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';

const CLOSED_STATUSES = [
  'quote_selected',
  'booking_open',
  'confirmed',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

export default function VendorQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Quote form state
  const [pricePerUnit, setPricePerUnit] = useState<number>(499);
  const [availableStartTime, setAvailableStartTime] = useState<string>('10:00 AM');
  const [techniciansCount, setTechniciansCount] = useState<number>(3);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number>(30);
  const [notes, setNotes] = useState<string>(
    'Professional team with full service tools and equipment.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<any>(null);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);

  const handleMarkJobCompleted = async (bookingId: string) => {
    setCompletingBookingId(bookingId);
    try {
      const res = await fetch(`/api/vendor-quote/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update job');

      toast.success(data.message || 'Job marked completed! Resident notified for rating.');
      // Optimistically update local booking status
      setInviteData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookings: (prev.bookings || []).map((b: any) =>
            b.id === bookingId ? { ...b, status: 'completed' } : b
          ),
        };
      });
    } catch (err: any) {
      toast.error(err.message || 'Error updating job');
    } finally {
      setCompletingBookingId(null);
    }
  };

  useEffect(() => {
    async function loadInvite() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/vendor-quote/${token}`);
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || 'Invalid or expired invitation link');
        }
        const data = await res.json();
        setInviteData(data);

        if (data.campaign?.current_price) {
          setPricePerUnit(Math.max(199, Math.round(data.campaign.current_price * 0.9)));
        }
        if (data.existing_quote) {
          setSubmittedQuote(data.existing_quote);
          setPricePerUnit(data.existing_quote.price_per_unit || 499);
          setTechniciansCount(data.existing_quote.technicians_count || 3);
          setEstimatedDurationMinutes(data.existing_quote.estimated_duration_minutes || 30);
          if (data.existing_quote.available_start_time) {
            setAvailableStartTime(data.existing_quote.available_start_time);
          }
          if (data.existing_quote.notes) {
            setNotes(data.existing_quote.notes);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [token]);

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricePerUnit || pricePerUnit < 50) {
      toast.error('Please enter a valid price per home');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/vendor-quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricePerUnit: Number(pricePerUnit),
          availableDate: inviteData.campaign?.event_date || new Date().toISOString().split('T')[0],
          availableStartTime: availableStartTime.trim() || '10:00 AM',
          techniciansCount: Number(techniciansCount) || 3,
          simultaneousCapacity: Number(techniciansCount) || 3,
          estimatedDurationMinutes: Number(estimatedDurationMinutes) || 30,
          totalCapacity: (Number(techniciansCount) || 3) * 8,
          warrantyDays: 0,
          inclusions: ['Full service check', 'Standard cleaning & testing'],
          exclusions: ['Parts replacement'],
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit quote');
      }

      toast.success(data.message || 'Quote submitted successfully!');
      setSubmittedQuote(data.bid);
    } catch (err: any) {
      toast.error(err.message || 'Error submitting quote');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 space-y-3">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading service details...</p>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Link Not Available</h1>
        <p className="text-sm text-slate-500 max-w-sm">{error || 'This invitation link is expired or invalid.'}</p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm"
        >
          Go to {APP_NAME}
        </Link>
      </div>
    );
  }

  const campaign = inviteData.campaign || {};
  const invite = inviteData.invite || {};
  const targetHomes = campaign.target_customers || 20;
  const estimatedEarnings = (pricePerUnit || 0) * targetHomes;
  const isClosed = CLOSED_STATUSES.includes(campaign.status);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              O
            </div>
            <span className="font-bold text-base text-slate-900">{APP_NAME}</span>
          </Link>
          <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
            Invited: <strong className="text-slate-900">{invite.business_name}</strong>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Service Request Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              <span>{campaign.society?.name || 'Residential Society'}</span>
              {campaign.society?.city ? <span>• {campaign.society.city}</span> : null}
            </div>
            {campaign.event_date && (
              <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Service Date: <strong className="text-slate-800">{campaign.event_date}</strong>
              </span>
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {campaign.title}
            </h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              {campaign.description || 'The residents of this society are booking this service together on the scheduled date.'}
            </p>
          </div>

          {/* Simple Demand Highlight (No transit waste) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Society Demand
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {targetHomes} Homes Interested
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Single Visit</span>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                Bulk Booking
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Quote Selected & Service Day Checklist */}
        {inviteData.is_selected ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Accepted Banner */}
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <h2 className="font-extrabold text-base text-emerald-950">
                  🎉 Your Quote Was Accepted by the Society!
                </h2>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                You are the designated service partner for this service camp. Below is your confirmed apartment checklist. Tap &quot;Mark Done&quot; as you complete each home.
              </p>
            </div>

            {/* Service Day Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                  Booked Homes
                </span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block font-mono">
                  {inviteData.bookings?.length || 0}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                  Completed
                </span>
                <span className="text-xl font-black text-emerald-600 mt-0.5 block font-mono">
                  {inviteData.bookings?.filter((b: any) => b.status === 'completed').length || 0} / {inviteData.bookings?.length || 0}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                  Total to Collect
                </span>
                <span className="text-xl font-black text-teal-700 mt-0.5 block font-mono">
                  ₹{((inviteData.bookings || []).reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Confirmed Society Jobs Checklist */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-teal-600" />
                    <span>Apartment Checklist &amp; Routing</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visit apartments in order of their coordinated arrival slots.
                  </p>
                </div>
              </div>

              {!inviteData.bookings || inviteData.bookings.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Residents are currently booking time slots
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Confirmed apartment visits and scheduled arrival times will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inviteData.bookings.map((b: any) => {
                    const isDone = b.status === 'completed';
                    const isCompleting = completingBookingId === b.id;

                    return (
                      <div
                        key={b.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDone
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200/80">
                              Unit {b.flat_number}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{b.slot_time}</span>
                            </span>
                            <span className="text-xs font-extrabold text-emerald-700 font-mono">
                              ₹{b.total_amount}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 font-medium">
                            <span>Resident: <strong className="text-slate-800">{b.resident_name}</strong></span>
                            {b.resident_phone && (
                              <span className="ml-2 inline-flex items-center gap-1">
                                • <Phone className="w-3 h-3 text-teal-600" />
                                <a
                                  href={`tel:${b.resident_phone}`}
                                  className="text-teal-700 hover:underline font-semibold"
                                >
                                  {b.resident_phone}
                                </a>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="self-end sm:self-auto shrink-0">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Completed</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkJobCompleted(b.id)}
                              disabled={isCompleting}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {isCompleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>{isCompleting ? 'Updating...' : 'Mark Done'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : isClosed ? (
          /* Closed notice */
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <div className="font-semibold">Quotes Closed for this Date</div>
              <div className="text-xs text-amber-800 mt-0.5">
                The society has completed vendor selection. Thank you for your interest!
              </div>
            </div>
          </div>
        ) : null}

        {/* Submitted Banner */}
        {submittedQuote && !isClosed && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950">
                  Quote Submitted: ₹{submittedQuote.price_per_unit} per home
                </div>
                <div className="text-xs text-emerald-800 mt-0.5">
                  The organizer has received your price. You can update your details anytime below.
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-200/60 text-emerald-900 font-medium text-xs shrink-0">
              Active
            </span>
          </div>
        )}

        {/* Quote Form */}
        {!isClosed && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {submittedQuote ? 'Update Your Quote' : 'Send Your Price Quote'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fill in your rate and team arrival time. No commission is deducted.
              </p>
            </div>

            <form onSubmit={handleSubmitQuote} className="space-y-5">
              {/* Price per home */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Your Price Per Home (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={pricePerUnit || ''}
                    onChange={(e) => setPricePerUnit(Number(e.target.value))}
                    required
                    min={50}
                    step={10}
                    placeholder="e.g. 499"
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Amount each flat owner will pay you for this service.
                </p>
              </div>

              {/* Dynamic Earnings Calculation */}
              <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>Your Estimated Total Earnings</span>
                  </div>
                  <span className="text-xs text-teal-700 font-medium">
                    {targetHomes} homes
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-teal-200/60">
                  <span className="text-xs text-teal-800">
                    ₹{(pricePerUnit || 0).toLocaleString('en-IN')} × {targetHomes} homes
                  </span>
                  <span className="text-2xl font-extrabold text-teal-950 font-mono">
                    ₹{estimatedEarnings.toLocaleString('en-IN')}
                  </span>
                </div>

                <p className="text-[11px] text-teal-700 pt-0.5">
                  Paid directly to you by each resident on service day.
                </p>
              </div>

              {/* Arrival time and crew size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                    Arrival Time
                  </label>
                  <input
                    type="text"
                    value={availableStartTime}
                    onChange={(e) => setAvailableStartTime(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    What time will your team arrive at the society gate?
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    <Users className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                    Number of Technicians
                  </label>
                  <input
                    type="number"
                    value={techniciansCount || ''}
                    onChange={(e) => setTechniciansCount(Math.max(1, Number(e.target.value)))}
                    min={1}
                    max={50}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    How many technicians will be in your team?
                  </p>
                </div>
              </div>

              {/* Service duration */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Time Needed per Home (Minutes)
                </label>
                <input
                  type="number"
                  value={estimatedDurationMinutes || ''}
                  onChange={(e) => setEstimatedDurationMinutes(Math.max(10, Number(e.target.value)))}
                  min={10}
                  max={240}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Roughly how many minutes does one flat take (e.g. 30 or 45 mins)?
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Notes for Society Residents (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. We bring our own ladders, pressure pumps, and cleaning materials."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white resize-none transition"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{submittedQuote ? 'Update My Quote' : 'Send Quote to Society'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
