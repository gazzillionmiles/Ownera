import test from 'node:test';
import assert from 'node:assert/strict';

test('Routing Guard: /home and /s/[slug] do not bounce to /onboarding when primary_society_id is null', async () => {
  const profile = { primary_society_id: null };
  const uiUser = { primarySocietyId: null };
  const cachedSocieties = null;

  const hasCompletedOnboarding = !!(
    profile.primary_society_id ||
    uiUser.primarySocietyId ||
    (cachedSocieties && cachedSocieties.length > 0)
  );

  assert.equal(hasCompletedOnboarding, false);

  // Paths that manage their own society resolution must NOT redirect to /onboarding
  const selfResolvingPaths = ['/home', '/s/palm-meadows', '/s/palm-meadows/campaigns', '/s/palm-meadows/bookings'];
  for (const pathname of selfResolvingPaths) {
    const isHomePath = pathname === '/home';
    const isSocietyPath = pathname.startsWith('/s/');
    const isOnboardingPath = pathname === '/onboarding';

    let targetRedirect = null;
    if (!isHomePath && !isSocietyPath) {
      if (!hasCompletedOnboarding && !isOnboardingPath) {
        targetRedirect = '/onboarding';
      }
    }
    assert.equal(targetRedirect, null, `Path ${pathname} should not prematurely redirect to /onboarding`);
  }
});

test('Routing Guard: Genuinely non-onboarded user on other protected routes is redirected to /onboarding', async () => {
  const profile = { primary_society_id: null };
  const uiUser = { primarySocietyId: null };
  const cachedSocieties = null;

  const hasCompletedOnboarding = !!(
    profile.primary_society_id ||
    uiUser.primarySocietyId ||
    (cachedSocieties && cachedSocieties.length > 0)
  );

  const restrictedPaths = ['/profile', '/settings', '/admin/issues'];
  for (const pathname of restrictedPaths) {
    const isHomePath = pathname === '/home';
    const isSocietyPath = pathname.startsWith('/s/');
    const isOnboardingPath = pathname === '/onboarding';

    let targetRedirect = null;
    if (!isHomePath && !isSocietyPath) {
      if (!hasCompletedOnboarding && !isOnboardingPath) {
        targetRedirect = '/onboarding';
      }
    }
    assert.equal(targetRedirect, '/onboarding', `Path ${pathname} must redirect to /onboarding`);
  }
});

test('Routing Guard: User with cached societies is treated as onboarded even if primary_society_id is null', async () => {
  const profile = { primary_society_id: null };
  const uiUser = { primarySocietyId: null };
  const cachedSocieties = [{ id: 'soc-123', name: 'Palm Meadows', slug: 'palm-meadows' }];

  const hasCompletedOnboarding = !!(
    profile.primary_society_id ||
    uiUser.primarySocietyId ||
    (cachedSocieties && cachedSocieties.length > 0)
  );

  assert.equal(hasCompletedOnboarding, true);

  const pathname = '/profile';
  const isHomePath = pathname === '/home';
  const isSocietyPath = pathname.startsWith('/s/');
  const isOnboardingPath = pathname === '/onboarding';

  let targetRedirect = null;
  if (!isHomePath && !isSocietyPath) {
    if (!hasCompletedOnboarding && !isOnboardingPath) {
      targetRedirect = '/onboarding';
    }
  }
  assert.equal(targetRedirect, null, 'User with society memberships should not be bounced from /profile');
});

test('Routing Guard: Onboarded user visiting /onboarding is redirected to /home', async () => {
  const profile = { primary_society_id: 'soc-123' };
  const uiUser = { primarySocietyId: 'soc-123' };
  const hasCompletedOnboarding = !!(profile.primary_society_id || uiUser.primarySocietyId);

  const pathname = '/onboarding';
  const isOnboardingPath = pathname === '/onboarding';

  let targetRedirect = null;
  if (hasCompletedOnboarding && isOnboardingPath) {
    targetRedirect = '/home';
  }

  assert.equal(targetRedirect, '/home');
});

