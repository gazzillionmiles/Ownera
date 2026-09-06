import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/service';

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (err) {
    console.error('[Webhook] Signature verification error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[${requestId}] Webhook received`);

  try {
    // 1. Read raw request body as text for signature verification (Razorpay requirement)
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (!signature) {
      console.warn(`[${requestId}] Missing x-razorpay-signature header`);
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }

    if (!webhookSecret) {
      console.error(`[${requestId}] CRITICAL: RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting webhook.`);
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const isValid = verifySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error(`[${requestId}] Invalid Razorpay webhook signature`);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }
    console.log(`[${requestId}] Signature verified successfully`);

    // 2. Parse payload
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn(`[${requestId}] Invalid JSON payload`);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const event = body.event;

    // Supported webhook events
    const supportedEvents = [
      'payment.captured',
      'payment.failed',
      'refund.processed',
      'refund.created',
      'payment.dispute.created',
      'payment.dispute.lost',
    ];

    if (!supportedEvents.includes(event)) {
      console.log(`[${requestId}] Unsupported event ignored: ${event}`);
      return NextResponse.json({ received: true, status: 'ignored_unsupported_event' }, { status: 200 });
    }

    const paymentEntity = body.payload?.payment?.entity;
    const refundEntity = body.payload?.refund?.entity;
    const disputeEntity = body.payload?.dispute?.entity;

    const paymentId = paymentEntity?.id || refundEntity?.payment_id || disputeEntity?.payment_id;
    const orderId = paymentEntity?.order_id || refundEntity?.order_id || disputeEntity?.order_id || '';
    const amount = paymentEntity?.amount || refundEntity?.amount || disputeEntity?.amount || 0;
    const currency = paymentEntity?.currency || refundEntity?.currency || disputeEntity?.currency || 'INR';

    if (!paymentId) {
      console.warn(`[${requestId}] Missing paymentId in webhook payload for event ${event}`);
      return NextResponse.json({ received: true, message: 'Missing paymentId' }, { status: 200 });
    }

    console.log(`[${requestId}] Processing event=${event} paymentId=${paymentId} orderId=${orderId} amount=${amount}`);

    const supabase = createAdminClient();

    // 3. Call dedicated Ownera payment processor RPC
    // This ensures: validation + idempotency + booking status update + payment record + audit event = atomic (ZERO credits/commissions)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_ownera_razorpay_payment', {
      p_payment_id: paymentId,
      p_order_id: orderId,
      p_amount: amount,
      p_currency: currency,
      p_event_type: event,
      p_raw_payload: body,
    });

    if (rpcError) {
      console.error(`[${requestId}] RPC error:`, rpcError);
      // Return 200 for duplicate to prevent Razorpay retries (per best practices)
      if (rpcError.code === '23505' || rpcError.message?.includes('duplicate')) {
        return NextResponse.json({ received: true, status: 'duplicate' }, { status: 200 });
      }
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }

    const result = rpcResult as any;

    if (result?.status === 'duplicate') {
      console.log(`[${requestId}] Duplicate payment ignored: ${paymentId}`);
      return NextResponse.json({ received: true, status: 'duplicate', paymentId }, { status: 200 });
    }

    if (result?.status === 'already_paid') {
      console.log(`[${requestId}] Order already marked as paid: ${orderId}`);
      return NextResponse.json({ received: true, status: 'already_paid', orderId }, { status: 200 });
    }

    if (result?.status === 'success') {
      console.log(`[${requestId}] SUCCESS: Booking payment captured for payment ${paymentId}, order ${orderId}, booking ${result.booking_id}`);
      return NextResponse.json({
        received: true,
        event,
        status: 'paid',
        paymentId,
        orderId,
        bookingId: result.booking_id,
      }, { status: 200 });
    }

    if (result?.status === 'failed') {
      console.log(`[${requestId}] Payment failed recorded: ${paymentId}`);
      return NextResponse.json({ received: true, event, status: 'failed', paymentId, orderId }, { status: 200 });
    }

    if (result?.status === 'refunded') {
      console.log(`[${requestId}] Payment refund recorded: ${paymentId}`);
      return NextResponse.json({ received: true, event, status: 'refunded', paymentId, orderId }, { status: 200 });
    }

    if (result?.status === 'disputed') {
      console.warn(`[${requestId}] PAYMENT DISPUTE RECORDED: event=${event}, paymentId=${paymentId}`);
      return NextResponse.json({
        received: true,
        event,
        status: 'disputed',
        paymentId,
        orderId,
      }, { status: 200 });
    }

    // Unhandled or other
    console.log(`[${requestId}] Event processed: ${result?.status || 'unhandled'}`);
    return NextResponse.json({ received: true, event, status: result?.status || 'processed' }, { status: 200 });

  } catch (err: any) {
    console.error(`[${requestId}] Webhook exception:`, err);
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 }
    );
  }
}
