import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import {
  getClientIp,
  checkPaymentOrderRateLimit,
  createRateLimitResponse,
} from '@/lib/ratelimit';
import { requireSocietyMember } from '@/lib/ownera/auth';
import { createErrorResponse } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user using Supabase SSR
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to proceed with payment.' },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(request);
    const rateLimitResult = await checkPaymentOrderRateLimit(user.id, clientIp);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        'Too many order creation attempts. Please wait a few moments.'
      );
    }

    // 2. Parse request payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { bookingId, campaignId, paymentType = 'deposit' } = body;

    if (!bookingId && !campaignId) {
      return NextResponse.json(
        {
          error:
            'Missing bookingId. A valid booking is required to initiate service payment.',
        },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();

    let targetBooking: any = null;
    let targetCampaign: any = null;

    if (bookingId) {
      const { data: booking, error: bErr } = await serviceSupabase
        .from('bookings')
        .select(
          `
          *,
          campaign:service_campaigns(*),
          society:societies(*)
        `
        )
        .eq('id', bookingId)
        .single();

      if (bErr || !booking) {
        return NextResponse.json(
          { error: 'Booking record not found' },
          { status: 404 }
        );
      }

      // Security: Validate user ownership
      if (booking.user_id !== user.id) {
        return NextResponse.json(
          {
            error:
              'Forbidden: You cannot initiate payment for another resident’s booking.',
          },
          { status: 403 }
        );
      }

      // Security: Validate booking state
      if (booking.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Cannot pay for a cancelled booking.' },
          { status: 400 }
        );
      }

      // Security: Check if already paid
      const { data: existingPayment } = await serviceSupabase
        .from('booking_payments')
        .select('id, status')
        .eq('booking_id', bookingId)
        .eq('payment_type', paymentType)
        .eq('status', 'captured')
        .maybeSingle();

      if (existingPayment) {
        return NextResponse.json(
          { error: 'Payment for this booking has already been captured.' },
          { status: 400 }
        );
      }

      targetBooking = booking;
      targetCampaign = booking.campaign;
    } else if (campaignId) {
      const { data: campaign, error: cErr } = await serviceSupabase
        .from('service_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (cErr || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }

      targetCampaign = campaign;
    }

    // Security: Validate active society membership
    const targetSocietyId =
      targetBooking?.society_id || targetCampaign?.society_id;
    try {
      await requireSocietyMember(supabase, user.id, targetSocietyId);
    } catch (memErr: any) {
      return NextResponse.json(
        {
          error:
            'Forbidden: You must be an active member of this society to initiate payment.',
        },
        { status: 403 }
      );
    }

    // 3. Calculate Amount Strictly Server-Side
    let amountInPaise = 0;
    const quantity = targetBooking?.quantity || body.quantity || 1;
    const depositPerUnit = targetCampaign?.deposit_amount || 49;

    if (paymentType === 'deposit') {
      amountInPaise = Math.round(depositPerUnit * quantity * 100);
    } else if (paymentType === 'balance') {
      const balanceRupees =
        targetBooking?.balance_amount ||
        (targetCampaign?.current_price - depositPerUnit) * quantity;
      amountInPaise = Math.round(balanceRupees * 100);
    } else {
      // Full payment
      const fullPrice = targetCampaign?.current_price || 699;
      amountInPaise = Math.round(fullPrice * quantity * 100);
    }

    const description = `Ownera ${paymentType === 'deposit' ? 'Deposit' : 'Payment'} for ${targetCampaign?.title || 'Service'}`;

    const notes: Record<string, string> = {
      userId: user.id,
      societyId: targetSocietyId,
      campaignId: targetCampaign?.id || '',
      paymentType,
    };
    if (targetBooking?.id) {
      notes.bookingId = targetBooking.id;
    }

    // 4. Initialize Razorpay SDK
    const keyId =
      process.env.RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_API_KEY ||
      'rzp_test_placeholder';
    const keySecret =
      process.env.RAZORPAY_KEY_SECRET ||
      process.env.RAZORPAY_API_SECRET ||
      'test_secret_placeholder';

    // Mock order for local test development
    if (keyId === 'rzp_test_placeholder' || !process.env.RAZORPAY_KEY_ID) {
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Store created booking_payment state
      if (targetBooking?.id) {
        await serviceSupabase.from('booking_payments').insert({
          society_id: targetSocietyId,
          booking_id: targetBooking.id,
          user_id: user.id,
          razorpay_order_id: mockOrderId,
          amount: amountInPaise,
          currency: 'INR',
          payment_type: paymentType,
          status: 'created',
          raw_payload: { isMock: true, notes },
        });
      }

      return NextResponse.json({
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        publishableKey: keyId,
        isMock: true,
        description,
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const receiptId = `rcpt_${user.id.substring(0, 8)}_${Date.now()}`;
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      notes,
    };

    let order;
    try {
      order = await razorpay.orders.create(orderOptions);
    } catch (rzpError: any) {
      return createErrorResponse(
        'PaymentGateway',
        'createRazorpayOrder',
        rzpError,
        'Failed to create order with Razorpay',
        502,
        { userId: user.id, bookingId: targetBooking?.id }
      );
    }

    // 5. Store booking_payment in 'created' state
    if (targetBooking?.id) {
      try {
        await serviceSupabase.from('booking_payments').insert({
          society_id: targetSocietyId,
          booking_id: targetBooking.id,
          user_id: user.id,
          razorpay_order_id: order.id,
          amount: amountInPaise,
          currency: 'INR',
          payment_type: paymentType,
          status: 'created',
          raw_payload: { order, notes },
        });
      } catch (dbErr) {
        console.error(
          '[API/payment/create-order] DB error inserting booking_payments:',
          dbErr
        );
      }
    }

    // 6. Store in payment_orders for order history tracking
    try {
      await serviceSupabase.from('payment_orders').insert({
        user_id: user.id,
        order_id: order.id,
        amount: amountInPaise,
        currency: 'INR',
        credits: 0,
        status: 'created',
        receipt: receiptId,
        metadata: notes,
      });
    } catch (dbErr) {
      console.error(
        '[API/payment/create-order] DB error saving payment_order:',
        dbErr
      );
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      publishableKey: keyId,
      description,
      isMock: false,
    });
  } catch (err: any) {
    return createErrorResponse(
      'API',
      'paymentCreateOrderException',
      err,
      'Internal server error',
      500
    );
  }
}
