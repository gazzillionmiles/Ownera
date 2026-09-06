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
  DollarSign,
  Check,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-2">
            <Briefcase className="w-3.5 h-3.5" /> Vendor Quote Comparison
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Compare Offers for &ldquo;{campaign.title}&rdquo;
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Review vendor pricing, technician crew sizes, and simultaneous house capacities. Choose the best offer to open booking slots.
          </p>
        </div>

        {bids.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-zinc-900/50 border border-white/5 text-xs text-zinc-400">
            No quotes submitted yet. Invite local vendors or wait for provider offers.
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
                  className={`p-5 rounded-2xl border transition space-y-4 ${
                    isWinning
                      ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 shadow-lg'
                      : 'border-white/10 bg-zinc-900/60 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white">{providerName}</span>
                        {rating ? (
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5 font-mono">
                            ★ {rating}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-zinc-400 px-2 py-0.5 rounded-md bg-zinc-800 border border-white/5">
                            New Provider
                          </span>
                        )}
                        {completedJobs > 0 && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            ({completedJobs}+ jobs done)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Available on: <strong className="text-zinc-200">{bid.available_date}</strong>
                        {bid.available_start_time ? ` (Starts ${bid.available_start_time})` : ''}
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start">
                      <div className="text-2xl font-extrabold text-[#2CB7A5] font-mono">
                        ₹{bid.price_per_unit}
                      </div>
                      <div className="text-[10px] text-zinc-500">per unit / household</div>
                    </div>
                  </div>

                  {/* Capacity & Timing Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <div className="text-zinc-500 text-[10px]">Team Size</div>
                      <div className="font-bold font-mono text-white mt-0.5">
                        {teamSize ? `${teamSize} Technicians` : 'Dedicated crew'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <div className="text-zinc-500 text-[10px]">Simultaneous Homes</div>
                      <div className="font-bold font-mono text-emerald-400 mt-0.5">
                        {simultaneous ? `${simultaneous} at once` : 'Standard flow'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <div className="text-zinc-500 text-[10px]">Est. Duration</div>
                      <div className="font-bold font-mono text-white mt-0.5">
                        {duration ? `${duration} mins / home` : 'Standard duration'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <div className="text-zinc-500 text-[10px]">Warranty</div>
                      <div className="font-bold font-mono text-[#2CB7A5] mt-0.5">
                        {bid.warranty_days ? `${bid.warranty_days} Days` : 'Standard'}
                      </div>
                    </div>
                  </div>

                  {bid.notes && (
                    <p className="text-xs text-zinc-400 italic bg-black/20 p-3 rounded-xl border border-white/5">
                      &ldquo;{bid.notes}&rdquo;
                    </p>
                  )}

                  {/* Action CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-500">
                      Payment directly on service day (No platform fee)
                    </span>

                    {isWinning ? (
                      <div className="px-5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30">
                        <Check className="w-4 h-4" />
                        <span>Accepted Offer</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcceptQuote(bid)}
                        disabled={selectingBidId === bid.id}
                        className="px-6 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition shadow-md disabled:opacity-50"
                      >
                        {selectingBidId === bid.id ? 'Accepting...' : 'Accept Offer & Open Slots'}
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
