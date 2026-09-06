import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTierPrice } from '../lib/ownera/campaigns.ts';

// Complete Simulation Database Model
const MockDB = {
  users: [],
  profiles: [],
  societies: [],
  society_members: [],
  services: [],
  service_campaigns: [],
  campaign_pricing_tiers: [],
  booking_slots: [],
  campaign_participants: [],
  providers: [],
  provider_bids: [],
  bookings: [],
  booking_payments: [],
  service_completions: [],
  service_ratings: [],
};

// Helpers simulating business logic & API handlers
function simulateSignup(userId, email, name) {
  MockDB.users.push({ id: userId, email });
  const profile = {
    id: userId,
    name,
    email,
    active_role: 'resident',
    primary_society_id: null,
  };
  MockDB.profiles.push(profile);
  return profile;
}

function simulateCreateSociety(userId, name, slug, inviteCode, totalHomes, flatNumber) {
  const society = {
    id: `soc_${slug}`,
    name,
    slug,
    invite_code: inviteCode,
    total_homes: totalHomes,
    created_by: userId,
  };
  MockDB.societies.push(society);
  MockDB.society_members.push({
    id: `mem_${userId}_${society.id}`,
    society_id: society.id,
    user_id: userId,
    flat_number: flatNumber,
    role: 'organizer',
    status: 'active',
  });
  const p = MockDB.profiles.find((pr) => pr.id === userId);
  if (p) {
    p.active_role = 'organizer';
    p.primary_society_id = society.id;
  }
  return society;
}

function simulateJoinSociety(userId, inviteCode, flatNumber, role = 'resident') {
  const soc = MockDB.societies.find((s) => s.invite_code === inviteCode);
  if (!soc) throw new Error('Society not found');
  const membership = {
    id: `mem_${userId}_${soc.id}`,
    society_id: soc.id,
    user_id: userId,
    flat_number: flatNumber,
    role,
    status: 'active',
  };
  MockDB.society_members.push(membership);
  const p = MockDB.profiles.find((pr) => pr.id === userId);
  if (p) {
    p.active_role = role;
    p.primary_society_id = soc.id;
  }
  return { society: soc, membership };
}

function simulateCreateCampaign(organizerId, societyId, serviceId, title, eventDate, targetCustomers, pricingTiers) {
  const isOrganizer = MockDB.society_members.some(
    (m) => m.society_id === societyId && m.user_id === organizerId && m.role === 'organizer' && m.status === 'active'
  );
  if (!isOrganizer) throw new Error('Unauthorized');

  const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sortedTiers = [...pricingTiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const startingPrice = sortedTiers[0].price_per_unit;

  const camp = {
    id: campaignId,
    society_id: societyId,
    organizer_id: organizerId,
    service_id: serviceId,
    title,
    event_date: eventDate,
    minimum_customers: 10,
    target_customers: targetCustomers,
    deposit_amount: 49,
    status: 'open',
    current_price: startingPrice,
    selected_provider_id: null,
  };
  MockDB.service_campaigns.push(camp);

  pricingTiers.forEach((t, i) => {
    MockDB.campaign_pricing_tiers.push({
      id: `tier_${campaignId}_${i}`,
      campaign_id: campaignId,
      ...t,
      tier_order: i + 1,
    });
  });

  const slots = [
    { id: `slot_${campaignId}_1`, campaign_id: campaignId, slot_time: '09:00 AM - 10:30 AM', max_capacity: 5, booked_count: 0 },
    { id: `slot_${campaignId}_2`, campaign_id: campaignId, slot_time: '11:00 AM - 12:30 PM', max_capacity: 5, booked_count: 0 },
  ];
  slots.forEach((s) => MockDB.booking_slots.push(s));

  return camp;
}

function simulateExpressInterest(userId, campaignId, quantity = 1, unitIdentifier = 'Flat A-101') {
  const camp = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!camp) throw new Error('Campaign not found');

  const isMember = MockDB.society_members.some(
    (m) => m.society_id === camp.society_id && m.user_id === userId && m.status === 'active'
  );
  if (!isMember) throw new Error('Must be society member');

  let part = MockDB.campaign_participants.find((p) => p.campaign_id === campaignId && p.user_id === userId);
  if (part) {
    part.status = part.status === 'interested' ? 'cancelled' : 'interested';
  } else {
    part = {
      id: `part_${userId}_${campaignId}`,
      campaign_id: campaignId,
      user_id: userId,
      quantity,
      unit_identifier: unitIdentifier,
      status: 'interested',
    };
    MockDB.campaign_participants.push(part);
  }

  // Recalculate price
  const activeCount = MockDB.campaign_participants.filter(
    (p) => p.campaign_id === campaignId && (p.status === 'interested' || p.status === 'confirmed')
  ).reduce((sum, p) => sum + p.quantity, 0);

  const tiers = MockDB.campaign_pricing_tiers.filter((t) => t.campaign_id === campaignId);
  const priceInfo = calculateTierPrice(activeCount, tiers, camp.current_price);
  camp.current_price = priceInfo.currentPrice;

  if (activeCount >= camp.minimum_customers && camp.status === 'open') {
    camp.status = 'threshold_reached';
  }

  return { status: part.status, currentPrice: camp.current_price, campaignStatus: camp.status };
}

