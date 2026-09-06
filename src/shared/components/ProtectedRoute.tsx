'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TermsConsentModal } from '@/src/shared/components/TermsConsentModal';
import { Layers } from 'lucide-react';
import { APP_NAME } from '@/src/constants';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, uiUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
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
  }, [user, profile, uiUser, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414] text-white">
        <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold animate-pulse shadow-lg mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <p className="text-xs text-zinc-400 font-medium animate-pulse">Loading {APP_NAME}...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasCompletedOnboarding = !!(profile?.primary_society_id || uiUser.primarySocietyId);
  const isOnboardingPath = pathname === '/onboarding';

  if (!hasCompletedOnboarding && !isOnboardingPath) {
    return null;
  }

  return (
    <>
      <TermsConsentModal />
      {children}
    </>
  );
}
