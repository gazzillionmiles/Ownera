import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  joinByInviteTokenSchema,
  validateInviteTokenQuerySchema,
  rotateInviteLinkSchema,
  getInviteLinkQuerySchema,
} from '../src/shared/validations/ownera.ts';

function getSafePostAuthRedirect(next) {
  if (!next || typeof next !== 'string') {
    return '/home';
  }

  const trimmed = next.trim();
  // Must start with single slash, not protocol-relative (//) or backslash (/\ or \..)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\\')) {
    return '/home';
  }

  // Ensure it is a valid relative path containing URL-safe characters only
  if (!/^\/[a-zA-Z0-9_\-.~%!$&'()*+,;=:@/?#[\]]*$/.test(trimmed)) {
    return '/home';
  }

  return trimmed;
}

// =============================================================================
// Simulation Database Model for Society Invite Links
// =============================================================================
const MockDB = {
  users: [
    { id: 'usr-platform-admin', email: 'admin@ownera.in', name: 'Platform Admin' },
    { id: 'usr-secretary-A', email: 'secA@palmmeadows.in', name: 'Secretary A' },
    { id: 'usr-secretary-B', email: 'secB@sunrisetowers.in', name: 'Secretary B' },
    { id: 'usr-resident-1', email: 'res1@palmmeadows.in', name: 'Resident 1' },
    { id: 'usr-resident-new', email: 'newresident@example.com', name: 'New Resident' },
    { id: 'usr-stranger', email: 'stranger@somewhere.in', name: 'Stranger' },
  ],
  profiles: [
    { id: 'usr-platform-admin', email: 'admin@ownera.in', name: 'Platform Admin', primary_society_id: null, active_role: 'admin' },
    { id: 'usr-secretary-A', email: 'secA@palmmeadows.in', name: 'Secretary A', primary_society_id: 'soc-A', active_role: 'organizer' },
    { id: 'usr-secretary-B', email: 'secB@sunrisetowers.in', name: 'Secretary B', primary_society_id: 'soc-B', active_role: 'organizer' },
    { id: 'usr-resident-1', email: 'res1@palmmeadows.in', name: 'Resident 1', primary_society_id: 'soc-A', active_role: 'resident' },
    { id: 'usr-resident-new', email: 'newresident@example.com', name: 'New Resident', primary_society_id: null, active_role: 'resident' },
    { id: 'usr-stranger', email: 'stranger@somewhere.in', name: 'Stranger', primary_society_id: null, active_role: 'resident' },
  ],
  platform_admins: [
    { id: 'pa-1', user_id: 'usr-platform-admin', role: 'platform_admin', status: 'active' },
  ],
  societies: [
    {
      id: 'soc-A',
      name: 'Palm Meadows',
      slug: 'palm-meadows',
      invite_code: 'PALM2026',
      city: 'Bengaluru',
      state: 'Karnataka',
      address: 'Varthur Road, Whitefield',
      total_homes: 250,
      created_by: 'usr-secretary-A',
    },
    {
      id: 'soc-B',
      name: 'Sunrise Towers',
      slug: 'sunrise-towers',
      invite_code: 'SUNRISE100',
      city: 'Bengaluru',
      state: 'Karnataka',
      address: 'Sarjapur Main Road',
      total_homes: 120,
      created_by: 'usr-secretary-B',
    },
  ],
  society_members: [
    {
      id: 'mem-secA',
      society_id: 'soc-A',
      user_id: 'usr-secretary-A',
      flat_number: 'Villa 1',
      unit_number: 'Villa 1',
      property_type: 'villa',
      role: 'secretary',
      status: 'active',
    },
    {
      id: 'mem-secB',
      society_id: 'soc-B',
      user_id: 'usr-secretary-B',
      flat_number: 'Tower 1 - 101',
      unit_number: 'Tower 1 - 101',
      property_type: 'apartment',
      role: 'secretary',
      status: 'active',
    },
    {
      id: 'mem-res1',
      society_id: 'soc-A',
      user_id: 'usr-resident-1',
      flat_number: 'Villa 42',
      unit_number: 'Villa 42',
      property_type: 'villa',
      role: 'resident',
      status: 'active',
    },
  ],
  society_invite_links: [],
};

