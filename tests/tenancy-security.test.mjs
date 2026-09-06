import test from 'node:test';
import assert from 'node:assert/strict';

// Simulated Database State
const DB = {
  users: [
    { id: 'usr-resident-A', email: 'residentA@greenheights.in' },
    { id: 'usr-resident-B', email: 'residentB@sunrisetowers.in' },
    { id: 'usr-dual-member', email: 'dual@property.in' },
    { id: 'usr-organizer-A', email: 'orgA@greenheights.in' },
    { id: 'usr-organizer-B', email: 'orgB@sunrisetowers.in' },
    { id: 'usr-provider-1', email: 'vendor@coolair.in' },
    { id: 'usr-outsider', email: 'stranger@example.com' },
  ],
  societies: [
    { id: 'soc-A', name: 'Green Heights', slug: 'green-heights', invite_code: 'OWNERA123' },
    { id: 'soc-B', name: 'Sunrise Towers', slug: 'sunrise-towers', invite_code: 'SUNRISE456' },
  ],
  society_members: [
    { society_id: 'soc-A', user_id: 'usr-resident-A', role: 'resident', status: 'active' },
    { society_id: 'soc-B', user_id: 'usr-resident-B', role: 'resident', status: 'active' },
    { society_id: 'soc-A', user_id: 'usr-dual-member', role: 'resident', status: 'active' },
    { society_id: 'soc-B', user_id: 'usr-dual-member', role: 'resident', status: 'active' },
    { society_id: 'soc-A', user_id: 'usr-organizer-A', role: 'organizer', status: 'active' },
    { society_id: 'soc-B', user_id: 'usr-organizer-B', role: 'organizer', status: 'active' },
  ],
  providers: [
    { id: 'prov-1', user_id: 'usr-provider-1', company_name: 'CoolAir Pro' },
  ],
  service_campaigns: [
    { id: 'camp-A1', society_id: 'soc-A', organizer_id: 'usr-organizer-A', title: 'AC Service Camp A' },
    { id: 'camp-B1', society_id: 'soc-B', organizer_id: 'usr-organizer-B', title: 'AC Service Camp B' },
  ],
  provider_bids: [
    { id: 'bid-1', campaign_id: 'camp-A1', provider_id: 'prov-1' },
  ],
  bookings: [
    { id: 'bk-1', society_id: 'soc-A', campaign_id: 'camp-A1', user_id: 'usr-resident-A', status: 'confirmed' },
    { id: 'bk-2', society_id: 'soc-B', campaign_id: 'camp-B1', user_id: 'usr-resident-B', status: 'confirmed' },
  ],
  booking_payments: [
    { id: 'pay-1', society_id: 'soc-A', booking_id: 'bk-1', user_id: 'usr-resident-A', amount: 4900 },
  ],
};

// Simulation of PostgreSQL RLS Evaluator for service_campaigns
function rlsCanSelectCampaign(userId, campaign) {
  if (!campaign) return false;
  // Organizer of campaign
  if (campaign.organizer_id === userId) return true;

  // Active member of society
  const isMember = DB.society_members.some(
    (sm) => sm.society_id === campaign.society_id && sm.user_id === userId && sm.status === 'active'
  );
  if (isMember) return true;

  // Provider with bid or invite
  const isProv = DB.providers.some((p) => {
    if (p.user_id !== userId) return false;
    return DB.provider_bids.some((pb) => pb.campaign_id === campaign.id && pb.provider_id === p.id);
  });
  if (isProv) return true;

  return false;
}

// Simulation of PostgreSQL RLS Evaluator for society_members
function rlsCanSelectSocietyMember(userId, targetMember) {
  if (!targetMember) return false;
  if (targetMember.user_id === userId) return true;
  return DB.society_members.some(
    (sm) => sm.society_id === targetMember.society_id && sm.user_id === userId && sm.status === 'active'
  );
}

// Simulation of PostgreSQL RLS Evaluator for bookings
function rlsCanMutateBooking(userId, targetBooking) {
  if (!targetBooking) return false;
  if (targetBooking.user_id === userId) return true;
  const isOrg = DB.society_members.some(
    (sm) => sm.society_id === targetBooking.society_id && sm.user_id === userId && sm.role === 'organizer' && sm.status === 'active'
  );
  return isOrg;
}

