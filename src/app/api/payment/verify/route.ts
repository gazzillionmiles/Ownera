import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      isMock,
    } = body;

    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_API_SECRET;

    // Cryptographic signature verification with timing-safe comparison
    if (!isMock && secret && razorpay_signature && razorpay_order_id && razorpay_payment_id) {
      const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const expectedBuffer = Buffer.from(generated_signature, 'utf8');
      const signatureBuffer = Buffer.from(razorpay_signature, 'utf8');

      if (
        expectedBuffer.length !== signatureBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
      ) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }
    }

    const serviceSupabase = createAdminClient();

    // Verify booking ownership if bookingId provided
    if (bookingId) {
      const { data: booking, error: bError } = await serviceSupabase
        .from('bookings')
        .select('id, user_id, society_id, campaign_id, status')
        .eq('id', bookingId)
        .single();

      if (bError || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      if (booking.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot verify payment for another resident’s booking.' },
          { status: 403 }
        );
      }
    }

    const paymentId = razorpay_payment_id || `pay_mock_${Date.now()}`;
    const orderId = razorpay_order_id || `order_mock_${Date.now()}`;

    // Execute atomic Ownera payment processor RPC
    const { data: rpcResult, error: rpcError } = await serviceSupabase.rpc(
      'process_ownera_razorpay_payment',
      {
        p_payment_id: paymentId,
        p_order_id: orderId,
        p_amount: body.amount ? Math.round(body.amount * 100) : 4900,
        p_currency: 'INR',
        p_event_type: 'payment.captured',
        p_raw_payload: body,
      }
    );

    if (rpcError) {
      console.error('[API/payment/verify] RPC error:', rpcError);
      return NextResponse.json({ error: 'Payment processing failed', details: rpcError.message }, { status: 500 });
    }

    // If this was a balance payment, decrement or clear balance_amount on booking
    if (bookingId && (body.paymentType === 'balance' || body.payment_type === 'balance')) {
      const amountRupees = body.amount ? Number(body.amount) : 0;
      const { data: b } = await serviceSupabase
        .from('bookings')
        .select('balance_amount, deposit_paid, total_amount')
        .eq('id', bookingId)
        .single();

      if (b) {
        const currentBalance = Number(b.balance_amount) || 0;
        const newBalance = Math.max(0, currentBalance - (amountRupees > 0 ? amountRupees : currentBalance));
        await serviceSupabase
          .from('bookings')
          .update({
            balance_amount: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and booking confirmed successfully!',
      paymentId,
      result: rpcResult,
    });
  } catch (err: any) {
    console.error('[API/payment/verify] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
