'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ShieldCheck, ChevronDown, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { APP_NAME } from '@/src/constants';

export const TermsConsentModal: React.FC = () => {
  const { user, hasTermsConsent, acceptTermsConsent } = useAuth();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Tolerance of 25px from bottom
    const isBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 25;
    if (isBottom) {
      setHasScrolledToBottom(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkScrollPosition();
    }, 200);
    return () => clearTimeout(timer);
  }, [checkScrollPosition]);

  if (!user || hasTermsConsent) {
    return null;
  }

  const handleScroll = () => {
    checkScrollPosition();
  };

  const handleAccept = async () => {
    if (!agreed) {
      toast.error('Please agree to the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    const { error } = await acceptTermsConsent();
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to record consent. Please try again.');
    } else {
      toast.success(`Terms accepted. Welcome to ${APP_NAME}!`);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[#141414] border border-white/10 shadow-2xl text-white overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-[#181818]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Terms of Service &amp; Privacy Policy</h2>
              <p className="text-xs text-[#A0A0A0] mt-0.5">
                Please review the terms below to continue using {APP_NAME}.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed text-[#CCCCCC] scroll-smooth overscroll-contain select-text"
          style={{ maxHeight: 'calc(90vh - 230px)' }}
        >
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Action Required: Please scroll through the legal terms below to enable the agreement checkbox.
            </span>
          </div>

          {/* Section 1: Terms of Service */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-[#2CB7A5]">
              Part 1: Terms of Service
            </h3>

            <div>
              <h4 className="font-semibold text-white mb-1">1. Acceptance of Terms</h4>
              <p>
                By accessing or using {APP_NAME} (&quot;the Service&quot;), you agree to be bound by these Terms.
                If you do not agree with any part of these terms, you must not access or use the Service.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">2. Eligibility</h4>
              <p>
                You must be at least 18 years of age to register for an account. By continuing, you confirm that you meet this requirement.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">3. Acceptable Use Policy</h4>
              <p className="mb-2">You agree not to use the Service for any unlawful or abusive purposes, including:</p>
              <ul className="list-disc pl-5 space-y-1 text-[#B0B0B0]">
                <li>Any illegal activities or violation of applicable regulations.</li>
                <li>Harassment, defamation, or infringing third-party intellectual property rights.</li>
                <li>Automated scraping or platform manipulation.</li>
                <li>[INSERT PRODUCT SPECIFIC ACCEPTABLE USE RESTRICTIONS]</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">4. Automated Outputs Disclaimer</h4>
              <p>
                [DESCRIBE YOUR AI / ASYNC PROCESSING: All automated suggestions, analyses, and generated outputs are provided on an &quot;AS IS&quot; basis for assistive purposes. You remain responsible for reviewing all outputs before use.]
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">5. Credits &amp; Payments</h4>
              <p>
                The platform utilizes a pay-as-you-go credit model. Purchased credits are consumable digital items applied to your balance and are non-refundable except as provided in the Refund Policy.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4" />

          {/* Section 2: Privacy Policy */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-[#2CB7A5]">
              Part 2: Privacy Practices
            </h3>

            <div>
              <h4 className="font-semibold text-white mb-1">1. Information Collection</h4>
              <p>
                We collect your account email address, authentication identifiers, credit transactions, and submitted inputs required to process your requested operations.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">2. Data Retention &amp; Deletion Rights</h4>
              <p>
                You maintain the right to delete your account and personal data at any time through account settings. Deletion requests are processed with a 30-day grace period.
              </p>
            </div>
          </div>

          <div className="pt-4 text-center text-[11px] text-[#2CB7A5] font-medium border-t border-dashed border-white/10">
            ✓ End of Terms &amp; Conditions and Privacy Policy
          </div>
        </div>

        {/* Footer & Consent Checkbox */}
        <div className="p-6 border-t border-white/10 bg-[#181818]/80 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {!hasScrolledToBottom ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                <ChevronDown className="w-4 h-4 animate-bounce" />
                <span>Scroll down the box above to enable checkbox</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[#2CB7A5] font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Terms reviewed</span>
              </div>
            )}
          </div>

          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
              !hasScrolledToBottom
                ? 'opacity-50 cursor-not-allowed border-white/10 bg-white/5'
                : 'cursor-pointer border-[#2CB7A5]/30 bg-[#2CB7A5]/5 hover:border-[#2CB7A5]'
            }`}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!hasScrolledToBottom || loading}
              className="mt-0.5 h-4 w-4 rounded border-[#2CB7A5] text-[#2CB7A5] focus:ring-[#2CB7A5] cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-xs text-white leading-relaxed select-none">
              I have read, understood, and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2CB7A5] underline hover:opacity-80">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2CB7A5] underline hover:opacity-80">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!agreed || loading || !hasScrolledToBottom}
            className="w-full py-3 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Recording Consent...</span>
              </>
            ) : (
              <span>Accept &amp; Continue</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
