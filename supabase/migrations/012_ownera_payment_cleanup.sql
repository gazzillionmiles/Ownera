-- ==============================================================================
-- Migration: 012_ownera_payment_cleanup.sql
-- Description: Clean, isolated Ownera INR booking payment RPC, payment state machine,
--              and removal of legacy credit/affiliate triggers from Ownera payments.
-- ==============================================================================

-- 1. Update booking_payments status constraint for comprehensive state machine
-- ------------------------------------------------------------------------------
ALTER TABLE public.booking_payments DROP CONSTRAINT IF EXISTS booking_payments_status_check;
ALTER TABLE public.booking_payments ADD CONSTRAINT booking_payments_status_check
  CHECK (status IN ('pending', 'created', 'authorized', 'captured', 'refunded', 'partially_refunded', 'failed', 'disputed'));

-- Ensure unique payment ID constraint when payment is captured
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_payments_razorpay_payment_id_uniq
  ON public.booking_payments(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_status
  ON public.booking_payments(booking_id, status);

CREATE INDEX IF NOT EXISTS idx_booking_payments_user_society
  ON public.booking_payments(user_id, society_id);

-- 2. Dedicated Ownera Payment Processing RPC (Zero Virtual Credits, Zero Affiliate Commissions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_ownera_razorpay_payment(
  p_payment_id TEXT,
  p_order_id TEXT,
  p_amount INTEGER,
  p_currency TEXT,
  p_event_type TEXT,
  p_raw_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_payment RECORD;
  v_payment_order RECORD;
  v_booking RECORD;
  v_existing_payment UUID;
  v_target_order_id TEXT;
  v_event_key TEXT;
  v_booking_id UUID;
  v_society_id UUID;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_target_order_id := p_order_id;
  v_event_key := p_payment_id || '_' || p_event_type;

  -- 1. Idempotency Check: prevent duplicate event processing
  SELECT id INTO v_existing_payment
  FROM public.processed_payments
  WHERE payment_id = v_event_key OR (payment_id = p_payment_id AND event_type = p_event_type)
  LIMIT 1;

  IF v_existing_payment IS NOT NULL THEN
    RAISE LOG '[OwneraPayment] Duplicate event ignored: % for payment %', p_event_type, p_payment_id;
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Event already processed',
      'payment_id', p_payment_id,
      'event_type', p_event_type
    );
  END IF;

  -- If p_order_id is missing, look up from booking_payments or payment_orders
  IF v_target_order_id IS NULL OR v_target_order_id = '' THEN
    SELECT razorpay_order_id INTO v_target_order_id
    FROM public.booking_payments
    WHERE razorpay_payment_id = p_payment_id
    LIMIT 1;
  END IF;

  -- Look up booking_payment record
  IF v_target_order_id IS NOT NULL AND v_target_order_id != '' THEN
    SELECT * INTO v_booking_payment
    FROM public.booking_payments
    WHERE razorpay_order_id = v_target_order_id
    FOR UPDATE;

    SELECT * INTO v_payment_order
    FROM public.payment_orders
    WHERE order_id = v_target_order_id
    FOR UPDATE;
  END IF;

  -- Extract booking & society references
  IF v_booking_payment IS NOT NULL THEN
    v_booking_id := v_booking_payment.booking_id;
    v_society_id := v_booking_payment.society_id;
    v_user_id := v_booking_payment.user_id;
  ELSIF v_payment_order IS NOT NULL AND (v_payment_order.metadata->>'bookingId') IS NOT NULL THEN
    v_booking_id := (v_payment_order.metadata->>'bookingId')::UUID;
    v_society_id := (v_payment_order.metadata->>'societyId')::UUID;
    v_user_id := v_payment_order.user_id;
  END IF;

  -- Fetch associated booking
  IF v_booking_id IS NOT NULL THEN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_booking_id
    FOR UPDATE;
  END IF;

  -- ---------------------------------------------------------------------------
  -- EVENT: payment.captured
  -- ---------------------------------------------------------------------------
  IF p_event_type = 'payment.captured' THEN
    -- If already captured for this order, idempotently return success
    IF v_booking_payment IS NOT NULL AND v_booking_payment.status = 'captured' THEN
      RETURN jsonb_build_object(
        'status', 'already_paid',
        'message', 'Booking payment is already captured',
        'order_id', v_target_order_id,
        'payment_id', p_payment_id
      );
    END IF;

    -- Update or Insert booking_payments
    IF v_booking_payment IS NOT NULL THEN
      UPDATE public.booking_payments
      SET status = 'captured',
          razorpay_payment_id = p_payment_id,
          amount = p_amount,
          raw_payload = p_raw_payload,
          updated_at = NOW()
      WHERE id = v_booking_payment.id;
    ELSIF v_booking_id IS NOT NULL AND v_society_id IS NOT NULL THEN
      INSERT INTO public.booking_payments (
        society_id,
        booking_id,
        user_id,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        currency,
        payment_type,
        status,
        raw_payload
      ) VALUES (
        v_society_id,
        v_booking_id,
        v_user_id,
        COALESCE(v_target_order_id, 'ord_' || p_payment_id),
        p_payment_id,
        p_amount,
        p_currency,
        'deposit',
        'captured',
        p_raw_payload
      )
      ON CONFLICT (razorpay_order_id) DO UPDATE SET
        status = 'captured',
        razorpay_payment_id = EXCLUDED.razorpay_payment_id,
        amount = EXCLUDED.amount,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    END IF;

    -- Update booking status to confirmed
    IF v_booking IS NOT NULL THEN
      UPDATE public.bookings
      SET status = 'confirmed',
          deposit_paid = GREATEST(deposit_paid, (p_amount / 100.0)),
          updated_at = NOW()
      WHERE id = v_booking_id;

      -- Update campaign participant status to confirmed
      UPDATE public.campaign_participants
      SET status = 'confirmed',
          updated_at = NOW()
      WHERE campaign_id = v_booking.campaign_id AND user_id = v_booking.user_id;

      -- Record campaign audit event
      INSERT INTO public.campaign_events (
        campaign_id,
        society_id,
        event_type,
        metadata
      ) VALUES (
        v_booking.campaign_id,
        v_booking.society_id,
        'payment_captured',
        jsonb_build_object(
          'booking_id', v_booking_id,
          'payment_id', p_payment_id,
          'amount_paise', p_amount,
          'amount_rupees', (p_amount / 100.0)
        )
      );
    END IF;

    -- Update payment_orders if exists
    IF v_payment_order IS NOT NULL THEN
      UPDATE public.payment_orders
      SET status = 'paid',
          updated_at = NOW()
      WHERE id = v_payment_order.id;
    END IF;

    -- Record idempotency ledger in processed_payments
    INSERT INTO public.processed_payments (
      payment_id,
      order_id,
      user_id,
      amount,
      status,
      event_type,
      credits_added,
      raw_payload
    ) VALUES (
      p_payment_id,
      COALESCE(v_target_order_id, 'direct_capture'),
      COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
      p_amount,
      'captured',
      p_event_type,
      0, -- Zero virtual credits
      p_raw_payload
    )
    ON CONFLICT (payment_id) DO NOTHING;

    v_result := jsonb_build_object(
      'status', 'success',
      'payment_id', p_payment_id,
      'order_id', v_target_order_id,
      'booking_id', v_booking_id,
      'amount', p_amount,
      'credits_added', 0
    );

  -- ---------------------------------------------------------------------------
  -- EVENT: refund.processed / refund.created
  -- ---------------------------------------------------------------------------
  ELSIF p_event_type IN ('refund.processed', 'refund.created') THEN
    IF v_booking_payment IS NOT NULL THEN
      UPDATE public.booking_payments
      SET status = 'refunded',
          updated_at = NOW()
      WHERE id = v_booking_payment.id;
    END IF;

    IF v_booking IS NOT NULL THEN
      UPDATE public.bookings
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id = v_booking_id;
    END IF;

    IF v_payment_order IS NOT NULL THEN
      UPDATE public.payment_orders
      SET status = 'disputed',
          updated_at = NOW()
      WHERE id = v_payment_order.id;
    END IF;

    INSERT INTO public.processed_payments (
      payment_id,
      order_id,
      user_id,
      amount,
      status,
      event_type,
      credits_added,
      raw_payload
    ) VALUES (
      v_event_key,
      COALESCE(v_target_order_id, 'refund'),
      COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
      p_amount,
      'refunded',
      p_event_type,
      0,
      p_raw_payload
    )
    ON CONFLICT (payment_id) DO NOTHING;

    v_result := jsonb_build_object(
      'status', 'refunded',
      'payment_id', p_payment_id,
      'order_id', v_target_order_id,
      'booking_id', v_booking_id
    );

  -- ---------------------------------------------------------------------------
  -- EVENT: payment.dispute.created / payment.dispute.lost
  -- ---------------------------------------------------------------------------
  ELSIF p_event_type IN ('payment.dispute.created', 'payment.dispute.lost') THEN
    IF v_booking_payment IS NOT NULL THEN
      UPDATE public.booking_payments
      SET status = 'disputed',
          updated_at = NOW()
      WHERE id = v_booking_payment.id;
    END IF;

    IF v_booking IS NOT NULL THEN
      UPDATE public.bookings
      SET status = 'disputed',
          updated_at = NOW()
      WHERE id = v_booking_id;
    END IF;

    INSERT INTO public.processed_payments (
      payment_id,
      order_id,
      user_id,
      amount,
      status,
      event_type,
      credits_added,
      raw_payload
    ) VALUES (
      v_event_key,
      COALESCE(v_target_order_id, 'disputed'),
      COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
      p_amount,
      'disputed',
      p_event_type,
      0,
      p_raw_payload
    )
    ON CONFLICT (payment_id) DO NOTHING;

    v_result := jsonb_build_object(
      'status', 'disputed',
      'payment_id', p_payment_id,
      'order_id', v_target_order_id,
      'booking_id', v_booking_id
    );

  -- ---------------------------------------------------------------------------
  -- EVENT: payment.failed
  -- ---------------------------------------------------------------------------
  ELSIF p_event_type = 'payment.failed' THEN
    IF v_booking_payment IS NOT NULL THEN
      UPDATE public.booking_payments
      SET status = 'failed',
          updated_at = NOW()
      WHERE id = v_booking_payment.id;
    END IF;

    IF v_payment_order IS NOT NULL THEN
      UPDATE public.payment_orders
      SET status = 'failed',
          updated_at = NOW()
      WHERE id = v_payment_order.id;
    END IF;

    INSERT INTO public.processed_payments (
      payment_id,
      order_id,
      user_id,
      amount,
      status,
      event_type,
      credits_added,
      raw_payload
    ) VALUES (
      p_payment_id,
      COALESCE(v_target_order_id, 'failed'),
      COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
      p_amount,
      'failed',
      p_event_type,
      0,
      p_raw_payload
    )
    ON CONFLICT (payment_id) DO NOTHING;

    v_result := jsonb_build_object(
      'status', 'failed',
      'payment_id', p_payment_id,
      'order_id', v_target_order_id
    );

  ELSE
    v_result := jsonb_build_object(
      'status', 'ignored_event',
      'event_type', p_event_type,
      'payment_id', p_payment_id
    );
  END IF;

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Payment already processed (unique violation)',
      'payment_id', p_payment_id
    );
  WHEN OTHERS THEN
    RAISE LOG '[OwneraPayment] Error in process_ownera_razorpay_payment: %', SQLERRM;
    RETURN jsonb_build_object(
      'status', 'error',
      'error_message', SQLERRM,
      'payment_id', p_payment_id
    );
END;
$$;

-- Revoke public access and grant to service_role only
REVOKE EXECUTE ON FUNCTION public.process_ownera_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_ownera_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_ownera_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM anon;

GRANT EXECUTE ON FUNCTION public.process_ownera_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role;
