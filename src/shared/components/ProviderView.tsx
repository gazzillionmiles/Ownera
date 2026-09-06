'use client';

import React, { useState } from 'react';
import {
  ServiceCampaign,
  Booking,
  Provider,
  ProviderBid,
} from '@/src/types/ownera';
import { BaseUserProfile } from '@/src/types/auth';
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Layers,
  Check,
  Plus,
  ShieldCheck,
  X,
  Phone,
  ArrowRight,
  Star,
  MapPin,
  CheckSquare,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProviderViewProps {
  campaigns: ServiceCampaign[];
  providerBookings: Booking[];
  providerBids: ProviderBid[];
  providerProfile: Provider | null;
  user: BaseUserProfile;
  activeTab: string;
  onRefresh: () => void;
}

export const ProviderView: React.FC<ProviderViewProps> = ({
  campaigns,
  providerBookings,
  providerBids,
  providerProfile,
  user,
  activeTab,
  onRefresh,
}) => {
  const [biddingCampaign, setBiddingCampaign] = useState<ServiceCampaign | null>(null);
  const [bidPrice, setBidPrice] = useState(499);
  const [availableStartTime, setAvailableStartTime] = useState('10:00 AM');
  const [simultaneousCapacity, setSimultaneousCapacity] = useState(5);
  const [techniciansCount, setTechniciansCount] = useState(5);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(30);
  const [totalCapacity, setTotalCapacity] = useState(40);
  const [bidWarranty, setBidWarranty] = useState(45);
  const [bidNotes, setBidNotes] = useState('Dedicated 5-technician mobile crew on site with commercial jet equipment.');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);

  const handleOpenBidModal = (camp: ServiceCampaign) => {
    setBiddingCampaign(camp);
    setBidPrice(camp.current_price ? Math.max(300, camp.current_price - 50) : 499);
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingCampaign) return;

    setIsSubmittingBid(true);
    try {
      const res = await fetch('/api/providers/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: biddingCampaign.id,
          pricePerUnit: bidPrice,
          availableDate: biddingCampaign.event_date,
          availableStartTime,
          simultaneousCapacity,
          techniciansCount,
          estimatedDurationMinutes,
          totalCapacity,
          maxCapacity: totalCapacity,
          serviceDurationMinutes: estimatedDurationMinutes,
          warrantyDays: bidWarranty,
          inclusions: ['Full standardized checklist servicing', 'Inspection & pressure test'],
          exclusions: ['Parts replacement'],
          notes: bidNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quote');

      toast.success(data.message || `Quote of ₹${bidPrice} submitted!`);
      setBiddingCampaign(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Error submitting quote');
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleMarkJobCompleted = async (bookingId: string) => {
    setCompletingBookingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Standard checklist completed on site.' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark completion');

      toast.success('Job marked completed! Resident notified for rating.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Error updating job');
    } finally {
      setCompletingBookingId(null);
    }
  };

  const confirmedCount = providerBookings.length;
  const completedCount = providerBookings.filter((b) => b.status === 'completed').length;
  const expectedRevenue = providerBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) ||
    campaigns.reduce((sum, c) => sum + ((c.confirmed_count || 0) * (c.current_price || 0)), 0);

  // -------------------------------------------------------------
  // TAB 1: OVERVIEW & CONCENTRATED DEMAND ECONOMICS
  // -------------------------------------------------------------
  if (activeTab === 'overview') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        {/* Economic Value Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#18191D] via-[#16171B] to-[#121316] border border-[#2CB7A5]/30 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5" /> High-Density Concentrated Demand
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {campaigns[0]?.title || 'Society Service Camps'}
              </h1>
              <p className="text-xs text-zinc-400">
                {campaigns[0]?.society?.name ? `${campaigns[0].society.name} • ` : ''}Single Residential Complex • Concentrated Service Day
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 text-right">
              <div className="text-xs text-zinc-400">Single-Day Volume Opportunity</div>
              <div className="text-3xl font-extrabold text-[#2CB7A5] font-mono">
                ₹{expectedRevenue.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                {confirmedCount > 0 ? `${confirmedCount} Confirmed Bookings` : `${campaigns.reduce((acc, c) => acc + (c.confirmed_count || 0), 0)} Confirmed Society Homes`}
              </div>
            </div>
          </div>

          {/* Economic Efficiency Comparison */}
          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-1">
              <div className="text-zinc-400">Service Location</div>
              <div className="text-2xl font-bold font-mono text-emerald-400">1 Society Complex</div>
              <div className="text-[11px] text-zinc-500">Zero transit waste between flats</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-1">
              <div className="text-zinc-400">Jobs Completed</div>
              <div className="text-2xl font-bold font-mono text-white">{completedCount} Completed</div>
              <div className="text-[11px] text-zinc-500">{confirmedCount} Total Society Jobs</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-1">
              <div className="text-zinc-400">Your Provider Rating</div>
              <div className="text-2xl font-bold font-mono text-amber-400">
                {providerProfile?.rating ? `★ ${providerProfile.rating}` : 'New Provider'}
              </div>
              <div className="text-[11px] text-zinc-500">
                {providerProfile?.rating ? `${completedCount} verified jobs done` : 'No ratings yet'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#18191D] border border-white/10 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2CB7A5]" />
              <span>Invited Opportunities ({campaigns.length})</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Societies that have explicitly invited you to submit bulk service offers.
            </p>
            <div className="text-xs text-[#2CB7A5] font-semibold">
              {providerBids.length} Offers Submitted
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#18191D] border border-white/10 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Confirmed Society Jobs Checklist ({confirmedCount})</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Access the apartment flat checklist, technician routing, and completion markers.
            </p>
            <div className="text-xs text-emerald-400 font-semibold">
              {completedCount} of {confirmedCount} Jobs Completed
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB: PROFILE
  // -------------------------------------------------------------
  if (activeTab === 'profile') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        <div className="p-6 rounded-3xl bg-[#18191D] border border-white/10 shadow-xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#2CB7A5] flex items-center justify-center text-xl font-bold text-zinc-950">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{providerProfile?.company_name || 'Service Provider Profile'}</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase">
                  Verified
                </span>
              </div>
              <p className="text-xs text-zinc-400">{providerProfile?.contact_person} • {providerProfile?.phone || user.email}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 text-center">
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {providerProfile?.rating ? `★ ${providerProfile.rating}` : 'New Provider'}
              </div>
              <div className="text-xs text-zinc-400">
                {providerProfile?.rating ? 'Average Rating' : 'No ratings yet'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 text-center">
              <div className="text-2xl font-bold text-[#2CB7A5] font-mono">{completedCount}</div>
              <div className="text-xs text-zinc-400">Society Jobs Fulfilled</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 font-mono">{providerBids.length}</div>
              <div className="text-xs text-zinc-400">Active Quotes</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB 2 & 3: OPPORTUNITIES / SCHEDULE
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {activeTab === 'opportunities' ? 'Invited Society Opportunities' : 'Confirmed Society Jobs Checklist'}
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          {activeTab === 'opportunities'
            ? 'Submit competitive bulk volume quotes with crew capacity for residential society camps.'
            : 'Track apartment-by-apartment job execution and mark completed.'}
        </p>
      </div>

      {activeTab === 'opportunities' ? (
        campaigns.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#16171B] space-y-3">
            <Building2 className="w-10 h-10 text-zinc-500 mx-auto" />
            <div className="text-base font-bold text-white">No active campaign invitations</div>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              When societies invite you to quote on AC servicing, pest control, or cleaning, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((camp) => {
              const myBid = providerBids.find((b) => b.campaign_id === camp.id);

              return (
                <div
                  key={camp.id}
                  className="p-6 rounded-3xl bg-[#18191D] border border-white/10 shadow-xl space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] uppercase">
                          {camp.society?.name || 'Society'}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          Event Date: {camp.event_date}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-white">{camp.title}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-zinc-400">Demand Volume</div>
                      <div className="text-2xl font-extrabold text-[#2CB7A5] font-mono">
                        {camp.confirmed_count || 0} / {camp.target_customers || 30} Homes
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {camp.description || 'Standardized service camp looking for verified commercial provider crews.'}
                  </p>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-zinc-400">
                      Target Bulk Ceiling: <strong className="text-white">₹{camp.current_price}</strong> / unit
                    </div>

                    {myBid ? (
                      <div className="px-4 py-2 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-[#2CB7A5] text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Quote Submitted: ₹{myBid.price_per_unit} ({myBid.status})</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenBidModal(camp)}
                        className="px-5 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition shadow-md flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Submit Quote</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Jobs Checklist */
        providerBookings.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#16171B] space-y-3">
            <CheckSquare className="w-10 h-10 text-zinc-500 mx-auto" />
            <div className="text-base font-bold text-white">No confirmed jobs scheduled yet</div>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              When an organizer accepts your offer and residents book slots, your service checklist will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {providerBookings.map((job) => {
              const isCompleted = job.status === 'completed';

              return (
                <div
                  key={job.id}
                  className={`p-5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isCompleted
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/10 bg-[#18191D]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-white/10">
                        Flat {job.flat_number}
                      </span>
                      <span className="text-xs text-zinc-300 font-semibold">
                        {job.quantity} {job.quantity === 1 ? 'Unit' : 'Units'}
                      </span>
                      <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-[#2CB7A5]" />
                        {job.slot?.slot_time || '10:00 AM - 10:45 AM'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Resident: {job.user_profile?.name || 'Resident'} • Contact: {job.user_profile?.phone || 'On site'} • Campaign: {job.campaign?.title || 'Service'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {isCompleted ? (
                      <div className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={completingBookingId === job.id}
                        onClick={() => handleMarkJobCompleted(job.id)}
                        className="px-4 py-2 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition shadow-md"
                      >
                        {completingBookingId === job.id ? 'Updating...' : 'Mark Completed'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Submit Quote Modal with Capacity Settings */}
      {biddingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              onClick={() => setBiddingCampaign(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-1">
                <Briefcase className="w-3.5 h-3.5" /> Submit Bulk Society Offer
              </div>
              <h2 className="text-xl font-bold text-white">{biddingCampaign.title}</h2>
              <p className="text-xs text-zinc-400">
                {biddingCampaign.society?.name || 'Society Camp'} • Expected Demand: {biddingCampaign.confirmed_count || biddingCampaign.total_votes || 0} Units
              </p>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Your Quote per Unit (₹)
                  </label>
                  <input
                    type="number"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(Number(e.target.value))}
                    required
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-sm focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={availableStartTime}
                    onChange={(e) => setAvailableStartTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>
              </div>

              {/* Crew Capacity Settings */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
                <div className="text-xs font-bold text-[#2CB7A5] flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>Crew &amp; Simultaneous House Capacity</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Technicians</label>
                    <input
                      type="number"
                      value={techniciansCount}
                      onChange={(e) => {
                        const count = Number(e.target.value);
                        setTechniciansCount(count);
                        setSimultaneousCapacity(count);
                      }}
                      min={1}
                      className="w-full p-2 rounded-lg bg-zinc-800 border border-white/10 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Simultaneous Flats</label>
                    <input
                      type="number"
                      value={simultaneousCapacity}
                      onChange={(e) => setSimultaneousCapacity(Number(e.target.value))}
                      min={1}
                      className="w-full p-2 rounded-lg bg-zinc-800 border border-white/10 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Mins / Flat</label>
                    <input
                      type="number"
                      value={estimatedDurationMinutes}
                      onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))}
                      min={15}
                      className="w-full p-2 rounded-lg bg-zinc-800 border border-white/10 font-mono text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Service Warranty (Days)
                </label>
                <input
                  type="number"
                  value={bidWarranty}
                  onChange={(e) => setBidWarranty(Number(e.target.value))}
                  required
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-sm focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Technician Crew Details &amp; Equipment Notes
                </label>
                <textarea
                  rows={2}
                  value={bidNotes}
                  onChange={(e) => setBidNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingBid}
                className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition"
              >
                {isSubmittingBid ? 'Submitting Offer...' : 'Submit Quote to Society Organizer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
