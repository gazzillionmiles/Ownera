import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server.js';

const APP_PREFIX = process.env.NEXT_PUBLIC_APP_COOKIE_PREFIX || 'ownera';
const REF_COOKIE_NAME = `${APP_PREFIX}_ref_code`;
const INVITE_COOKIE_NAME = `${APP_PREFIX}_invite_code`;

export function createRedirectResponse(url: URL | string, sourceResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}

export interface AuthRedirectParams {
  pathname: string;
  searchParams: URLSearchParams;
  hasCompletedOnboarding: boolean;
  profile?: { active_role?: string; primary_society_id?: string | null } | null;
  isPartnerPath?: boolean;
}

export function resolveAuthRedirectTarget({
  pathname,
  searchParams,
  hasCompletedOnboarding,
  profile,
  isPartnerPath = pathname.startsWith('/partner'),
}: AuthRedirectParams): string | null {
  const nextParam = searchParams.get('next');
  const isSafeNext = Boolean(
    nextParam &&
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//') &&
    !nextParam.includes('\\')
  );

  if (!hasCompletedOnboarding) {
    if (pathname === '/login' || pathname === '/signup' || pathname === '/public') {
      if (isSafeNext && nextParam!.startsWith('/join/')) {
        return nextParam!;
      }
      return '/onboarding';
    }
  } else {
    if (pathname === '/onboarding' || pathname === '/login' || pathname === '/signup' || pathname === '/public') {
      const isTargetableNext = isSafeNext && (nextParam!.startsWith('/join/') || nextParam!.startsWith('/s/'));
      if (pathname !== '/onboarding' && isTargetableNext) {
        return nextParam!;
      }
      return (profile?.active_role === 'provider' || isPartnerPath) ? '/partner' : '/home';
    }
  }

  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Fetch current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;
  const refCode = searchParams.get('ref')?.trim();

  // Distinguish society invite codes from Supabase auth exchange codes (which are 32+ hex/base64 strings on auth routes)
  const isAuthRoute = pathname.startsWith('/auth') || pathname === '/callback' || pathname === '/login';
  const rawCode = (
    searchParams.get('invite_code') ||
    searchParams.get('inviteCode') ||
    (!isAuthRoute ? searchParams.get('code') : null)
  )?.trim();

  const isAuthToken = Boolean(rawCode && (rawCode.length > 25 || /^[0-9a-f]{32,}$/i.test(rawCode)));
  const inviteCodeParam = isAuthToken ? null : rawCode;

  if (refCode) {
    supabaseResponse.cookies.set(REF_COOKIE_NAME, refCode.toUpperCase(), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
  }

  if (inviteCodeParam) {
    supabaseResponse.cookies.set(INVITE_COOKIE_NAME, inviteCodeParam.toUpperCase(), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
  }

  // Allowed unauthenticated paths
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/reset-password',
    '/forgot-password',
    '/auth/callback',
    '/callback',
    '/public',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/refund',
    '/pricing',
    '/share',
    '/c',
    '/join',
    '/partner/register',
    '/vendor-quote',
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(route + '/')
  );

  // Static files bypassing auth middleware
  const isStatic =
    pathname.startsWith('/_next') ||
    pathname.includes('.');

  // API route protection & Consent locking
  const isApiRoute = pathname.startsWith('/api');
  const publicApiPrefixes = [
    '/api/auth/',
    '/api/payment/webhook',
    '/api/consent/',
    '/api/account/restore',
    '/api/credit-packs',
    '/api/services',
    '/api/demo/seed',
    '/api/locations',
    '/api/societies/invite-link/validate',
    '/api/vendor-quote/',
  ];
  const isPublicApi = publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isApiRoute && !isPublicApi) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentTermsVersion = process.env.TERMS_CONSENT_VERSION || '2026-v1';
    const { data: consentEvent } = await supabase
      .from('consent_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', 'terms_accepted')
      .eq('consent_version', currentTermsVersion)
      .limit(1)
      .maybeSingle();

    if (!consentEvent) {
      return NextResponse.json(
        {
          error: 'TERMS_CONSENT_REQUIRED',
          message: 'You must accept the Terms & Conditions and Privacy Policy to continue.',
        },
        { status: 403 }
      );
    }
  }

  // Redirect unauthenticated users to /login
  if (!user && !isPublicRoute && !isStatic && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (refCode) {
      url.searchParams.set('ref', refCode.toUpperCase());
    }
    const redirectResponse = createRedirectResponse(url, supabaseResponse);
    if (refCode) {
      redirectResponse.cookies.set(REF_COOKIE_NAME, refCode.toUpperCase(), {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      });
    }
    return redirectResponse;
  }

  // Handle pending_deletion account state and onboarding enforcement for authenticated users
  if (user && !isStatic && !isApiRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('deletion_status, primary_society_id, active_role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.deletion_status === 'pending_deletion' && pathname !== '/account-deleted') {
      const url = request.nextUrl.clone();
      url.pathname = '/account-deleted';
      return createRedirectResponse(url, supabaseResponse);
    }

    if (profile?.deletion_status !== 'pending_deletion' && pathname === '/account-deleted') {
      const url = request.nextUrl.clone();
      url.pathname = profile?.active_role === 'provider' ? '/partner' : profile?.primary_society_id ? '/home' : '/onboarding';
      return createRedirectResponse(url, supabaseResponse);
    }

    // Determine onboarding completion status (has primary society, active society membership, or provider profile)
    let hasCompletedOnboarding = !!profile?.primary_society_id || profile?.active_role === 'provider';
    if (!hasCompletedOnboarding) {
      const { data: member } = await supabase
        .from('society_members')
        .select('society_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (member?.society_id) {
        hasCompletedOnboarding = true;
      } else {
        const { data: providerRec } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (providerRec?.id) {
          hasCompletedOnboarding = true;
        }
      }
    }

    const isPartnerPath = pathname.startsWith('/partner');

    // Block non-onboarded users from accessing protected pages until onboarding is complete
    if (!hasCompletedOnboarding) {
      // Partner flow is completely separate and independent from residential society onboarding
      if (isPartnerPath) {
        return supabaseResponse;
      }

      if (pathname !== '/onboarding' && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        return createRedirectResponse(url, supabaseResponse);
      }
      if (pathname === '/login' || pathname === '/signup' || pathname === '/public') {
        const target = resolveAuthRedirectTarget({
          pathname,
          searchParams,
          hasCompletedOnboarding,
          profile,
          isPartnerPath,
        });
        if (target) {
          const targetUrl = new URL(target, request.nextUrl.origin);
          return createRedirectResponse(targetUrl, supabaseResponse);
        }
      }
    } else {
      // Completed onboarding users attempting to visit /onboarding or auth entry pages
      if (pathname === '/onboarding' || pathname === '/login' || pathname === '/signup' || pathname === '/public') {
        const target = resolveAuthRedirectTarget({
          pathname,
          searchParams,
          hasCompletedOnboarding,
          profile,
          isPartnerPath,
        });
        if (target) {
          const targetUrl = new URL(target, request.nextUrl.origin);
          return createRedirectResponse(targetUrl, supabaseResponse);
        }
      }
    }
  }

  return supabaseResponse;
}
