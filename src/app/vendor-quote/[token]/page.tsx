'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  ShieldCheck,
  Send,
  Loader2,
  Layers,
  Wrench,
  DollarSign,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';

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
  const [availableDate, setAvailableDate] = useState<string>('');
  const [availableStartTime, setAvailableStartTime] = useState<string>('10:00 AM');
  const [simultaneousCapacity, setSimultaneousCapacity] = useState<number>(5);
  const [techniciansCount, setTechniciansCount] = useState<number>(5);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number>(30);
  const [totalCapacity, setTotalCapacity] = useState<number>(40);
  const [notes, setNotes] = useState<string>(
    'Dedicated team of technicians equipped with high-pressure jet pump and testing gauges.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<any>(null);

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

        if (data.campaign?.event_date) {
          setAvailableDate(data.campaign.event_date);
        }
        if (data.campaign?.current_price) {
          setPricePerUnit(Math.max(299, Math.round(data.campaign.current_price * 0.9)));
        }
        if (data.existing_quote) {
          setSubmittedQuote(data.existing_quote);
          setPricePerUnit(data.existing_quote.price_per_unit);
          setSimultaneousCapacity(data.existing_quote.simultaneous_capacity || 5);
          setTechniciansCount(data.existing_quote.technicians_count || 5);
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
    setSubmitting(true);
    try {
      const res = await fetch(`/api/vendor-quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricePerUnit,
          availableDate,
          availableStartTime,
          simultaneousCapacity,
          techniciansCount,
          estimatedDurationMinutes,
          totalCapacity,
          warrantyDays: 0,
          inclusions: ['Standard full checklist servicing', 'Inspection & pressure test'],
          exclusions: ['Parts replacement'],
          notes,
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
      <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col items-center justify-center p-4 space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading campaign invitation...</p>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <Briefcase className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Invitation Not Found</h1>
        <p className="text-xs text-slate-500 max-w-sm">{error}</p>
        <Link href="/" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
          Return to {APP_NAME} Home
        </Link>
      </div>
    );
  }

  const campaign = inviteData.campaign;
  const invite = inviteData.invite;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black">
              O
            </div>
            <span className="font-extrabold text-base text-slate-900">{APP_NAME.toLowerCase()} Vendor Portal</span>
          </Link>
          <div className="text-xs font-medium text-slate-500">
            Invited: <strong className="text-slate-900 font-bold">{invite.business_name}</strong>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Campaign Opportunity Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" /> {campaign.society?.name || 'Society Camp'}
            </div>
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Service Date: {campaign.event_date || 'Upcoming Weekend'}
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{campaign.title}</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              {campaign.description || 'Residential society looking for service partners for high-density bulk camp.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs">
            <div>
              <div className="text-slate-400 text-[11px] font-bold uppercase">Society Demand</div>
              <div className="text-xl font-black font-mono text-blue-600 mt-0.5">
                {campaign.target_customers || 30}+ Units
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px] font-bold uppercase">Location</div>
              <div className="text-sm font-bold text-slate-800 mt-1">
                {campaign.society?.city || 'Bengaluru'}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-slate-400 text-[11px] font-bold uppercase">Transit Waste</div>
              <div className="text-xl font-black font-mono text-emerald-600 mt-0.5">
                0 Hours (1 Gate)
              </div>
            </div>
          </div>
        </div>

        {/* Existing Quote Banner */}
        {submittedQuote && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-extrabold">Your Quote of ₹{submittedQuote.price_per_unit}/unit is submitted!</div>
                <div className="text-[11px] text-emerald-700">You can update your capacity or rate below anytime before committee acceptance.</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold uppercase text-[10px]">
              {submittedQuote.status}
            </span>
          </div>
        )}

        {/* Submit Offer Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span>Submit Commercial Quote</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Set your bulk per-unit rate and specify how many simultaneous flats your crew can service.
            </p>
          </div>

          <form onSubmit={handleSubmitQuote} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quote Price per Unit (₹)
                </label>
                <input
                  type="number"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(Number(e.target.value))}
                  required
                  min={100}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Start Arrival Time
                </label>
                <input
                  type="text"
                  value={availableStartTime}
                  onChange={(e) => setAvailableStartTime(e.target.value)}
                  placeholder="e.g. 10:00 AM"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Crew Capacity Config */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Crew &amp; Simultaneous Capacity</span>
              </div>
              <p className="text-[11px] text-slate-500">
                This dictates the scheduling slot capacity for residents (e.g. 5 technicians = 5 simultaneous flats per time slot).
              </p>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Crew Size</label>
                  <input
                    type="number"
                    value={techniciansCount}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      setTechniciansCount(count);
                      setSimultaneousCapacity(count);
                    }}
                    min={1}
                    max={50}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Simultaneous Flats</label>
                  <input
                    type="number"
                    value={simultaneousCapacity}
                    onChange={(e) => setSimultaneousCapacity(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Minutes / Unit</label>
                  <input
                    type="number"
                    value={estimatedDurationMinutes}
                    onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))}
                    min={15}
                    max={180}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Daily Capacity (Units)
              </label>
              <input
                type="number"
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(Number(e.target.value))}
                min={5}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Equipment &amp; Technician Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
              />
            </div>

            {/* Potential Revenue Callout */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between text-xs">
              <span className="text-slate-700 font-bold">Estimated Day Volume ({campaign.target_customers || 30} units):</span>
              <span className="text-xl font-black font-mono text-blue-600">
                ₹{(pricePerUnit * (campaign.target_customers || 30)).toLocaleString()}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{submittedQuote ? 'Update Submitted Quote' : 'Submit Quote to Society Committee'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
