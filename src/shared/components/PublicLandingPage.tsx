'use client';

import React from 'react';
import Link from 'next/link';
import {
  Building2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Wind,
  Bug,
  Droplet,
  Check,
  Zap,
  Car,
  Paintbrush,
  Hammer,
  Sun,
  Moon,
  ShieldCheck,
  Clock,
  Users,
} from 'lucide-react';
import { useTheme } from '@/src/shared/components/ui/theme-provider';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';

const STANDARDIZED_SERVICES = [
  {
    name: 'AC Servicing & Jet Cleaning',
    category: 'AC Maintenance & Repair',
    icon: Wind,
    desc: 'High-pressure filter wash, outdoor unit deep flush & gas pressure diagnostics.',
    badge: 'Standardized Scope',
  },
  {
    name: 'Pest & Cockroach Control',
    category: 'Cleaning & Pest Control',
    icon: Bug,
    desc: 'Odorless kitchen gel baiting, bathroom drain spray with 30-day retreat protection.',
    badge: 'Verified Checklist',
  },
  {
    name: 'Home Deep Cleaning',
    category: 'Cleaning & Pest Control',
    icon: Sparkles,
    desc: 'Mechanized single-disc floor scrubbing, kitchen degreasing & bathroom descaling.',
    badge: 'Bulk Camp Ready',
  },
  {
    name: 'RO Purifier Health Check',
    category: 'Water Purifier & Plumbing',
    icon: Droplet,
    desc: 'Pre-filter wash, booster pump test, TDS calibration & internal sanitization.',
    badge: 'Standardized Scope',
  },
  {
    name: 'Electrical & Geyser Service',
    category: 'Electrical & Appliances',
    icon: Zap,
    desc: 'Water heater geyser descaling, thermostat test, MCB diagnostics, and repairs.',
    badge: 'Verified Checklist',
  },
  {
    name: 'Car Foam Wash & Polish',
    category: 'Car & Bike Care',
    icon: Car,
    desc: 'Doorstep basement high-pressure foam wash, interior vacuuming & UV tyre dressing.',
    badge: 'Bulk Camp Ready',
  },
  {
    name: 'Balcony Waterproofing',
    category: 'Painting & Waterproofing',
    icon: Paintbrush,
    desc: 'Polymer tile joint re-grouting, exterior waterproof elastomeric coat & sealing.',
    badge: 'Standardized Scope',
  },
  {
    name: 'Home Carpentry & Repairs',
    category: 'Home Repair & Carpentry',
    icon: Hammer,
    desc: 'Door alignments, lock replacement, wall frame drilling, and precision carpentry.',
    badge: 'Verified Checklist',
  },
  {
    name: 'Curtain & Carpet Deep Clean',
    category: 'Home Deep-Care',
    icon: Sparkles,
    desc: 'High-suction HEPA vacuum dust extraction & fabric enzyme steam sanitization.',
    badge: 'Bulk Camp Ready',
  },
  {
    name: 'Water Tank Mechanical Clean',
    category: 'Society & Common Areas',
    icon: Building2,
    desc: 'High-pressure rotary jet de-sludging, vacuum extraction & anti-bacterial UV wash.',
    badge: 'Standardized Scope',
  },
  {
    name: 'Pre-Summer AC Drive',
    category: 'Seasonal Services',
    icon: Sun,
    desc: 'Mass society early-summer AC inspection, coil descaling & filter flushing.',
    badge: 'Bulk Camp Ready',
  },
  {
    name: 'Balcony Mosquito Netting',
    category: 'Renovation & Home Upgrades',
    icon: Layers,
    desc: 'Custom-fitted stainless steel anti-rust mesh netting for windows & balconies.',
    badge: 'Verified Checklist',
  },
];