function simulateSubmitBid(providerUserId, campaignId, pricePerUnit, maxCapacity) {
  let prov = MockDB.providers.find((p) => p.user_id === providerUserId);
  if (!prov) {
    prov = {
      id: `prov_${providerUserId}`,
      user_id: providerUserId,
      company_name: 'CoolBreeze Solutions',
      rating: 4.8,
      total_jobs_completed: 45,
    };
    MockDB.providers.push(prov);
  }

  const bid = {
    id: `bid_${prov.id}_${campaignId}`,
    campaign_id: campaignId,
    provider_id: prov.id,
    price_per_unit: pricePerUnit,
    max_capacity: maxCapacity,
    status: 'submitted',
  };
  MockDB.provider_bids.push(bid);
  return bid;
}

function simulateSelectProvider(organizerId, campaignId, bidId) {
  const camp = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!camp) throw new Error('Campaign not found');
  if (camp.organizer_id !== organizerId) throw new Error('Unauthorized');

  const bid = MockDB.provider_bids.find((b) => b.id === bidId);
  if (!bid) throw new Error('Bid not found');

  bid.status = 'accepted';
  camp.selected_provider_id = bid.provider_id;
  camp.current_price = bid.price_per_unit;
  camp.status = 'booking_open';

  return { selectedProviderId: bid.provider_id, status: camp.status };
}

function simulateCreateBookingAndSlot(userId, campaignId, flatNumber, quantity, slotId) {
  const camp = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!camp) throw new Error('Campaign not found');

  if (slotId) {
    const slot = MockDB.booking_slots.find((s) => s.id === slotId);
    if (!slot) throw new Error('Slot not found');
    if (slot.booked_count >= slot.max_capacity) {
      throw new Error(`The ${slot.slot_time} time slot is fully booked.`);
    }
    slot.booked_count += 1;
  }

  const unitPrice = camp.current_price;
  const depositPaid = camp.deposit_amount * quantity;
  const totalAmount = unitPrice * quantity;
  const balanceAmount = totalAmount - depositPaid;

  const booking = {
    id: `bk_${userId}_${campaignId}`,
    society_id: camp.society_id,
    campaign_id: campaignId,
    user_id: userId,
    provider_id: camp.selected_provider_id,
    slot_id: slotId,
    flat_number: flatNumber,
    quantity,
    unit_price: unitPrice,
    deposit_paid: depositPaid,
    balance_amount: balanceAmount,
    total_amount: totalAmount,
    status: 'confirmed',
  };
  MockDB.bookings.push(booking);

  // Update participant status to confirmed
  const part = MockDB.campaign_participants.find((p) => p.campaign_id === campaignId && p.user_id === userId);
  if (part) {
    part.status = 'confirmed';
  } else {
    MockDB.campaign_participants.push({
      id: `part_${userId}_${campaignId}`,
      campaign_id: campaignId,
      user_id: userId,
      quantity,
      unit_identifier: flatNumber,
      status: 'confirmed',
    });
  }

  return booking;
}

