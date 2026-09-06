-- ==============================================================================
-- Migration: 002_credit_system.sql
-- Description: Double-entry credit ledger and atomic stored procedures
-- ==============================================================================

-- 1. Create credit_transactions ledger table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'purchase',
    'bonus',
    'usage',
    'refund',
    'admin',
    'clawback',
    'payment_addition',
    'usage_deduction',
    'refund_addition',
    'admin_adjustment',
    'welcome_bonus',
    'promo_claim'
  )),
  reason TEXT NOT NULL,
  reference_id TEXT UNIQUE,
  balance_after NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference_id ON public.credit_transactions(reference_id);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Atomic consume_credits RPC (SECURITY DEFINER, service_role only)
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_current_credits NUMERIC;
  v_new_credits NUMERIC;
  v_existing_tx RECORD;
  v_result JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to consume credits' USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive: %', p_amount USING ERRCODE = 'P0002';
  END IF;

  -- 1. Idempotency Check: if reference_id already processed, return existing balance
  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_existing_tx
    FROM public.credit_transactions
    WHERE reference_id = p_reference_id
    LIMIT 1;

    IF FOUND THEN
      SELECT credits INTO v_current_credits
      FROM public.profiles
      WHERE id = v_user_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent', true,
        'message', 'Transaction already processed',
        'credits_deducted', 0,
        'new_balance', v_current_credits,
        'reference_id', p_reference_id
      );
    END IF;
  END IF;

  -- 2. Lock profile row FOR UPDATE
  SELECT credits INTO v_current_credits
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user: %', v_user_id USING ERRCODE = 'P0001';
  END IF;

  -- 3. Check sufficient balance
  IF COALESCE(v_current_credits, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'status', 'insufficient_credits',
      'current_balance', COALESCE(v_current_credits, 0),
      'required', p_amount,
      'shortfall', p_amount - COALESCE(v_current_credits, 0)
    );
  END IF;

  -- 4. Deduct credits
  v_new_credits := v_current_credits - p_amount;

  UPDATE public.profiles
  SET credits = v_new_credits,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 5. Record immutable ledger transaction
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    reason,
    reference_id,
    balance_after
  ) VALUES (
    v_user_id,
    -p_amount,
    'usage',
    COALESCE(p_reason, 'Usage deduction'),
    p_reference_id,
    v_new_credits
  );

  v_result := jsonb_build_object(
    'status', 'success',
    'idempotent', false,
    'credits_deducted', p_amount,
    'new_balance', v_new_credits,
    'reference_id', p_reference_id
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    SELECT credits INTO v_current_credits
    FROM public.profiles
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'status', 'success',
      'idempotent', true,
      'message', 'Transaction already processed (concurrent)',
      'credits_deducted', 0,
      'new_balance', v_current_credits,
      'reference_id', p_reference_id
    );
  WHEN OTHERS THEN
    RAISE LOG 'Error in consume_credits: %', SQLERRM;
    RAISE;
END;
$$;

-- 3. Atomic refund_credits RPC (SECURITY DEFINER, service_role only)
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_id TEXT,
  p_original_reference_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_current_credits NUMERIC;
  v_new_credits NUMERIC;
  v_existing_tx RECORD;
  v_result JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to refund credits' USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive: %', p_amount USING ERRCODE = 'P0002';
  END IF;

  -- 1. Idempotency Check: if refund reference_id already processed
  IF p_reference_id IS NOT NULL THEN
    SELECT * INTO v_existing_tx
    FROM public.credit_transactions
    WHERE reference_id = p_reference_id
    LIMIT 1;

    IF FOUND THEN
      SELECT credits INTO v_current_credits
      FROM public.profiles
      WHERE id = v_user_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent', true,
        'message', 'Refund already processed',
        'credits_refunded', 0,
        'new_balance', v_current_credits,
        'reference_id', p_reference_id
      );
    END IF;
  END IF;

  -- 2. Lock profile row FOR UPDATE
  SELECT credits INTO v_current_credits
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user: %', v_user_id USING ERRCODE = 'P0001';
  END IF;

  -- 3. Add refunded credits
  v_new_credits := COALESCE(v_current_credits, 0) + p_amount;

  UPDATE public.profiles
  SET credits = v_new_credits,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 4. Record immutable refund transaction
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    reason,
    reference_id,
    balance_after
  ) VALUES (
    v_user_id,
    p_amount,
    'refund',
    COALESCE(p_reason, 'Operation failure refund'),
    p_reference_id,
    v_new_credits
  );

  v_result := jsonb_build_object(
    'status', 'success',
    'idempotent', false,
    'credits_refunded', p_amount,
    'new_balance', v_new_credits,
    'reference_id', p_reference_id,
    'original_reference_id', p_original_reference_id
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    SELECT credits INTO v_current_credits
    FROM public.profiles
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'status', 'success',
      'idempotent', true,
      'message', 'Refund already processed (concurrent)',
      'credits_refunded', 0,
      'new_balance', v_current_credits,
      'reference_id', p_reference_id
    );
  WHEN OTHERS THEN
    RAISE LOG 'Error in refund_credits: %', SQLERRM;
    RAISE;
END;
$$;

-- 4. Atomic grant_welcome_credits_atomic RPC
CREATE OR REPLACE FUNCTION public.grant_welcome_credits_atomic(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_already_granted BOOLEAN;
  v_current_credits NUMERIC;
  v_new_credits NUMERIC;
BEGIN
  SELECT welcome_credit_granted, credits
  INTO v_already_granted, v_current_credits
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'profile_not_found');
  END IF;

  IF v_already_granted THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'welcome_credits_already_claimed');
  END IF;

  v_new_credits := COALESCE(v_current_credits, 0) + p_amount;

  UPDATE public.profiles
  SET
    welcome_credit_granted = TRUE,
    credits = v_new_credits,
    updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    reason,
    reference_id,
    balance_after
  ) VALUES (
    p_user_id,
    p_amount,
    'bonus',
    'welcome_bonus',
    'welcome_' || p_user_id,
    v_new_credits
  )
  ON CONFLICT (reference_id) DO NOTHING;

  RETURN jsonb_build_object(
    'granted', true,
    'credits_granted', p_amount,
    'new_balance', v_new_credits,
    'reason', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Revoke direct public execution, grant strictly to service_role
REVOKE EXECUTE ON FUNCTION public.consume_credits(NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_credits(NUMERIC, TEXT, TEXT, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credits(NUMERIC, TEXT, TEXT, UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.refund_credits(NUMERIC, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_credits(NUMERIC, TEXT, TEXT, TEXT, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(NUMERIC, TEXT, TEXT, TEXT, UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.grant_welcome_credits_atomic(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_welcome_credits_atomic(UUID, NUMERIC) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_welcome_credits_atomic(UUID, NUMERIC) FROM anon;

GRANT EXECUTE ON FUNCTION public.consume_credits(NUMERIC, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(NUMERIC, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_welcome_credits_atomic(UUID, NUMERIC) TO service_role;
