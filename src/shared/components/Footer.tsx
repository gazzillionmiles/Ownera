'use client';

import React from 'react';
import Link from 'next/link';
import { ThemeMode } from '@/src/types/saas';
import { Shield, Sparkles, Layers } from 'lucide-react';
import { APP_NAME, SUPPORT_EMAIL } from '@/src/constants';

interface FooterProps {
  theme?: ThemeMode;
}

export function Footer({ theme = 'dark' }: FooterProps) {
  const isDark = theme === 'dark';
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`w-full border-t transition-colors duration-200 mt-auto ${
        isDark
          ? 'bg-[#09090b] border-zinc-800/80 text-zinc-300'
          : 'bg-[#fafafa] border-zinc-200 text-zinc-700'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-8">
          {/* Brand Section */}
          <div className="md:col-span-6 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold shadow-sm shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-bold text-xl tracking-tight text-foreground">
                {APP_NAME}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md">
              Ownera is a collective-buying platform for residential communities. Aggregating neighborhood demand so multiple homes get better bulk prices while service providers get high-volume jobs in one location.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] font-medium border border-[#2CB7A5]/20">
                <Sparkles className="w-3 h-3" /> Standardized Inclusions
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800/50 text-zinc-400 border border-zinc-700/40">
                <Shield className="w-3 h-3" /> Society-Approved Partners
              </span>
            </div>
          </div>

          {/* Product Section */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Platform
            </h3>
            <nav aria-label="Company Links">
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <Link href="/about" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Legal Section */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Legal
            </h3>
            <nav aria-label="Legal Links">
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <Link href="/privacy" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/refund" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link href="/affiliate-terms" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                    Affiliate Terms
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-6 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>© {currentYear} {APP_NAME}. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            <span>Collective Buying</span>
            <span>•</span>
            <span>Standardized Home Services</span>
            <span>•</span>
            <span>Guaranteed Bulk Pricing</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
