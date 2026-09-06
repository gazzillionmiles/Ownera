import test from 'node:test';
import assert from 'node:assert/strict';

// Simulated In-Memory Database for Payment Architecture Testing
function createTestEnvironment() {
  const DB = {
    users: [
      { id: 'usr-resident-A', email: 'residentA@greenheights.in', credits: 0 },
      { id: 'usr-resident-B', email: 'residentB@sunrisetowers.in', credits: 0 },
    ],
    societies: [
      { id: 'soc-A', name: 'Green Heights', slug: 'green-heights' },
      { id: 'soc-B', name: 'Sunrise Towers', slug: 'sunrise-towers' },
    ],
    society_members: [
      { society_id: 'soc-A', user_id: 'usr-resident-A', role: 'resident', status: 'active' },
      { society_id: 'soc-B', user_id: 'usr-resident-B', role: 'resident', status: 'active' },
    ],
    service_campaigns: [
      { id: 'camp-A', society_id: 'soc-A', title: 'AC Service Camp', deposit_amount: 49, current_price: 549 },
      { id: 'camp-B', society_id: 'soc-B', title: 'Deep Cleaning Camp', deposit_amount: 199, current_price: 1999 },
    ],
    bookings: [
      {
        id: 'bk-A1',
        society_id: 'soc-A',
        campaign_id: 'camp-A',
        user_id: 'usr-resident-A',
        quantity: 1,
        unit_price: 549,
        deposit_paid: 0,
        balance_amount: 500,
        total_amount: 549,
        status: 'confirmed',
      },
      {
        id: 'bk-A2-cancelled',
        society_id: 'soc-A',
        campaign_id: 'camp-A',
        user_id: 'usr-resident-A',
        quantity: 1,
        unit_price: 549,
        deposit_paid: 0,
        balance_amount: 500,
        total_amount: 549,
        status: 'cancelled',
      },
    ],
    booking_payments: [],
    payment_orders: [],
    processed_payments: [],
    campaign_events: [],
    commission_ledger: [], // Legacy table must remain EMPTY for Ownera payments
  };

  // 1. Server-side create-order simulation
  function createOrder({ userId, bookingId, clientSentAmount, paymentType = 'deposit' }) {
    const booking = DB.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return { success: false, error: 'Booking record not found', status: 404 };
    }

    // Security: Check ownership
    if (booking.user_id !== userId) {
      return { success: false, error: 'Forbidden: Cannot pay for another resident’s booking', status: 403 };
    }

    // Security: Check society membership
    const isMember = DB.society_members.some(
      (sm) => sm.society_id === booking.society_id && sm.user_id === userId && sm.status === 'active'
    );
    if (!isMember) {
      return { success: false, error: 'Forbidden: Not a member of this society', status: 403 };
    }

    // Security: Check booking state
    if (booking.status === 'cancelled') {
      return { success: false, error: 'Cannot pay for a cancelled booking', status: 400 };
    }

    // Security: Check if already paid
    const existingPaid = DB.booking_payments.find(
      (bp) => bp.booking_id === bookingId && bp.payment_type === paymentType && bp.status === 'captured'
    );
    if (existingPaid) {
      return { success: false, error: 'Payment for this booking has already been captured', status: 400 };
    }

    const campaign = DB.service_campaigns.find((c) => c.id === booking.campaign_id);
    
    // Server-side amount computation (Never trust clientSentAmount)
    let amountInPaise = 0;
    if (paymentType === 'deposit') {
      amountInPaise = Math.round((campaign?.deposit_amount || 49) * booking.quantity * 100);
    } else {
      amountInPaise = Math.round(booking.balance_amount * 100);
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const paymentRecord = {
      id: `bp_${Date.now()}`,
      society_id: booking.society_id,
      booking_id: booking.id,
      user_id: userId,
      razorpay_order_id: orderId,
      razorpay_payment_id: null,
      amount: amountInPaise,
      currency: 'INR',
      payment_type: paymentType,
      status: 'created',
      created_at: new Date().toISOString(),
    };
    DB.booking_payments.push(paymentRecord);

    return {
      success: true,
      orderId,
      calculatedAmountPaise: amountInPaise,
      calculatedAmountRupees: amountInPaise / 100,
      paymentRecord,
    };
  }

  // 2. Dedicated Ownera RPC Simulation: process_ownera_razorpay_payment
  function processOwneraPaymentRPC({ paymentId, orderId, amount, currency, eventType, rawPayload }) {
    const eventKey = `${paymentId}_${eventType}`;

    // Idempotency check
    const duplicate = DB.processed_payments.find(
      (pp) => pp.payment_id === eventKey || (pp.payment_id === paymentId && pp.event_type === eventType)
    );
    if (duplicate) {
      return { status: 'duplicate', message: 'Event already processed', payment_id: paymentId };
    }

    const bookingPayment = DB.booking_payments.find(
      (bp) => bp.razorpay_order_id === orderId || bp.razorpay_payment_id === paymentId
    );

    if (eventType === 'payment.captured') {
      if (bookingPayment && bookingPayment.status === 'captured') {
        return { status: 'already_paid', message: 'Booking payment already captured', payment_id: paymentId };
      }

      if (bookingPayment) {
        bookingPayment.status = 'captured';
        bookingPayment.razorpay_payment_id = paymentId;
        bookingPayment.amount = amount;
      }

      const booking = bookingPayment ? DB.bookings.find((b) => b.id === bookingPayment.booking_id) : null;
      if (booking) {
        booking.status = 'confirmed';
        booking.deposit_paid = amount / 100;
        booking.balance_amount = booking.total_amount - booking.deposit_paid;

        DB.campaign_events.push({
          campaign_id: booking.campaign_id,
          society_id: booking.society_id,
          event_type: 'payment_captured',
          metadata: { booking_id: booking.id, payment_id: paymentId, amount_rupees: amount / 100 },
        });
      }

      DB.processed_payments.push({
        payment_id: paymentId,
        order_id: orderId,
        amount,
        status: 'captured',
        event_type: eventType,
        credits_added: 0,
      });

      return {
        status: 'success',
        payment_id: paymentId,
        order_id: orderId,
        booking_id: booking?.id,
        amount,
        credits_added: 0,
      };
    } else if (eventType === 'refund.processed') {
      if (bookingPayment) {
        bookingPayment.status = 'refunded';
      }
      const booking = bookingPayment ? DB.bookings.find((b) => b.id === bookingPayment.booking_id) : null;
      if (booking) {
        booking.status = 'cancelled';
      }
      DB.processed_payments.push({
        payment_id: eventKey,
        order_id: orderId,
        amount,
        status: 'refunded',
        event_type: eventType,
        credits_added: 0,
      });
      return { status: 'refunded', payment_id: paymentId, booking_id: booking?.id };
    } else if (eventType === 'payment.failed') {
      if (bookingPayment) {
        bookingPayment.status = 'failed';
      }
      DB.processed_payments.push({
        payment_id: paymentId,
        order_id: orderId,
        amount,
        status: 'failed',
        event_type: eventType,
        credits_added: 0,
      });
      return { status: 'failed', payment_id: paymentId };
    }

    return { status: 'unhandled' };
  }

  return { DB, createOrder, processOwneraPaymentRPC };
}

