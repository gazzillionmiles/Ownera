'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Briefcase,
  Users,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Award,
  Loader2,
  Check,
  Star,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCampaign, ProviderBid } from '@/src/types/ownera';

interface QuoteComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: ServiceCampaign | null;
  onSuccess: () => void;
}

export const QuoteComparisonModal: React.FC<QuoteComparisonModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectingBidId, setSelectingBidId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !campaign || !mounted) return null;

  const bids = campaign.bids || [];

  const handleAcceptQuote = async (bid: ProviderBid) => {
    setSelectingBidId(bid.id);
    try {
      const res = await fetch(`/api/polls/${campaign.id}/select-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId: bid.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept offer');
      }

      toast.success(data.message || 'Offer accepted! Bookings are now open for residents.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error accepting quote');
    } finally {
      setSelectingBidId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121620] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[80vh] md:max-h-[75vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition flex items-center justify-center p-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-semibold mb-1 border border-transparent dark:border-blue-500/20">
            <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Commercial Bid Comparison</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Compare Quotes for &ldquo;{campaign.title}&rdquo;
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
            Review vendor pricing, technician crew sizes, and arrival window capacities. Accept the optimal quote to open booking slots.
          </p>
        </div>

        {bids.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-slate-50 dark:bg-[#181f2e] border border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-zinc-400 space-y-2">
            <p className="font-bold text-slate-800 dark:text-white text-sm">No quotes submitted yet</p>
            <p>Invite local service partners or wait for vendors to respond.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {bids.map((bid) => {
              const isWinning = campaign.selected_bid_id === bid.id || bid.status === 'accepted';
              const providerName = bid.provider?.company_name || 'Service Provider';
              const rating = bid.provider?.rating;
              const completedJobs = bid.provider?.total_jobs_completed || 0;
              const simultaneous = bid.simultaneous_capacity || bid.technicians_count;
              const teamSize = bid.technicians_count || simultaneous;
              const duration = bid.estimated_duration_minutes || bid.service_duration_minutes;

              return (
                <div
                  key={bid.id}
                  className={`p-6 rounded-2xl border transition-all space-y-4 ${
                    isWinning
                      ? 'border-2 border-emerald-500 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md'
                      : 'border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#181f2e] hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-slate-900 dark:text-white">{providerName}</span>
                        {rating && rating > 0 ? (
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {rating}
                          </span>
                        ) : null}
                        {completedJobs > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                            ({completedJobs}+ completed jobs)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                        Available on: <strong className="text-slate-800 dark:text-zinc-200">{bid.available_date}</strong>
                        {bid.available_start_time ? ` (${bid.available_start_time})` : ''}
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
                        ₹{bid.price_per_unit}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-semibold">per household / unit</div>
                    </div>
                  </div>

                  {/* Operational Details Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5">
                      <div className="text-slate-400 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Crew Size</div>
                      <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {teamSize ? `${teamSize} Technicians` : 'Dedicated crew'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5">
                      <div className="text-slate-400 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Simultaneous Units</div>
                      <div className="font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                        {simultaneous ? `${simultaneous} at once` : 'Standard flow'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/25 border border-slate-100 dark:border-white/5">
                      <div className="text-slate-400 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Est. Duration</div>
                      <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {duration ? `${duration} mins / flat` : 'Standard'}
                      </div>
                    </div>
                  </div>

                  {bid.notes && (
                    <p className="text-xs text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-black/25 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                      &ldquo;{bid.notes}&rdquo;
                    </p>
                  )}

                  {/* Action CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                      Direct cash / UPI settlement on service day
                    </span>

                    {isWinning ? (
                      <div className="px-5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                        <span>Accepted Offer</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcceptQuote(bid)}
                        disabled={selectingBidId === bid.id}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        {selectingBidId === bid.id ? (
                          'Accepting...'
                        ) : (
                          <>
                            <span>Accept Offer &amp; Open Slots</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