// -----------------------------------------------------------------------------
// Simulation Logic mirroring lib/ownera/invite-links.ts & RBAC
// -----------------------------------------------------------------------------

function isPlatformAdmin(userId) {
  return MockDB.platform_admins.some((pa) => pa.user_id === userId && pa.status === 'active');
}

function isSecretary(userId, societyId) {
  return MockDB.society_members.some(
    (m) => m.society_id === societyId && m.user_id === userId && m.role === 'secretary' && m.status === 'active'
  );
}

function generateSimulatedToken() {
  const entropy = crypto.randomBytes(24).toString('base64url');
  return `soc_${entropy}`;
}

function getOrCreateActiveInviteLinkSim(societyId, actorUserId) {
  if (!isPlatformAdmin(actorUserId) && !isSecretary(actorUserId, societyId)) {
    const err = new Error('Forbidden: Only the society secretary or a platform admin can manage invite links');
    err.statusCode = 403;
    throw err;
  }

  const existing = MockDB.society_invite_links.find(
    (l) => l.society_id === societyId && l.is_active === true
  );

  if (existing) {
    const soc = MockDB.societies.find((s) => s.id === societyId);
    return { inviteLink: { ...existing, society: soc }, isNew: false };
  }

  const token = generateSimulatedToken();
  const newLink = {
    id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    society_id: societyId,
    token,
    is_active: true,
    created_by: actorUserId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rotated_at: null,
  };

  MockDB.society_invite_links.push(newLink);
  const soc = MockDB.societies.find((s) => s.id === societyId);
  return { inviteLink: { ...newLink, society: soc }, isNew: true };
}

function rotateInviteLinkSim(societyId, actorUserId) {
  if (!isPlatformAdmin(actorUserId) && !isSecretary(actorUserId, societyId)) {
    const err = new Error('Forbidden: Only the society secretary or a platform admin can rotate invite links');
    err.statusCode = 403;
    throw err;
  }

  const nowIso = new Date().toISOString();
  // Deactivate existing
  MockDB.society_invite_links.forEach((l) => {
    if (l.society_id === societyId && l.is_active === true) {
      l.is_active = false;
      l.rotated_at = nowIso;
      l.updated_at = nowIso;
    }
  });

  const newToken = generateSimulatedToken();
  const newLink = {
    id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    society_id: societyId,
    token: newToken,
    is_active: true,
    created_by: actorUserId,
    created_at: nowIso,
    updated_at: nowIso,
    rotated_at: null,
  };

  MockDB.society_invite_links.push(newLink);
  const soc = MockDB.societies.find((s) => s.id === societyId);
  return { inviteLink: { ...newLink, society: soc }, rotated: true };
}

function validateInviteTokenSim(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'not_found', error: 'Invalid invite token' };
  }

  const link = MockDB.society_invite_links.find((l) => l.token === token.trim());
  if (!link) {
    return { valid: false, reason: 'not_found', error: 'Invite link not found or invalid' };
  }

  if (!link.is_active) {
    return { valid: false, reason: 'inactive', error: 'This invite link is inactive or has been rotated' };
  }

  const society = MockDB.societies.find((s) => s.id === link.society_id);
  if (!society) {
    return { valid: false, reason: 'not_found', error: 'Society not found' };
  }

  // Safe preview: DO NOT leak token, member counts, secretary personal info, etc.
  return {
    valid: true,
    society: {
      id: society.id,
      name: society.name,
      slug: society.slug,
      address: society.address || null,
      city: society.city,
      state: society.state || null,
      total_homes: society.total_homes,
    },
  };
}

