import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import {
  createRedirectResponse,
  resolveAuthRedirectTarget,
} from '../lib/supabase/middleware.ts';
import {
  shouldResolveSocieties,
  evaluateProtectedRouteGuard,
} from '../lib/routing/guards.ts';

test('Regression FIX 1: Expired/refreshed session cookies are propagated on middleware redirect (Source call)', () => {
  const origin = 'http://localhost:3000';
  const targetUrl = new URL('/s/palm-meadows', origin);

  // 1. Simulate supabaseResponse holding refreshed session cookies from supabase.auth.getUser()
  const stagedResponse = NextResponse.next();
  stagedResponse.cookies.set('sb-access-token', 'refreshed-jwt-token-xyz', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600,
  });
  stagedResponse.cookies.set('sb-refresh-token', 'refreshed-refresh-token-abc', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 604800,
  });

  assert.equal(stagedResponse.cookies.getAll().length, 2, 'Staged response must have 2 refreshed session cookies');

  // 2. Verify bare NextResponse.redirect drops all cookies (reproducing the original bug)
  const bareRedirect = NextResponse.redirect(targetUrl);
  assert.equal(
    bareRedirect.cookies.getAll().length,
    0,
    'Bare NextResponse.redirect drops cookies staged on supabaseResponse'
  );

  // 3. Directly exercise exported createRedirectResponse from lib/supabase/middleware.ts
  const safeRedirect = createRedirectResponse(targetUrl, stagedResponse);
  const propagatedCookies = safeRedirect.cookies.getAll();

  assert.equal(propagatedCookies.length, 2, 'createRedirectResponse must propagate all staged session cookies');

  const accessTokenCookie = safeRedirect.cookies.get('sb-access-token');
  assert.ok(accessTokenCookie, 'Refreshed access token must exist on redirect response');
  assert.equal(accessTokenCookie.value, 'refreshed-jwt-token-xyz');
  assert.equal(accessTokenCookie.path, '/');
  assert.equal(accessTokenCookie.httpOnly, true);

  const refreshTokenCookie = safeRedirect.cookies.get('sb-refresh-token');
  assert.ok(refreshTokenCookie, 'Refreshed refresh token must exist on redirect response');
  assert.equal(refreshTokenCookie.value, 'refreshed-refresh-token-abc');
  assert.equal(refreshTokenCookie.path, '/');
  assert.equal(refreshTokenCookie.httpOnly, true);

  // Assert redirect destination
  assert.equal(safeRedirect.status, 307);
  assert.equal(safeRedirect.headers.get('location'), 'http://localhost:3000/s/palm-meadows');
});

test('Regression FIX 2: resolveAuthRedirectTarget scoping prevents unauthorized dashboard leak (Source call)', () => {
  // Directly exercise exported resolveAuthRedirectTarget from lib/supabase/middleware.ts

  // Case A: Onboarded user hits /login?next=/s/palm-meadows -> MUST redirect to /s/palm-meadows (not /home)
  const onboardedRedirect = resolveAuthRedirectTarget({
    pathname: '/login',
    searchParams: new URLSearchParams('next=/s/palm-meadows'),
    hasCompletedOnboarding: true,
    profile: { active_role: 'resident', primary_society_id: 'soc-123' },
  });
  assert.equal(
    onboardedRedirect,
    '/s/palm-meadows',
    'Onboarded user visiting /login with ?next=/s/[slug] must redirect to the society page'
  );

  // Case B: Incomplete onboarding user hits /login?next=/s/palm-meadows -> MUST redirect to /onboarding (Scope leak prevention!)
  const nonOnboardedSocietyRedirect = resolveAuthRedirectTarget({
    pathname: '/login',
    searchParams: new URLSearchParams('next=/s/palm-meadows'),
    hasCompletedOnboarding: false,
    profile: { active_role: 'resident', primary_society_id: null },
  });
  assert.equal(
    nonOnboardedSocietyRedirect,
    '/onboarding',
    'Non-onboarded user visiting /login with ?next=/s/[slug] must be locked to /onboarding, NEVER leaked into /s/[slug]'
  );

  // Case C: Incomplete onboarding user hits /login?next=/join/secret-invite-token -> MUST preserve /join/
  const nonOnboardedJoinRedirect = resolveAuthRedirectTarget({
    pathname: '/login',
    searchParams: new URLSearchParams('next=/join/secret-invite-token'),
    hasCompletedOnboarding: false,
    profile: { active_role: 'resident', primary_society_id: null },
  });
  assert.equal(
    nonOnboardedJoinRedirect,
    '/join/secret-invite-token',
    'Non-onboarded user visiting /login with ?next=/join/[token] must be allowed to access the invitation preview'
  );

  // Case D: Malicious open redirect attempt
  const openRedirect = resolveAuthRedirectTarget({
    pathname: '/login',
    searchParams: new URLSearchParams('next=//evil.com/phish'),
    hasCompletedOnboarding: true,
    profile: { active_role: 'resident', primary_society_id: 'soc-123' },
  });
  assert.equal(
    openRedirect,
    '/home',
    'Protocol-relative open redirect must be rejected and safely fallback to /home'
  );
});

