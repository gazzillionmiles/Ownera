'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  TrendingDown,
  Building2,
  Wrench,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Wind,
  Bug,
  Droplet,
  Flame,
  Armchair,
  Bed,
  Check,
  Calendar,
  Zap,
} from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';

const STANDARDIZED_SERVICES = [
  {
    name: 'AC Servicing',
    category: 'Cooling & HVAC',
    icon: Wind,
    individualPrice: 699,
    bulkPrice: 499,
    savings: 'Save ₹200 (28% off)',
    desc: 'Jet-pump filter wash, outdoor unit deep flush & gas pressure diagnostics.',
  },
  {
    name: 'Pest Control',
    category: 'Pest & Hygiene',
    icon: Bug,
    individualPrice: 999,
    bulkPrice: 699,
    savings: 'Save ₹300 (30% off)',
    desc: 'Odorless kitchen gel baiting, bathroom drain spray with 30-day retreat warranty.',
  },
  {
    name: 'Deep Cleaning',
    category: 'Deep Cleaning',
    icon: Sparkles,
    individualPrice: 2999,
    bulkPrice: 2199,
    savings: 'Save ₹800 (27% off)',
    desc: 'Mechanized single-disc floor scrubbing, kitchen degreasing & bathroom descaling.',
  },
  {
    name: 'Sofa Cleaning',
    category: 'Upholstery',
    icon: Armchair,
    individualPrice: 799,
    bulkPrice: 549,
    savings: 'Save ₹250 (31% off)',
    desc: 'Deep fabric shampoo extraction, organic stain removal & allergen sanitization.',
  },
  {
    name: 'RO Servicing',
    category: 'Water & Health',
    icon: Droplet,
    individualPrice: 499,
    bulkPrice: 349,
    savings: 'Save ₹150 (30% off)',
    desc: 'Pre-filter wash, booster pump test, TDS calibration & internal sanitization.',
  },
  {
    name: 'Chimney Cleaning',
    category: 'Kitchen',
    icon: Flame,
    individualPrice: 899,
    bulkPrice: 629,
    savings: 'Save ₹270 (30% off)',
    desc: 'Baffle dismantling, ultrasonic caustic degreasing & blower motor surface clean.',
  },
  {
    name: 'Mattress Cleaning',
    category: 'Upholstery',
    icon: Bed,
    individualPrice: 649,
    bulkPrice: 449,
    savings: 'Save ₹200 (31% off)',
    desc: 'HEPA dust-mite extraction, UV-C sanitization & deodorizing enzyme treatment.',
  },
  {
    name: 'Water-Tank Cleaning',
    category: 'Community Utilities',
    icon: Building2,
    individualPrice: 1499,
    bulkPrice: 999,
    savings: 'Save ₹500 (33% off)',
    desc: 'High pressure rotary jet de-sludging, vacuum extraction & UV disinfection.',
  },
];

