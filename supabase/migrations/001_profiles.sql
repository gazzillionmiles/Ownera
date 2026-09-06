-- ==============================================================================
-- Migration: 001_profiles.sql
-- Description: Core user profiles, security triggers, and anti-abuse logs
-- ==============================================================================

-- 1. Helper function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN := TRUE;
BEGIN
  WHILE code_exists LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = result) INTO code_exists;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'English',
  theme TEXT DEFAULT 'dark',
  is_premium BOOLEAN DEFAULT FALSE,
  credits NUMERIC(10, 2) DEFAULT 0 NOT NULL,
  welcome_credit_granted BOOLEAN DEFAULT FALSE NOT NULL,
  
  -- Affiliate & Referral program
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  affiliate_status TEXT DEFAULT 'none' CHECK (affiliate_status IN ('none', 'pending', 'active', 'suspended')),
  affiliate_enrolled_at TIMESTAMPTZ,
  affiliate_instagram TEXT,
  affiliate_upi_id TEXT,
  disputed_payment_flag BOOLEAN DEFAULT FALSE,
  dispute_count INTEGER DEFAULT 0,
  
  -- Anti-abuse & Fingerprinting
  device_fingerprint TEXT,
  fingerprint_flagged BOOLEAN DEFAULT FALSE,
  fingerprint_count INTEGER DEFAULT 1,
  
  -- Lifecycle & Account Deletion (30-day grace period)
  deletion_status TEXT DEFAULT 'active' CHECK (deletion_status IN ('active', 'pending_deletion', 'purged')),
  deletion_requested_at TIMESTAMPTZ,
  scheduled_purge_at TIMESTAMPTZ,
  deletion_reason TEXT,
  deletion_ip_address TEXT,
  restored_at TIMESTAMPTZ,
  restoration_count INTEGER DEFAULT 0,
  purged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_device_fingerprint ON public.profiles(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_status ON public.profiles(deletion_status);
CREATE INDEX IF NOT EXISTS idx_profiles_scheduled_purge ON public.profiles(scheduled_purge_at) WHERE deletion_status = 'pending_deletion';
CREATE INDEX IF NOT EXISTS idx_profiles_disputed_flag ON public.profiles(disputed_payment_flag) WHERE disputed_payment_flag = TRUE;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view own profile; mutations must go via server-side service role
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 5. Anti-Tamper Trigger: Protect financial/entitlement columns
CREATE OR REPLACE FUNCTION public.protect_profile_financial_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(
    current_setting('request.jwt.claim.role', true),
    auth.role(),
    ''
  );

  IF v_role <> 'service_role' THEN
    IF NEW.credits IS DISTINCT FROM OLD.credits THEN
      RAISE EXCEPTION 'Direct client modification of credit balance is forbidden.' USING ERRCODE = '42501';
    END IF;

    IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
      RAISE EXCEPTION 'Direct client modification of premium entitlement is forbidden.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_financial ON public.profiles;
CREATE TRIGGER trg_protect_profile_financial
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_financial_columns();

-- 6. Auth Trigger: Automatically provision profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    avatar_url,
    preferred_language,
    theme,
    is_premium,
    credits,
    referral_code
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'English',
    'dark',
    FALSE,
    0,
    public.generate_unique_referral_code()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    referral_code = COALESCE(public.profiles.referral_code, public.generate_unique_referral_code()),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Anti-Abuse Fingerprint Flag Logs
CREATE TABLE IF NOT EXISTS public.fingerprint_flag_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id TEXT,
  device_fingerprint TEXT NOT NULL,
  event_type TEXT NOT NULL,
  matching_user_ids JSONB DEFAULT '[]'::jsonb,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fingerprint_flag_logs_fp ON public.fingerprint_flag_logs(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_fingerprint_flag_logs_user ON public.fingerprint_flag_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fingerprint_flag_logs_created_at ON public.fingerprint_flag_logs(created_at DESC);

ALTER TABLE public.fingerprint_flag_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fingerprint flag logs"
  ON public.fingerprint_flag_logs
  FOR SELECT
  USING (auth.uid() = user_id);