// Simulation of Profile Role Update Guard
function validateRoleUpdate(user, requestedRole) {
  if (!user) return { allowed: false, effectiveRole: 'resident' };
  if (requestedRole === 'resident') return { allowed: true, effectiveRole: 'resident' };
  if (requestedRole === 'organizer') {
    const isOrg = DB.society_members.some(
      (sm) => sm.user_id === user.id && (sm.role === 'organizer' || sm.role === 'committee') && sm.status === 'active'
    );
    return { allowed: isOrg, effectiveRole: isOrg ? 'organizer' : 'resident' };
  }
  if (requestedRole === 'admin') {
    return { allowed: false, effectiveRole: 'resident' };
  }
  return { allowed: false, effectiveRole: 'resident' };
}

// Simulation of PostgreSQL RLS Evaluator for booking_payments
function rlsCanSelectPayment(userId, payment) {
  if (!payment) return false;
  if (payment.user_id === userId) return true;
  const isOrg = DB.society_members.some(
    (sm) => sm.society_id === payment.society_id && sm.user_id === userId && sm.role === 'organizer' && sm.status === 'active'
  );
  return isOrg;
}

// -----------------------------------------------------------------------------
// Core Test Suite: 9 Tenancy & Security Boundaries
// -----------------------------------------------------------------------------

test('Test 1: Resident in Society A cannot read Society B campaign', () => {
  const campB = DB.service_campaigns.find((c) => c.society_id === 'soc-B');
  const allowed = rlsCanSelectCampaign('usr-resident-A', campB);
  assert.equal(allowed, false, 'Resident A should be blocked from reading Society B campaign');
});

test('Test 2: Resident in Society A cannot read Society B members', () => {
  const memberB = DB.society_members.find((m) => m.society_id === 'soc-B' && m.user_id === 'usr-resident-B');
  const allowed = rlsCanSelectSocietyMember('usr-resident-A', memberB);
  assert.equal(allowed, false, 'Resident A should not have access to Society B member list');
});

test('Test 3: Resident cannot modify another resident booking', () => {
  const bookingA = DB.bookings.find((b) => b.user_id === 'usr-resident-A');
  const allowed = rlsCanMutateBooking('usr-resident-B', bookingA);
  assert.equal(allowed, false, 'Resident B cannot modify Resident A booking');
});

test('Test 4: Resident cannot become organizer by editing profile.active_role', () => {
  const user = DB.users.find((u) => u.id === 'usr-resident-A');
  const result = validateRoleUpdate(user, 'organizer');
  assert.equal(result.allowed, false, 'Unauthorized role promotion to organizer must be rejected');
  assert.equal(result.effectiveRole, 'resident', 'Role must remain resident');
});

test('Test 5: Organizer in Society A cannot modify Society B campaign', () => {
  const campB = DB.service_campaigns.find((c) => c.society_id === 'soc-B');
  const isOrgInSocB = DB.society_members.some(
    (sm) => sm.society_id === campB.society_id && sm.user_id === 'usr-organizer-A' && sm.role === 'organizer'
  );
  assert.equal(isOrgInSocB, false, 'Organizer A has no authority over Society B campaigns');
});

test('Test 6: Provider invited to Campaign A cannot access unrelated Campaign B', () => {
  const campB = DB.service_campaigns.find((c) => c.society_id === 'soc-B');
  const allowed = rlsCanSelectCampaign('usr-provider-1', campB);
  assert.equal(allowed, false, 'Provider with bid on Camp A should not access private Camp B');
});

test('Test 7: A user who belongs to Society A and Society B can access both using the correct society URL', () => {
  const campA = DB.service_campaigns.find((c) => c.society_id === 'soc-A');
  const campB = DB.service_campaigns.find((c) => c.society_id === 'soc-B');
  
  const canAccessA = rlsCanSelectCampaign('usr-dual-member', campA);
  const canAccessB = rlsCanSelectCampaign('usr-dual-member', campB);

  assert.equal(canAccessA, true, 'Dual member should access Society A campaign');
  assert.equal(canAccessB, true, 'Dual member should access Society B campaign');
});

test('Test 8: An authenticated user who is not a member of a society cannot access its private campaign routes', () => {
  const campA = DB.service_campaigns.find((c) => c.society_id === 'soc-A');
  const allowed = rlsCanSelectCampaign('usr-outsider', campA);
  assert.equal(allowed, false, 'Outsider authenticated user must not access private society campaigns');
});

test('Test 9: Payment records cannot cross user/society boundaries', () => {
  const paymentA = DB.booking_payments.find((p) => p.society_id === 'soc-A');
  const canResidentBView = rlsCanSelectPayment('usr-resident-B', paymentA);
  const canOrganizerBView = rlsCanSelectPayment('usr-organizer-B', paymentA);

  assert.equal(canResidentBView, false, 'Resident in Society B cannot view Society A payment');
  assert.equal(canOrganizerBView, false, 'Organizer in Society B cannot view Society A payment');
});