function simulateProviderCompleteJob(providerUserId, bookingId) {
  const prov = MockDB.providers.find((p) => p.user_id === providerUserId);
  if (!prov) throw new Error('Provider not found');

  const booking = MockDB.bookings.find((b) => b.id === bookingId);
  if (!booking || booking.provider_id !== prov.id) throw new Error('Booking not assigned to provider');

  booking.status = 'completed';
  prov.total_jobs_completed += 1;

  MockDB.service_completions.push({
    id: `comp_${bookingId}`,
    booking_id: bookingId,
    provider_id: prov.id,
    resident_status: 'unconfirmed',
  });

  return { status: 'completed', providerJobs: prov.total_jobs_completed };
}

function simulateResidentRateService(residentUserId, bookingId, rating, review) {
  const booking = MockDB.bookings.find((b) => b.id === bookingId);
  if (!booking || booking.user_id !== residentUserId) throw new Error('Unauthorized');

  const ratingRecord = {
    id: `rate_${bookingId}`,
    booking_id: bookingId,
    user_id: residentUserId,
    provider_id: booking.provider_id,
    campaign_id: booking.campaign_id,
    rating,
    review,
  };
  MockDB.service_ratings.push(ratingRecord);

  // Recalculate provider average
  const allRatings = MockDB.service_ratings.filter((r) => r.provider_id === booking.provider_id);
  const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
  const prov = MockDB.providers.find((p) => p.id === booking.provider_id);
  if (prov) {
    prov.rating = Math.round(avg * 10) / 10;
  }

  return { rating: ratingRecord, newAverage: prov?.rating };
}

// -----------------------------------------------------------------------------
// END-TO-END TEST SUITE
// -----------------------------------------------------------------------------

test('Flow 1: Signup & Profile Provisioning', () => {
  const profile = simulateSignup('usr-1', 'resident@gh.in', 'Amit Sharma');
  assert.equal(profile.name, 'Amit Sharma');
  assert.equal(profile.active_role, 'resident');
});

test('Flow 2: Create & Join Society with invite code', () => {
  const soc = simulateCreateSociety('usr-org-1', 'Green Heights', 'green-heights', 'GH2026', 150, 'T1-101');
  assert.equal(soc.name, 'Green Heights');
  assert.equal(soc.slug, 'green-heights');

  const joinRes = simulateJoinSociety('usr-1', 'GH2026', 'T1-402', 'resident');
  assert.equal(joinRes.society.id, soc.id);
  assert.equal(joinRes.membership.role, 'resident');
});

test('Flow 3: Organizer creates campaign with pricing tiers and default slots', () => {
  const pricingTiers = [
    { min_quantity: 1, max_quantity: 9, price_per_unit: 699 },
    { min_quantity: 10, max_quantity: 19, price_per_unit: 599 },
    { min_quantity: 20, max_quantity: null, price_per_unit: 499 },
  ];

  const camp = simulateCreateCampaign('usr-org-1', 'soc_green-heights', 'serv-ac-1', 'AC Service Camp', '2026-09-01', 25, pricingTiers);
  assert.equal(camp.title, 'AC Service Camp');
  assert.equal(camp.current_price, 699);
  assert.equal(camp.status, 'open');

  const slots = MockDB.booking_slots.filter((s) => s.campaign_id === camp.id);
  assert.equal(slots.length, 2);
  assert.equal(slots[0].max_capacity, 5);
});

test('Flow 4: Residents join campaign & trigger dynamic tier unlocking', () => {
  const camp = MockDB.service_campaigns[0];

  // 1 resident expresses interest (tier 1: ₹699)
  const res1 = simulateExpressInterest('usr-1', camp.id, 1, 'T1-402');
  assert.equal(res1.currentPrice, 699);
  assert.equal(res1.campaignStatus, 'open');

  // Add 9 more residents to reach 10 homes (tier 2: ₹599 & threshold reached)
  for (let i = 2; i <= 10; i++) {
    simulateSignup(`usr-${i}`, `user${i}@gh.in`, `User ${i}`);
    simulateJoinSociety(`usr-${i}`, 'GH2026', `T1-${100 + i}`, 'resident');
    simulateExpressInterest(`usr-${i}`, camp.id, 1, `T1-${100 + i}`);
  }

  assert.equal(camp.current_price, 599, 'Price must drop to ₹599 at 10 participants');
  assert.equal(camp.status, 'threshold_reached', 'Campaign must reach threshold');
});