// -----------------------------------------------------------------------------
// Test Suite: 12 Payment Architecture & Security Requirements
// -----------------------------------------------------------------------------

test('Test 1: Successful ₹49 booking deposit flow', () => {
  const env = createTestEnvironment();
  const orderRes = env.createOrder({
    userId: 'usr-resident-A',
    bookingId: 'bk-A1',
    paymentType: 'deposit',
  });

  assert.equal(orderRes.success, true);
  assert.equal(orderRes.calculatedAmountRupees, 49, 'Deposit must be exactly ₹49');
  assert.equal(orderRes.paymentRecord.status, 'created');

  const captureRes = env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_101',
    orderId: orderRes.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
    rawPayload: {},
  });

  assert.equal(captureRes.status, 'success');
  const booking = env.DB.bookings.find((b) => b.id === 'bk-A1');
  assert.equal(booking.status, 'confirmed');
  assert.equal(booking.deposit_paid, 49);
  assert.equal(booking.balance_amount, 500);
});

test('Test 2: Duplicate webhook does not duplicate payment (Idempotency)', () => {
  const env = createTestEnvironment();
  const orderRes = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });

  // First webhook delivery
  const res1 = env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_dup_1',
    orderId: orderRes.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
    rawPayload: {},
  });
  assert.equal(res1.status, 'success');

  // Second duplicate webhook delivery
  const res2 = env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_dup_1',
    orderId: orderRes.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
    rawPayload: {},
  });
  assert.equal(res2.status, 'duplicate');
  assert.equal(env.DB.processed_payments.length, 1, 'Only one transaction recorded in idempotency ledger');
});

test('Test 3: User cannot pay for another user’s booking', () => {
  const env = createTestEnvironment();
  // Resident B trying to create payment order for Resident A's booking
  const res = env.createOrder({
    userId: 'usr-resident-B',
    bookingId: 'bk-A1',
  });
  assert.equal(res.success, false);
  assert.equal(res.status, 403, 'Cross-user booking payment attempt must be blocked with 403');
});

