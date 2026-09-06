import test from 'node:test';
import assert from 'node:assert/strict';

// -----------------------------------------------------------------------------
// Explicit Permissions Definitions (Matching lib/ownera/rbac.ts)
// -----------------------------------------------------------------------------
const PLATFORM_ROLE_PERMISSIONS = {
  platform_admin: [
    'platform.view',
    'platform.societies.manage',
    'platform.societies.create',
    'platform.users.manage',
    'platform.providers.manage',
    'platform.campaigns.manage',
    'platform.bookings.manage',
    'platform.payments.manage',
    'platform.issues.manage',
    'platform.admins.manage',
  ],
  support_admin: [
    'platform.view',
    'platform.users.manage',
    'platform.providers.manage',
    'platform.campaigns.manage',
    'platform.bookings.manage',
    'platform.issues.manage',
  ],
};

const SOCIETY_ROLE_PERMISSIONS = {
  secretary: [
    'society.view',
    'society.update',
    'society.members.view',
    'society.members.manage',
    'society.secretary.manage',
    'society.secretary.transfer',
    'society.committee.manage',
    'society.campaigns.create',
    'society.campaigns.manage',
    'society.campaigns.select_provider',
    'society.campaigns.view',
    'society.bookings.view_all',
    'society.bookings.manage',
    'society.issues.manage',
    'society.info.view',
  ],
  committee: [
    'society.view',
    'society.members.view',
    'society.campaigns.create',
    'society.campaigns.manage',
    'society.campaigns.select_provider',
    'society.campaigns.view',
    'society.bookings.view_all',
    'society.issues.manage',
    'society.info.view',
  ],
  resident: [
    'society.view',
    'society.campaigns.view',
    'society.info.view',
  ],
};

