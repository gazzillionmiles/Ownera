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
    <div className="p-6 sm:p-7 rounded-3xl border border-white/10 bg-[#18191D] shadow-xl hover:border-[#2CB7A5]/30 transition space-y-5">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isMyHouse
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-[#2CB7A5]/15 text-[#2CB7A5] border border-[#2CB7A5]/30'
              }`}
            >
              {isMyHouse ? '🏡 My House Request' : '🏢 Society Poll'}
            </span>

            {poll.service?.name && (
              <span className="text-[11px] text-zinc-400 font-medium">
                {poll.service.name}
              </span>
            )}

            <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {poll.event_date}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">{poll.title}</h3>
          {poll.description && (
            <p className="text-xs text-zinc-400 line-clamp-2">{poll.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleShareClick}
            className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 transition text-xs font-semibold flex items-center gap-1.5"
            title="Share with neighbors on WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-[#2CB7A5]" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Poll Question & Interactive Voting Buttons */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-xs text-white flex items-center gap-2">
            <Vote className="w-4 h-4 text-[#2CB7A5]" />
            <span>{poll.poll_question || 'Who wants this service?'}</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#2CB7A5]">
            {totalVotes} {totalVotes === 1 ? 'Resident Vote' : 'Resident Votes'}
          </span>
        </div>

        {/* Voting Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
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
                className={`p-3 rounded-xl border text-left transition relative overflow-hidden flex items-center justify-between group ${
                  isSelected
                    ? 'border-[#2CB7A5] bg-[#2CB7A5]/15 text-white font-bold'
                    : 'border-white/10 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {/* Background vote percentage fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-[#2CB7A5]/10 transition-all duration-300 pointer-events-none"
                  style={{ width: `${pct}%` }}
                />

                <div className="relative z-10 flex items-center gap-2">
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0" />}
                  <span className="text-xs font-semibold">{opt}</span>
                </div>

                <div className="relative z-10 text-[11px] font-mono text-zinc-400 group-hover:text-zinc-200">
                  {count} ({pct}%)
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vendor Quote / Booking Status Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-zinc-400 flex items-center gap-2">
          {hasSelectedProvider ? (
            (() => {
              const basePrice = poll.service?.base_price_estimate;
              const hasRealSavings = typeof basePrice === 'number' && typeof poll.current_price === 'number' && basePrice > poll.current_price;
              const savings = hasRealSavings ? basePrice - poll.current_price : 0;
              const savingsPct = hasRealSavings ? Math.round((savings / basePrice) * 100) : 0;

              return (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Provider Selected: {poll.selected_provider?.company_name || 'Assigned Provider'} (₹{poll.current_price}/unit
                    {hasRealSavings ? ` • Save ₹${savings} (${savingsPct}% off)` : ''})
                  </span>
                </span>
              );
            })()
          ) : (
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#2CB7A5]" />
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
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition"
              >
                + Invite Vendor
              </button>

              {bidsCount > 0 && !hasSelectedProvider && (
                <button
                  onClick={() => onOpenCompareQuotes(poll)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs hover:bg-amber-500/25 transition flex items-center gap-1"
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
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Book Time Slot</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
