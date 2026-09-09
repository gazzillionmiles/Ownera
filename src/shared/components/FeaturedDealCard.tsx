'use client';

import React from 'react';
import {
  Calendar,
  Check,
  ArrowRight,
  TrendingUp,
  Clock,
  Briefcase,
  Users,
} from 'lucide-react';
import { ServiceCampaign } from '@/src/types/ownera';
import { AcUnitGraphic, CarWashGraphic, CleaningSuppliesGraphic } from './ui/IllustrationIcons';

interface FeaturedDealCardProps {
  campaign: ServiceCampaign;
  onOpenBooking?: (campaign: ServiceCampaign) => void;
  onOpenCompareQuotes?: (campaign: ServiceCampaign) => void;
  onVote?: (pollId: string, option: string) => Promise<void>;
}

export const FeaturedDealCard: React.FC<FeaturedDealCardProps> = ({
  campaign,
  onOpenBooking,
  onOpenCompareQuotes,
}) => {
  const isBookingOpen = campaign.status === 'booking_open' || campaign.status === 'scheduled';
  const hasProvider = !!campaign.selected_provider_id;
  const targetNeeded = campaign.target_customers || 25;
  const joinedCount = campaign.total_votes || campaign.poll_votes?.length || 0;
  const percentage = Math.min(100, Math.round((joinedCount / targetNeeded) * 100));
  const neededToUnlock = Math.max(0, targetNeeded - joinedCount);

  const isAcService = campaign.title?.toLowerCase().includes('ac') || campaign.service?.name?.toLowerCase().includes('ac');
  const isCarService = campaign.title?.toLowerCase().includes('car');
  const isCleaningService = campaign.title?.toLowerCase().includes('clean');

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e0f2fe] via-[#f0f9ff] to-[#ffffff] border border-sky-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-6">
        <div className="space-y-2 z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 text-blue-800 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Community Drive • {campaign.event_date || 'Upcoming Weekend'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {campaign.title}
          </h2>

          <p className="text-xs sm:text-sm font-normal text-slate-600 leading-relaxed">
            {campaign.description || 'Vendor bids determine the final bulk rate. Join to unlock competitive quotes.'}
          </p>
        </div>

        {/* Vector Illustration */}
        <div className="relative w-44 sm:w-56 h-28 sm:h-32 self-center sm:self-auto shrink-0">
          {isAcService ? (
            <AcUnitGraphic className="w-full h-full" />
          ) : isCarService ? (
            <CarWashGraphic className="w-full h-full" />
          ) : isCleaningService ? (
            <CleaningSuppliesGraphic className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-blue-50/50 rounded-2xl border border-blue-100">
              <TrendingUp className="w-12 h-12 text-blue-500" />
            </div>
          )}
        </div>
      </div>

      {/* Participation Count & Target */}
      <div className="pt-2 border-t border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-600 block mb-1">
            Community Participation:
          </span>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>{joinedCount} Residents Pledged</span>
            </div>
            {hasProvider && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Provider Assigned</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <div className="flex items-baseline sm:justify-end gap-1.5 font-mono">
            <span className="text-2xl font-black text-blue-600 tracking-tight">
              {joinedCount}
            </span>
            <span className="text-sm font-bold text-slate-500 font-sans">
              / {targetNeeded} target
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            {neededToUnlock > 0 ? `${neededToUnlock} more needed for next tier` : 'Quorum goal reached!'}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-3 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(5, percentage)}%` }}
          />
        </div>
      </div>

      {/* Action Area */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full">
        {isBookingOpen && onOpenBooking ? (
          <button
            onClick={() => onOpenBooking(campaign)}
            className="w-full sm:w-auto min-w-[240px] min-h-[48px] py-3.5 px-8 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>Book Your Time Slot</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        ) : (campaign.bids_count || 0) > 0 && onOpenCompareQuotes ? (
          <button
            onClick={() => onOpenCompareQuotes(campaign)}
            className="w-full sm:w-auto min-w-[240px] min-h-[48px] py-3.5 px-8 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>Review Provider Bids ({campaign.bids_count})</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        ) : null}

        {campaign.service?.name && (
          <span className="text-xs text-slate-500 font-normal sm:ml-auto">
            Standard service checklist verified by society
          </span>
        )}
      </div>
    </div>
  );
};
