'use client';

import React, { useState } from 'react';
import {
  Users,
  Calendar,
  Building2,
  Home,
  CheckCircle2,
  Clock,
  Share2,
  Briefcase,
  Check,
  ChevronRight,
  Vote,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCampaign, PollVote } from '@/src/types/ownera';
import { BaseUserProfile } from '@/src/types/auth';

interface PollCardProps {
  poll: ServiceCampaign;
  user: BaseUserProfile;
  onVote: (pollId: string, option: string) => Promise<void>;
  onOpenInviteVendor: (poll: ServiceCampaign) => void;
  onOpenCompareQuotes: (poll: ServiceCampaign) => void;
  onOpenBooking: (poll: ServiceCampaign) => void;
  onRefresh: () => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  user,
  onVote,
  onOpenInviteVendor,
  onOpenCompareQuotes,
  onOpenBooking,
}) => {
  const [votingOption, setVotingOption] = useState<string | null>(null);

  const isCreator = poll.organizer_id === user.id;
  const isMyHouse = poll.scope === 'my_house';
  const pollOptions = poll.poll_options || ['Yes', 'No'];
  const userVoteOption = poll.user_vote?.option_selected;
  const totalVotes = poll.total_votes || poll.poll_votes?.length || 0;
  const voteBreakdown = poll.vote_breakdown || {};
  const bidsCount = poll.bids_count || poll.bids?.length || 0;
  const isBookingOpen = poll.status === 'booking_open' || poll.status === 'scheduled';
  const hasSelectedProvider = !!poll.selected_provider_id;
  const targetNeeded = poll.target_customers || 20;
  const percentage = Math.min(100, Math.round((totalVotes / targetNeeded) * 100));

  const handleVoteClick = async (option: string) => {
    setVotingOption(option);
    try {
      await onVote(poll.id, option);
      toast.success(`Vote recorded: "${option}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit vote');
    } finally {
      setVotingOption(null);
    }
  };

  const handleShareClick = () => {
    const text = `📊 *${poll.title}* at *${poll.society?.name || 'Society'}*\n\nQuestion: "${poll.poll_question || 'Who wants this service?'}"\n${totalVotes} neighbors have responded!\n\nVote on Ownera:\n${window.location.origin}/s/${poll.society?.slug || 'hub'}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="p-6 sm:p-7 rounded-3xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all space-y-5">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isMyHouse
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isMyHouse ? '🏡 My House Request' : '🏢 Society Poll'}
            </span>

            {poll.service?.name && (
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
                {poll.service.name}
              </span>
            )}

            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Service: {poll.event_date || 'Upcoming'}</span>
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {poll.title}
          </h3>

          {poll.description && (
            <p className="text-xs text-slate-500 font-medium line-clamp-2">
              {poll.description}
            </p>
          )}

          {poll.creator_profile?.name && (
            <p className="text-[11px] text-slate-400 font-medium">
              Proposed by <strong className="text-slate-700">{poll.creator_profile.name}</strong>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={handleShareClick}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Share with neighbors on WhatsApp"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Quorum Target Progress Bar */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Community Quorum</span>
          </span>
          <span className="font-extrabold text-blue-600">
            {totalVotes} / {targetNeeded} interested ({percentage}%)
          </span>
        </div>

        <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-2.5 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(4, percentage)}%` }}
          />
        </div>
      </div>

      {/* Poll Question & Interactive Voting Buttons */}
      <div className="space-y-3">
        <div className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Vote className="w-4 h-4 text-blue-600" />
          <span>{poll.poll_question || 'Cast your response:'}</span>
        </div>

        {/* Voting Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {pollOptions.map((opt) => {
            const isSelected = userVoteOption === opt;
            const count = voteBreakdown[opt] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleVoteClick(opt)}
                disabled={votingOption !== null}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-emerald-600/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {/* Background vote percentage fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-100/50 transition-all duration-300 pointer-events-none"
                  style={{ width: `${pct}%` }}
                />

                <div className="relative z-10 flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-bold">{opt}</span>
                </div>

                <div className="relative z-10 text-xs font-bold text-slate-500">
                  {count} ({pct}%)
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vendor Quote / Booking Status Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500 flex items-center gap-2">
           {hasSelectedProvider ? (
             <span className="text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
               <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
               <span>Partner: {poll.selected_provider?.company_name || 'Assigned Provider'} • Quote accepted</span>
             </span>
           ) : (
            <span className="text-slate-600 font-semibold flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <Briefcase className="w-4 h-4 text-blue-600" />
              {bidsCount > 0 ? `${bidsCount} Vendor ${bidsCount === 1 ? 'Quote' : 'Quotes'} received` : 'Waiting for vendor quotes'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Creator / Secretary Actions */}
          {isCreator && (
            <>
              <button
                onClick={() => onOpenInviteVendor(poll)}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                + Invite Vendor
              </button>

              {bidsCount > 0 && !hasSelectedProvider && (
                <button
                  onClick={() => onOpenCompareQuotes(poll)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Compare Offers ({bidsCount})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {/* Resident Booking Action */}
          {isBookingOpen && (
            <button
              onClick={() => onOpenBooking(poll)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs hover:bg-blue-700 transition shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Book Time Slot</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
