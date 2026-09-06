-- ==============================================================================
-- Migration: 005_account_deletion.sql
-- Description: Account deletion grace period, audit logging, and automated purge
-- ==============================================================================

-- 1. Create append-only account_lifecycle_logs table
CREATE TABLE IF NOT EXISTS public.account_lifecycle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('deletion_requested', 'deletion_cancelled', 'account_purged')),
  actor_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_logs_user_id ON public.account_lifecycle_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_logs_created_at ON public.account_lifecycle_logs(created_at DESC);

ALTER TABLE public.account_lifecycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lifecycle logs"
  ON public.account_lifecycle_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Enforce append-only immutability
CREATE OR REPLACE FUNCTION public.prevent_lifecycle_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'account_lifecycle_logs is an append-only audit trail and cannot be modified or deleted' USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_lifecycle_logs ON public.account_lifecycle_logs;
CREATE TRIGGER trg_protect_lifecycle_logs
  BEFORE UPDATE OR DELETE ON public.account_lifecycle_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_lifecycle_log_mutation();

-- 2. Create deleted_account_hashes table for anti-abuse bonus prevention
CREATE TABLE IF NOT EXISTS public.deleted_account_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_hash TEXT UNIQUE,
  fingerprint_hash TEXT,
  fp_expires_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deleted_hashes_email ON public.deleted_account_hashes(email_hash);
CREATE INDEX IF NOT EXISTS idx_deleted_hashes_fp ON public.deleted_account_hashes(fingerprint_hash) WHERE fingerprint_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deleted_hashes_fp_expires ON public.deleted_account_hashes(fp_expires_at) WHERE fp_expires_at IS NOT NULL;

ALTER TABLE public.deleted_account_hashes ENABLE ROW LEVEL SECURITY;

-- 3. Generic purge_expired_account RPC (service_role only)
CREATE OR REPLACE FUNCTION public.purge_expired_account(
  p_user_id UUID,
  p_salt TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile RECORD;
  v_email_hash TEXT;
  v_fp_hash TEXT;
  v_result JSONB;
BEGIN
  -- 1. Lock and fetch target profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id USING ERRCODE = 'P0001';
  END IF;

  IF v_profile.deletion_status != 'pending_deletion' THEN
    RAISE EXCEPTION 'Account % is not in pending_deletion status', p_user_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Compute anti-abuse hashes if salt provided
  IF p_salt IS NOT NULL AND p_salt != '' THEN
    IF v_profile.email IS NOT NULL AND v_profile.email != '' THEN
      v_email_hash := encode(hmac(v_profile.email::bytea, p_salt::bytea, 'sha256'), 'hex');
    END IF;

    IF v_profile.device_fingerprint IS NOT NULL AND v_profile.device_fingerprint != '' THEN
      v_fp_hash := encode(hmac(v_profile.device_fingerprint::bytea, p_salt::bytea, 'sha256'), 'hex');
    END IF;

    IF v_email_hash IS NOT NULL OR v_fp_hash IS NOT NULL THEN
      INSERT INTO public.deleted_account_hashes (
        user_id,
        email_hash,
        fingerprint_hash,
        fp_expires_at,
        purged_at
      ) VALUES (
        p_user_id,
        v_email_hash,
        v_fp_hash,
        CASE WHEN v_fp_hash IS NOT NULL THEN NOW() + INTERVAL '180 days' ELSE NULL END,
        NOW()
      )
      ON CONFLICT (email_hash) DO NOTHING;
    END IF;
  END IF;

  -- 3. Delete user activity logs if activity_logs table exists
  BEGIN
    DELETE FROM public.activity_logs WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 4. Handle referral & commission relationships
  BEGIN
    UPDATE public.commission_ledger
    SET payout_status = 'void',
        paid_by_admin_note = COALESCE(paid_by_admin_note || ' | ', '') || '[FORFEITED: Referrer account purged]'
    WHERE referrer_user_id = p_user_id AND payout_status = 'unpaid';

    UPDATE public.referrals
    SET status = 'rejected'
    WHERE referrer_user_id = p_user_id OR referred_user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 5. Anonymize profiles row (preserve row for FK financial ledger integrity)
  UPDATE public.profiles
  SET
    name = 'Deleted User',
    email = NULL,
    avatar_url = NULL,
    preferred_language = 'English',
    theme = 'dark',
    is_premium = FALSE,
    credits = 0,
    referral_code = NULL,
    device_fingerprint = NULL,
    fingerprint_flagged = FALSE,
    fingerprint_count = 0,
    deletion_status = 'purged',
    deletion_ip_address = NULL,
    purged_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 6. Log append-only purge event
  INSERT INTO public.account_lifecycle_logs (
    user_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    p_user_id,
    'account_purged',
    p_user_id,
    jsonb_build_object('purged_at', NOW())
  );

  v_result := jsonb_build_object(
    'status', 'success',
    'user_id', p_user_id
  );

  RETURN v_result;
END;
$$;

-- 4. RPC to scrub IP addresses older than retention window (default: 180 days)
CREATE OR REPLACE FUNCTION public.anonymize_expired_ips(p_retention_days INTEGER DEFAULT 180)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_logs_updated INTEGER := 0;
  v_profiles_updated INTEGER := 0;
BEGIN
  v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;

  UPDATE public.profiles
  SET deletion_ip_address = NULL
  WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at < v_cutoff AND deletion_ip_address IS NOT NULL;

  GET DIAGNOSTICS v_profiles_updated = ROW_COUNT;

  UPDATE public.fingerprint_flag_logs
  SET client_id = 'anonymized'
  WHERE created_at < v_cutoff AND client_id IS NOT NULL AND client_id != 'anonymized';

  GET DIAGNOSTICS v_logs_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'success',
    'cutoff', v_cutoff,
    'profiles_ip_scrubbed', v_profiles_updated,
    'flag_logs_scrubbed', v_logs_updated
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_account(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_account(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_account(UUID, TEXT) FROM anon;

REVOKE EXECUTE ON FUNCTION public.anonymize_expired_ips(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anonymize_expired_ips(INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymize_expired_ips(INTEGER) FROM anon;

GRANT EXECUTE ON FUNCTION public.purge_expired_account(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_expired_ips(INTEGER) TO service_role;