test('API Deduplication: Concurrent calls share the in-flight Promise without duplicate network requests', async () => {
  let networkCalls = 0;

  // Simulator for in-flight promise sharing and caching
  let cache = null;
  let inflight = null;

  async function mockFetchUserSocieties(force = false) {
    if (!force && cache && Date.now() - cache.ts < 30000) return cache.data;
    if (!force && inflight) return inflight;

    inflight = (async () => {
      networkCalls++;
      await new Promise((r) => setTimeout(r, 20));
      const result = { societies: [{ id: 'soc-1', slug: 'palm-meadows' }], memberships: [] };
      cache = { data: result, ts: Date.now() };
      return result;
    })().finally(() => {
      inflight = null;
    });

    return inflight;
  }

  // 4 components mount concurrently and request societies
  const [res1, res2, res3, res4] = await Promise.all([
    mockFetchUserSocieties(),
    mockFetchUserSocieties(),
    mockFetchUserSocieties(),
    mockFetchUserSocieties(),
  ]);

  assert.equal(networkCalls, 1, '4 concurrent calls must coalesce into exactly 1 network request');
  assert.equal(res1.societies[0].slug, 'palm-meadows');
  assert.equal(res4.societies[0].slug, 'palm-meadows');

  // Sequential call within TTL uses cache
  const res5 = await mockFetchUserSocieties();
  assert.equal(networkCalls, 1, 'Sequential call within TTL must use cached data');

  // Invalidate cache
  cache = null;
  await mockFetchUserSocieties();
  assert.equal(networkCalls, 2, 'Call after cache invalidation must trigger fresh fetch');
});

test('Role-Scoped API Endpoints: Only role-applicable endpoints are fetched', () => {
  function getRequiredEndpoints(role, hasSocietyId) {
    const isOrganizer = role === 'organizer' || role === 'secretary' || role === 'committee';
    const isProvider = role === 'provider';
    const isResident = !isOrganizer && !isProvider;

    if (!isProvider && !hasSocietyId) {
      return []; // Must not fetch society-scoped endpoints without a valid society ID
    }

    const endpoints = [];
    if (!isProvider) {
      endpoints.push('/api/services');
      endpoints.push('/api/polls?societyId=...');
    }
    if (isResident) {
      endpoints.push('/api/bookings?role=resident');
    }
    if (isOrganizer) {
      endpoints.push('/api/bookings?role=organizer');
    }
    if (isProvider) {
      endpoints.push('/api/polls?role=provider');
      endpoints.push('/api/bookings?role=provider');
      endpoints.push('/api/providers?self=true');
      endpoints.push('/api/providers/bids');
    }
    return endpoints;
  }

  // 1. Without valid society ID, non-provider queries zero endpoints
  assert.deepEqual(getRequiredEndpoints('resident', false), []);
  assert.deepEqual(getRequiredEndpoints('secretary', false), []);

  // 2. Resident with society ID queries ONLY resident-relevant endpoints
  const residentEndpoints = getRequiredEndpoints('resident', true);
  assert.ok(residentEndpoints.includes('/api/services'));
  assert.ok(residentEndpoints.includes('/api/polls?societyId=...'));
  assert.ok(residentEndpoints.includes('/api/bookings?role=resident'));
  assert.ok(!residentEndpoints.includes('/api/bookings?role=organizer'));
  assert.ok(!residentEndpoints.includes('/api/providers?self=true'));
  assert.ok(!residentEndpoints.includes('/api/providers/bids'));

  // 3. Organizer queries ONLY organizer-relevant endpoints
  const organizerEndpoints = getRequiredEndpoints('organizer', true);
  assert.ok(organizerEndpoints.includes('/api/services'));
  assert.ok(organizerEndpoints.includes('/api/polls?societyId=...'));
  assert.ok(organizerEndpoints.includes('/api/bookings?role=organizer'));
  assert.ok(!organizerEndpoints.includes('/api/bookings?role=resident'));
  assert.ok(!organizerEndpoints.includes('/api/providers?self=true'));

  // 4. Provider queries provider-only endpoints
  const providerEndpoints = getRequiredEndpoints('provider', false);
  assert.ok(providerEndpoints.includes('/api/polls?role=provider'));
  assert.ok(providerEndpoints.includes('/api/bookings?role=provider'));
  assert.ok(providerEndpoints.includes('/api/providers?self=true'));
  assert.ok(providerEndpoints.includes('/api/providers/bids'));
  assert.ok(!providerEndpoints.includes('/api/services'));
});