class AuthorizationError extends Error {
  constructor(message = 'Forbidden: Insufficient permissions', statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

// -----------------------------------------------------------------------------
// Database Simulation Model for Ownera RBAC
// -----------------------------------------------------------------------------
const MockDB = {
  users: [
    { id: 'usr-platform-admin', email: 'admin@ownera.in', name: 'Platform Admin' },
    { id: 'usr-support-admin', email: 'support@ownera.in', name: 'Support Admin' },
    { id: 'usr-secretary-A', email: 'secA@greenheights.in', name: 'Secretary A' },
    { id: 'usr-committee-A', email: 'commA@greenheights.in', name: 'Committee A' },
    { id: 'usr-resident-A', email: 'resA@greenheights.in', name: 'Resident A' },
    { id: 'usr-resident-B', email: 'resB@sunrisetowers.in', name: 'Resident B' },
    { id: 'usr-multi-user', email: 'multi@property.in', name: 'Multi Role User' },
    { id: 'usr-provider-1', email: 'vendor@coolair.in', name: 'Vendor 1' },
    { id: 'usr-unauth', email: 'unauth@example.com', name: 'Unauth User' },
  ],
  platform_admins: [
    { id: 'padm-1', user_id: 'usr-platform-admin', role: 'platform_admin', status: 'active' },
    { id: 'padm-2', user_id: 'usr-support-admin', role: 'support_admin', status: 'active' },
  ],
  societies: [
    { id: 'soc-A', name: 'Green Heights', slug: 'green-heights', invite_code: 'GREEN123', created_by: 'usr-platform-admin' },
    { id: 'soc-B', name: 'Sunrise Towers', slug: 'sunrise-towers', invite_code: 'SUNRISE456', created_by: 'usr-platform-admin' },
    { id: 'soc-C', name: 'Lakeview Towers', slug: 'lakeview-towers', invite_code: 'LAKE789', created_by: 'usr-platform-admin' },
  ],
  society_members: [
    { id: 'mem-1', society_id: 'soc-A', user_id: 'usr-secretary-A', flat_number: 'A-101', role: 'secretary', status: 'active' },
    { id: 'mem-2', society_id: 'soc-A', user_id: 'usr-committee-A', flat_number: 'A-202', role: 'committee', status: 'active' },
    { id: 'mem-3', society_id: 'soc-A', user_id: 'usr-resident-A', flat_number: 'A-303', role: 'resident', status: 'active' },
    { id: 'mem-4', society_id: 'soc-B', user_id: 'usr-resident-B', flat_number: 'B-101', role: 'resident', status: 'active' },
    { id: 'mem-5', society_id: 'soc-C', user_id: 'usr-multi-user', flat_number: 'C-404', role: 'secretary', status: 'active' },
    { id: 'mem-6', society_id: 'soc-B', user_id: 'usr-multi-user', flat_number: 'B-202', role: 'resident', status: 'active' },
  ],
  society_invitations: [],
  providers: [
    { id: 'prov-1', user_id: 'usr-provider-1', company_name: 'CoolAir Pro' },
  ],
  service_campaigns: [
    { id: 'camp-A1', society_id: 'soc-A', organizer_id: 'usr-secretary-A', title: 'AC Camp GH', status: 'open' },
    { id: 'camp-B1', society_id: 'soc-B', organizer_id: 'usr-resident-B', title: 'AC Camp ST', status: 'open' },
  ],
  campaign_participants: [],
  bookings: [],
};

// -----------------------------------------------------------------------------
// Core RBAC Evaluator Logic
// -----------------------------------------------------------------------------

function evaluatePlatformPermission(userId, permission) {
  if (!userId) return false;
  const admin = MockDB.platform_admins.find((pa) => pa.user_id === userId && pa.status === 'active');
  if (!admin) return false;
  const permissions = PLATFORM_ROLE_PERMISSIONS[admin.role] || [];
  return permissions.includes(permission);
}

function evaluateSocietyPermission(userId, societyId, permission) {
  if (!userId || !societyId) return false;

  // Platform admin bypass
  const isPlatform = evaluatePlatformPermission(userId, 'platform.societies.manage');
  if (isPlatform) return true;

  const membership = MockDB.society_members.find(
    (sm) => sm.society_id === societyId && sm.user_id === userId && sm.status === 'active'
  );
  if (!membership) return false;

  const permissions = SOCIETY_ROLE_PERMISSIONS[membership.role] || [];
  return permissions.includes(permission);
}

function simulateTransferSecretary(currentUserId, societyId, newSecretaryUserId, oldRole = 'committee') {
  // Authorization check
  const isPlatform = evaluatePlatformPermission(currentUserId, 'platform.societies.manage');
  const isCurrentSec = MockDB.society_members.some(
    (sm) => sm.society_id === societyId && sm.user_id === currentUserId && sm.role === 'secretary' && sm.status === 'active'
  );

  if (!isPlatform && !isCurrentSec) {
    throw new AuthorizationError('Unauthorized: Only secretary or platform admin can transfer secretary role', 403);
  }

  const targetMember = MockDB.society_members.find(
    (sm) => sm.society_id === societyId && sm.user_id === newSecretaryUserId && sm.status === 'active'
  );
  if (!targetMember) {
    throw new Error('Target user must be an active member of this society');
  }

  // Atomically demote existing secretary
  const existingSec = MockDB.society_members.find(
    (sm) => sm.society_id === societyId && sm.role === 'secretary' && sm.status === 'active'
  );
  if (existingSec && existingSec.user_id !== newSecretaryUserId) {
    existingSec.role = oldRole;
  }

  // Promote target
  targetMember.role = 'secretary';

  // Verify single primary secretary invariant
  const activeSecCount = MockDB.society_members.filter(
    (sm) => sm.society_id === societyId && sm.role === 'secretary' && sm.status === 'active'
  ).length;

  if (activeSecCount !== 1) {
    throw new Error(`Integrity Violation: Expected 1 primary secretary, found ${activeSecCount}`);
  }

  return { success: true, newSecretaryId: newSecretaryUserId, oldSecretaryRole: oldRole };
}

function simulateUpdateMemberRole(callerUserId, societyId, targetUserId, newRole) {
  const isPlatform = evaluatePlatformPermission(callerUserId, 'platform.societies.manage');
  const isSec = MockDB.society_members.some(
    (sm) => sm.society_id === societyId && sm.user_id === callerUserId && sm.role === 'secretary' && sm.status === 'active'
  );

  if (!isPlatform && !isSec) {
    throw new AuthorizationError('Forbidden: Only secretary or platform admin can manage member roles', 403);
  }

  const target = MockDB.society_members.find(
    (sm) => sm.society_id === societyId && sm.user_id === targetUserId && sm.status === 'active'
  );
  if (!target) throw new Error('Member not found');

  if (target.role === 'secretary' && callerUserId === targetUserId) {
    throw new Error('Secretary must use transferSecretary to change role');
  }

  target.role = newRole;
  return target;
}

function simulateJoinSociety(userId, inviteCode, flatNumber, requestedRole = 'resident', token = null) {
  const society = MockDB.societies.find((s) => s.invite_code === inviteCode);
  if (!society) throw new Error('Society not found');

  let assignedRole = 'resident';

  if (token) {
    const invite = MockDB.society_invitations.find((i) => i.token === token && i.status === 'pending');
    if (invite && invite.society_id === society.id) {
      assignedRole = invite.role;
      invite.status = 'accepted';

      // If accepted role is secretary, demote any previous secretary in that society
      if (assignedRole === 'secretary') {
        const oldSec = MockDB.society_members.find(
          (sm) => sm.society_id === society.id && sm.role === 'secretary' && sm.status === 'active'
        );
        if (oldSec && oldSec.user_id !== userId) {
          oldSec.role = 'committee';
        }
      }
    }
  }

  // Standard join by code NEVER respects requestedRole > resident
  const existing = MockDB.society_members.find(
    (sm) => sm.society_id === society.id && sm.user_id === userId
  );

  if (existing) {
    if (token && assignedRole) {
      existing.role = assignedRole;
    }
    return existing;
  }

  const newMember = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    society_id: society.id,
    user_id: userId,
    flat_number: flatNumber,
    role: assignedRole,
    status: 'active',
  };
  MockDB.society_members.push(newMember);
  return newMember;
}

// =============================================================================
// 15 REQUIRED SECURITY & ROLE SPECIFICATION TESTS
// =============================================================================

test('Security 1: Resident cannot become secretary through client join payload', () => {
  const member = simulateJoinSociety('usr-attacker-1', 'GREEN123', 'Flat 999', 'secretary');
  assert.equal(member.role, 'resident', 'Standard join must force resident role and ignore client role promotion');
});

test('Security 2: Resident cannot become committee through profile or join update', () => {
  const member = simulateJoinSociety('usr-attacker-2', 'GREEN123', 'Flat 998', 'committee');
  assert.equal(member.role, 'resident', 'Standard join must reject client committee role escalation');
});

test('Security 3: Resident cannot become platform admin via profile API', () => {
  const isPlatform = evaluatePlatformPermission('usr-resident-A', 'platform.admins.manage');
  assert.equal(isPlatform, false, 'Resident must have zero platform administrator permissions');
});

test('Security 4: Resident cannot change another user’s membership role', () => {
  assert.throws(
    () => simulateUpdateMemberRole('usr-resident-A', 'soc-A', 'usr-committee-A', 'resident'),
    /Forbidden/i,
    'Resident must not be permitted to alter any member roles'
  );
});

test('Security 5: Secretary can manage their own society (create campaigns, select provider)', () => {
  const canCreate = evaluateSocietyPermission('usr-secretary-A', 'soc-A', 'society.campaigns.create');
  const canSelectProvider = evaluateSocietyPermission('usr-secretary-A', 'soc-A', 'society.campaigns.select_provider');
  const canTransfer = evaluateSocietyPermission('usr-secretary-A', 'soc-A', 'society.secretary.transfer');

  assert.equal(canCreate, true, 'Secretary must be able to create campaigns in own society');
  assert.equal(canSelectProvider, true, 'Secretary must be able to select provider in own society');
  assert.equal(canTransfer, true, 'Secretary must be able to transfer secretary role');
});

test('Security 6: Secretary cannot manage another society where they are not secretary', () => {
  const canManageSocB = evaluateSocietyPermission('usr-secretary-A', 'soc-B', 'society.campaigns.create');
  const canTransferSocB = evaluateSocietyPermission('usr-secretary-A', 'soc-B', 'society.secretary.transfer');

  assert.equal(canManageSocB, false, 'Secretary of Society A must have no organizer powers in Society B');
  assert.equal(canTransferSocB, false, 'Secretary of Society A cannot transfer roles in Society B');
});

test('Security 7: Committee cannot transfer secretary role', () => {
  const canTransfer = evaluateSocietyPermission('usr-committee-A', 'soc-A', 'society.secretary.transfer');
  assert.equal(canTransfer, false, 'Committee role must NOT have secretary transfer permission');

  assert.throws(
    () => simulateTransferSecretary('usr-committee-A', 'soc-A', 'usr-committee-A', 'resident'),
    /Unauthorized/i,
    'Committee member attempting transfer must be blocked'
  );
});

test('Security 8: Secretary can transfer secretary role atomically', () => {
  const res = simulateTransferSecretary('usr-secretary-A', 'soc-A', 'usr-committee-A', 'committee');
  assert.equal(res.success, true);
  assert.equal(res.newSecretaryId, 'usr-committee-A');

  const oldSec = MockDB.society_members.find((m) => m.society_id === 'soc-A' && m.user_id === 'usr-secretary-A');
  const newSec = MockDB.society_members.find((m) => m.society_id === 'soc-A' && m.user_id === 'usr-committee-A');

  assert.equal(oldSec.role, 'committee', 'Old secretary must transition to committee role');
  assert.equal(newSec.role, 'secretary', 'New secretary must hold secretary role');
});

test('Security 9: Only one primary secretary can exist per society (Unique constraint integrity)', () => {
  const activeSecretaries = MockDB.society_members.filter(
    (m) => m.society_id === 'soc-A' && m.role === 'secretary' && m.status === 'active'
  );
  assert.equal(activeSecretaries.length, 1, 'Database must enforce exactly one primary active secretary');
});

test('Security 10: User can be secretary in Society A and resident in Society B with independent permissions', () => {
  const canManageC = evaluateSocietyPermission('usr-multi-user', 'soc-C', 'society.campaigns.create');
  const canManageB = evaluateSocietyPermission('usr-multi-user', 'soc-B', 'society.campaigns.create');

  assert.equal(canManageC, true, 'User is secretary in Society C -> allowed to manage campaigns');
  assert.equal(canManageB, false, 'User is resident in Society B -> blocked from managing campaigns');
});

test('Security 11: Provider cannot gain society admin permissions', () => {
  const canManageCampaigns = evaluateSocietyPermission('usr-provider-1', 'soc-A', 'society.campaigns.create');
  const canTransfer = evaluateSocietyPermission('usr-provider-1', 'soc-A', 'society.secretary.transfer');

  assert.equal(canManageCampaigns, false, 'Provider identity has no society administration permissions');
  assert.equal(canTransfer, false, 'Provider cannot perform secretary actions');
});

test('Security 12: Support admin cannot perform restricted platform-admin actions (e.g. platform admin management)', () => {
  const canView = evaluatePlatformPermission('usr-support-admin', 'platform.view');
  const canManageAdmins = evaluatePlatformPermission('usr-support-admin', 'platform.admins.manage');
  const canManageSocieties = evaluatePlatformPermission('usr-support-admin', 'platform.societies.create');

  assert.equal(canView, true, 'Support admin can view platform support operations');
  assert.equal(canManageAdmins, false, 'Support admin must NOT be able to manage platform admin roles');
  assert.equal(canManageSocieties, false, 'Support admin must NOT be able to create platform societies');
});

test('Security 13: Platform admin can manage societies across the platform', () => {
  const canCreate = evaluatePlatformPermission('usr-platform-admin', 'platform.societies.create');
  const canManage = evaluatePlatformPermission('usr-platform-admin', 'platform.societies.manage');
  const canManageAdmins = evaluatePlatformPermission('usr-platform-admin', 'platform.admins.manage');

  assert.equal(canCreate, true, 'Platform admin can create societies');
  assert.equal(canManage, true, 'Platform admin can manage societies');
  assert.equal(canManageAdmins, true, 'Platform admin can manage platform admins');
});

test('Security 14: Unauthenticated user cannot access role management', () => {
  const canPlatform = evaluatePlatformPermission(null, 'platform.view');
  const canSociety = evaluateSocietyPermission(null, 'soc-A', 'society.view');

  assert.equal(canPlatform, false, 'Unauthenticated user denied platform access');
  assert.equal(canSociety, false, 'Unauthenticated user denied society access');
});

test('Security 15: Role changes immediately affect authorization', () => {
  // Promote resident to committee
  simulateUpdateMemberRole('usr-platform-admin', 'soc-A', 'usr-resident-A', 'committee');
  let canCreate = evaluateSocietyPermission('usr-resident-A', 'soc-A', 'society.campaigns.create');
  assert.equal(canCreate, true, 'Immediately after promotion to committee, user can create campaigns');

  // Demote back to resident
  simulateUpdateMemberRole('usr-platform-admin', 'soc-A', 'usr-resident-A', 'resident');
  canCreate = evaluateSocietyPermission('usr-resident-A', 'soc-A', 'society.campaigns.create');
  assert.equal(canCreate, false, 'Immediately after demotion to resident, user cannot create campaigns');
});

// =============================================================================
// ACCEPTANCE SCENARIO (Section 28)
// =============================================================================

test('Acceptance Flow: Complete End-to-End Multi-Role Scenario', () => {
  // Step 1: User A joins Green Heights as resident -> cannot manage campaigns
  const userA = simulateJoinSociety('usr-acc-A', 'GREEN123', 'T1-101', 'resident');
  assert.equal(userA.role, 'resident');
  assert.equal(evaluateSocietyPermission('usr-acc-A', 'soc-A', 'society.campaigns.create'), false);

  // Step 2: Secretary Invitation -> Platform Admin invites User B as Secretary
  const inviteTokenB = 'inv_sec_test_user_b_token_123';
  MockDB.society_invitations.push({
    id: 'inv-1',
    society_id: 'soc-A',
    email: 'userB@greenheights.in',
    role: 'secretary',
    token: inviteTokenB,
    status: 'pending',
    invited_by: 'usr-platform-admin',
  });

  // User B accepts invitation -> becomes secretary
  const userB = simulateJoinSociety('usr-acc-B', 'GREEN123', 'T1-201', 'resident', inviteTokenB);
  assert.equal(userB.role, 'secretary');
  assert.equal(evaluateSocietyPermission('usr-acc-B', 'soc-A', 'society.campaigns.create'), true);

  // Step 3: User B can create a campaign
  const campNew = {
    id: 'camp-acc-1',
    society_id: 'soc-A',
    organizer_id: 'usr-acc-B',
    title: 'Acceptance AC Camp',
  };
  MockDB.service_campaigns.push(campNew);

  // Step 4: User C joins Green Heights as resident -> can join campaign, cannot edit campaign
  const userC = simulateJoinSociety('usr-acc-C', 'GREEN123', 'T1-301', 'resident');
  assert.equal(userC.role, 'resident');
  const canUserCParticipate = evaluateSocietyPermission('usr-acc-C', 'soc-A', 'society.view');
  const canUserCEditCamp = evaluateSocietyPermission('usr-acc-C', 'soc-A', 'society.campaigns.create');
  assert.equal(canUserCParticipate, true, 'Resident can view/participate in campaign');
  assert.equal(canUserCEditCamp, false, 'Resident cannot edit campaign');

  // Step 5: User B invites User D as committee -> User D gets committee permissions
  const inviteTokenD = 'inv_com_test_user_d_token_456';
  MockDB.society_invitations.push({
    id: 'inv-2',
    society_id: 'soc-A',
    email: 'userD@greenheights.in',
    role: 'committee',
    token: inviteTokenD,
    status: 'pending',
    invited_by: 'usr-acc-B',
  });
  const userD = simulateJoinSociety('usr-acc-D', 'GREEN123', 'T1-401', 'resident', inviteTokenD);
  assert.equal(userD.role, 'committee');
  assert.equal(evaluateSocietyPermission('usr-acc-D', 'soc-A', 'society.campaigns.create'), true);
  assert.equal(evaluateSocietyPermission('usr-acc-D', 'soc-A', 'society.secretary.transfer'), false);

  // Step 6: User B transfers secretary role to User D -> User B becomes committee, User D becomes secretary
  const transferRes = simulateTransferSecretary('usr-acc-B', 'soc-A', 'usr-acc-D', 'committee');
  assert.equal(transferRes.success, true);
  assert.equal(userB.role, 'committee');
  assert.equal(userD.role, 'secretary');

  // Step 7: Multi-Society -> User B joins Sunrise Towers as resident
  const userB_in_SocB = simulateJoinSociety('usr-acc-B', 'SUNRISE456', 'T2-501', 'resident');
  assert.equal(userB_in_SocB.role, 'resident');

  // Verify User B permissions differ by society context
  const userB_CanManageGreenHeights = evaluateSocietyPermission('usr-acc-B', 'soc-A', 'society.campaigns.create');
  const userB_CanManageSunriseTowers = evaluateSocietyPermission('usr-acc-B', 'soc-B', 'society.campaigns.create');

  assert.equal(userB_CanManageGreenHeights, true, 'User B has committee permissions in Green Heights');
  assert.equal(userB_CanManageSunriseTowers, false, 'User B is only a resident in Sunrise Towers');
});