test('Flow 5: Provider submits competitive bid', () => {
  const camp = MockDB.service_campaigns[0];
  const bid = simulateSubmitBid('usr-prov-1', camp.id, 549, 30);
  assert.equal(bid.price_per_unit, 549);
  assert.equal(bid.status, 'submitted');
});

test('Flow 6: Organizer selects provider bid & opens bookings', () => {
  const camp = MockDB.service_campaigns[0];
  const bid = MockDB.provider_bids.find((b) => b.campaign_id === camp.id);
  const result = simulateSelectProvider('usr-org-1', camp.id, bid.id);

  assert.equal(result.selectedProviderId, 'prov_usr-prov-1');
  assert.equal(result.status, 'booking_open');
  assert.equal(camp.current_price, 549);
});

test('Flow 7: Resident books slot with ₹49 deposit', () => {
  const camp = MockDB.service_campaigns[0];
  const slot = MockDB.booking_slots.find((s) => s.campaign_id === camp.id);

  const booking = simulateCreateBookingAndSlot('usr-1', camp.id, 'T1-402', 1, slot.id);
  assert.equal(booking.deposit_paid, 49);
  assert.equal(booking.balance_amount, 500);
  assert.equal(booking.status, 'confirmed');
  assert.equal(slot.booked_count, 1);
});

test('Flow 8: Full slot capacity rejection prevents double booking', () => {
  const camp = MockDB.service_campaigns[0];
  const slot = MockDB.booking_slots.find((s) => s.campaign_id === camp.id);

  // Fill remaining 4 spots in the slot (capacity = 5)
  for (let i = 2; i <= 5; i++) {
    simulateCreateBookingAndSlot(`usr-${i}`, camp.id, `T1-${100 + i}`, 1, slot.id);
  }
  assert.equal(slot.booked_count, 5);

  // 6th resident attempts to book the same slot -> must be rejected
  assert.throws(
    () => simulateCreateBookingAndSlot('usr-6', camp.id, 'T1-106', 1, slot.id),
    /fully booked/i,
    'Attempt to exceed slot capacity must be rejected'
  );
});

test('Flow 9: Provider sees confirmed bookings & marks completion', () => {
  const booking = MockDB.bookings[0];
  const comp = simulateProviderCompleteJob('usr-prov-1', booking.id);

  assert.equal(comp.status, 'completed');
  assert.equal(booking.status, 'completed');
});

test('Flow 10: Resident rates completed service and updates provider rating', () => {
  const booking = MockDB.bookings[0];
  const ratingRes = simulateResidentRateService('usr-1', booking.id, 5, 'Exceptional technician service!');

  assert.equal(ratingRes.rating.rating, 5);
  assert.equal(ratingRes.newAverage, 5);
});

test('Flow 11: Multi-society user isolation and switching', () => {
  // User 1 is resident in Green Heights
  // Now User 1 also joins Sunrise Towers as organizer
  simulateCreateSociety('usr-org-2', 'Sunrise Towers', 'sunrise-towers', 'SUN2026', 100, 'T2-101');
  simulateJoinSociety('usr-1', 'SUN2026', 'T2-501', 'organizer');

  const memberships = MockDB.society_members.filter((m) => m.user_id === 'usr-1');
  assert.equal(memberships.length, 2, 'User must have 2 active memberships');

  const ghMembership = memberships.find((m) => m.society_id === 'soc_green-heights');
  const sunMembership = memberships.find((m) => m.society_id === 'soc_sunrise-towers');

  assert.equal(ghMembership.role, 'resident');
  assert.equal(sunMembership.role, 'organizer');
});
