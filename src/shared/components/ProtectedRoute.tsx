'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TermsConsentModal } from '@/src/shared/components/TermsConsentModal';
import { APP_NAME } from '@/src/constants';
import { getSocietiesCache, fetchUserSocieties } from '@/src/shared/lib/api';
import { Society } from '@/src/types/ownera';
import {
  shouldResolveSocieties,
  evaluateProtectedRouteGuard,
  type ProtectedRouteGuardParams,
  type ProtectedRouteGuardResult,
} from '@/lib/routing/guards';

export { shouldResolveSocieties, evaluateProtectedRouteGuard };
export type { ProtectedRouteGuardParams, ProtectedRouteGuardResult };

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, uiUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPartner = profile?.active_role === 'provider' || uiUser.activeRole === 'provider';
  const isPartnerPath = pathname.startsWith('/partner');

  const [resolvingSocieties, setResolvingSocieties] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const cached = getSocietiesCache();
    return shouldResolveSocieties({
      user,
      profile,
      uiUser,
      authLoading: loading,
      pathname,
      hasCachedSocieties: cached !== null,
      hasUserSocieties: false,
    });
  });

  const [userSocieties, setUserSocieties] = useState<Society[] | null>(() => getSocietiesCache());

  useEffect(() => {
    let isMounted = true;

    const cached = getSocietiesCache();
    const needsResolution = shouldResolveSocieties({
      user,
      profile,
      uiUser,
      authLoading: loading,
      pathname,
      hasCachedSocieties: cached !== null,
      hasUserSocieties: userSocieties !== null,
    });

    if (!needsResolution) {
      if (cached && !userSocieties) {
        setUserSocieties(cached);
      }
      setResolvingSocieties(false);
      return;
    }

    setResolvingSocieties(true);
    fetchUserSocieties()
      .then((data) => {
        if (isMounted) {
          setUserSocieties(data.societies || []);
          setResolvingSocieties(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUserSocieties([]);
          setResolvingSocieties(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loading, user, isPartner, isPartnerPath, profile?.primary_society_id, uiUser.primarySocietyId, pathname, userSocieties]);

  const isResolving = loading || resolvingSocieties;

  useEffect(() => {
    if (!isResolving) {
      const cachedSocieties = userSocieties || getSocietiesCache();
      const { targetRedirect } = evaluateProtectedRouteGuard({
        user,
        profile,
        uiUser,
        societies: cachedSocieties,
        pathname,
      });

      if (targetRedirect) {
        router.replace(targetRedirect);
      }
    }
  }, [user, profile, uiUser, isResolving, pathname, router, userSocieties]);

  if (isResolving) {
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

  const cachedSocieties = userSocieties || getSocietiesCache();
  const { hasCompletedOnboarding } = evaluateProtectedRouteGuard({
    user,
    profile,
    uiUser,
    societies: cachedSocieties,
    pathname,
  });

  const isOnboardingPath = pathname === '/onboarding';
  const isHomePath = pathname === '/home';
  const isSocietyPath = pathname.startsWith('/s/');

  if (isPartner || isPartnerPath) {
    if (pathname === '/onboarding') {
      return null;
    }
  } else {
    if (!hasCompletedOnboarding && !isOnboardingPath && !isHomePath && !isSocietyPath) {
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
