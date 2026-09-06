import test from 'node:test';
import assert from 'node:assert/strict';

// =============================================================================
// Comprehensive Simulation Database Model for Ownera PRD Flow
// =============================================================================
const MockDB = {
  users: [],
  profiles: [],
  societies: [],
  society_members: [],
  services: [
    { id: 'serv-ac', name: 'AC Servicing', category: 'Cooling & HVAC', base_price_estimate: 699, slug: 'ac-servicing' },
    { id: 'serv-pest', name: 'Pest Control', category: 'Pest & Hygiene', base_price_estimate: 899, slug: 'pest-control' },
    { id: 'serv-clean', name: 'Deep Cleaning', category: 'Cleaning', base_price_estimate: 2199, slug: 'deep-cleaning' },
  ],
  service_campaigns: [],
  poll_votes: [],
  campaign_vendor_invites: [],
  providers: [],
  provider_bids: [],
  booking_slots: [],
  bookings: [],
  service_completions: [],
  service_ratings: [],
  service_issues: [],
};

// -----------------------------------------------------------------------------
// Flow Handlers
// -----------------------------------------------------------------------------

function simulateOnboardingProfile(userId, email, name, phone, propertyType, unitNumber, societyName, inviteCode) {
  MockDB.users.push({ id: userId, email });
  const profile = {
    id: userId,
    name,
    email,
    phone,
    property_type: propertyType,
    unit_number: unitNumber,
    active_role: 'resident',
    primary_society_id: null,
  };
  MockDB.profiles.push(profile);

  // Self-serve join/create society (No secretary approval required)
  let soc = MockDB.societies.find((s) => s.invite_code === inviteCode || s.name.toLowerCase() === societyName.toLowerCase());
  if (!soc) {
    soc = {
      id: `soc_${societyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: societyName,
      slug: societyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      invite_code: inviteCode || `SOC${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      total_homes: 150,
      created_by: userId,
    };
    MockDB.societies.push(soc);
  }

  const member = {
    id: `mem_${userId}_${soc.id}`,
    society_id: soc.id,
    user_id: userId,
    flat_number: unitNumber,
    unit_number: unitNumber,
    property_type: propertyType,
    role: soc.created_by === userId ? 'secretary' : 'resident',
    status: 'active',
  };
  MockDB.society_members.push(member);

  profile.primary_society_id = soc.id;
  profile.active_role = member.role;

  return { profile, society: soc, member };
}

function simulateCreatePoll(callerUserId, societyId, scope, title, pollQuestion, pollOptions, targetPropertyUnit = null) {
  const member = MockDB.society_members.find((m) => m.society_id === societyId && m.user_id === callerUserId && m.status === 'active');
  if (!member) throw new Error('Must be society member');

  const isSec = member.role === 'secretary' || member.role === 'committee';
  const approvalStatus = scope === 'my_house' ? 'none' : isSec ? 'approved' : 'pending';
  const initialStatus = scope === 'my_house' ? 'approved' : 'poll_active';

  const poll = {
    id: `poll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    society_id: societyId,
    organizer_id: callerUserId,
    service_id: 'serv-ac',
    title,
    scope,
    target_property_unit: targetPropertyUnit,
    poll_question: pollQuestion,
    poll_options: pollOptions,
    secretary_approval_status: approvalStatus,
    status: initialStatus,
    current_price: 699,
    event_date: '2026-09-06',
    created_at: new Date().toISOString(),
  };
  MockDB.service_campaigns.push(poll);

  // Auto-vote for creator
  MockDB.poll_votes.push({
    id: `pv_${callerUserId}_${poll.id}`,
    campaign_id: poll.id,
    user_id: callerUserId,
    option_selected: pollOptions[0] || 'Yes',
    unit_identifier: targetPropertyUnit || member.unit_number || member.flat_number,
  });

  return poll;
}

function simulateVotePoll(userId, campaignId, optionSelected, unitIdentifier) {
  const poll = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!poll) throw new Error('Poll not found');

  let vote = MockDB.poll_votes.find((pv) => pv.campaign_id === campaignId && pv.user_id === userId);
  if (vote) {
    vote.option_selected = optionSelected;
    vote.unit_identifier = unitIdentifier;
  } else {
    vote = {
      id: `pv_${userId}_${campaignId}`,
      campaign_id: campaignId,
      user_id: userId,
      option_selected: optionSelected,
      unit_identifier: unitIdentifier,
    };
    MockDB.poll_votes.push(vote);
  }
  return vote;
}

function simulateSecretaryApprovePoll(secretaryUserId, campaignId, action, rejectionReason = null) {
  const poll = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!poll) throw new Error('Poll not found');

  const sec = MockDB.society_members.find(
    (m) => m.society_id === poll.society_id && m.user_id === secretaryUserId && (m.role === 'secretary' || m.role === 'committee')
  );
  if (!sec) throw new Error('Forbidden: Secretary authority required');

  if (action === 'approve') {
    poll.secretary_approval_status = 'approved';
    poll.status = 'quotes_invited';
  } else {
    poll.secretary_approval_status = 'rejected';
    poll.rejection_reason = rejectionReason;
    poll.status = 'cancelled';
  }
  return poll;
}

function simulateInviteVendor(callerUserId, campaignId, businessName, phone, whatsappNumber = null) {
  const poll = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!poll) throw new Error('Poll not found');

  const token = `token_${Math.random().toString(36).substring(2, 10)}`;
  const invite = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    campaign_id: campaignId,
    business_name: businessName,
    phone,
    whatsapp_number: whatsappNumber || phone,
    invited_by: callerUserId,
    status: 'invited',
    invite_token: token,
  };
  MockDB.campaign_vendor_invites.push(invite);
  return invite;
}

function simulateSubmitVendorQuote(inviteToken, pricePerUnit, techniciansCount, simultaneousCapacity, estimatedDurationMinutes) {
  const invite = MockDB.campaign_vendor_invites.find((i) => i.invite_token === inviteToken);
  if (!invite) throw new Error('Invalid token');

  // Provider record
  let prov = MockDB.providers.find((p) => p.phone === invite.phone);
  if (!prov) {
    prov = {
      id: `prov_${Math.random().toString(36).substring(2, 6)}`,
      user_id: `usr_${Math.random().toString(36).substring(2, 6)}`,
      company_name: invite.business_name,
      contact_person: invite.business_name,
      phone: invite.phone,
      rating: 4.8,
      total_jobs_completed: 25,
    };
    MockDB.providers.push(prov);
  }

  invite.provider_id = prov.id;
  invite.status = 'quote_submitted';

  const bid = {
    id: `bid_${prov.id}_${invite.campaign_id}`,
    campaign_id: invite.campaign_id,
    provider_id: prov.id,
    vendor_invite_id: invite.id,
    price_per_unit: pricePerUnit,
    technicians_count: techniciansCount,
    simultaneous_capacity: simultaneousCapacity,
    estimated_duration_minutes: estimatedDurationMinutes,
    available_date: '2026-09-06',
    available_start_time: '10:00 AM',
    status: 'submitted',
  };
  MockDB.provider_bids.push(bid);
  return bid;
}

function simulateAcceptQuote(callerUserId, campaignId, bidId) {
  const poll = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!poll) throw new Error('Poll not found');

  const bid = MockDB.provider_bids.find((b) => b.id === bidId && b.campaign_id === campaignId);
  if (!bid) throw new Error('Bid not found');

  MockDB.provider_bids.filter((b) => b.campaign_id === campaignId).forEach((b) => {
    b.status = b.id === bidId ? 'accepted' : 'rejected';
  });

  poll.selected_provider_id = bid.provider_id;
  poll.selected_bid_id = bid.id;
  poll.current_price = bid.price_per_unit;
  poll.status = 'booking_open';

  // Generate dynamic capacity slots
  const simCap = bid.simultaneous_capacity;
  const slots = [
    { id: `slot_${campaignId}_1`, campaign_id: campaignId, slot_time: '10:00 AM - 10:45 AM', max_capacity: simCap, booked_count: 0 },
    { id: `slot_${campaignId}_2`, campaign_id: campaignId, slot_time: '11:00 AM - 11:45 AM', max_capacity: simCap, booked_count: 0 },
    { id: `slot_${campaignId}_3`, campaign_id: campaignId, slot_time: '12:00 PM - 12:45 PM', max_capacity: simCap, booked_count: 0 },
  ];
  slots.forEach((s) => MockDB.booking_slots.push(s));

  return { poll, slots };
}

function simulateBookSlot(userId, campaignId, flatNumber, quantity, slotId) {
  const poll = MockDB.service_campaigns.find((c) => c.id === campaignId);
  if (!poll) throw new Error('Poll not found');

  const slot = MockDB.booking_slots.find((s) => s.id === slotId && s.campaign_id === campaignId);
  if (!slot) throw new Error('Slot not found');

  if (slot.booked_count >= slot.max_capacity) {
    throw new Error('Slot is FULL');
  }
  slot.booked_count += 1;

  const totalAmount = poll.current_price * quantity;
  const booking = {
    id: `bk_${userId}_${campaignId}`,
    society_id: poll.society_id,
    campaign_id: campaignId,
    user_id: userId,
    provider_id: poll.selected_provider_id,
    slot_id: slotId,
    flat_number: flatNumber,
    quantity,
    unit_price: poll.current_price,
    deposit_paid: 0, // ZERO PAYMENTS IN MVP
    balance_amount: totalAmount,
    total_amount: totalAmount,
    payment_mode: 'direct_to_provider',
    status: 'confirmed',
  };
  MockDB.bookings.push(booking);
  return booking;
}

function simulateCompleteJob(providerUserId, bookingId) {
  const booking = MockDB.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error('Booking not found');
  booking.status = 'completed';

  const prov = MockDB.providers.find((p) => p.id === booking.provider_id);
  if (prov) {
    prov.total_jobs_completed += 1;
  }

  MockDB.service_completions.push({
    id: `comp_${bookingId}`,
    booking_id: bookingId,
    provider_id: booking.provider_id,
    resident_status: 'unconfirmed',
  });
  return booking;
}

function simulateResidentConfirmAndRate(residentUserId, bookingId, rating, review) {
  const booking = MockDB.bookings.find((b) => b.id === bookingId && b.user_id === residentUserId);
  if (!booking) throw new Error('Booking not found');

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
  return ratingRecord;
}

// =============================================================================
// TEST SUITE: Ownera Full Lifecycle
// =============================================================================

test('PRD Flow 1 & 2: Onboarding with Property Taxonomy (No Secretary Approval Required to Join)', () => {
  // User 1 signs up with Row House
  const { profile, society, member } = simulateOnboardingProfile(
    'usr-1',
    'resident1@greenheights.in',
    'Rahul Resident',
    '+91 98765 11111',
    'row_house',
    'Row House #4',
    'Green Heights',
    'GH123'
  );

  assert.equal(profile.property_type, 'row_house');
  assert.equal(profile.unit_number, 'Row House #4');
  assert.equal(society.name, 'Green Heights');
  assert.equal(member.status, 'active');
  assert.equal(member.role, 'secretary', 'Creator of society becomes secretary');

  // User 2 joins existing society as Flat resident without needing approval
  const user2 = simulateOnboardingProfile(
    'usr-2',
    'resident2@greenheights.in',
    'Priya Sharma',
    '+91 98765 22222',
    'flat',
    'Flat B-302',
    'Green Heights',
    'GH123'
  );

  assert.equal(user2.member.role, 'resident');
  assert.equal(user2.member.status, 'active');
  assert.equal(user2.profile.property_type, 'flat');
});

test('PRD Flow 4 & 5: Individual "My House" Request (Auto-Approved)', () => {
  const individualPoll = simulateCreatePoll(
    'usr-2',
    MockDB.societies[0].id,
    'my_house',
    'AC Repair for my house',
    'I need AC repair this week',
    ['Yes, need service'],
    'Flat B-302'
  );

  assert.equal(individualPoll.scope, 'my_house');
  assert.equal(individualPoll.secretary_approval_status, 'none');
  assert.equal(individualPoll.status, 'approved', 'Individual request is auto-approved without secretary bottleneck');
});

test('PRD Flow 4 & 6: Society-wide Poll by Resident (Goes to Secretary for Approval)', () => {
  const societyPoll = simulateCreatePoll(
    'usr-2',
    MockDB.societies[0].id,
    'society',
    'AC Service Camp for 30 houses',
    'Who wants AC servicing this Sunday?',
    ['Yes', 'No', 'Basic Clean', 'Deep Clean']
  );

  assert.equal(societyPoll.scope, 'society');
  assert.equal(societyPoll.secretary_approval_status, 'pending', 'Resident-created society campaign requires secretary approval');
  assert.equal(societyPoll.status, 'poll_active');
});

test('PRD Flow 4: Interactive Option Voting on Poll', () => {
  const poll = MockDB.service_campaigns.find((c) => c.scope === 'society');

  // User 3 signs up and votes "Deep Clean"
  simulateOnboardingProfile('usr-3', 'res3@gh.in', 'User 3', '9876533333', 'apartment', 'A-101', 'Green Heights', 'GH123');
  const vote1 = simulateVotePoll('usr-3', poll.id, 'Deep Clean', 'A-101');
  assert.equal(vote1.option_selected, 'Deep Clean');

  // User 4 votes "Yes"
  simulateOnboardingProfile('usr-4', 'res4@gh.in', 'User 4', '9876544444', 'apartment', 'A-102', 'Green Heights', 'GH123');
  const vote2 = simulateVotePoll('usr-4', poll.id, 'Yes', 'A-102');
  assert.equal(vote2.option_selected, 'Yes');

  const pollVotes = MockDB.poll_votes.filter((pv) => pv.campaign_id === poll.id);
  assert.equal(pollVotes.length, 3, 'Creator + User 3 + User 4');
});

test('PRD Flow 6: Secretary Approves Society-wide Campaign for Vendor Quotes', () => {
  const poll = MockDB.service_campaigns.find((c) => c.scope === 'society');
  
  // Non-secretary attempts approval -> must fail
  assert.throws(
    () => simulateSecretaryApprovePoll('usr-3', poll.id, 'approve'),
    /Forbidden/i
  );

  // Secretary (User 1) approves
  const approved = simulateSecretaryApprovePoll('usr-1', poll.id, 'approve');
  assert.equal(approved.secretary_approval_status, 'approved');
  assert.equal(approved.status, 'quotes_invited');
});

test('PRD Flow 7 & 8: Invite Local Vendors with Token & WhatsApp Share Link', () => {
  const poll = MockDB.service_campaigns.find((c) => c.scope === 'society');

  // Invite Vendor A (Local vendor)
  const inviteA = simulateInviteVendor('usr-2', poll.id, 'ABC Services', '+91 98450 11111');
  assert.equal(inviteA.business_name, 'ABC Services');
  assert.equal(inviteA.status, 'invited');
  assert.ok(inviteA.invite_token.startsWith('token_'));

  // Invite Vendor B
  const inviteB = simulateInviteVendor('usr-2', poll.id, 'CoolCare HVAC', '+91 98450 22222');
  assert.equal(inviteB.business_name, 'CoolCare HVAC');

  // Invite Vendor C
  const inviteC = simulateInviteVendor('usr-2', poll.id, 'FastFix Pro', '+91 98450 33333');
  assert.equal(inviteC.business_name, 'FastFix Pro');
});

test('PRD Flow 8, 9 & 10: Multiple Vendors Submit Capacity-Aware Quotes', () => {
  const poll = MockDB.service_campaigns.find((c) => c.scope === 'society');
  const invites = MockDB.campaign_vendor_invites.filter((i) => i.campaign_id === poll.id);

  // Vendor A submits quote: ₹599, 5 technicians, 5 simultaneous houses, 30 min duration
  const quoteA = simulateSubmitVendorQuote(invites[0].invite_token, 599, 5, 5, 30);
  assert.equal(quoteA.price_per_unit, 599);
  assert.equal(quoteA.technicians_count, 5);
  assert.equal(quoteA.simultaneous_capacity, 5);

  // Vendor B submits quote: ₹549, 4 technicians, 4 simultaneous houses
  const quoteB = simulateSubmitVendorQuote(invites[1].invite_token, 549, 4, 4, 30);
  assert.equal(quoteB.price_per_unit, 549);

  // Vendor C submits quote: ₹499, 8 technicians, 8 simultaneous houses
  const quoteC = simulateSubmitVendorQuote(invites[2].invite_token, 499, 8, 8, 30);
  assert.equal(quoteC.price_per_unit, 499);
  assert.equal(quoteC.technicians_count, 8);

  const bids = MockDB.provider_bids.filter((b) => b.campaign_id === poll.id);
  assert.equal(bids.length, 3);
});

test('PRD Flow 11: Campaign Creator Compares Offers & Accepts Best Quote', () => {
  const poll = MockDB.service_campaigns.find((c) => c.scope === 'society');
  const bids = MockDB.provider_bids.filter((b) => b.campaign_id === poll.id);

  // Creator accepts Vendor C (FastFix Pro at ₹499 with 8 technicians capacity)
  const winningBid = bids.find((b) => b.price_per_unit === 499);
  const result = simulateAcceptQuote('usr-2', poll.id, winningBid.id);

  assert.equal(result.poll.selected_bid_id, winningBid.id);
  assert.equal(result.poll.status, 'booking_open');
  assert.equal(result.poll.current_price, 499);

  // Verify non-selected quotes rejected
  const rejectedBids = MockDB.provider_bids.filter((b) => b.campaign_id === poll.id && b.id !== winningBid.id);
  assert.equal(rejectedBids[0].status, 'rejected');
  assert.equal(rejectedBids[1].status, 'rejected');

  // Verify dynamic slots were generated with simultaneous capacity = 8
  assert.equal(result.slots[0].max_capacity, 8);
  assert.equal(result.slots.length, 3);
});

test('PRD Flow 12 & 15: Booking & Slot Selection (Capacity Tracking & Zero Upfront Payments)', () => {
  const poll = MockDB.service_campaigns.find((c) => c.scope === 'society');
  const slot = MockDB.booking_slots.find((s) => s.campaign_id === poll.id);

  // Resident 2 books slot 1
  const booking1 = simulateBookSlot('usr-2', poll.id, 'Flat B-302', 1, slot.id);
  assert.equal(booking1.deposit_paid, 0, 'Zero upfront deposit in MVP');
  assert.equal(booking1.total_amount, 499);
  assert.equal(booking1.payment_mode, 'direct_to_provider');
  assert.equal(slot.booked_count, 1);

  // Fill up remaining 7 spots in the slot (capacity = 8)
  for (let i = 5; i <= 11; i++) {
    simulateOnboardingProfile(`usr-${i}`, `res${i}@gh.in`, `User ${i}`, '9876500000', 'apartment', `B-${300 + i}`, 'Green Heights', 'GH123');
    simulateBookSlot(`usr-${i}`, poll.id, `B-${300 + i}`, 1, slot.id);
  }
  assert.equal(slot.booked_count, 8);

  // 9th resident attempts to book full slot -> rejected as FULL
  simulateOnboardingProfile('usr-12', 'res12@gh.in', 'User 12', '9876500000', 'apartment', 'B-312', 'Green Heights', 'GH123');
  assert.throws(
    () => simulateBookSlot('usr-12', poll.id, 'B-312', 1, slot.id),
    /FULL/i,
    'Attempt to book full slot capacity must be rejected'
  );
});

test('PRD Flow 13: Service Day Schedule & Job Completion by Provider', () => {
  const booking = MockDB.bookings[0];
  const completed = simulateCompleteJob('usr-fastfix-provider', booking.id);
  assert.equal(completed.status, 'completed');
});

test('PRD Flow 14: Resident Rating & Review', () => {
  const booking = MockDB.bookings[0];
  const ratingRecord = simulateResidentConfirmAndRate(booking.user_id, booking.id, 5, 'Superb technician service!');
  assert.equal(ratingRecord.rating, 5);
  assert.equal(ratingRecord.review, 'Superb technician service!');
});
