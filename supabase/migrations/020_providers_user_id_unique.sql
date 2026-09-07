-- ==============================================================================
-- Migration: 020_providers_user_id_unique.sql
-- Description: Ensure public.providers has a unique constraint on user_id
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_providers_user_id'
  ) THEN
    ALTER TABLE public.providers
    ADD CONSTRAINT uq_providers_user_id UNIQUE (user_id);
  END IF;
END $$;