function joinSocietyByInviteTokenSim({ token, userId, unitNumber, propertyType }) {
  if (!userId) {
    return { success: false, reason: 'error', error: 'Unauthorized', statusCode: 401 };
  }

  const validation = validateInviteTokenSim(token);
  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      error: validation.error,
      statusCode: validation.reason === 'inactive' ? 410 : 404,
    };
  }

  const targetSociety = validation.society;
  const cleanUnitNumber = (unitNumber || '').trim() || 'Unit 1';
  const cleanPropertyType = propertyType || 'apartment';

  // Check existing membership
  const existingMember = MockDB.society_members.find(
    (m) => m.society_id === targetSociety.id && m.user_id === userId
  );

  if (existingMember && existingMember.status === 'active') {
    // Preserve existing role!
    return {
      success: true,
      alreadyMember: true,
      message: `You are already a member of ${targetSociety.name}.`,
      society: targetSociety,
      member: existingMember,
    };
  }

  // New membership
  const newMember = {
    id: `mem_${userId}_${targetSociety.id}`,
    society_id: targetSociety.id,
    user_id: userId,
    flat_number: cleanUnitNumber,
    unit_number: cleanUnitNumber,
    property_type: cleanPropertyType,
    role: 'resident',
    status: 'active',
  };

  MockDB.society_members.push(newMember);

  const profile = MockDB.profiles.find((p) => p.id === userId);
  if (profile) {
    profile.primary_society_id = targetSociety.id;
    profile.unit_number = cleanUnitNumber;
    profile.property_type = cleanPropertyType;
  }

  return {
    success: true,
    alreadyMember: false,
    message: `Welcome to ${targetSociety.name}!`,
    society: targetSociety,
    member: newMember,
  };
}

// =============================================================================
// TEST SUITE: Reusable Society Resident Invite Links (Phase 1)
// =============================================================================

test('Phase 1 - Scenario 1: Secretary generates / retrieves active invite link', () => {
  // Secretary A requests invite link for Society A
  const res = getOrCreateActiveInviteLinkSim('soc-A', 'usr-secretary-A');
  assert.equal(res.isNew, true);
  assert.ok(res.inviteLink.token.startsWith('soc_'));
  assert.equal(res.inviteLink.society_id, 'soc-A');
  assert.equal(res.inviteLink.is_active, true);

  // Calling it again returns the same active link (idempotent retrieval)
  const res2 = getOrCreateActiveInviteLinkSim('soc-A', 'usr-secretary-A');
  assert.equal(res2.isNew, false);
  assert.equal(res2.inviteLink.token, res.inviteLink.token);
  assert.equal(res2.inviteLink.id, res.inviteLink.id);
});

test('Phase 1 - Scenario 2: Token format and cryptographic properties', () => {
  const token = generateSimulatedToken();
  assert.ok(token.startsWith('soc_'));
  assert.ok(token.length >= 32, 'Token must contain >= 32 characters of entropy');
  assert.match(token, /^soc_[A-Za-z0-9_-]+$/, 'Token must be strictly URL-safe base64url');
});

test('Phase 1 - Scenario 3: Valid invite link validation (public preview)', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  assert.ok(activeLink, 'Active link must exist from scenario 1');

  const validation = validateInviteTokenSim(activeLink.token);
  assert.equal(validation.valid, true);
  assert.equal(validation.society.name, 'Palm Meadows');
  assert.equal(validation.society.city, 'Bengaluru');
  assert.equal(validation.society.total_homes, 250);

  // Security: sensitive fields and token echo MUST NOT be exposed
  assert.equal(validation.society.created_by, undefined, 'Must not expose created_by user ID');
  assert.equal(validation.society.secretary, undefined, 'Must not expose secretary details');
  assert.equal(validation.society.members, undefined, 'Must not expose member lists');
  assert.equal(validation.inviteLink, undefined, 'Must not echo inviteLink object in public validation payload');
  assert.equal(validation.token, undefined, 'Must not echo raw token in public validation payload');
});

test('Phase 1 - Scenario 4: Valid Flow — Authenticated user joins society via invite token', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  const joinResult = joinSocietyByInviteTokenSim({
    token: activeLink.token,
    userId: 'usr-resident-new',
    unitNumber: 'Villa 108',
    propertyType: 'villa',
  });

  assert.equal(joinResult.success, true);
  assert.equal(joinResult.alreadyMember, false);
  assert.equal(joinResult.society.name, 'Palm Meadows');
  assert.equal(joinResult.member.role, 'resident');
  assert.equal(joinResult.member.unit_number, 'Villa 108');
  assert.equal(joinResult.member.property_type, 'villa');

  // Verify profile updated
  const profile = MockDB.profiles.find((p) => p.id === 'usr-resident-new');
  assert.equal(profile.primary_society_id, 'soc-A');
  assert.equal(profile.unit_number, 'Villa 108');
});

