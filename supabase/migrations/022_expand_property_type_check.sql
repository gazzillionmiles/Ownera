-- ==============================================================================
-- Migration: 022_expand_property_type_check.sql
-- Description: Expand property_type check constraints on profiles and society_members
--              tables to include 'villa' and 'shop', matching the onboarding UI options.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Expand profiles.property_type check constraint
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_property_type_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_property_type_check 
    CHECK (property_type IN ('flat', 'apartment', 'tenement', 'row_house', 'bungalow', 'villa', 'shop', 'other'));

  -- 2. Expand society_members.property_type check constraint if present
  ALTER TABLE public.society_members DROP CONSTRAINT IF EXISTS society_members_property_type_check;
  ALTER TABLE public.society_members ADD CONSTRAINT society_members_property_type_check 
    CHECK (property_type IN ('flat', 'apartment', 'tenement', 'row_house', 'bungalow', 'villa', 'shop', 'other'));
END $$;
