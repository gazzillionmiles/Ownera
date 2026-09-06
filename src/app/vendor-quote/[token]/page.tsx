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
  const [warrantyDays, setWarrantyDays] = useState<number>(30);
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
          warrantyDays,
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
      <div className="min-h-screen bg-[#121316] text-white flex flex-col items-center justify-center p-4 space-y-3">
        <Loader2 className="w-8 h-8 text-[#2CB7A5] animate-spin" />
        <p className="text-xs text-zinc-400">Loading campaign invitation...</p>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-[#121316] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <Briefcase className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold">Invitation Not Found</h1>
        <p className="text-xs text-zinc-400 max-w-sm">{error}</p>
        <Link href="/" className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold">
          Return to {APP_NAME} Home
        </Link>
      </div>
    );
  }

  const campaign = inviteData.campaign;
  const invite = inviteData.invite;

  return (
    <div className="min-h-screen bg-[#121316] text-white flex flex-col">
      <header className="border-b border-white/[0.08] bg-[#121316]/95 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2CB7A5] to-emerald-400 flex items-center justify-center text-zinc-950 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-white">{APP_NAME} Vendor Portal</span>
          </Link>
          <div className="text-[11px] font-mono text-zinc-400">
            Invited: <strong className="text-white">{invite.business_name}</strong>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Campaign Opportunity Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#18191D] to-[#141518] border border-[#2CB7A5]/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" /> {campaign.society?.name || 'Society Camp'}
            </div>
            <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5" /> Service Date: {campaign.event_date}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-white">{campaign.title}</h1>
            <p className="text-xs text-zinc-400 mt-1">
              {campaign.description || 'Residential society looking for verified service providers for high-density bulk camp.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-white/5 text-center text-xs">
            <div>
              <div className="text-zinc-400 text-[11px]">Society Demand</div>
              <div className="text-xl font-bold font-mono text-[#2CB7A5] mt-0.5">
                {campaign.target_customers || 30}+ Homes
              </div>
            </div>
            <div>
              <div className="text-zinc-400 text-[11px]">Society Location</div>
              <div className="text-sm font-bold text-zinc-200 mt-1">
                {campaign.society?.city || 'Bengaluru'}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-zinc-400 text-[11px]">Travel Time</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                0 Hours (1 Gate)
              </div>
            </div>
          </div>
        </div>

        {/* Existing Quote Banner */}
        {submittedQuote && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold">Your Offer of ₹{submittedQuote.price_per_unit}/unit is submitted!</div>
                <div className="text-[11px] text-emerald-400/80">You can update your capacity or price below anytime before acceptance.</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold uppercase text-[10px]">
              {submittedQuote.status}
            </span>
          </div>
        )}

        {/* Submit Offer Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#2CB7A5]" />
              <span>Submit Your Service Offer</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Set your bulk per-unit price and specify how many simultaneous houses your crew can handle.
            </p>
          </div>

          <form onSubmit={handleSubmitQuote} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Offer Price per Unit (₹)
                </label>
                <input
                  type="number"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(Number(e.target.value))}
                  required
                  min={100}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-base focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Start Time on Service Day
                </label>
                <input
                  type="text"
                  value={availableStartTime}
                  onChange={(e) => setAvailableStartTime(e.target.value)}
                  placeholder="e.g. 10:00 AM"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>
            </div>

            {/* Crew Capacity Config */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/5 space-y-3">
              <div className="text-xs font-bold text-[#2CB7A5] flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Crew &amp; Simultaneous Capacity</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                This dictates the scheduling slot capacity for residents (e.g. 5 technicians = 5 simultaneous flats per time slot).
              </p>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Team Size</label>
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
                    className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Simultaneous Flats</label>
                  <input
                    type="number"
                    value={simultaneousCapacity}
                    onChange={(e) => setSimultaneousCapacity(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Minutes / Unit</label>
                  <input
                    type="number"
                    value={estimatedDurationMinutes}
                    onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))}
                    min={15}
                    max={180}
                    className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 font-mono text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Total Daily Capacity (Units)
                </label>
                <input
                  type="number"
                  value={totalCapacity}
                  onChange={(e) => setTotalCapacity(Number(e.target.value))}
                  min={5}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Service Warranty (Days)
                </label>
                <input
                  type="number"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(Number(e.target.value))}
                  min={0}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Equipment &amp; Technician Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5] resize-none"
              />
            </div>

            {/* Potential Revenue Callout */}
            <div className="p-4 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Potential Day Revenue ({campaign.target_customers || 30} homes):</span>
              <span className="text-xl font-bold font-mono text-[#2CB7A5]">
                ₹{(pricePerUnit * (campaign.target_customers || 30)).toLocaleString()}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{submittedQuote ? 'Update Submitted Quote' : 'Submit Offer to Society Organizer'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