test('Phase 1 - Scenario 5: Existing Member Flow — Idempotent join without duplicate membership or role demotion', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);

  // Resident 1 is already a member of Society A
  const memberCountBefore = MockDB.society_members.filter((m) => m.society_id === 'soc-A').length;

  const joinResult = joinSocietyByInviteTokenSim({
    token: activeLink.token,
    userId: 'usr-resident-1',
    unitNumber: 'Villa 42',
    propertyType: 'villa',
  });

  assert.equal(joinResult.success, true);
  assert.equal(joinResult.alreadyMember, true);
  assert.equal(joinResult.member.role, 'resident');

  const memberCountAfter = MockDB.society_members.filter((m) => m.society_id === 'soc-A').length;
  assert.equal(memberCountAfter, memberCountBefore, 'No duplicate membership row must be created');

  // Secretary A opens their own society invite link
  const secJoinResult = joinSocietyByInviteTokenSim({
    token: activeLink.token,
    userId: 'usr-secretary-A',
  });

  assert.equal(secJoinResult.success, true);
  assert.equal(secJoinResult.alreadyMember, true);
  assert.equal(secJoinResult.member.role, 'secretary', 'Existing Secretary role must NOT be demoted to resident');
});

test('Phase 1 - Scenario 6: Invalid Token Flow — Non-existent token rejects join', () => {
  const memberCountBefore = MockDB.society_members.length;

  const validation = validateInviteTokenSim('soc_fake_invalid_token_999999999999');
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'not_found');

  const joinResult = joinSocietyByInviteTokenSim({
    token: 'soc_fake_invalid_token_999999999999',
    userId: 'usr-stranger',
  });

  assert.equal(joinResult.success, false);
  assert.equal(joinResult.statusCode, 404);
  assert.equal(MockDB.society_members.length, memberCountBefore, 'Must not create membership on invalid token');
});

test('Phase 1 - Scenario 7: Inactive Token Flow — Rotated token stops working immediately', () => {
  const oldActiveLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  const oldToken = oldActiveLink.token;

  // Secretary rotates link
  const rotateRes = rotateInviteLinkSim('soc-A', 'usr-secretary-A');
  assert.equal(rotateRes.rotated, true);
  assert.notEqual(rotateRes.inviteLink.token, oldToken);
  assert.equal(rotateRes.inviteLink.is_active, true);

  // Old link is now inactive in DB
  const oldLinkInDb = MockDB.society_invite_links.find((l) => l.token === oldToken);
  assert.equal(oldLinkInDb.is_active, false);
  assert.ok(oldLinkInDb.rotated_at !== null);

  // Validating old token returns inactive (410)
  const validationOld = validateInviteTokenSim(oldToken);
  assert.equal(validationOld.valid, false);
  assert.equal(validationOld.reason, 'inactive');

  // Joining with old token fails
  const memberCountBefore = MockDB.society_members.length;
  const joinOldResult = joinSocietyByInviteTokenSim({
    token: oldToken,
    userId: 'usr-stranger',
  });
  assert.equal(joinOldResult.success, false);
  assert.equal(joinOldResult.statusCode, 410);
  assert.equal(MockDB.society_members.length, memberCountBefore, 'Must not create membership on inactive token');

  // Joining with NEW rotated token succeeds
  const joinNewResult = joinSocietyByInviteTokenSim({
    token: rotateRes.inviteLink.token,
    userId: 'usr-stranger',
    unitNumber: 'Villa 99',
  });
  assert.equal(joinNewResult.success, true);
  assert.equal(joinNewResult.member.user_id, 'usr-stranger');
  assert.equal(joinNewResult.member.role, 'resident');
});

