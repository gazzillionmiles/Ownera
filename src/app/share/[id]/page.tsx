'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Building2,
  Calendar,
  Users,
  CheckCircle2,
  Share2,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';
import { ServiceCampaign } from '@/src/types/ownera';
import { toast } from 'sonner';

export default function ShareCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<ServiceCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${resolvedParams.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.campaign) {
          setCampaign(data.campaign);
          if (data.campaign.society?.invite_code && typeof document !== 'undefined') {
            const code = data.campaign.society.invite_code.toUpperCase();
            document.cookie = `ownera_invite_code=${encodeURIComponent(code)}; path=/; max-age=2592000; SameSite=Lax`;
            try {
              window.localStorage.setItem('ownera_invite_code', code);
            } catch {}
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121316] text-white flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2CB7A5]" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#121316] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1>
        <p className="text-zinc-400 text-sm mb-6">This service camp link may have expired or is invalid.</p>
        <Link href="/" className="px-6 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs">
          Go to Home
        </Link>
      </div>
    );
  }

  const societyName = campaign.society?.name || 'Society';
  const confirmedCount = campaign.confirmed_count || 0;
  const interestedCount = campaign.interested_count || 0;
  const targetCount = campaign.target_customers || 30;
  const currentPrice = campaign.current_price || campaign.price_info?.currentPrice;
  const basePrice = campaign.service?.base_price_estimate || campaign.price_info?.basePrice;
  const hasRealSavings = typeof basePrice === 'number' && typeof currentPrice === 'number' && basePrice > currentPrice;
  const savings = hasRealSavings ? basePrice - currentPrice : 0;
  const savingsPct = hasRealSavings ? Math.round((savings / basePrice) * 100) : 0;

  const shareText = `🔥 *${campaign.title}* at *${societyName}*
💰 *₹${currentPrice}* bulk rate${hasRealSavings ? ` (Save ₹${savings} / ${savingsPct}% off)` : ''}
🎯 *${confirmedCount}/${targetCount}* homes confirmed!
👉 Join our society camp on Ownera:
${typeof window !== 'undefined' ? window.location.href : ''}`;

  const handleCopyShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('Campaign share message copied!');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#121316] text-white flex flex-col">
      <header className="border-b border-white/[0.08] bg-[#121316]/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg">{APP_NAME}</span>
          </Link>
          <Link
            href={`/login?mode=signup&code=${campaign.society?.invite_code || ''}`}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-[#2CB7A5] text-zinc-950"
          >
            Join Campaign
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl border border-[#2CB7A5]/30 bg-[#18191D] shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" /> {societyName}
            </div>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {campaign.event_date}
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {campaign.title}
            </h1>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {campaign.description || 'Collective society bulk booking camp. Combine demand with your neighbors to unlock lowest provider bulk rate.'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#2CB7A5]" />
                <strong>{confirmedCount}</strong> / {targetCount} homes confirmed
              </span>
              <span className="text-emerald-400 font-bold font-mono">
                {targetCount - confirmedCount > 0
                  ? `Only ${targetCount - confirmedCount} more needed`
                  : 'Target Reached!'}
              </span>
            </div>
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2CB7A5] to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((confirmedCount / targetCount) * 100))}%` }}
              />
            </div>
          </div>

          {/* Price Box */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-white/5 text-center">
            <div>
              <div className="text-[11px] text-zinc-400">Current Unlocked Price</div>
              <div className="text-2xl font-extrabold text-[#2CB7A5] font-mono mt-0.5">₹{currentPrice}</div>
              <div className="text-[10px] text-zinc-500 line-through">₹{basePrice} Solo Rate</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">Your Bulk Savings</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-0.5">₹{savings}</div>
              <div className="text-[10px] text-emerald-500 font-medium">Per household</div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            <Link
              href={`/login?mode=signup&code=${campaign.society?.invite_code || ''}`}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Join &amp; Confirm Booking (₹49 Deposit)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="py-2.5 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp Share</span>
              </button>

              <button
                type="button"
                onClick={handleCopyShare}
                className="py-2.5 px-3 rounded-xl bg-zinc-800 border border-white/10 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#2CB7A5]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