test('Regression FIX 3: ProtectedRoute guard evaluation prevents premature /onboarding bounce when cache is null (Source call)', () => {
  // 1. Test shouldResolveSocieties on initial hard refresh of /settings (cold cache, auth finished)
  const needsResolution = shouldResolveSocieties({
    user: { id: 'usr-123' },
    profile: { primary_society_id: null, active_role: 'resident' },
    uiUser: { primarySocietyId: null, activeRole: 'resident' },
    authLoading: false,
    pathname: '/settings',
    hasCachedSocieties: false,
    hasUserSocieties: false,
  });

  assert.equal(
    needsResolution,
    true,
    'shouldResolveSocieties must return true on cold cache without primary_society_id to hold loading state'
  );

  // 2. When resolved with active societies: evaluateProtectedRouteGuard stays on /settings
  const stateResolvedWithSocieties = evaluateProtectedRouteGuard({
    user: { id: 'usr-123' },
    profile: { primary_society_id: null, active_role: 'resident' },
    uiUser: { primarySocietyId: null, activeRole: 'resident' },
    societies: [{ id: 'soc-1', slug: 'palm-meadows' }],
    pathname: '/settings',
  });

  assert.equal(
    stateResolvedWithSocieties.hasCompletedOnboarding,
    true,
    'User with active societies is recognized as onboarded'
  );
  assert.equal(
    stateResolvedWithSocieties.targetRedirect,
    null,
    'User with active societies on /settings must stay on /settings (0 redirects)'
  );

  // 3. When onboarded user visits /onboarding: evaluateProtectedRouteGuard routes to /s/[slug]
  const stateOnboardedOnOnboarding = evaluateProtectedRouteGuard({
    user: { id: 'usr-123' },
    profile: { primary_society_id: null, active_role: 'resident' },
    uiUser: { primarySocietyId: null, activeRole: 'resident' },
    societies: [{ id: 'soc-1', slug: 'palm-meadows' }],
    pathname: '/onboarding',
  });

  assert.equal(
    stateOnboardedOnOnboarding.targetRedirect,
    '/s/palm-meadows',
    'Onboarded user on /onboarding must redirect directly to /s/[slug], agreeing with onboarding/page.tsx (NOT /home)'
  );

  // 4. Truly Non-onboarded User (0 societies): evaluateProtectedRouteGuard redirects to /onboarding
  const stateGenuinelyNonOnboarded = evaluateProtectedRouteGuard({
    user: { id: 'usr-456' },
    profile: { primary_society_id: null, active_role: 'resident' },
    uiUser: { primarySocietyId: null, activeRole: 'resident' },
    societies: [],
    pathname: '/settings',
  });

  assert.equal(
    stateGenuinelyNonOnboarded.hasCompletedOnboarding,
    false,
    'User with 0 societies is recognized as non-onboarded'
  );
  assert.equal(
    stateGenuinelyNonOnboarded.targetRedirect,
    '/onboarding',
    'Genuinely non-onboarded user on /settings must be redirected to /onboarding only after resolution completes'
  );
});