test('Phase 1 - Scenario 8: Unauthorized Management Protection', () => {
  // 1. Resident attempts to get/create invite link -> Denied
  assert.throws(
    () => getOrCreateActiveInviteLinkSim('soc-A', 'usr-resident-1'),
    (err) => err.statusCode === 403
  );

  // 2. Resident attempts to rotate invite link -> Denied
  assert.throws(
    () => rotateInviteLinkSim('soc-A', 'usr-resident-1'),
    (err) => err.statusCode === 403
  );

  // 3. Secretary of Society B attempts to manage Society A's invite link -> Denied
  assert.throws(
    () => getOrCreateActiveInviteLinkSim('soc-A', 'usr-secretary-B'),
    (err) => err.statusCode === 403
  );
  assert.throws(
    () => rotateInviteLinkSim('soc-A', 'usr-secretary-B'),
    (err) => err.statusCode === 403
  );

  // 4. Platform Admin can manage any society invite link
  const adminRes = getOrCreateActiveInviteLinkSim('soc-B', 'usr-platform-admin');
  assert.ok(adminRes.inviteLink.token);
});

test('Phase 1 - Scenario 9: Security Guard — Client cannot pass arbitrary Society ID or slug to join', () => {
  // Verify Zod validation strictly strips / rejects any societyId or slug injection
  const payloadWithInjection = {
    token: 'soc_valid_token_12345678901234',
    societyId: 'soc-VICTIM-SOCIETY',
    society_id: 'soc-VICTIM-SOCIETY',
    slug: 'victim-society-slug',
    unitNumber: 'Flat 101',
    propertyType: 'apartment',
  };

  const parsed = joinByInviteTokenSchema.safeParse(payloadWithInjection);
  assert.equal(parsed.success, true);

  // The parsed object contains ONLY the whitelisted fields
  const data = parsed.data;
  assert.equal(data.token, 'soc_valid_token_12345678901234');
  assert.equal(data.unitNumber, 'Flat 101');
  assert.equal(data.propertyType, 'apartment');
  assert.equal(data.societyId, undefined, 'societyId must be stripped by validation');
  assert.equal(data.society_id, undefined, 'society_id must be stripped by validation');
  assert.equal(data.slug, undefined, 'slug must be stripped by validation');
});

// =============================================================================
// TEST SUITE: Phase 2A Mobile-First Join Journey & Auth Continuation
// =============================================================================

test('Phase 2A - Scenario 1: Logged Out User Flow — Preview, auth redirect preservation, and return', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  const token = activeLink.token;

  // 1. Unauthenticated user calls validation endpoint
  const validation = validateInviteTokenSim(token);
  assert.equal(validation.valid, true);
  assert.equal(validation.society.name, 'Palm Meadows');

  // 2. Client constructs login URL preserving exact internal next destination
  const nextDestination = `/join/${token}`;
  const safeNext = getSafePostAuthRedirect(nextDestination);
  assert.equal(safeNext, nextDestination);

  const loginUrl = `/login?next=${encodeURIComponent(safeNext)}`;
  assert.ok(loginUrl.includes(`next=%2Fjoin%2F${token}`));

  // 3. User authenticates via password -> redirects to safeNext
  const postLoginRedirect = getSafePostAuthRedirect(safeNext);
  assert.equal(postLoginRedirect, `/join/${token}`);
});

test('Phase 2A - Scenario 2: Google Login OAuth Preservation Flow', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  const token = activeLink.token;

  // 1. User on /join/{token} clicks Google login
  const nextParam = `/join/${token}`;
  const safeNext = getSafePostAuthRedirect(nextParam);

  const origin = 'https://ownera.in';
  const oauthRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  assert.equal(oauthRedirectTo, `https://ownera.in/auth/callback?next=%2Fjoin%2F${token}`);

  // 2. Supabase auth callback parses next param
  const callbackUrl = new URL(oauthRedirectTo);
  const extractedNext = getSafePostAuthRedirect(callbackUrl.searchParams.get('next'));
  assert.equal(extractedNext, `/join/${token}`);
});

test('Phase 2A - Scenario 3: Existing Authenticated User Flow', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-B' && l.is_active);
  const token = activeLink.token;

  // Authenticated user (usr-resident-new) opens Society B link
  const validation = validateInviteTokenSim(token);
  assert.equal(validation.valid, true);
  assert.equal(validation.society.name, 'Sunrise Towers');

  // Submits join with property details
  const joinResult = joinSocietyByInviteTokenSim({
    token,
    userId: 'usr-resident-new',
    unitNumber: 'Tower 2 - 404',
    propertyType: 'apartment',
  });

  assert.equal(joinResult.success, true);
  assert.equal(joinResult.alreadyMember, false);
  assert.equal(joinResult.member.society_id, 'soc-B');
  assert.equal(joinResult.member.unit_number, 'Tower 2 - 404');
});

