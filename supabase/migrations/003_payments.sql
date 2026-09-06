-- ==============================================================================
-- Migration: 003_payments.sql
-- Description: Payment orders, webhook processing, and dispute handling
-- ==============================================================================

-- 1. Create payment_orders table
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  credits NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'disputed')),
  receipt TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON public.payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment orders"
  ON public.payment_orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Create processed_payments table for idempotent webhook tracking
CREATE TABLE IF NOT EXISTS public.processed_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  credits_added NUMERIC(10, 2) DEFAULT 0,
  raw_payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_payments_payment_id ON public.processed_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_processed_payments_order_id ON public.processed_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_processed_payments_user_id ON public.processed_payments(user_id);

ALTER TABLE public.processed_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processed payments"
  ON public.processed_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Atomic process_razorpay_payment RPC
CREATE OR REPLACE FUNCTION public.process_razorpay_payment(
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
  v_order RECORD;
  v_existing_payment UUID;
  v_current_credits NUMERIC := 0;
  v_new_credits NUMERIC := 0;
  v_credits_granted NUMERIC := 0;
  v_credits_to_clawback NUMERIC := 0;
  v_result JSONB;
  v_credit_trans_id UUID;
  v_referral RECORD;
  v_purchase_paid_rupees NUMERIC(10, 2);
  v_commission_rupees NUMERIC(10, 2);
  v_commission_row RECORD;
  v_target_order_id TEXT;
  v_was_paid BOOLEAN := FALSE;
  v_new_payout_status TEXT := 'none';
  v_event_key TEXT;
  v_user_id UUID;
  v_target_comm_id UUID;
  v_note_text TEXT;
  v_dispute_count INTEGER := 0;
BEGIN
  v_target_order_id := p_order_id;
  v_event_key := p_payment_id || '_' || p_event_type;

  -- 1. Idempotency check: prevent processing identical payment_id + event_type twice
  SELECT id INTO v_existing_payment
  FROM public.processed_payments
  WHERE payment_id = v_event_key OR (payment_id = p_payment_id AND event_type = p_event_type)
  LIMIT 1;

  IF v_existing_payment IS NOT NULL THEN
    RAISE LOG 'Duplicate event detected: % for payment %', p_event_type, p_payment_id;
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Event already processed',
      'payment_id', p_payment_id,
      'event_type', p_event_type
    );
  END IF;

  -- If p_order_id is missing/empty, look up via processed_payments or payment_orders
  IF v_target_order_id IS NULL OR v_target_order_id = '' THEN
    SELECT order_id INTO v_target_order_id
    FROM public.processed_payments
    WHERE payment_id = p_payment_id
    LIMIT 1;
  END IF;

  -- Lookup order if available
  IF v_target_order_id IS NOT NULL AND v_target_order_id != '' THEN
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE order_id = v_target_order_id
    FOR UPDATE;
  END IF;

  -- If order row was not found by order_id, try finding order by payment_id in processed_payments
  IF v_order IS NULL AND p_payment_id IS NOT NULL THEN
    SELECT po.* INTO v_order
    FROM public.processed_payments pp
    JOIN public.payment_orders po ON po.order_id = pp.order_id
    WHERE pp.payment_id = p_payment_id
    LIMIT 1;
  END IF;

  -- Handle event types
  IF p_event_type = 'payment.captured' THEN
    IF v_order IS NULL THEN
      RAISE EXCEPTION 'Order not found: %', p_order_id USING ERRCODE = 'P0001';
    END IF;

    IF v_order.status = 'paid' THEN
      RAISE LOG 'Order % is already marked as paid. Skipping credit grant.', p_order_id;
      RETURN jsonb_build_object(
        'status', 'already_paid',
        'message', 'Order is already marked as paid',
        'order_id', p_order_id,
        'payment_id', p_payment_id
      );
    END IF;

    IF v_order.amount != p_amount THEN
      RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_order.amount, p_amount USING ERRCODE = 'P0002';
    END IF;

    IF v_order.currency != p_currency THEN
      RAISE EXCEPTION 'Currency mismatch: expected %, got %', v_order.currency, p_currency USING ERRCODE = 'P0003';
    END IF;

    -- Increment credits atomically
    SELECT credits INTO v_current_credits
    FROM public.profiles
    WHERE id = v_order.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile not found for user: %', v_order.user_id USING ERRCODE = 'P0004';
    END IF;

    v_new_credits := COALESCE(v_current_credits, 0) + v_order.credits;

    UPDATE public.profiles
    SET credits = v_new_credits,
        updated_at = NOW()
    WHERE id = v_order.user_id;

    -- Update order status to paid
    UPDATE public.payment_orders
    SET status = 'paid',
        updated_at = NOW()
    WHERE order_id = p_order_id;

    -- Insert into credit_transactions ledger
    INSERT INTO public.credit_transactions (
      user_id,
      amount,
      type,
      reason,
      reference_id,
      balance_after
    ) VALUES (
      v_order.user_id,
      v_order.credits,
      'purchase',
      'Credit pack purchase (' || v_order.credits || ' credits)',
      p_order_id,
      v_new_credits
    )
    ON CONFLICT (reference_id) DO NOTHING
    RETURNING id INTO v_credit_trans_id;

    IF v_credit_trans_id IS NULL THEN
      SELECT id INTO v_credit_trans_id
      FROM public.credit_transactions
      WHERE reference_id = p_order_id;
    END IF;

    -- Insert into processed_payments
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
      p_order_id,
      v_order.user_id,
      p_amount,
      'paid',
      p_event_type,
      v_order.credits,
      p_raw_payload
    )
    ON CONFLICT (payment_id) DO NOTHING;

    -- Check for ACTIVE referral to award affiliate commission if table exists
    BEGIN
      SELECT * INTO v_referral
      FROM public.referrals
      WHERE referred_user_id = v_order.user_id
        AND status = 'active'
      LIMIT 1;

      IF FOUND THEN
        v_purchase_paid_rupees := FLOOR(p_amount / 100.0);
        v_commission_rupees := FLOOR(v_purchase_paid_rupees * 0.20);

        INSERT INTO public.commission_ledger (
          referrer_user_id,
          referred_user_id,
          credit_pack_purchase_id,
          purchase_amount_paid,
          commission_amount,
          payout_status
        ) VALUES (
          v_referral.referrer_user_id,
          v_order.user_id,
          v_credit_trans_id,
          v_purchase_paid_rupees,
          v_commission_rupees,
          'unpaid'
        );
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- In case referrals table is not installed
      NULL;
    END;

    v_result := jsonb_build_object(
      'status', 'success',
      'credits_added', v_order.credits,
      'new_balance', v_new_credits,
      'payment_id', p_payment_id,
      'order_id', p_order_id
    );

  ELSIF p_event_type IN ('refund.processed', 'refund.created', 'payment.dispute.created', 'payment.dispute.lost') THEN
    v_user_id := NULL;

    IF v_order IS NOT NULL THEN
      v_user_id := v_order.user_id;
      v_target_order_id := v_order.order_id;
      v_credits_granted := COALESCE(v_order.credits, 0);

      UPDATE public.payment_orders
      SET status = 'disputed',
          updated_at = NOW()
      WHERE order_id = v_target_order_id;

      SELECT id INTO v_credit_trans_id
      FROM public.credit_transactions
      WHERE reference_id = v_target_order_id
      LIMIT 1;
    END IF;

    IF v_user_id IS NULL AND v_target_order_id IS NOT NULL THEN
      SELECT user_id, credits INTO v_user_id, v_credits_granted FROM public.payment_orders WHERE order_id = v_target_order_id LIMIT 1;
    END IF;

    IF v_user_id IS NULL AND p_payment_id IS NOT NULL THEN
      SELECT user_id INTO v_user_id FROM public.processed_payments WHERE payment_id = p_payment_id LIMIT 1;
    END IF;

    -- Clawback credits & flag profile
    IF v_user_id IS NOT NULL THEN
      SELECT credits, COALESCE(dispute_count, 0) INTO v_current_credits, v_dispute_count
      FROM public.profiles
      WHERE id = v_user_id
      FOR UPDATE;

      IF FOUND THEN
        v_current_credits := COALESCE(v_current_credits, 0);
        v_new_credits := GREATEST(0, v_current_credits - v_credits_granted);
        v_credits_to_clawback := v_current_credits - v_new_credits;
        v_dispute_count := v_dispute_count + 1;

        UPDATE public.profiles
        SET credits = v_new_credits,
            disputed_payment_flag = TRUE,
            dispute_count = v_dispute_count,
            updated_at = NOW()
        WHERE id = v_user_id;

        INSERT INTO public.credit_transactions (
          user_id,
          amount,
          type,
          reason,
          reference_id,
          balance_after
        ) VALUES (
          v_user_id,
          -v_credits_to_clawback,
          'clawback',
          'Credit clawback due to ' || p_event_type || ' (' || v_credits_granted || ' credits granted)',
          v_event_key,
          v_new_credits
        )
        ON CONFLICT (reference_id) DO NOTHING;
      END IF;
    END IF;

    -- Void/dispute commission ledger if exists
    BEGIN
      IF v_credit_trans_id IS NOT NULL THEN
        SELECT * INTO v_commission_row
        FROM public.commission_ledger
        WHERE credit_pack_purchase_id = v_credit_trans_id
        LIMIT 1;
      END IF;

      IF (NOT FOUND OR v_commission_row.id IS NULL) AND v_user_id IS NOT NULL THEN
        SELECT * INTO v_commission_row
        FROM public.commission_ledger
        WHERE referred_user_id = v_user_id
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;

      IF v_commission_row.id IS NOT NULL THEN
        v_target_comm_id := v_commission_row.id;
        v_was_paid := (v_commission_row.payout_status = 'paid');
        v_new_payout_status := CASE WHEN v_was_paid THEN 'disputed' ELSE 'void' END;

        v_note_text := COALESCE(v_commission_row.paid_by_admin_note, '') ||
          ' [' || UPPER(p_event_type) || ' RECEIVED: Payment ' || p_payment_id ||
          CASE WHEN v_was_paid THEN ' - CLAWED BACK AFTER PAYOUT]' ELSE ' - VOIDED]' END;

        UPDATE public.commission_ledger
        SET payout_status = v_new_payout_status,
            was_paid_before_dispute = v_was_paid,
            paid_by_admin_note = v_note_text
        WHERE id = v_target_comm_id;
      ELSE
        v_new_payout_status := 'none';
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    IF v_user_id IS NOT NULL AND v_target_order_id IS NOT NULL THEN
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
        v_target_order_id,
        v_user_id,
        p_amount,
        'disputed',
        p_event_type,
        0,
        p_raw_payload
      )
      ON CONFLICT (payment_id) DO NOTHING;
    END IF;

    v_result := jsonb_build_object(
      'status', 'disputed',
      'event_type', p_event_type,
      'payment_id', p_payment_id,
      'order_id', v_target_order_id,
      'user_id', v_user_id,
      'previous_balance', v_current_credits,
      'credits_granted', v_credits_granted,
      'credits_clawed_back', v_credits_to_clawback,
      'new_balance', v_new_credits,
      'dispute_count', v_dispute_count,
      'payout_status', v_new_payout_status,
      'was_paid_before_dispute', v_was_paid
    );

  ELSIF p_event_type = 'payment.failed' THEN
    IF v_order IS NOT NULL THEN
      UPDATE public.payment_orders
      SET status = 'failed',
          updated_at = NOW()
      WHERE order_id = v_target_order_id;

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
        v_target_order_id,
        v_order.user_id,
        p_amount,
        'failed',
        p_event_type,
        0,
        p_raw_payload
      )
      ON CONFLICT (payment_id) DO NOTHING;
    END IF;

    v_result := jsonb_build_object(
      'status', 'failed',
      'payment_id', p_payment_id,
      'order_id', v_target_order_id
    );

  ELSE
    IF v_order IS NOT NULL THEN
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
        v_target_order_id,
        v_order.user_id,
        p_amount,
        'unhandled',
        p_event_type,
        0,
        p_raw_payload
      )
      ON CONFLICT (payment_id) DO NOTHING;
    END IF;

    v_result := jsonb_build_object(
      'status', 'unhandled',
      'event_type', p_event_type,
      'payment_id', p_payment_id
    );
  END IF;

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Payment already processed (unique constraint)',
      'payment_id', p_payment_id
    );
  WHEN OTHERS THEN
    RAISE LOG 'Error in process_razorpay_payment: %', SQLERRM;
    RETURN jsonb_build_object(
      'status', 'error',
      'error_message', SQLERRM,
      'payment_id', p_payment_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM anon;

GRANT EXECUTE ON FUNCTION public.process_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role;
