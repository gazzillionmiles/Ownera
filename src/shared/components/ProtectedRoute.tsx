'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TermsConsentModal } from '@/src/shared/components/TermsConsentModal';
import { APP_NAME } from '@/src/constants';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, uiUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPartner = profile?.active_role === 'provider' || uiUser.activeRole === 'provider';
  const isPartnerPath = pathname.startsWith('/partner');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
        return;
      }

      // Partner routes and partner accounts do not participate in residential society onboarding
      if (isPartner || isPartnerPath) {
        if (pathname === '/onboarding') {
          router.replace('/partner');
        }
        return;
      }

      const hasCompletedOnboarding = !!(profile?.primary_society_id || uiUser.primarySocietyId);
      const isOnboardingPath = pathname === '/onboarding';

      if (!hasCompletedOnboarding && !isOnboardingPath) {
        router.replace('/onboarding');
      } else if (hasCompletedOnboarding && isOnboardingPath) {
        router.replace('/home');
      }
    }
  }, [user, profile, uiUser, loading, pathname, router, isPartner, isPartnerPath]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/70 text-slate-900">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black animate-pulse shadow-lg mb-3">
          O
        </div>
        <p className="text-xs text-slate-500 font-bold animate-pulse">Loading {APP_NAME}...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Prevent flashing onboarding content if user is a partner
  if (isPartner || isPartnerPath) {
    if (pathname === '/onboarding') {
      return null;
    }
  } else {
    const hasCompletedOnboarding = !!(profile?.primary_society_id || uiUser.primarySocietyId);
    const isOnboardingPath = pathname === '/onboarding';

    if (!hasCompletedOnboarding && !isOnboardingPath) {
      return null;
    }
  }

  return (
    <>
      <TermsConsentModal />
      {children}
    </>
  );
}
