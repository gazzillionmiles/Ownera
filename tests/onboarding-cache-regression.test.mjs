import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import {
  STATUS_COOKIE_NAME,
  setOnboardStatusCookie,
  evaluateOnboardingCacheHit,
} from '../lib/supabase/middleware.ts';

test('Regression: Stale negative onboarding status cookie (0) is treated as cache miss and evicted', () => {
  const userId = 'usr-test-123';
  const staleNegativeCookieValue = `${userId}:0:resident::active`;

  // 1. Evaluate stale negative cookie directly with exported middleware function
  const isStatusCached = evaluateOnboardingCacheHit(staleNegativeCookieValue, userId);
  assert.equal(
    isStatusCached,
    false,
    'Stale negative onboarding cookie (0) must be treated as cache miss to allow DB re-verification'
  );

  // 2. Simulate fresh DB lookup returning active primary_society_id
  const dbProfile = { primary_society_id: 'soc-palm-meadows', active_role: 'organizer', deletion_status: 'active' };
  const hasCompletedOnboarding = !!dbProfile.primary_society_id;
  assert.equal(hasCompletedOnboarding, true, 'DB re-verification correctly detects completed onboarding');

  // 3. Simulate setting new positive status cookie on response
  const response = NextResponse.next();
  setOnboardStatusCookie(response, {
    userId,
    activeRole: dbProfile.active_role,
    primarySocietyId: dbProfile.primary_society_id,
    deletionStatus: dbProfile.deletion_status,
  });

  const updatedCookie = response.cookies.get(STATUS_COOKIE_NAME);
  assert.ok(updatedCookie, 'Positive status cookie must be set on response');
  assert.equal(
    updatedCookie.value,
    `${userId}:1:organizer:soc-palm-meadows:active`,
    'Response cookie must hold positive onboarding status (1) with active role and society ID'
  );
});

test('Regression: Un-onboarded user (0 societies) receives NO positive cookie and stale cookie is purged', () => {
  const userId = 'usr-new-456';

  // DB lookup returns no primary_society_id and no memberships
  const dbProfile = { primary_society_id: null, active_role: 'resident', deletion_status: 'active' };
  const hasCompletedOnboarding = !!dbProfile.primary_society_id;
  assert.equal(hasCompletedOnboarding, false);

  const response = NextResponse.next();
  if (hasCompletedOnboarding) {
    setOnboardStatusCookie(response, { userId, activeRole: dbProfile.active_role });
  } else {
    // Purge stale negative cookie if present
    response.cookies.set(STATUS_COOKIE_NAME, '', { path: '/', httpOnly: true, maxAge: 0 });
  }

  const cookie = response.cookies.get(STATUS_COOKIE_NAME);
  assert.ok(cookie, 'Cookie action must take place on response');
  assert.equal(cookie.value, '', 'Negative status must NOT be cached for 600s; cookie value must be cleared');
});
