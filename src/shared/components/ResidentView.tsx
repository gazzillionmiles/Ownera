'use client';

import React, { useState } from 'react';
import {
  ServiceCampaign,
  Booking,
  BookingSlot,
  Society,
  ServiceCatalogItem,
} from '@/src/types/ownera';
import { BaseUserProfile } from '@/src/types/auth';
import {
  Sparkles,
  Users,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Star,
  AlertTriangle,
  X,
  Copy,
  Plus,
  Vote,
} from 'lucide-react';
import { toast } from 'sonner';
import { PollCard } from './PollCard';
import { CreatePollModal } from './CreatePollModal';
import { QuoteComparisonModal } from './QuoteComparisonModal';
import { InviteVendorModal } from './InviteVendorModal';
import { APP_NAME } from '@/src/constants';

interface ResidentViewProps {
  polls?: ServiceCampaign[];
  activePolls?: ServiceCampaign[];
  myPolls?: ServiceCampaign[];
  societyPolls?: ServiceCampaign[];
  upcomingServices?: ServiceCampaign[];
  previousCampaigns?: ServiceCampaign[];
  campaigns: ServiceCampaign[];
  userBookings: Booking[];
  activeSociety: Society | null;
  services?: ServiceCatalogItem[];
  user: BaseUserProfile;
  activeTab: string;
  onVote: (pollId: string, option: string) => Promise<void>;
  onRefresh: () => void;
  onOpenJoinModal: () => void;
}

