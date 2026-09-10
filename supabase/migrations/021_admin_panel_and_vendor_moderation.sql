-- ==============================================================================
-- Migration: 021_admin_panel_and_vendor_moderation.sql
-- Description: Vendor status moderation ('pending', 'verified', 'rejected', 'banned')
--              and database-backed platform administrator records.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Update providers verification_status constraint to include 'banned'
  ALTER TABLE public.providers DROP CONSTRAINT IF EXISTS providers_verification_status_check;
  ALTER TABLE public.providers ADD CONSTRAINT providers_verification_status_check 
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'banned'));

  -- 2. Update default verification_status to 'pending' so newly created vendors require manual review
  ALTER TABLE public.providers ALTER COLUMN verification_status SET DEFAULT 'pending';

  -- 3. Ensure indexing for fast administrative moderation queries
  CREATE INDEX IF NOT EXISTS idx_providers_verification_status ON public.providers(verification_status);
END $$;

-- 4. Comment on platform_admins table:
-- All administrator roles are determined purely by database records in public.platform_admins.
-- To assign an admin directly via SQL:
-- INSERT INTO public.platform_admins (user_id, role, status)
-- VALUES ('<USER_UUID>', 'platform_admin', 'active')
-- ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
