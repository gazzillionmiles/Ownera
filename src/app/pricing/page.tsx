'use client';

import React from 'react';
import Link from 'next/link';
import { Layers, Check, ShieldCheck, ArrowRight, Building2, Wind, Bug, Sparkles, Droplet } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';
import { Footer } from '@/src/shared/components/Footer';

const SAMPLE_PRICING_TIERS = [
  {
    service: 'AC Servicing',
    icon: Wind,
    tier1: '₹699 (1-9 homes)',
    tier2: '₹599 (10-19 homes)',
    tier3: '₹549 (20-29 homes)',
    tier4: '₹499 (30+ homes)',
    maxSavings: 'Save ₹200 (28%)',
  },
  {
    service: 'Pest Control',
    icon: Bug,
    tier1: '₹999 (1-9 homes)',
    tier2: '₹849 (10-19 homes)',
    tier3: '₹749 (20-29 homes)',
    tier4: '₹699 (30+ homes)',
    maxSavings: 'Save ₹300 (30%)',
  },
  {
    service: 'Deep Cleaning',
    icon: Sparkles,
    tier1: '₹2,999 (1-9 homes)',
    tier2: '₹2,699 (10-19 homes)',
    tier3: '₹2,399 (20-29 homes)',
    tier4: '₹2,199 (30+ homes)',
    maxSavings: 'Save ₹800 (27%)',
  },
  {
    service: 'RO Servicing',
    icon: Droplet,
    tier1: '₹499 (1-9 homes)',
    tier2: '₹429 (10-19 homes)',
    tier3: '₹379 (20-29 homes)',
    tier4: '₹349 (30+ homes)',
    maxSavings: 'Save ₹150 (30%)',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#121316]/95 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight">{APP_NAME}</span>
              <span className="text-[10px] text-zinc-400 font-medium">{APP_TAGLINE}</span>
            </div>
          </Link>
          <Link
            href="/login"
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-[#2CB7A5]/40 text-[#2CB7A5] hover:bg-[#2CB7A5]/10 transition"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14 flex-1 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" /> Collective Bulk Pricing Model
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            The More Homes Join, The Less Everyone Pays
          </h1>
          <p className="text-sm text-zinc-400">
            No subscriptions or opaque commission markups. Transparent stepped volume tiers for every standardized residential service.
          </p>
        </div>

        {/* Bulk Pricing Tier Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {SAMPLE_PRICING_TIERS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#18191D] border border-white/10 shadow-xl space-y-4 hover:border-[#2CB7A5]/40 transition"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{item.service}</h3>
                      <span className="text-[11px] font-bold text-emerald-400">{item.maxSavings}</span>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    Bulk Camp
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                    <div className="text-zinc-500 text-[10px]">Tier 1 (1–9 Homes)</div>
                    <div className="font-mono font-bold text-zinc-300 mt-0.5">{item.tier1}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                    <div className="text-zinc-500 text-[10px]">Tier 2 (10–19 Homes)</div>
                    <div className="font-mono font-bold text-zinc-300 mt-0.5">{item.tier2}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                    <div className="text-zinc-500 text-[10px]">Tier 3 (20–29 Homes)</div>
                    <div className="font-mono font-bold text-zinc-300 mt-0.5">{item.tier3}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30">
                    <div className="text-[#2CB7A5] text-[10px] font-semibold">Tier 4 (30+ Homes)</div>
                    <div className="font-mono font-bold text-[#2CB7A5] mt-0.5">{item.tier4}</div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 flex items-center gap-2 pt-1">
                  <Check className="w-3.5 h-3.5 text-[#2CB7A5]" />
                  <span>Only ₹49 confirmation deposit • Balance due upon completion</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* How Booking Payments Work */}
        <div className="p-8 rounded-3xl bg-[#18191D] border border-white/10 space-y-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">How Payments Work</h2>
          <div className="grid sm:grid-cols-3 gap-6 text-xs text-zinc-400">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5] font-bold font-mono">
                1
              </div>
              <h4 className="font-bold text-white text-sm">Express Interest for Free</h4>
              <p>Residents add their home to the campaign count without paying full fees upfront. This signals aggregate volume to providers.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5] font-bold font-mono">
                2
              </div>
              <h4 className="font-bold text-white text-sm">₹49 Adjustable Deposit</h4>
              <p>When the bulk price unlocks, confirm your booking with an adjustable ₹49 deposit via Razorpay and pick your convenient Sunday slot.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5] font-bold font-mono">
                3
              </div>
              <h4 className="font-bold text-white text-sm">Pay Balance on Service Day</h4>
              <p>After your service is completed and verified, pay the remaining discounted bulk balance directly with satisfaction guaranteed.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-[#2CB7A5]" />
              <span>Secure Razorpay payment processing • 100% money-back deposit protection</span>
            </div>
            <Link
              href="/login?mode=signup"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2"
            >
              <span>Join Your Society Camp</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