export default function PublicLandingPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [sliderHomes, setSliderHomes] = useState(24);

  const calculateDemoPrice = (homes: number) => {
    if (homes >= 30) return { price: 499, savings: 200, tier: '30+ Homes Bulk Tier' };
    if (homes >= 20) return { price: 549, savings: 150, tier: '20-29 Homes Tier' };
    if (homes >= 10) return { price: 599, savings: 100, tier: '10-19 Homes Tier' };
    return { price: 699, savings: 0, tier: 'Standard Rate (1-9 Homes)' };
  };

  const demoPricing = calculateDemoPrice(sliderHomes);

  const handleJoinSocietySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inviteCode.trim().toUpperCase();
    if (cleanCode) {
      if (typeof document !== 'undefined') {
        document.cookie = `ownera_invite_code=${encodeURIComponent(cleanCode)}; path=/; max-age=2592000; SameSite=Lax`;
        try {
          window.localStorage.setItem('ownera_invite_code', cleanCode);
        } catch {}
      }
      router.push(`/login?mode=signup&code=${encodeURIComponent(cleanCode)}`);
    } else {
      router.push('/login?mode=signup');
    }
  };

  return (
    <div className="min-h-screen bg-[#121316] text-[#FAF8F5] antialiased selection:bg-[#2CB7A5]/30">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#121316]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2CB7A5] to-emerald-400 flex items-center justify-center text-zinc-950 font-bold shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight leading-none text-white">{APP_NAME}</span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide">{APP_TAGLINE}</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
            <a href="#how-it-works" className="hover:text-white transition">How it works</a>
            <a href="#services" className="hover:text-white transition">Standard Services</a>
            <a href="#three-sides" className="hover:text-white transition">Who It&apos;s For</a>
            <a href="#pricing-model" className="hover:text-white transition">Bulk Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 text-zinc-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-[#2CB7A5] text-[#09090b] hover:bg-[#2CB7A5]/90 transition shadow-sm"
            >
              Join Society
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5] text-xs font-semibold mb-6">
            <Building2 className="w-3.5 h-3.5" /> Collective Buying For Residential Societies
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 text-white max-w-4xl mx-auto">
            Your society has <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2CB7A5] via-emerald-300 to-teal-200">buying power.</span> <br />Use it.
          </h1>

          <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Ownera aggregates demand across apartment homes so residents get better bulk prices, while verified providers get 30+ jobs in one single building.
          </p>

          {/* Quick Society Code Entry */}
          <div className="max-w-md mx-auto mb-12">
            <form onSubmit={handleJoinSocietySubmit} className="flex gap-2 p-1.5 rounded-2xl bg-[#18191D] border border-white/10 shadow-2xl">
              <input
                type="text"
                placeholder="Enter society invite code (e.g. SOC1234)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="flex-1 px-4 py-3 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none uppercase font-mono tracking-wider"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center gap-1.5 shrink-0"
              >
                <span>Join</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Key Stat Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-4 border-t border-white/[0.08]">
            <div className="p-3 text-center">
              <div className="text-2xl font-bold text-white font-mono">25-40%</div>
              <div className="text-xs text-zinc-400">Average resident savings</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl font-bold text-[#2CB7A5] font-mono">1 Location</div>
              <div className="text-xs text-zinc-400">No travel waste for providers</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl font-bold text-white font-mono">100%</div>
              <div className="text-xs text-zinc-400">Standardized verified scope</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400 font-mono">₹49</div>
              <div className="text-xs text-zinc-400">Adjustable deposit only</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demand & Price Unlock Demo Card */}
      <section id="pricing-model" className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">
        <div className="p-6 sm:p-8 rounded-3xl border border-[#2CB7A5]/30 bg-gradient-to-b from-[#18191D] to-[#141518] shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-[11px] font-bold uppercase tracking-wider mb-1.5">
                Live Dynamic Collective Pricing Demo
              </div>
              <h2 className="text-2xl font-bold text-white">Community AC Service Camp</h2>
              <p className="text-xs text-zinc-400">Sunday Service Day • Residential Community</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400">Individual Marketplace Rate</div>
              <div className="text-xl font-bold text-zinc-500 line-through">₹699</div>
            </div>
          </div>

          {/* Interactive Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span>Simulate Participating Homes in Society:</span>
              <span className="text-base font-mono text-[#2CB7A5] font-bold">{sliderHomes} Homes Joined</span>
            </div>
            <input
              type="range"
              min="1"
              max="40"
              value={sliderHomes}
              onChange={(e) => setSliderHomes(Number(e.target.value))}
              className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#2CB7A5]"
            />
            <div className="flex justify-between text-[11px] font-mono text-zinc-500">
              <span>1 Home (₹699)</span>
              <span>10 Homes (₹599)</span>
              <span>20 Homes (₹549)</span>
              <span>30+ Homes (₹499)</span>
            </div>
          </div>

          {/* Result Card */}
          <div className="grid sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-zinc-900/90 border border-white/5">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Current Bulk Price</div>
              <div className="text-3xl font-extrabold text-[#2CB7A5] font-mono">₹{demoPricing.price}</div>
              <div className="text-[11px] text-zinc-500 mt-1">{demoPricing.tier}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Per Home Savings</div>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono">₹{demoPricing.savings}</div>
              <div className="text-[11px] text-zinc-500 mt-1">vs single booking</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Total Society Savings</div>
              <div className="text-3xl font-extrabold text-white font-mono">₹{demoPricing.savings * sliderHomes}</div>
              <div className="text-[11px] text-zinc-500 mt-1">combined community savings</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2CB7A5]" />
              <span>3 verified HVAC providers submitted competing bids</span>
            </div>
            <Link
              href="/login?mode=signup"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-center hover:bg-[#25A08F] transition"
            >
              Confirm Booking (₹49 Deposit)
            </Link>
          </div>
        </div>
      </section>

      {/* 3 Step Workflow */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.08]">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-[#2CB7A5] mb-3 uppercase tracking-wider">
            How Ownera Works
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Turn Many Homes Into One Better Deal
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mt-2">
            Ownera aggregates demand first and lets providers compete for the concentrated society demand.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#16171B] border border-white/5 space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center font-bold text-[#2CB7A5] font-mono text-lg">
              01
            </div>
            <h3 className="text-lg font-bold text-white">Demand Aggregates</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Residents in the same society express interest in a standardized service camp (e.g. AC service before summer). No upfront full payment needed.
            </p>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-[11px] text-zinc-300 font-mono">
              24 / 30 neighbors joined
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#16171B] border border-white/5 space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center font-bold text-[#2CB7A5] font-mono text-lg">
              02
            </div>
            <h3 className="text-lg font-bold text-white">Providers Compete</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Top-rated verified service providers bid on the guaranteed volume. Knowing they get 25+ flats in 1 building, they give bulk volume pricing.
            </p>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-[11px] text-zinc-300 font-mono">
              Provider B: ₹499/AC (Selected)
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#16171B] border border-white/5 space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center font-bold text-[#2CB7A5] font-mono text-lg">
              03
            </div>
            <h3 className="text-lg font-bold text-white">Fulfillment on Service Day</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Residents pick 90-minute time slots. The provider arrives with dedicated teams on Sunday, executes standardized checklist, and residents rate.
            </p>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-[11px] text-[#2CB7A5] font-mono">
              Service completed • 4.9★ rating
            </div>
          </div>
        </div>
      </section>

      {/* Standardized Services Catalog Grid */}
      <section id="services" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.08]">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-[#2CB7A5] mb-3 uppercase tracking-wider">
            Standardized Catalog
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Standardized Home Services Ready for Bulk Camps
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mt-2">
            No vague quotes or surprise add-ons. Clear inclusions, exclusions, and guaranteed bulk pricing tiers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STANDARDIZED_SERVICES.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#16171B] border border-white/5 hover:border-[#2CB7A5]/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {s.savings}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white">{s.name}</h3>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{s.desc}</p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 line-through mr-1.5">₹{s.individualPrice}</span>
                    <span className="font-bold text-[#2CB7A5] text-sm">₹{s.bulkPrice}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Bulk Camp</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Three Sides Value Proposition */}
      <section id="three-sides" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-white/[0.08]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white tracking-tight">Built For Everyone in the Community</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#18191D] border border-white/10 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#2CB7A5]">For Residents</div>
            <h3 className="text-lg font-bold text-white">Save money without hassle</h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Save 25-40% compared to solo marketplace rates</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Verified providers vetted by your society organizers</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Pick convenient slots on the society service day</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#18191D] border border-white/10 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#2CB7A5]">For Society Organizers</div>
            <h3 className="text-lg font-bold text-white">Zero vendor coordination chaos</h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>No messy spreadsheets or unorganized WhatsApp polls</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Invite top providers and compare structured bids side-by-side</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Real-time dashboard of confirmed bookings and service status</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#18191D] border border-white/10 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#2CB7A5]">For Service Providers</div>
            <h3 className="text-lg font-bold text-white">Concentrated demand in one building</h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>30+ confirmed jobs in 1 location in a single day</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Zero travel time or commute costs between apartments</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0 mt-0.5" />
                <span>Predictable high-margin revenue (e.g. ₹15,000+ per day)</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center border-t border-white/[0.08]">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Ready to bring collective buying to your society?
        </h2>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-8">
          Join your society with an invite code or create a new campaign for your apartment community.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login?mode=signup"
            className="w-full sm:w-auto px-8 py-3.5 bg-[#2CB7A5] text-zinc-950 font-bold text-sm rounded-2xl hover:bg-[#25A08F] transition shadow-lg flex items-center justify-center gap-2"
          >
            <span>Get Started with Ownera</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3.5 bg-zinc-900 border border-white/10 text-zinc-300 font-semibold text-sm rounded-2xl hover:bg-zinc-800 transition"
          >
            Sign In to Existing Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 text-xs text-zinc-500 bg-[#0E0F12]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white">{APP_NAME}</span>
            <span>— {APP_TAGLINE}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/refund" className="hover:text-white transition">Refunds</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
