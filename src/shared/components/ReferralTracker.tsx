'use client';

import { useEffect } from 'react';
import { trackReferralLinkUsed } from '@/src/shared/lib/analytics';

const APP_PREFIX = process.env.NEXT_PUBLIC_APP_COOKIE_PREFIX || 'saas';
const REF_COOKIE_NAME = `${APP_PREFIX}_ref_code`;

export const ReferralTracker: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref')?.trim();

      if (refCode) {
        const uppercaseCode = refCode.toUpperCase();
        trackReferralLinkUsed(uppercaseCode);
        window.localStorage.setItem(REF_COOKIE_NAME, uppercaseCode);

        const maxAge = 30 * 24 * 60 * 60; // 30 days
        document.cookie = `${REF_COOKIE_NAME}=${uppercaseCode}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }
    } catch (err) {
      console.error('[ReferralTracker] Error saving referral code:', err);
    }
  }, []);

  return null;
};
