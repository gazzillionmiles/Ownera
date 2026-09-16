'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ServiceCampaign,
  Booking,
  Provider,
  ProviderBid,
  ServiceIssue,
  ServiceRating,
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
  Wrench,
  AlertTriangle,
  XCircle,
  MessageSquare,
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
  onTabChange?: (tab: string) => void;
}

export const ProviderView: React.FC<ProviderViewProps> = ({
  campaigns,
  providerBookings,
  providerBids,
  providerProfile,
  user,
  activeTab,
  onRefresh,
  onTabChange,
}) => {
  const [biddingCampaign, setBiddingCampaign] = useState<ServiceCampaign | null>(null);
  const [bidPrice, setBidPrice] = useState(499);
  const [availableStartTime, setAvailableStartTime] = useState('10:00 AM');
  const [simultaneousCapacity, setSimultaneousCapacity] = useState(5);
  const [techniciansCount, setTechniciansCount] = useState(5);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(30);
  const [totalCapacity, setTotalCapacity] = useState(40);
  const [bidNotes, setBidNotes] = useState('Dedicated mobile crew on site with professional equipment.');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);

  // Reviews & Reported Issues (shown on the Overview tab)
  const [reviews, setReviews] = useState<ServiceRating[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!providerProfile?.id) return;
    setLoadingReviews(true);
    try {
      const res = await fetch(`/api/providers/${providerProfile.id}/reviews?limit=10`);
      const data = await res.json();
      if (res.ok) setReviews(data.reviews || []);
    } catch {
      // Non-critical widget — fail silently and leave the section empty.
    } finally {
      setLoadingReviews(false);
    }
  }, [providerProfile]);

  const fetchIssues = useCallback(async () => {
    if (!providerProfile?.id) return;
    setLoadingIssues(true);
    try {
      const res = await fetch(`/api/service-issues?providerId=${providerProfile.id}`);
      const data = await res.json();
      if (res.ok) setIssues(data.issues || []);
    } catch {
      // Non-critical widget — fail silently and leave the section empty.
    } finally {
      setLoadingIssues(false);
    }
  }, [providerProfile]);

  useEffect(() => {
    fetchReviews();
    fetchIssues();
  }, [fetchReviews, fetchIssues]);

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
          warrantyDays: 0,
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

  const verificationStatus = providerProfile?.verification_status || 'pending';
  const isPendingReview = verificationStatus === 'pending' || verificationStatus === 'unverified';
  const isBanned = verificationStatus === 'banned';
  const isRejected = verificationStatus === 'rejected';
  const isVerified = verificationStatus === 'verified';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Royal Blue Header matching Ownera ProviderDashboardScreen */}
      <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-900 text-white p-4 sm:p-6 rounded-3xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-semibold mb-1">
              <Wrench className="w-3.5 h-3.5" />
              <span>Service Partner Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
              {providerProfile?.company_name || 'Service Partner Hub'} 👋
            </h1>
            <p className="text-[11px] sm:text-xs text-blue-100 font-medium mt-0.5">
              Bulk invitations, demand pooling & job dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isVerified ? (
              <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-200 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5">
                {providerProfile?.rating ? (
                  <>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{providerProfile.rating}★ Rating</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-4 h-4" />
                    <span>Service Partner</span>
                  </>
                )}
              </span>
            ) : isPendingReview ? (
              <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Under Review</span>
              </span>
            ) : isBanned ? (
              <span className="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Account Banned</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-slate-500/20 text-slate-300 border border-slate-500/30 text-xs font-bold flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>Not Approved</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Stat Metrics in a Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-3 py-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight block font-mono">{campaigns.length}</span>
            <span className="text-xs font-bold text-blue-100 mt-1 block">Society Invitations</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-3 py-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight block font-mono">{providerBids.length}</span>
            <span className="text-xs font-bold text-blue-100 mt-1 block">Quotes Submitted</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-3 py-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight block font-mono">{confirmedCount}</span>
            <span className="text-xs font-bold text-blue-100 mt-1 block">Scheduled Flats</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-3 py-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight block font-mono">{completedCount}</span>
            <span className="text-xs font-bold text-blue-100 mt-1 block">Completed Jobs</span>
          </div>
        </div>
      </div>

      {/* Account Verification Status Notice */}
      {isPendingReview && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-amber-900">Your Business Profile is Under Review</h3>
              <p className="text-xs text-amber-800/80 font-medium mt-0.5 max-w-2xl leading-relaxed">
                Ownera administrators review every commercial service partner before activating bidding privileges. You will be able to submit volume bids as soon as your account is approved.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold shrink-0">
            <span>Status: Under Review</span>
          </div>
        </div>
      )}

      {isBanned && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-rose-900">Vendor Account Suspended</h3>
              <p className="text-xs text-rose-800/80 font-medium mt-0.5 max-w-2xl leading-relaxed">
                This service provider account has been banned by platform administrators. Bidding on society drives and technician scheduling have been restricted. Contact support if you believe this is an error.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold shrink-0">
            <span>Status: Banned</span>
          </div>
        </div>
      )}

      {/* Overview & Opportunities Content */}
      {(activeTab === 'overview' || activeTab === 'opportunities') && (
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                onClick={() => onTabChange?.('opportunities')}
                className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-blue-300 hover:shadow-md transition cursor-pointer space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2 group-hover:text-blue-600 transition">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Invited Opportunities ({campaigns.length})</span>
                  </h3>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Residential societies that have invited your firm to submit volume bids.
                </p>
                <div className="text-xs text-blue-600 font-bold">
                  {providerBids.length} Quotes submitted • {campaigns.length} Total invites
                </div>
              </div>

              <div
                onClick={() => onTabChange?.('schedule')}
                className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-emerald-300 hover:shadow-md transition cursor-pointer space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2 group-hover:text-emerald-600 transition">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <span>Confirmed Society Jobs Checklist ({confirmedCount})</span>
                  </h3>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Apartment unit checklist, technician arrival slots, and job completion verification.
                </p>
                <div className="text-xs text-emerald-600 font-bold">
                  {completedCount} of {confirmedCount} Jobs Completed
                </div>
              </div>
            </div>
          )}

          {/* Reviews & Reported Issues Summary (Overview only) */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span>Recent Reviews {providerProfile?.rating ? `(${providerProfile.rating}★ avg)` : ''}</span>
                </h3>
                {loadingReviews ? (
                  <p className="text-xs text-slate-400">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium">
                    No resident reviews yet. They&apos;ll appear here once residents rate completed jobs.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {reviews.map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-1 mb-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3 h-3 ${
                                idx < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="text-[11px] font-bold text-slate-500 ml-1">
                            {r.reviewer_name || 'Verified Resident'}
                          </span>
                        </div>
                        {r.review && <p className="text-xs text-slate-700">{r.review}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Issues Reported Against You ({issues.length})</span>
                </h3>
                {loadingIssues ? (
                  <p className="text-xs text-slate-400">Loading issue reports...</p>
                ) : issues.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium">
                    No issues reported. Keep up the great work!
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {issues.map((issue) => (
                      <div key={issue.id} className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase text-rose-700">{issue.category}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              issue.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : issue.status === 'investigating'
                                ? 'bg-amber-100 text-amber-800'
                                : issue.status === 'escalated'
                                ? 'bg-rose-200 text-rose-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {issue.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{issue.description}</p>
                        {issue.booking?.campaign?.title && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{issue.booking.campaign.title}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Society Bidding Invitations ({campaigns.length})</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Review resident volume and submit competitive rates with your crew capacity.
            </p>
          </div>

          {campaigns.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-3">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-base font-bold text-slate-900">No active campaign invitations</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                When societies invite you to quote on bulk services, your invitation cards will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((camp) => {
                const myBid = providerBids.find((b) => b.campaign_id === camp.id);

                return (
                  <div
                    key={camp.id}
                    className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 uppercase border border-blue-100/60">
                            {camp.society?.name || 'Society'}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            Service Date: <strong className="text-slate-700 font-semibold">{camp.event_date || 'Upcoming'}</strong>
                          </span>
                        </div>
                        <h3 className="font-extrabold text-lg text-slate-900 leading-snug">{camp.title}</h3>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div className="text-xs text-slate-400 font-medium">Demand Volume</div>
                        <div className="text-2xl font-black text-blue-600 font-mono tracking-tight">
                          {camp.total_votes || camp.confirmed_count || 0} / {camp.target_customers || 30} <span className="text-sm font-bold text-slate-500 font-sans">Flats</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {camp.description || 'Standardized service camp looking for commercial provider crews.'}
                    </p>

                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-500 font-medium">
                        Target Rate: <strong className="text-slate-900 font-bold font-mono text-sm">₹{camp.current_price}</strong> / unit
                      </div>

                      {myBid ? (
                        <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Quote Submitted: ₹{myBid.price_per_unit} ({myBid.status})</span>
                        </div>
                      ) : !isVerified ? (
                        <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold flex items-center gap-1.5">
                          {isBanned ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Account Suspended</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Under Review &bull; Quotes Locked</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenBidModal(camp)}
                          className="min-h-[40px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
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
          )}
        </div>
      )}

      {/* Schedule / Jobs Checklist Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Confirmed Society Jobs Checklist
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Track apartment-by-apartment technician routing and record completion.
            </p>
          </div>

          {providerBookings.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-3">
              <CheckSquare className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-base font-bold text-slate-900">No confirmed jobs scheduled yet</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                When an organizer accepts your quote and residents book slots, your service checklist will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {providerBookings.map((job) => {
                const isCompleted = job.status === 'completed';

                return (
                  <div
                    key={job.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-slate-200/80 bg-white shadow-sm'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 shrink-0">
                          Unit {job.flat_number}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {job.quantity} {job.quantity === 1 ? 'Unit' : 'Units'}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{job.slot?.slot_time || 'Coordinated Slot'}</span>
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Resident: <strong className="text-slate-800 font-semibold">{job.user_profile?.name || 'Resident'}</strong> • Phone: <strong className="text-slate-800 font-semibold">{job.user_profile?.phone || 'On site'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {isCompleted ? (
                        <div className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-semibold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Service Completed</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkJobCompleted(job.id)}
                          disabled={completingBookingId === job.id}
                          className="min-h-[40px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          {completingBookingId === job.id ? 'Marking...' : 'Mark Job Completed'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quote Submission Modal */}
      {biddingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setBiddingCampaign(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="space-y-1">
              <h3 className="font-black text-base sm:text-lg text-slate-900">Submit Quote to {biddingCampaign.society?.name || 'Society'}</h3>
              <p className="text-xs text-slate-500 font-medium">{biddingCampaign.title}</p>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Price Per Unit (₹)</label>
                  <input
                    type="number"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(Number(e.target.value))}
                    required
                    min={100}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Start Time</label>
                  <input
                    type="text"
                    value={availableStartTime}
                    onChange={(e) => setAvailableStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Crew (Techs)</label>
                  <input
                    type="number"
                    value={techniciansCount}
                    onChange={(e) => setTechniciansCount(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Simultaneous Flats</label>
                  <input
                    type="number"
                    value={simultaneousCapacity}
                    onChange={(e) => setSimultaneousCapacity(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingBid}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingBid ? 'Submitting Offer...' : 'Confirm Quote Submission'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