export const ResidentView: React.FC<ResidentViewProps> = ({
  polls = [],
  activePolls = [],
  myPolls = [],
  societyPolls = [],
  upcomingServices = [],
  previousCampaigns = [],
  campaigns,
  userBookings,
  activeSociety,
  services = [],
  user,
  activeTab,
  onVote,
  onRefresh,
  onOpenJoinModal,
}) => {
  // Modals state
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [quoteComparisonCamp, setQuoteComparisonCamp] = useState<ServiceCampaign | null>(null);
  const [inviteVendorCamp, setInviteVendorCamp] = useState<ServiceCampaign | null>(null);

  // Booking Modal
  const [bookingCampaign, setBookingCampaign] = useState<ServiceCampaign | null>(null);
  const [bookingFlat, setBookingFlat] = useState(user.unitNumber || '');
  const [bookingQuantity, setBookingQuantity] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Rating and Issue Modals State
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const [issueBooking, setIssueBooking] = useState<Booking | null>(null);
  const [issueCategory, setIssueCategory] = useState<'quality' | 'no_show' | 'damage' | 'delay' | 'pricing' | 'other'>('quality');
  const [issueDesc, setIssueDesc] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  const handleStartBooking = async (camp: ServiceCampaign) => {
    setBookingCampaign(camp);
    let slots = camp.slots || [];
    if (slots.length === 0) {
      try {
        const sRes = await fetch(`/api/campaigns/${camp.id}/slots`);
        const sData = await sRes.json();
        slots = sData.slots || [];
        setBookingCampaign({ ...camp, slots });
      } catch (e) {
        console.error('Error loading slots:', e);
      }
    }
    const availableSlot = slots.find((s) => (s.booked_count || 0) < (s.max_capacity || 5)) || slots[0];
    if (availableSlot) {
      setSelectedSlotId(availableSlot.id);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCampaign) return;

    setIsBooking(true);
    try {
      const bookRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: bookingCampaign.id,
          flatNumber: bookingFlat,
          quantity: bookingQuantity,
          slotId: selectedSlotId || undefined,
          residentNotes: bookingNotes,
        }),
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok) throw new Error(bookData.error || 'Failed to create booking');

      toast.success(bookData.message || `Booking Confirmed for ${bookingFlat}! Settle payment directly with provider on service day.`);
      setBookingCampaign(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Booking process failed');
    } finally {
      setIsBooking(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBooking) return;

    setIsSubmittingRating(true);
    try {
      const res = await fetch(`/api/bookings/${ratingBooking.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: ratingBooking.campaign_id,
          providerId: ratingBooking.provider_id,
          rating: ratingScore,
          review: ratingReview,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit rating');

      toast.success('Thank you for rating your service!');
      setRatingBooking(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Rating failed');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBooking) return;

    if (issueDesc.length < 10) {
      toast.error('Please describe the problem in at least 10 characters');
      return;
    }

    setIsSubmittingIssue(true);
    try {
      const res = await fetch(`/api/bookings/${issueBooking.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: issueBooking.provider_id,
          category: issueCategory,
          description: issueDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to report issue');

      toast.success('Issue reported. Organizer and provider notified.');
      setIssueBooking(null);
      setIssueDesc('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Issue report failed');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const realResidentSavings = userBookings.reduce((sum, b) => {
    if (b.status === 'completed' && b.campaign?.service?.base_price_estimate && b.unit_price) {
      const diff = b.campaign.service.base_price_estimate - b.unit_price;
      if (diff > 0) {
        return sum + diff * (b.quantity || 1);
      }
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* TAB 1: CAMPAIGNS & POLLS FEED */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'campaigns' || activeTab === 'home') && (
        <div className="space-y-8">
          {/* Society Hero Banner with Create Poll CTA */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#18191D] via-[#16171A] to-[#121316] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 text-[#2CB7A5] text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5" />
                <span>{activeSociety?.name || 'Society Hub'}</span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400">
                  {activeSociety?.member_count !== undefined
                    ? `${activeSociety.member_count} ${activeSociety.member_count === 1 ? 'Member' : 'Members'}`
                    : activeSociety?.total_homes
                    ? `${activeSociety.total_homes} Homes`
                    : '0 Members'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Demand Polls &amp; Service Camps
              </h1>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                Vote on upcoming community service polls to aggregate volume and invite discounted vendor quotes.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreatePollOpen(true)}
                className="px-5 py-3 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Create Poll</span>
              </button>
            </div>
          </div>

          {/* Feed Section 1: Active Society Polls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Vote className="w-4 h-4 text-[#2CB7A5]" />
                <span>Active Community Polls ({activePolls.length})</span>
              </h2>
            </div>

            {activePolls.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#16171B] border border-white/5 text-xs text-zinc-400 space-y-2">
                <p className="font-semibold text-white">No active society polls right now</p>
                <p className="text-[11px] text-zinc-500">
                  Be the first to create a poll for AC servicing, cleaning, or pest control!
                </p>
              </div>
            ) : (
              <div className="grid gap-5">
                {activePolls.map((p) => (
                  <PollCard
                    key={p.id}
                    poll={p}
                    user={user}
                    onVote={onVote}
                    onOpenInviteVendor={(camp) => setInviteVendorCamp(camp)}
                    onOpenCompareQuotes={(camp) => setQuoteComparisonCamp(camp)}
                    onOpenBooking={(camp) => handleStartBooking(camp)}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Feed Section 2: My Polls (if user created any) */}
          {myPolls.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>My Created Polls &amp; Requests ({myPolls.length})</span>
                </h2>
              </div>

              <div className="grid gap-4">
                {myPolls.map((p) => (
                  <PollCard
                    key={p.id}
                    poll={p}
                    user={user}
                    onVote={onVote}
                    onOpenInviteVendor={(camp) => setInviteVendorCamp(camp)}
                    onOpenCompareQuotes={(camp) => setQuoteComparisonCamp(camp)}
                    onOpenBooking={(camp) => handleStartBooking(camp)}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Feed Section 3: Upcoming Service Camps */}
          {upcomingServices.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Upcoming Service Days &amp; Camps</span>
                </h2>
              </div>

              <div className="grid gap-4">
                {upcomingServices.map((p) => (
                  <PollCard
                    key={p.id}
                    poll={p}
                    user={user}
                    onVote={onVote}
                    onOpenInviteVendor={(camp) => setInviteVendorCamp(camp)}
                    onOpenCompareQuotes={(camp) => setQuoteComparisonCamp(camp)}
                    onOpenBooking={(camp) => handleStartBooking(camp)}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MY BOOKINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                My Service Bookings
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Track upcoming service day slots, completion confirmations, and technician ratings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatePollOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create Poll</span>
            </button>
          </div>

          {userBookings.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#16171B] space-y-3">
              <Calendar className="w-10 h-10 text-zinc-500 mx-auto" />
              <div className="text-base font-bold text-white">No bookings yet</div>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                You haven&apos;t booked a slot in any service camp yet. Check out active polls in your society!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {userBookings.map((b) => {
                const isCompleted = b.status === 'completed';
                const isDisputed = b.status === 'disputed';
                const providerName = b.provider?.company_name || 'Assigned Provider';

                return (
                  <div
                    key={b.id}
                    className="p-6 rounded-3xl border border-white/10 bg-[#18191D] shadow-xl space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] uppercase">
                            Flat {b.flat_number}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            {b.campaign?.event_date}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg text-white">
                          {b.campaign?.title || 'Service Camp'}
                        </h3>
                      </div>

                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full uppercase font-mono self-start sm:self-auto ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isDisputed
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-[#2CB7A5]/20 text-[#2CB7A5] border border-[#2CB7A5]/30'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                        <div className="text-zinc-500 text-[11px]">Time Slot</div>
                        <div className="font-semibold text-zinc-200 mt-0.5">
                          {b.slot?.slot_time || 'Coordinated on service day'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                        <div className="text-zinc-500 text-[11px]">Assigned Provider</div>
                        <div className="font-semibold text-zinc-200 mt-0.5">
                          {providerName}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                        <div className="text-zinc-500 text-[11px]">Amount Due on Service Day</div>
                        <div className="font-semibold text-[#2CB7A5] mt-0.5 font-mono">
                          ₹{b.total_amount} (Direct to Provider)
                        </div>
                      </div>
                    </div>

                    {/* Completion Prompt if provider marked finished */}
                    {b.status === 'completed' && !b.service_rating && (
                      <div className="p-4 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                        <div className="flex items-center gap-2.5 text-xs text-white">
                          <Star className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" />
                          <div>
                            <div className="font-bold">Service Completed! Rate your technician</div>
                            <div className="text-zinc-400 text-[11px]">Help maintain high quality standards in your society</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setRatingBooking(b)}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs"
                          >
                            Submit Rating
                          </button>
                          <button
                            type="button"
                            onClick={() => setIssueBooking(b)}
                            className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-red-400 text-xs"
                          >
                            Report Problem
                          </button>
                        </div>
                      </div>
                    )}

                    {b.service_rating && (
                      <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 flex items-center gap-2 text-xs text-zinc-400">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span>You rated this service {b.service_rating.rating}★: &ldquo;{b.service_rating.review || 'Great service'}&rdquo;</span>
                      </div>
                    )}

                    {b.service_issue && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Issue Reported: {b.service_issue.description} ({b.service_issue.status})</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SOCIETY DETAILS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'society' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-2">
                  <Building2 className="w-3.5 h-3.5" /> Residential Community
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {activeSociety?.name || 'Society Hub'}
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  {activeSociety?.address ? `${activeSociety.address} • ` : ''}
                  {activeSociety?.member_count !== undefined
                    ? `${activeSociety.member_count} ${activeSociety.member_count === 1 ? 'Registered Member' : 'Registered Members'}`
                    : activeSociety?.total_homes
                    ? `${activeSociety.total_homes} Households`
                    : 'Active Society'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 text-center">
                <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Society Code</div>
                <div className="text-xl font-mono font-bold text-[#2CB7A5]">{activeSociety?.invite_code || '—'}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 text-center">
                <div className="text-2xl font-bold text-white font-mono">
                  {activeSociety?.member_count !== undefined ? activeSociety.member_count : (activeSociety?.total_homes || 0)}
                </div>
                <div className="text-xs text-zinc-400">Society Members</div>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 text-center">
                <div className="text-2xl font-bold text-[#2CB7A5] font-mono">{polls.length}</div>
                <div className="text-xs text-zinc-400">Active Service Polls</div>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 text-center">
                {realResidentSavings > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-emerald-400 font-mono">₹{realResidentSavings.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400">Total Savings Earned</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-zinc-400 font-mono py-1">No completed camps yet</div>
                    <div className="text-xs text-zinc-500">Savings calculated after service</div>
                  </>
                )}
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {activeSociety?.invite_code && (
                <button
                  type="button"
                  onClick={() => {
                    const text = `Join our society on ${APP_NAME} to get collective bulk discounts on home services: Code: ${activeSociety.invite_code} on ${window.location.origin}`;
                    navigator.clipboard.writeText(text);
                    toast.success('Society invite message copied!');
                  }}
                  className="px-6 py-3 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Society Invite Code</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenJoinModal}
                className="px-6 py-3 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 transition"
              >
                Switch / Join Another Society
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS - ALWAYS MOUNTED FOR ALL TABS */}
      {/* ------------------------------------------------------------- */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        activeSociety={activeSociety}
        services={services}
        onSuccess={() => {
          setIsCreatePollOpen(false);
          onRefresh();
        }}
      />

      <QuoteComparisonModal
        isOpen={!!quoteComparisonCamp}
        onClose={() => setQuoteComparisonCamp(null)}
        campaign={quoteComparisonCamp}
        onSuccess={() => {
          setQuoteComparisonCamp(null);
          onRefresh();
        }}
      />

      <InviteVendorModal
        isOpen={!!inviteVendorCamp}
        onClose={() => setInviteVendorCamp(null)}
        campaign={inviteVendorCamp}
        onSuccess={() => {
          setInviteVendorCamp(null);
          onRefresh();
        }}
      />

      {/* Booking Modal with Capacity Slots (Zero Payments in MVP) */}
      {bookingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              type="button"
              onClick={() => setBookingCampaign(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-1">
                <Calendar className="w-3.5 h-3.5" /> Select Service Slot
              </div>
              <h2 className="text-xl font-bold text-white">{bookingCampaign.title}</h2>
              <p className="text-xs text-zinc-400">
                {bookingCampaign.society?.name || 'Society'} • Service Date: {bookingCampaign.event_date}
              </p>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Flat / Unit Number
                  </label>
                  <input
                    type="text"
                    value={bookingFlat}
                    onChange={(e) => setBookingFlat(e.target.value)}
                    required
                    placeholder="e.g. A-402"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Quantity (Units)
                  </label>
                  <select
                    value={bookingQuantity}
                    onChange={(e) => setBookingQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  >
                    {[1, 2, 3, 4, 5].map((q) => (
                      <option key={q} value={q}>
                        {q} {q === 1 ? 'Unit / AC' : 'Units / ACs'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacity-Based Time Slot Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Select Available Service Slot
                </label>
                {(!bookingCampaign.slots || bookingCampaign.slots.length === 0) ? (
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-center text-xs text-zinc-400">
                    Standard service timing will be coordinated on service day.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {bookingCampaign.slots.map((slot) => {
                      const booked = slot.booked_count || 0;
                      const max = slot.max_capacity || 5;
                      const isFull = booked >= max;
                      const isSelected = selectedSlotId === slot.id;

                      return (
                        <button
                          type="button"
                          key={slot.id}
                          disabled={isFull}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition text-center ${
                            isSelected
                              ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-[#2CB7A5] font-bold'
                              : isFull
                              ? 'border-white/5 bg-zinc-900/20 text-zinc-600 cursor-not-allowed opacity-40'
                              : 'border-white/10 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
                          <div className="font-semibold">{slot.slot_time}</div>
                          <div className="text-[10px] mt-0.5 font-mono">
                            {isFull ? (
                              <span className="text-red-400 font-bold">FULL</span>
                            ) : (
                              <span className="text-[#2CB7A5]">{max - booked} / {max} available</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Direct Settlement Summary (Zero Payments in MVP) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Agreed Bulk Rate:</span>
                  <span className="font-mono text-white">₹{bookingCampaign.current_price} / unit</span>
                </div>
                <div className="flex justify-between text-white font-semibold">
                  <span>Total Service Amount:</span>
                  <span className="font-mono font-bold text-sm text-[#2CB7A5]">
                    ₹{bookingCampaign.current_price * bookingQuantity}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/5 text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Zero upfront payment. Pay ₹{bookingCampaign.current_price * bookingQuantity} directly to provider on service day.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBooking}
                className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isBooking ? 'Confirming...' : 'Confirm Slot Booking'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#18191D] p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setRatingBooking(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Rate Completed Service</h3>
              <p className="text-xs text-zinc-400">
                {ratingBooking.campaign?.title} • {ratingBooking.provider?.company_name || 'Provider'}
              </p>
            </div>

            <form onSubmit={handleSubmitRating} className="space-y-4">
              <div className="flex justify-center gap-2 py-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className="p-2 transition hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= ratingScore
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Feedback / Review (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="Describe punctuality, quality, and technician behavior..."
                  className="w-full p-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRating}
                className="w-full py-3 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition"
              >
                {isSubmittingRating ? 'Submitting...' : 'Submit 5-Star Rating'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Issue Report Modal */}
      {issueBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#18191D] p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setIssueBooking(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Report a Service Problem
              </div>
              <h3 className="font-bold text-lg text-white">We&apos;re here to resolve it</h3>
              <p className="text-xs text-zinc-400">
                Organizer and provider will immediately receive this report.
              </p>
            </div>

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Problem Category
                </label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs"
                >
                  <option value="quality">Service Quality Issue / Incomplete checklist</option>
                  <option value="no_show">Technician did not arrive on time</option>
                  <option value="damage">Property damage or leak</option>
                  <option value="pricing">Unexpected extra charges requested</option>
                  <option value="other">Other issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Describe the Issue (Minimum 10 characters)
                </label>
                <textarea
                  rows={4}
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  required
                  minLength={10}
                  placeholder="Explain what went wrong during the service..."
                  className="w-full p-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-red-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingIssue}
                className="w-full py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-600 transition"
              >
                {isSubmittingIssue ? 'Submitting Report...' : 'Submit Issue to Society Organizer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
