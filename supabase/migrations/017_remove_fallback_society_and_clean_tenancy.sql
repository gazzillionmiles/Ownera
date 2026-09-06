-- ==============================================================================
-- Migration: 017_remove_fallback_society_and_clean_tenancy.sql
-- Description: Completely remove hardcoded fallback society (22222222-2222-2222-2222-222222222001)
--              and dummy artifacts, clean user profile references, and ensure
--              campaign_events.campaign_id is nullable for society-level events.
-- ==============================================================================

-- 1. Ensure campaign_events.campaign_id is nullable (so society-level events do not require fake UUIDs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'campaign_events' AND column_name = 'campaign_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.campaign_events ALTER COLUMN campaign_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Clean dummy/audit events with fake UUIDs
DELETE FROM public.campaign_events 
WHERE campaign_id = '00000000-0000-0000-0000-000000000000'
   OR society_id = '22222222-2222-2222-2222-222222222001';

-- 3. Delete any dummy campaigns, bids, slots, and bookings linked to fallback society
DELETE FROM public.service_campaigns 
WHERE id = '44444444-4444-4444-4444-444444444001' 
   OR society_id = '22222222-2222-2222-2222-222222222001';

DELETE FROM public.bookings 
WHERE society_id = '22222222-2222-2222-2222-222222222001';

DELETE FROM public.booking_payments 
WHERE society_id = '22222222-2222-2222-2222-222222222001';

DELETE FROM public.service_issues 
WHERE society_id = '22222222-2222-2222-2222-222222222001';

DELETE FROM public.society_invitations 
WHERE society_id = '22222222-2222-2222-2222-222222222001';

DELETE FROM public.society_members 
WHERE society_id = '22222222-2222-2222-2222-222222222001';

-- 4. Delete the fallback demo society completely
DELETE FROM public.societies 
WHERE id = '22222222-2222-2222-2222-222222222001' 
   OR (slug = 'green-heights' AND invite_code = 'OWNERA123');

-- 5. Delete dummy provider records
DELETE FROM public.providers 
WHERE id IN (
  '33333333-3333-3333-3333-333333333001',
  '33333333-3333-3333-3333-333333333002',
  '33333333-3333-3333-3333-333333333003'
);

-- 6. Clean profiles that point to the deleted fallback society or invalid foreign keys
UPDATE public.profiles 
SET primary_society_id = NULL 
WHERE primary_society_id = '22222222-2222-2222-2222-222222222001'
   OR primary_society_id NOT IN (SELECT id FROM public.societies);