test('Test 4: User cannot pay for booking in another society', () => {
  const env = createTestEnvironment();
  // Resident B is only a member of Society B
  const res = env.createOrder({
    userId: 'usr-resident-B',
    bookingId: 'bk-A1',
  });
  assert.equal(res.success, false);
  assert.match(res.error, /Forbidden/);
});

test('Test 5: Client cannot manipulate payment amount (Server computes ₹49)', () => {
  const env = createTestEnvironment();
  // Client maliciously sends amount: 1 rupee
  const res = env.createOrder({
    userId: 'usr-resident-A',
    bookingId: 'bk-A1',
    clientSentAmount: 1, // Manipulated
    paymentType: 'deposit',
  });
  assert.equal(res.success, true);
  assert.equal(res.calculatedAmountRupees, 49, 'Server must enforce calculated ₹49 deposit, ignoring client value');
  assert.equal(res.calculatedAmountPaise, 4900);
});

test('Test 6: Cancelled booking cannot accept payment', () => {
  const env = createTestEnvironment();
  const res = env.createOrder({
    userId: 'usr-resident-A',
    bookingId: 'bk-A2-cancelled',
    paymentType: 'deposit',
  });
  assert.equal(res.success, false);
  assert.equal(res.status, 400);
  assert.match(res.error, /cancelled/i);
});

test('Test 7: Already-paid booking cannot create duplicate payment order', () => {
  const env = createTestEnvironment();
  // Order 1
  const o1 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });
  env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_done',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
  });

  // Attempt Order 2 for same booking deposit
  const o2 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });
  assert.equal(o2.success, false);
  assert.equal(o2.status, 400);
  assert.match(o2.error, /already been captured/i);
});

test('Test 8: Failed Razorpay payment leaves booking in correct state', () => {
  const env = createTestEnvironment();
  const o1 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });

  const failRes = env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_failed_1',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.failed',
  });

  assert.equal(failRes.status, 'failed');
  const paymentRecord = env.DB.booking_payments.find((bp) => bp.razorpay_order_id === o1.orderId);
  assert.equal(paymentRecord.status, 'failed');
  const booking = env.DB.bookings.find((b) => b.id === 'bk-A1');
  assert.equal(booking.deposit_paid, 0, 'No deposit credited on failure');
});

test('Test 9: Refund updates payment and booking state correctly', () => {
  const env = createTestEnvironment();
  const o1 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });
  env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_refund_test',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
  });

  const refundRes = env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_refund_test',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'refund.processed',
  });

  assert.equal(refundRes.status, 'refunded');
  const paymentRecord = env.DB.booking_payments.find((bp) => bp.razorpay_order_id === o1.orderId);
  assert.equal(paymentRecord.status, 'refunded');
  const booking = env.DB.bookings.find((b) => b.id === 'bk-A1');
  assert.equal(booking.status, 'cancelled');
});

test('Test 10: Ownera payment does NOT modify user credits', () => {
  const env = createTestEnvironment();
  const initialCredits = env.DB.users[0].credits; // 0

  const o1 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });
  const captureRes = env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_no_credits',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
  });

  assert.equal(captureRes.credits_added, 0, 'Zero credits added');
  assert.equal(env.DB.users[0].credits, initialCredits, 'User credits balance must remain untouched');
});

test('Test 11: Ownera payment does NOT create affiliate commissions', () => {
  const env = createTestEnvironment();
  const o1 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });
  env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_no_affiliate',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
  });

  assert.equal(env.DB.commission_ledger.length, 0, 'Commission ledger must not have any entries created');
});

test('Test 12: Correct booking/society relationship is preserved across payment lifecycle', () => {
  const env = createTestEnvironment();
  const o1 = env.createOrder({ userId: 'usr-resident-A', bookingId: 'bk-A1' });

  const paymentRecord = env.DB.booking_payments.find((bp) => bp.razorpay_order_id === o1.orderId);
  assert.equal(paymentRecord.society_id, 'soc-A', 'Payment must retain exact society_id of booking');
  assert.equal(paymentRecord.booking_id, 'bk-A1');
  assert.equal(paymentRecord.user_id, 'usr-resident-A');

  env.processOwneraPaymentRPC({
    paymentId: 'pay_rzp_rel_1',
    orderId: o1.orderId,
    amount: 4900,
    currency: 'INR',
    eventType: 'payment.captured',
  });

  const campaignEvent = env.DB.campaign_events.find((ce) => ce.metadata.booking_id === 'bk-A1');
  assert.equal(campaignEvent.society_id, 'soc-A', 'Campaign audit event must belong to Society A');
});
