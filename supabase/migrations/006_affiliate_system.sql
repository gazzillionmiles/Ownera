-- ==============================================================================
-- Migration: 006_affiliate_system.sql
-- Description: Viral referral tracking, affiliate commissions, and dispute flags
-- ==============================================================================

-- 1. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referrals where they are the referrer"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can view referral where they were referred"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referred_user_id);

-- 2. Create commission_ledger table
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_pack_purchase_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  purchase_amount_paid NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  payout_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payout_status IN ('unpaid', 'processing', 'paid', 'void', 'disputed')),
  was_paid_before_dispute BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  paid_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_by_admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_referrer ON public.commission_ledger(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_referred ON public.commission_ledger(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_status ON public.commission_ledger(payout_status);

ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commission records"
  ON public.commission_ledger
  FOR SELECT
  USING (auth.uid() = referrer_user_id);
