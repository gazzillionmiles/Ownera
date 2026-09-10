export interface SocietyItem {
  id: string;
  slug: string;
}

export interface ProtectedRouteGuardParams {
  user: unknown;
  profile?: { active_role?: string; primary_society_id?: string | null } | null;
  uiUser?: { primarySocietyId?: string | null; activeRole?: string } | null;
  societies?: SocietyItem[] | null;
  pathname: string;
}

export interface ProtectedRouteGuardResult {
  hasCompletedOnboarding: boolean;
  targetRedirect: string | null;
}

export function shouldResolveSocieties({
  user,
  profile,
  uiUser,
  authLoading,
  pathname,
  hasCachedSocieties,
  hasUserSocieties,
}: {
  user: unknown;
  profile?: { active_role?: string; primary_society_id?: string | null } | null;
  uiUser?: { primarySocietyId?: string | null; activeRole?: string } | null;
  authLoading: boolean;
  pathname?: string;
  hasCachedSocieties: boolean;
  hasUserSocieties: boolean;
}): boolean {
  const isPartner = profile?.active_role === 'provider' || uiUser?.activeRole === 'provider';
  const isPartnerPath = pathname ? pathname.startsWith('/partner') : false;

  if (authLoading || !user || isPartner || isPartnerPath) return false;
  if (profile?.primary_society_id || uiUser?.primarySocietyId) return false;
  return !hasCachedSocieties && !hasUserSocieties;
}

export function evaluateProtectedRouteGuard({
  user,
  profile,
  uiUser,
  societies,
  pathname,
}: ProtectedRouteGuardParams): ProtectedRouteGuardResult {
  if (!user) {
    return { hasCompletedOnboarding: false, targetRedirect: '/login' };
  }

  const isPartner = profile?.active_role === 'provider' || uiUser?.activeRole === 'provider';
  const isPartnerPath = pathname.startsWith('/partner');

  if (isPartner || isPartnerPath) {
    if (pathname === '/onboarding') {
      return { hasCompletedOnboarding: true, targetRedirect: '/partner' };
    }
    return { hasCompletedOnboarding: true, targetRedirect: null };
  }

  const hasCompletedOnboarding = Boolean(
    profile?.primary_society_id ||
    uiUser?.primarySocietyId ||
    (societies && societies.length > 0)
  );

  const isOnboardingPath = pathname === '/onboarding';
  const isHomePath = pathname === '/home';
  const isSocietyPath = pathname.startsWith('/s/');

  if (isHomePath || isSocietyPath) {
    return { hasCompletedOnboarding, targetRedirect: null };
  }

  if (!hasCompletedOnboarding && !isOnboardingPath) {
    return { hasCompletedOnboarding: false, targetRedirect: '/onboarding' };
  }

  if (hasCompletedOnboarding && isOnboardingPath) {
    const primaryId = profile?.primary_society_id || uiUser?.primarySocietyId;
    const targetSoc = societies?.find((s) => s.id === primaryId) || societies?.[0];
    const targetRedirect = targetSoc?.slug ? `/s/${targetSoc.slug}` : '/home';
    return { hasCompletedOnboarding: true, targetRedirect };
  }

  return { hasCompletedOnboarding, targetRedirect: null };
}
