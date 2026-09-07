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
  const [confirmedBookingData, setConfirmedBookingData] = useState<any | null>(null);

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

  // Top featured campaign for the Hero Deal Card
  const featuredCampaign =
    upcomingServices.find((c) => c.status === 'booking_open' || c.status === 'scheduled') ||
    activePolls[0] ||
    polls[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* TAB 1: CAMPAIGNS & POLLS FEED */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'campaigns' || activeTab === 'home') && (
        <div className="space-y-8">
          {/* Welcome Banner with Society Overview matching Ownera HomeScreen */}
          <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-32 -bottom-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-400 text-xs font-bold border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{activeSociety?.name || 'Society Hub'}</span>
                  <span className="text-slate-400">•</span>
                  <span>{activeSociety?.city || 'Community'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                  Good day, {user.name ? user.name.split(' ')[0] : 'Neighbor'} <span className="text-2xl sm:text-3xl">👋</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Pool society demand with neighbors to unlock negotiated group discounts for AC servicing, deep cleaning, and home maintenance.
                </p>
              </div>

              {/* Quick Metrics Cluster */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center min-w-[90px]">
                  <span className="text-xl sm:text-2xl font-black text-white block">
                    {activeSociety?.member_count !== undefined ? activeSociety.member_count : (activeSociety?.total_homes || 0)}
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium">Members</span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center min-w-[90px]">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 block">
                    {activePolls.length}
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium">Active Drives</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatePollOpen(true)}
                  className="px-5 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Propose Service</span>
                </button>
              </div>
            </div>
          </section>

          {/* Featured Hero Deal Card */}
          {featuredCampaign && (
            <section aria-labelledby="featured-deal-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="featured-deal-heading" className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    Active Group Drive
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Pre-negotiated bulk campaign for {activeSociety?.name || 'your society'}
                  </p>
                </div>
              </div>

              <FeaturedDealCard
                campaign={featuredCampaign}
                onOpenBooking={(c) => handleStartBooking(c)}
                onOpenCompareQuotes={(c) => setQuoteComparisonCamp(c)}
                onVote={onVote}
              />
            </section>
          )}

          {/* Active Society Polls Grid */}
          <section aria-labelledby="polls-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="polls-heading" className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Vote className="w-5 h-5 text-blue-600" />
                  <span>Community Proposals ({activePolls.length})</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Vote to express interest and aggregate quorum for vendor bidding
                </p>
              </div>
            </div>

            {activePolls.length === 0 ? (
              <div className="p-10 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                <p className="font-bold text-slate-800 text-sm">No active society proposals right now</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Be the first to propose a collective drive for AC servicing, home deep cleaning, or pest control!
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreatePollOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-blue-700 transition cursor-pointer"
                >
                  + Propose a Service
                </button>
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
            <section aria-labelledby="my-polls-heading" className="space-y-4 pt-4 border-t border-slate-200/80">
              <h2 id="my-polls-heading" className="text-lg font-bold text-slate-900 flex items-center gap-2">
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
            <section aria-labelledby="upcoming-heading" className="space-y-4 pt-4 border-t border-slate-200/80">
              <h2 id="upcoming-heading" className="text-lg font-bold text-slate-900 flex items-center gap-2">
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
                {realResidentSavings > 0 ? (
                  <>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">₹{realResidentSavings.toLocaleString()}</div>
                    <div className="text-xs font-bold text-slate-500 mt-1">Total Savings Earned</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-slate-700 font-mono py-1">Direct Vendor Savings</div>
                    <div className="text-xs text-slate-400">Calculated upon drive completion</div>
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
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setBookingCampaign(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Select Service Slot
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {bookingCampaign.title}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {bookingCampaign.society?.name || 'Society'} • Service Date: {bookingCampaign.event_date}
              </p>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Flat / Unit Number
                  </label>
                  <input
                    type="text"
                    value={bookingFlat}
                    onChange={(e) => setBookingFlat(e.target.value)}
                    required
                    placeholder="e.g. A-402"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity (Units)
                  </label>
                  <select
                    value={bookingQuantity}
                    onChange={(e) => setBookingQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Preferred Arrival Window
                </label>
                {(!bookingCampaign.slots || bookingCampaign.slots.length === 0) ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600 font-medium">
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
                          className={`p-3 rounded-2xl border text-xs transition text-center cursor-pointer ${
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
                              <span className="text-blue-600">{max - booked} / {max} slots left</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Direct Settlement Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Agreed Group Rate:</span>
                  <span className="font-bold text-slate-900">₹{bookingCampaign.current_price} / unit</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Total Payable:</span>
                  <span className="font-black text-base text-emerald-600">
                    ₹{bookingCampaign.current_price * bookingQuantity}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Pay ₹{bookingCampaign.current_price * bookingQuantity} directly to provider on service day after work is done.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBooking}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-300 text-white font-black text-sm sm:text-base shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isBooking ? 'Confirming...' : 'Confirm Slot Reservation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Booking Confirmed Voucher Modal matching Ownera BookingConfirmedScreen */}
      {confirmedBookingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 mx-auto">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Service slot confirmed! 🎉
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Appointment reserved for Unit {confirmedBookingData.flatNumber}.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2.5 text-xs">
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
                <span className="text-slate-700 font-bold">Amount Payable on Completion</span>
                <span className="font-black text-sm text-emerald-600">{confirmedBookingData.price}</span>
              </div>
            </div>

            <button
              onClick={() => setConfirmedBookingData(null)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-sm transition cursor-pointer"
            >
              Done &amp; Return to Hub
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setRatingBooking(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="font-extrabold text-lg text-slate-900">Rate Completed Service</h3>
              <p className="text-xs text-slate-500 font-medium">
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
                    className="p-2 transition hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= ratingScore
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
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
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setIssueBooking(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Report a Service Problem
              </div>
              <h3 className="font-extrabold text-lg text-slate-900">We&apos;re here to resolve it</h3>
              <p className="text-xs text-slate-500 font-medium">
                Organizer and provider will immediately receive this report.
              </p>
            </div>

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Describe the Issue (Minimum 10 characters)
                </label>
                <textarea
                  rows={4}
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
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
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