export default function PublicLandingPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-[#0b0f17] text-slate-900 dark:text-[#f8fafc] font-sans antialiased">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-md shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight leading-none text-slate-900 dark:text-white">{APP_NAME}</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">{APP_TAGLINE}</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition">How It Works</a>
            <a href="#services" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Services</a>
            <a href="#roles" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Who It&apos;s For</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              aria-label="Toggle theme"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              )}
            </button>
            <Link
              href="/login"
              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
            >
              Join Society
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-16 pb-14 sm:pb-20 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold mb-5 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Collective Buying For Residential Societies</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-5">
            Your society has <span className="text-blue-600">buying power.</span> <br className="hidden sm:inline" />Use it together.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
            Ownera aggregates resident demand across apartment homes to unlock volume discounts, while verified commercial service providers get dedicated full-day routes in one single building.
          </p>

          {/* Get Started CTA */}
          <div className="max-w-md mx-auto mb-10 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link
                href="/signup"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Create Your Society</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/login"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center"
              >
                Sign In
              </Link>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Been invited by your society secretary? Open the link they sent you to join directly.
            </p>
          </div>

          {/* 4 Trust & Value Pillars (Non-Monetary) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-200/80">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                <Users className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-sm font-extrabold text-slate-900">Collective Demand</div>
              <div className="text-xs text-slate-500 font-medium">Aggregated volume unlocks better partner bids</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-sm font-extrabold text-slate-900">Verified Providers</div>
              <div className="text-xs text-slate-500 font-medium">Commercial partners vetted by committees</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-sm font-extrabold text-slate-900">1 Central Service Day</div>
              <div className="text-xs text-slate-500 font-medium">Coordinated weekend delivery with dedicated teams</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="text-sm font-extrabold text-slate-900">Standardized Scope</div>
              <div className="text-xs text-slate-500 font-medium">Transparent checklists with zero hidden surprises</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-16 border-t border-slate-200/80">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold mb-2 uppercase tracking-wider">
            How Ownera Works
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Turn Many Homes Into One Coordinated Drive
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mt-1 font-medium">
            Ownera brings together community demand first, then enables verified service partners to submit transparent bids.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-black flex items-center justify-center font-mono text-base">
              01
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Express Interest</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Residents in the same society express interest in a seasonal service drive (such as AC servicing before summer). No full payment required upfront.
            </p>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 font-medium">
              Quorum milestone gathered from neighbors
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-black flex items-center justify-center font-mono text-base">
              02
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Providers Compete</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Top-rated commercial service providers bid on the concentrated volume. Knowing they serve multiple flats in 1 building, they offer volume efficiencies.
            </p>
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-700 font-semibold">
              Verified partner selected by the society committee
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-black flex items-center justify-center font-mono text-base">
              03
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Fulfillment on Service Day</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Residents select convenient arrival windows. Assigned technician crews execute the standardized service checklist, and residents rate performance.
            </p>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-800 font-semibold">
              Service completed &bull; Transparent resident ratings
            </div>
          </div>
        </div>
      </section>

      {/* Standardized Services Catalog Grid */}
      <section id="services" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 border-t border-slate-200/80">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold mb-2 uppercase tracking-wider">
            Standardized Catalog
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Essential Community Services Ready for Bulk Camps
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mt-1 font-medium">
            Clear inclusions, exclusions, and verified scopes. No surprise add-ons or vague contractor quotes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STANDARDIZED_SERVICES.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {s.category}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-snug">{s.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed font-normal">{s.desc}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{s.badge}</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Bulk Camp</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Three Sides Value Proposition */}
      <section id="roles" className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-16 border-t border-slate-200/80">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold mb-2 uppercase tracking-wider">
            Who It&apos;s For
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Built For Everyone in the Community
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mt-1 font-medium">
            A unified platform designed for apartment residents, society leadership, and trusted service providers.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600">For Residents</div>
              <h3 className="text-lg font-extrabold text-slate-900">Better Deals Without the Hassle</h3>
              <ul className="space-y-2 text-xs text-slate-600 font-medium">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Guaranteed volume discounts through collective community quorum</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Verified commercial service partners approved by your society committee</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Convenient 90-minute arrival slot booking on dedicated service days</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Standardized checklist execution with transparent resident ratings</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-600">For Society Organizers</div>
              <h3 className="text-lg font-extrabold text-slate-900">Zero Vendor Coordination Chaos</h3>
              <ul className="space-y-2 text-xs text-slate-600 font-medium">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>No messy spreadsheets, repetitive phone calls, or unorganized chat polls</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Invite trusted providers and compare structured bids side-by-side</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Single secretary approval workflow for official society drives</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Real-time dashboard of confirmed bookings, technician arrivals, and issues</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">For Service Providers</div>
              <h3 className="text-lg font-extrabold text-slate-900">Concentrated Multi-Unit Volume</h3>
              <ul className="space-y-2 text-xs text-slate-600 font-medium">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>30+ confirmed jobs in 1 location on a single service day</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Zero travel time or commute waste between distant customer apartments</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Predictable technician routing with apartment-by-apartment checklists</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Direct society committee relationships with recurring seasonal drive opportunities</span>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <Link
                href="/partner/register"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Register as Service Partner</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center border-t border-slate-200/80">
        <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Ready to bring collective buying to your society?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto font-medium">
            Join your society with an invite code or propose a collective service camp for your apartment community.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login?mode=signup"
              className="w-full sm:w-auto min-h-[44px] px-8 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>Get Started with Ownera</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition flex items-center justify-center"
            >
              Sign In to Existing Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-10 text-xs text-slate-500 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-slate-900">{APP_NAME}</span>
            <span className="text-slate-400">&mdash; {APP_TAGLINE}</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-slate-500 font-medium">
            <Link href="/privacy" className="hover:text-blue-600 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-blue-600 transition">Terms</Link>
            <Link href="/refund" className="hover:text-blue-600 transition">Refunds</Link>
            <Link href="/contact" className="hover:text-blue-600 transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
