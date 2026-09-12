-- ==============================================================================
-- Migration: 025_service_ratings_and_completions_unique.sql
-- Description: Add unique constraints for booking_id on service_ratings and
--              service_completions to guarantee data integrity and allow safe upsert.
-- ==============================================================================

-- 1. Ensure at most one rating record per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_ratings_booking_id 
ON public.service_ratings(booking_id);

-- 2. Ensure at most one completion record per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_completions_booking_id 
ON public.service_completions(booking_id);
