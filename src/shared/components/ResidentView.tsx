'use client';

import React, { useState } from 'react';
import {
  ServiceCampaign,
  Booking,
  BookingSlot,
  BookingStatus,
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
  ArrowRight,
  TrendingUp,
  Tag,
  UserCheck,
  Snowflake,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { PollCard } from './PollCard';
import { FeaturedDealCard } from './FeaturedDealCard';
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
  onTabChange?: (tab: string) => void;
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
  onTabChange,
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
  const [confirmedBookingData, setConfirmedBookingData] = useState<any | null>(null);

  // Reschedule / Slot Change Modal State
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<BookingSlot[]>([]);
  const [selectedRescheduleSlotId, setSelectedRescheduleSlotId] = useState<string>('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [now] = useState(() => Date.now());

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
      setConfirmedBookingData({
        ...bookData.booking,
        campaign: bookingCampaign,
        flatNumber: bookingFlat,
        serviceDate: bookingCampaign.event_date,
        providerName: bookingCampaign.selected_provider?.company_name || 'Assigned Provider',
        price: `₹${bookingCampaign.current_price * bookingQuantity}`,
      });
      setBookingCampaign(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Booking process failed');
    } finally {
      setIsBooking(false);
    }
  };

  const handleOpenReschedule = async (b: Booking) => {
    const serviceDate = b.campaign?.event_date;
    if (serviceDate) {
      const serviceDateTime = new Date(`${serviceDate}T09:00:00`);
      const diffHours = (serviceDateTime.getTime() - now) / (1000 * 60 * 60);
      if (diffHours < 12) {
        toast.error('Slot changes close 12 hours before service day so vendors can arrange technician dispatch.');
        return;
      }
    }

    setRescheduleBooking(b);
    let slots = b.campaign?.slots || [];
    if (slots.length === 0 && b.campaign_id) {
      try {
        const sRes = await fetch(`/api/campaigns/${b.campaign_id}/slots`);
        const sData = await sRes.json();
        slots = sData.slots || [];
      } catch (err) {
        console.error('Error fetching slots for reschedule:', err);
      }
    }
    setRescheduleSlots(slots);
    setSelectedRescheduleSlotId(b.slot_id || (slots[0]?.id || ''));
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !selectedRescheduleSlotId) return;

    setIsRescheduling(true);
    try {
      const res = await fetch(`/api/bookings/${rescheduleBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedRescheduleSlotId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to reschedule slot');
      }

      toast.success('Arrival time slot updated successfully!');
      setRescheduleBooking(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Error updating slot');
    } finally {
      setIsRescheduling(false);
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

  // Savings calculation removed: base_price_estimate is not a reliable post-vendor comparison value per requirements.

  // Top featured campaign for the Hero Deal Card
  const featuredCampaign =
    upcomingServices.find((c) => c.status === 'booking_open' || c.status === 'scheduled') ||
    activePolls[0] ||
    polls[0];

  const activeBookingStatuses: BookingStatus[] = ['confirmed', 'scheduled', 'in_progress', 'disputed'];
  const activeBookings = userBookings.filter((b) => activeBookingStatuses.includes(b.status));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* TAB 1: RESIDENT HOME / SUMMARY VIEW */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'home' || activeTab === 'overview' || !activeTab) && (
        <div className="space-y-8">
          {/* Welcome Banner - Compact on mobile per BATCH 3B */}
          <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-400 text-xs font-bold border border-white/10">
                  <span>{activeSociety?.name || 'Society Hub'}</span>
                  <span className="text-slate-400">•</span>
                  <span>{activeSociety?.city || 'Community'}</span>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                  Good day, {user.name ? user.name.split(' ')[0] : 'Neighbor'} 👋
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-300 max-w-md line-clamp-2 sm:line-clamp-none">
                  Pool demand with neighbors for group discounts on AC servicing, deep cleaning & maintenance.
                </p>
              </div>

              {/* Metrics - De-emphasized on mobile */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px]">
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
                  <span className="font-black text-white block">
                    {activeSociety?.member_count !== undefined ? activeSociety.member_count : (activeSociety?.total_homes || 0)}
                  </span>
                  <span className="text-[10px] text-slate-300">Members</span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
                  <span className="font-black text-emerald-400 block">
                    {activePolls.length}
                  </span>
                  <span className="text-[10px] text-slate-300">Active</span>
                </div>
              </div>
            </div>
          </section>

          {/* BATCH 2A HIERARCHY - Active Services Summary (max 4 cards) */}
          <section aria-labelledby="active-services-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="active-services-heading" className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Active Services for Your Building
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Join or book these deals with your neighbours</p>
              </div>
              <button
                type="button"
                onClick={() => onTabChange?.('campaigns')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                See all services <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {(() => {
              const actionableStatuses = ['poll_active', 'open', 'threshold_reached', 'pending_secretary_approval', 'booking_open', 'quote_selected'];
              const combined = [...activePolls, ...upcomingServices]
                .sort((a, b) => {
                  const aAction = actionableStatuses.includes(a.status) ? 0 : 1;
                  const bAction = actionableStatuses.includes(b.status) ? 0 : 1;
                  if (aAction !== bAction) return aAction - bAction;
                  if (a.event_date && b.event_date) {
                    return a.event_date.localeCompare(b.event_date);
                  }
                  return 0;
                })
                .slice(0, 4);

              return combined.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                  <p className="font-bold text-slate-800 text-sm">No active services right now</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">Be the first to propose a collective drive for your building.</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatePollOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-700 transition cursor-pointer"
                  >
                    Request a Service for Your Building
                  </button>
                </div>
              ) : (
                <div className="grid gap-5">
                  {combined.map((p) => (
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
              );
            })()}
          </section>

          {/* BATCH 2A HIERARCHY - My Active Bookings Summary (max 3 cards or Fix 7 empty state) */}
          <section aria-labelledby="my-bookings-heading" className="space-y-4 pt-4 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="my-bookings-heading" className="text-xl font-extrabold text-slate-900 tracking-tight">
                  My Next Bookings
                </h2>
                <p className="text-xs text-slate-500">Action required or upcoming</p>
              </div>
              {activeBookings.length > 0 && (
                <button
                  type="button"
                  onClick={() => onTabChange?.('bookings')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View all bookings <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeBookings.length === 0 ? (
              <div className="p-6 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <p className="font-bold text-slate-800 text-sm">You haven&apos;t booked any services yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When you join or reserve a service, it will appear here.
                </p>
                <button
                  type="button"
                  onClick={() => onTabChange?.('campaigns')}
                  className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Browse Available Services
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeBookings.slice(0, 3).map((b) => {
                  const isDisputed = b.status === 'disputed';
                  return (
                    <div
                      key={b.id}
                      className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">{b.campaign?.title || 'Service'}</h3>
                          <p className="text-xs text-slate-500">Unit {b.flat_number} • {b.campaign?.event_date}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isDisputed ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
                          {b.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="text-emerald-600 font-black">₹{b.total_amount}</span>
                        {(b.status === 'confirmed' || b.status === 'scheduled') && (
                          <button
                            type="button"
                            onClick={() => handleOpenReschedule(b)}
                            className="text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            Change Slot
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: FULL SERVICES DISCOVERY DESTINATION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'campaigns' && (
        <div className="space-y-8">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => onTabChange?.('home')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Home
                </button>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                All Services for Your Building
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Explore all community service proposals, group drives, and upcoming scheduled maintenance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatePollOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Propose Service</span>
            </button>
          </div>

          {/* Active Society Polls Grid */}
          <section aria-labelledby="all-polls-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="all-polls-heading" className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Vote className="w-5 h-5 text-blue-600" />
                  <span>Community Proposals ({activePolls.length})</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Vote to express interest and aggregate quorum for vendor bidding
                </p>
              </div>
            </div>

            {activePolls.length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <p className="font-bold text-slate-800 text-sm">No active proposals right now</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Be the first to propose a collective drive for AC servicing, home deep cleaning, or pest control!
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
          </section>

          {/* My Created Polls Section */}
          {myPolls.length > 0 && (
            <section aria-labelledby="all-my-polls-heading" className="space-y-4 pt-4 border-t border-slate-200/80">
              <h2 id="all-my-polls-heading" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>My Created Proposals ({myPolls.length})</span>
              </h2>

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
            </section>
          )}

          {/* Upcoming Service Days */}
          {upcomingServices.length > 0 && (
            <section aria-labelledby="all-upcoming-heading" className="space-y-4 pt-4 border-t border-slate-200/80">
              <h2 id="all-upcoming-heading" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Upcoming Scheduled Service Days</span>
              </h2>

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
            </section>
          )}

          {/* Previous Campaigns / Past Services */}
          {previousCampaigns.length > 0 && (
            <section aria-labelledby="all-past-heading" className="space-y-4 pt-4 border-t border-slate-200/80">
              <h2 id="all-past-heading" className="text-lg font-bold text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span>Previous Completed Services ({previousCampaigns.length})</span>
              </h2>

              <div className="grid gap-4 opacity-75">
                {previousCampaigns.map((p) => (
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
            </section>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MY BOOKINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                My Service Bookings
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Confirmed bulk service visits and scheduled maintenance appointments for your unit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatePollOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Propose Service</span>
            </button>
          </div>

          {userBookings.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200/80 bg-white shadow-xs space-y-3">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-base font-bold text-slate-900">No active bookings yet</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                You haven&apos;t reserved a time slot in any service camp yet. Explore active deals in your society!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userBookings.map((b) => {
                const isCompleted = b.status === 'completed';
                const isDisputed = b.status === 'disputed';
                const providerName = b.provider?.company_name || 'Assigned Provider';

                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-6 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs border border-emerald-100 shrink-0">
                            <Snowflake className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                              {b.campaign?.title || 'Service Camp'}
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold">Unit: {b.flat_number}</p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full uppercase shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : isDisputed
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{b.campaign?.event_date || 'Service Day'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{b.slot?.slot_time || 'Coordinated'}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 font-medium">
                            <UserCheck className="w-4 h-4 text-slate-400" />
                            Partner:
                          </span>
                          <strong className="text-slate-900">{providerName}</strong>
                        </div>

                        <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Tag className="w-4 h-4 text-slate-400" />
                            Payable:
                          </span>
                          <span className="text-emerald-600 font-black text-base">₹{b.total_amount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Completion / Rating / Issue Prompts */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      {/* Reschedule Button with 12h cutoff indicator */}
                      {(b.status === 'confirmed' || b.status === 'scheduled') && (() => {
                        const serviceDate = b.campaign?.event_date;
                        let canChange = true;
                        if (serviceDate) {
                          const serviceDateTime = new Date(`${serviceDate}T09:00:00`);
                          const diffHours = (serviceDateTime.getTime() - now) / (1000 * 60 * 60);
                          if (diffHours < 12) canChange = false;
                        }

                        return (
                          <div>
                            {canChange ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReschedule(b)}
                                className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Change Arrival Slot</span>
                              </button>
                            ) : (
                              <div className="w-full py-1.5 px-3 rounded-xl bg-slate-100 text-slate-500 font-semibold text-[11px] text-center" title="Vendors require 12 hours notice to organize technician routes">
                                Slot locked &bull; Under 12h to service
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {b.status === 'completed' && !b.service_rating && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setRatingBooking(b)}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                          >
                            ★ Rate Service &amp; Technician
                          </button>
                          <button
                            type="button"
                            onClick={() => setIssueBooking(b)}
                            className="w-full py-2 text-slate-500 hover:text-rose-600 text-xs font-semibold transition cursor-pointer"
                          >
                            Report Problem
                          </button>
                        </div>
                      )}

                      {b.service_rating && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                          <span>Rated {b.service_rating.rating}★: {b.service_rating.review || 'Completed'}</span>
                        </div>
                      )}

                      {b.service_issue && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Issue: {b.service_issue.description}</span>
                        </div>
                      )}
                    </div>
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
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Residential Community Hub</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {activeSociety?.name || 'Society Hub'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  {activeSociety?.address ? `${activeSociety.address} • ` : ''}
                  {activeSociety?.member_count !== undefined
                    ? `${activeSociety.member_count} Registered Members`
                    : `${activeSociety?.total_homes || 0} Households`}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Society Invite Code</div>
                <div className="text-2xl font-mono font-black text-blue-600">{activeSociety?.invite_code || '—'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {activeSociety?.member_count !== undefined ? activeSociety.member_count : (activeSociety?.total_homes || 0)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1">Society Members</div>
              </div>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-2xl sm:text-3xl font-black text-blue-600 font-mono">{polls.length}</div>
                <div className="text-xs font-bold text-slate-500 mt-1">Service Drives Initiated</div>
              </div>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <>
                  <div className="text-sm font-bold text-slate-700 font-mono py-1">Direct Vendor Savings</div>
                  <div className="text-xs text-slate-400">Unlocked after vendor quote acceptance</div>
                </>
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
                  className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Society Invite Code</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenJoinModal}
                className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition cursor-pointer"
              >
                Switch / Join Another Society
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setBookingCampaign(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                <Calendar className="w-3 h-3 text-blue-600" /> Select Service Slot
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {bookingCampaign.title}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {bookingCampaign.society?.name || 'Society'} • Service Date: {bookingCampaign.event_date}
              </p>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Flat / Unit Number
                  </label>
                  <input
                    type="text"
                    value={bookingFlat}
                    onChange={(e) => setBookingFlat(e.target.value)}
                    required
                    placeholder="e.g. A-402"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Quantity (Units)
                  </label>
                  <select
                    value={bookingQuantity}
                    onChange={(e) => setBookingQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Select Preferred Arrival Window
                </label>
                {(!bookingCampaign.slots || bookingCampaign.slots.length === 0) ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600 font-medium">
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
                          className={`p-2.5 rounded-xl border text-xs transition text-center cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-extrabold ring-2 ring-blue-600/20'
                              : isFull
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
                          <div className="font-extrabold">{slot.slot_time}</div>
                          <div className="text-[10px] mt-0.5 font-bold">
                            {isFull ? (
                              <span className="text-rose-500">FULL</span>
                            ) : (
                              <span className="text-blue-600">{max - booked} / {max} left</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Direct Settlement Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Agreed Group Rate:</span>
                  <span className="font-bold text-slate-900">₹{bookingCampaign.current_price} / unit</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Total Payable:</span>
                  <span className="font-black text-sm text-emerald-600">
                    ₹{bookingCampaign.current_price * bookingQuantity}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 text-[10px] text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>Pay directly to provider on service day after work completion.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBooking}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-300 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isBooking ? 'Confirming...' : 'Confirm Slot Reservation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Arrival Slot Modal with 12h cutoff notice */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setRescheduleBooking(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                <Clock className="w-3 h-3 text-blue-600" /> Reschedule Arrival Slot
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Change Arrival Window
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {rescheduleBooking.campaign?.title} • Unit: {rescheduleBooking.flat_number}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium leading-relaxed">
              <strong>12-Hour Policy:</strong> Time slot changes close 12 hours before service day so providers have adequate time to assign technician dispatch routes.
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Choose New Arrival Slot
                </label>
                {rescheduleSlots.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    No alternative slots configured for this campaign.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {rescheduleSlots.map((slot) => {
                      const booked = slot.booked_count || 0;
                      const max = slot.max_capacity || 5;
                      const isFull = booked >= max && slot.id !== rescheduleBooking.slot_id;
                      const isSelected = selectedRescheduleSlotId === slot.id;

                      return (
                        <button
                          type="button"
                          key={slot.id}
                          disabled={isFull}
                          onClick={() => setSelectedRescheduleSlotId(slot.id)}
                          className={`p-2.5 rounded-xl border text-xs transition text-center cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-extrabold ring-2 ring-blue-600/20'
                              : isFull
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-extrabold">{slot.slot_time}</div>
                          <div className="text-[10px] mt-0.5 font-bold">
                            {slot.id === rescheduleBooking.slot_id ? (
                              <span className="text-blue-600 font-black">Current Slot</span>
                            ) : isFull ? (
                              <span className="text-rose-500">FULL</span>
                            ) : (
                              <span className="text-slate-500">{max - booked} left</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isRescheduling || !selectedRescheduleSlotId || selectedRescheduleSlotId === rescheduleBooking.slot_id}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isRescheduling ? 'Updating...' : 'Confirm New Arrival Slot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Booking Confirmed Voucher Modal matching Ownera BookingConfirmedScreen */}
      {confirmedBookingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <button
              type="button"
              onClick={() => setConfirmedBookingData(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 mx-auto">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            <div className="space-y-0.5">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Service slot confirmed! 🎉
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Appointment reserved for Unit {confirmedBookingData.flatNumber}.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Service</span>
                <span className="font-extrabold text-slate-900">{confirmedBookingData.campaign?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Service Date</span>
                <span className="font-extrabold text-slate-900">{confirmedBookingData.serviceDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Partner</span>
                <span className="font-extrabold text-blue-600">{confirmedBookingData.providerName}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-bold">Payable on Completion</span>
                <span className="font-black text-sm text-emerald-600">{confirmedBookingData.price}</span>
              </div>
            </div>

            <button
              onClick={() => setConfirmedBookingData(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Done &amp; Return to Hub
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setRatingBooking(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="space-y-1">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">Rate Completed Service</h3>
              <p className="text-xs text-slate-500 font-medium">
                {ratingBooking.campaign?.title} • {ratingBooking.provider?.company_name || 'Provider'}
              </p>
            </div>

            <form onSubmit={handleSubmitRating} className="space-y-3.5">
              <div className="flex justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className="p-1.5 transition hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= ratingScore
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Feedback / Review (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="Describe punctuality, quality, and technician behavior..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRating}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Issue Report Modal */}
      {issueBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setIssueBooking(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3 text-rose-600" /> Report a Service Problem
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">We&apos;re here to resolve it</h3>
              <p className="text-xs text-slate-500 font-medium">
                Organizer and provider will immediately receive this report.
              </p>
            </div>

            <form onSubmit={handleSubmitIssue} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Problem Category
                </label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="quality">Service Quality Issue / Incomplete checklist</option>
                  <option value="no_show">Technician did not arrive on time</option>
                  <option value="damage">Property damage or leak</option>
                  <option value="pricing">Unexpected extra charges requested</option>
                  <option value="other">Other issue</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Describe the Issue (Minimum 10 characters)
                </label>
                <textarea
                  rows={3}
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  required
                  minLength={10}
                  placeholder="Explain what went wrong during the service..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingIssue}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
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