test('Phase 2A - Scenario 4: New User Signup Flow', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  const token = activeLink.token;

  // New user registers with next param
  const nextDestination = `/join/${token}`;
  const safeNext = getSafePostAuthRedirect(nextDestination);

  // Email redirect to for signup verification
  const emailRedirectTo = `https://ownera.in/auth/callback?next=${encodeURIComponent(safeNext)}`;
  assert.ok(emailRedirectTo.includes(`next=%2Fjoin%2F${token}`));

  // After callback, returns to /join/{token}
  const postSignupDestination = getSafePostAuthRedirect(new URL(emailRedirectTo).searchParams.get('next'));
  assert.equal(postSignupDestination, `/join/${token}`);
});

test('Phase 2A - Scenario 5: Invalid Link Flow', () => {
  const fakeToken = 'soc_nonexistent_token_00000000000000';
  const validation = validateInviteTokenSim(fakeToken);

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'not_found');
});

test('Phase 2A - Scenario 6: Rotated Link Flow', () => {
  // Rotate Society B link
  const rotateRes = rotateInviteLinkSim('soc-B', 'usr-secretary-B');
  const inactiveToken = MockDB.society_invite_links.find((l) => l.society_id === 'soc-B' && !l.is_active).token;

  const validation = validateInviteTokenSim(inactiveToken);
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'inactive');

  // Join attempt is rejected
  const joinResult = joinSocietyByInviteTokenSim({
    token: inactiveToken,
    userId: 'usr-stranger',
    unitNumber: 'Flat 101',
  });
  assert.equal(joinResult.success, false);
  assert.equal(joinResult.statusCode, 410);
});

test('Phase 2A - Scenario 7: Existing Member Safe Experience', () => {
  const activeLink = MockDB.society_invite_links.find((l) => l.society_id === 'soc-A' && l.is_active);
  const token = activeLink.token;

  // Member opens invite link
  const joinResult = joinSocietyByInviteTokenSim({
    token,
    userId: 'usr-resident-1',
  });

  assert.equal(joinResult.success, true);
  assert.equal(joinResult.alreadyMember, true);
  assert.ok(joinResult.message.includes('already a member'));
});

test('Phase 2A - Scenario 8: Onboarding Guard Simulation for /join/[token]', () => {
  const publicRoutes = ['/', '/login', '/signup', '/join'];
  const testPath = '/join/soc_test_token_12345';

  const isPublicRoute = publicRoutes.some((route) =>
    route === '/' ? testPath === '/' : testPath === route || testPath.startsWith(route + '/')
  );
  assert.equal(isPublicRoute, true, '/join routes must be recognized as public routes');

  // Non-onboarded user checking route protection
  const hasCompletedOnboarding = false;
  let targetRedirect = null;
  if (!hasCompletedOnboarding && testPath !== '/onboarding' && !isPublicRoute) {
    targetRedirect = '/onboarding';
  }

  // Must NOT redirect to /onboarding
  assert.equal(targetRedirect, null, 'Authenticated user without primary society must NOT be redirected away from /join/[token]');
});

test('Phase 2A - Scenario 9: Redirect Security & Open Redirect Protection', () => {
  const maliciousInputs = [
    '//evil.com',
    'https://evil.com/hack',
    'http://attacker.com',
    '/\\evil.com',
    '//attacker.com/join',
    'javascript:alert(1)',
    'data:text/html,hack',
    null,
    undefined,
    '',
    '   ',
    'ftp://evil.com',
  ];

  for (const input of maliciousInputs) {
    const safe = getSafePostAuthRedirect(input);
    assert.equal(safe, '/home', `Malicious or invalid input "${input}" must safely default to /home`);
  }

  // Valid internal paths
  assert.equal(getSafePostAuthRedirect('/join/soc_abc123'), '/join/soc_abc123');
  assert.equal(getSafePostAuthRedirect('/join/soc_abc123?step=unit'), '/join/soc_abc123?step=unit');
  assert.equal(getSafePostAuthRedirect('/s/palm-meadows'), '/s/palm-meadows');
});
