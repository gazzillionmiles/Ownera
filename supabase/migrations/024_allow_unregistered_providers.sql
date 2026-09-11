-- ==============================================================================
-- Migration: 023_allow_unregistered_providers.sql
-- Description: Allow providers to have nullable user_id for unauthenticated
--              local vendors invited via secure capability links.
-- ==============================================================================

DO $$
BEGIN
  ALTER TABLE public.providers ALTER COLUMN user_id DROP NOT NULL;
END $$;
