-- ==============================================================================
-- Migration: 004_consent_events.sql
-- Description: Append-only legal and terms consent audit trails (GDPR / DPDP)
-- ==============================================================================

-- 1. Create consent_events table for Terms & Privacy Policy acceptance audit trail
CREATE TABLE IF NOT EXISTS public.consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'revoked', 'terms_accepted')),
  auth_provider TEXT NOT NULL DEFAULT 'unknown',
  consent_version TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consent_events_user_created ON public.consent_events(user_id, created_at DESC);

ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent events"
  ON public.consent_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Create affiliate_consents table for Affiliate Agreement clickwrap audit trail
CREATE TABLE IF NOT EXISTS public.affiliate_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_version TEXT NOT NULL,
  agreement_effective_date DATE NOT NULL,
  agreement_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_consents_user_version ON public.affiliate_consents(user_id, agreement_version);
CREATE INDEX IF NOT EXISTS idx_affiliate_consents_user_accepted_at ON public.affiliate_consents(user_id, accepted_at DESC);

ALTER TABLE public.affiliate_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own affiliate consents"
  ON public.affiliate_consents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
