'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ArrowRight,
  Wind,
  Bug,
  Sparkles,
  Droplet,
  Zap,
  Car,
  Paintbrush,
  Hammer,
  Sun,
  Moon,
  Layers,
  Users,
  Briefcase,
  Wrench,
  Link2,
} from 'lucide-react';
import { useTheme } from '@/src/shared/components/ui/theme-provider';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';

const SERVICES = [
  { name: 'AC Servicing', icon: Wind, desc: 'Filter wash, gas check, coil flush' },
  { name: 'Pest Control', icon: Bug, desc: 'Kitchen & bathroom, 30-day cover' },
  { name: 'Deep Cleaning', icon: Sparkles, desc: 'Floors, kitchen, bathrooms' },
  { name: 'RO Purifier Check', icon: Droplet, desc: 'Filter, pump, TDS calibration' },
  { name: 'Electrical & Geyser', icon: Zap, desc: 'Descaling, thermostat, MCB' },
  { name: 'Car Foam Wash', icon: Car, desc: 'Doorstep, interior vacuum' },
  { name: 'Waterproofing', icon: Paintbrush, desc: 'Balcony joints & sealing' },
  { name: 'Carpentry', icon: Hammer, desc: 'Doors, locks, repairs' },
];

const AUDIENCES = [
  {
    key: 'residents',
    label: 'Residents',
    icon: Users,
    heading: 'Better rates, without chasing vendors',
    points: [
      'Join a service drive your neighbors already started',
      'One provider does the whole building on one day',
      'Pick a 90-minute arrival slot, rate the job after',
    ],
    cta: { label: 'Find your society', href: '/login?mode=signup' },
  },
  {
    key: 'organizers',
    label: 'Society organizers',
    icon: Briefcase,
    heading: 'One approval, not fifty phone calls',
    points: [
      'Replace the WhatsApp poll and vendor spreadsheet',
      'Compare bids side by side before you approve one',
      'See every booking and technician arrival in one place',
    ],
    cta: { label: 'Set up your society', href: '/login?mode=signup' },
  },
  {
    key: 'providers',
    label: 'Service providers',
    icon: Wrench,
    heading: 'One building, one route, no wasted trips',
    points: [
      'Bid on concentrated demand instead of scattered jobs',
      'A full day of confirmed work in a single location',
      'Direct relationship with the society committee',
    ],
    cta: { label: 'Register as a partner', href: '/partner/register' },
  },
];

export default function PublicLandingPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [activeAudience, setActiveAudience] = useState(AUDIENCES[0].key);
  const audience = AUDIENCES.find((a) => a.key === activeAudience) ?? AUDIENCES[0];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0b0f17] text-slate-900 dark:text-[#f8fafc] font-sans antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-white">{APP_NAME}</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 transition"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — the task comes before the pitch */}
      <section className="max-w-5xl mx-auto px-5 pt-12 sm:pt-16 pb-10">
        <div className="max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-3">
            Your society, buying as one.
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-7">
            {APP_TAGLINE} Neighbors pool demand for AC servicing, cleaning, and repairs — a single
            provider does the whole building in one visit, at a bulk rate.
          </p>
        </div>

        {/* Primary action reflects how people actually arrive: invited, or starting fresh */}
        <div className="max-w-md space-y-3">
          <div className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30">
            <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Invited by your society secretary?</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Open the link they sent you to join directly.</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            or
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <Link
            href="/signup"
            className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition shadow-sm"
          >
            Start a society drive
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-slate-400 text-center">You&apos;ll be set up as the society&apos;s first organizer.</p>
        </div>

        {/* Stat row — inline, not boxed */}
        <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-500">Bulk pricing</span>
            <span className="text-slate-500 dark:text-slate-400"> from pooled demand</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">1 service day</span>
            <span className="text-slate-500 dark:text-slate-400"> per building, not per flat</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">Committee-approved</span>
            <span className="text-slate-500 dark:text-slate-400"> providers only</span>
          </div>
        </div>
      </section>

      {/* How it works — one horizontal timeline */}
      <section className="max-w-5xl mx-auto px-5 py-14 border-t border-slate-100 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-8">How a drive comes together</h2>

        <div className="grid sm:grid-cols-3 gap-8 sm:gap-6 relative">
          <div className="hidden sm:block absolute top-[9px] left-[8%] right-[8%] h-px bg-slate-200 dark:bg-slate-800" />

          <div className="relative">
            <div className="w-[18px] h-[18px] rounded-full bg-blue-600 border-4 border-white dark:border-[#0b0f17] relative z-10 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Neighbors express interest</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No payment upfront. Once enough flats opt in, the drive is confirmed.
            </p>
          </div>

          <div className="relative">
            <div className="w-[18px] h-[18px] rounded-full bg-blue-600 border-4 border-white dark:border-[#0b0f17] relative z-10 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Providers bid on the volume</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Service partners compete for the whole building. The committee picks one.
            </p>
          </div>

          <div className="relative">
            <div className="w-[18px] h-[18px] rounded-full bg-emerald-600 border-4 border-white dark:border-[#0b0f17] relative z-10 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">One day, every flat</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Pick an arrival slot, the crew works through the building, you rate the job.
            </p>
          </div>
        </div>
      </section>

      {/* Services — horizontal strip, not a 12-tile grid */}
      <section className="py-14 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-5 mb-6 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ready for bulk drives</h2>
          <span className="text-xs text-slate-400">Scroll for more</span>
        </div>
        <div className="max-w-5xl mx-auto pl-5">
          <div className="flex gap-3 overflow-x-auto pb-2 pr-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.name}
                  className="shrink-0 w-44 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60"
                >
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{s.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Audiences — one switcher instead of three stacked cards */}
      <section className="max-w-5xl mx-auto px-5 py-14 border-t border-slate-100 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Built for everyone on the drive</h2>

        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 w-fit mb-6">
          {AUDIENCES.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setActiveAudience(a.key)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeAudience === a.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-8 items-start rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">{audience.heading}</h3>
            <ul className="space-y-2.5">
              {audience.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600 mt-2 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={audience.cta.href}
            className="w-full sm:w-auto shrink-0 min-h-11 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {audience.cta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer — carries the only remaining sign-in CTA, no redundant banner */}
      <footer className="border-t border-slate-100 dark:border-slate-800 py-10">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{APP_NAME}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition">Terms</Link>
            <Link href="/refund" className="hover:text-slate-900 dark:hover:text-white transition">Refunds</Link>
            <Link href="/contact" className="hover:text-slate-900 dark:hover:text-white transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
