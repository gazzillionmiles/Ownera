-- ==============================================================================
-- Migration: 011_ownera_tenancy_hardening.sql
-- Description: Enforce direct society_id scoping, database integrity constraints,
--              safe backfills, and hardened Row-Level Security (RLS) policies.
-- ==============================================================================

-- 1. Add direct society_id foreign key columns to operational tables
-- ------------------------------------------------------------------------------

-- 1.1 bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'society_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill bookings.society_id from service_campaigns
UPDATE public.bookings b
SET society_id = sc.society_id
FROM public.service_campaigns sc
WHERE b.campaign_id = sc.id AND b.society_id IS NULL;

-- Enforce NOT NULL on bookings.society_id if existing rows are backfilled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'society_id' AND is_nullable = 'YES'
  ) THEN
    -- Delete any orphan row without valid society before setting NOT NULL
    DELETE FROM public.bookings WHERE society_id IS NULL;
    ALTER TABLE public.bookings ALTER COLUMN society_id SET NOT NULL;
  END IF;
END $$;

-- 1.2 booking_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_payments' AND column_name = 'society_id'
  ) THEN
    ALTER TABLE public.booking_payments ADD COLUMN society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill booking_payments.society_id from bookings
UPDATE public.booking_payments bp
SET society_id = b.society_id
FROM public.bookings b
WHERE bp.booking_id = b.id AND bp.society_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_payments' AND column_name = 'society_id' AND is_nullable = 'YES'
  ) THEN
    DELETE FROM public.booking_payments WHERE society_id IS NULL;
    ALTER TABLE public.booking_payments ALTER COLUMN society_id SET NOT NULL;
  END IF;
END $$;

-- 1.3 service_issues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_issues' AND column_name = 'society_id'
  ) THEN
    ALTER TABLE public.service_issues ADD COLUMN society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill service_issues.society_id from bookings
UPDATE public.service_issues si
SET society_id = b.society_id
FROM public.bookings b
WHERE si.booking_id = b.id AND si.society_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_issues' AND column_name = 'society_id' AND is_nullable = 'YES'
  ) THEN
    DELETE FROM public.service_issues WHERE society_id IS NULL;
    ALTER TABLE public.service_issues ALTER COLUMN society_id SET NOT NULL;
  END IF;
END $$;

-- 1.4 service_ratings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_ratings' AND column_name = 'society_id'
  ) THEN
    ALTER TABLE public.service_ratings ADD COLUMN society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill service_ratings.society_id from service_campaigns
UPDATE public.service_ratings sr
SET society_id = sc.society_id
FROM public.service_campaigns sc
WHERE sr.campaign_id = sc.id AND sr.society_id IS NULL;

-- 1.5 campaign_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'campaign_events' AND column_name = 'society_id'
  ) THEN
    ALTER TABLE public.campaign_events ADD COLUMN society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill campaign_events.society_id from service_campaigns
UPDATE public.campaign_events ce
SET society_id = sc.society_id
FROM public.service_campaigns sc
WHERE ce.campaign_id = sc.id AND ce.society_id IS NULL;

-- 2. Indexes for tenant query acceleration
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_society_id ON public.bookings(society_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_society ON public.bookings(user_id, society_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_society_id ON public.booking_payments(society_id);
CREATE INDEX IF NOT EXISTS idx_service_issues_society_id ON public.service_issues(society_id);
CREATE INDEX IF NOT EXISTS idx_service_ratings_society_id ON public.service_ratings(society_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_society_id ON public.campaign_events(society_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_society_status ON public.service_campaigns(society_id, status);
CREATE INDEX IF NOT EXISTS idx_society_members_user_status ON public.society_members(user_id, status);

-- 3. Hardened Row-Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- Drop legacy permissive policies from 009
DROP POLICY IF EXISTS "Anyone authenticated can view societies" ON public.societies;
DROP POLICY IF EXISTS "Anyone authenticated can view society campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Anyone authenticated can view pricing tiers" ON public.campaign_pricing_tiers;
DROP POLICY IF EXISTS "Anyone authenticated can view booking slots" ON public.booking_slots;
DROP POLICY IF EXISTS "Anyone authenticated can view ratings" ON public.service_ratings;
DROP POLICY IF EXISTS "Anyone authenticated can view campaign events" ON public.campaign_events;
DROP POLICY IF EXISTS "Organizers or creators can update society" ON public.societies;
DROP POLICY IF EXISTS "Members can view members in same society" ON public.society_members;
DROP POLICY IF EXISTS "Users can update own membership or organizers can manage" ON public.society_members;
DROP POLICY IF EXISTS "Users, providers, and organizers can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users, providers and organizers can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Parties can view service completions" ON public.service_completions;
DROP POLICY IF EXISTS "Providers can mark completion" ON public.service_completions;
DROP POLICY IF EXISTS "Residents can update completion status" ON public.service_completions;
DROP POLICY IF EXISTS "Users, providers, organizers can view issues" ON public.service_issues;
DROP POLICY IF EXISTS "Organizers and providers can update issue resolution" ON public.service_issues;
DROP POLICY IF EXISTS "Users and organizers can view participants" ON public.campaign_participants;

-- 3.1 societies RLS
-- Members can view societies they belong to, or creators can view, or unauthenticated / authenticated can view public society meta
CREATE POLICY "Members or creators can view society"
  ON public.societies
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = societies.id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Organizers or creators can update society"
  ON public.societies
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = societies.id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.2 society_members RLS
CREATE POLICY "Members can view members in same society"
  ON public.society_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_members.society_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Users can update own membership or organizers can manage"
  ON public.society_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_members.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.3 service_campaigns RLS
-- Active society members can view campaigns in their society,
-- Providers invited or bidding on the campaign can view,
-- Organizers of the campaign can view.
CREATE POLICY "Society members, organizers and associated providers can view campaigns"
  ON public.service_campaigns
  FOR SELECT
  TO authenticated
  USING (
    organizer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_campaigns.society_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      JOIN public.campaign_provider_invites cpi ON cpi.provider_id = p.id
      WHERE cpi.campaign_id = service_campaigns.id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      JOIN public.provider_bids pb ON pb.provider_id = p.id
      WHERE pb.campaign_id = service_campaigns.id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_campaigns.selected_provider_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Society organizers can insert campaigns"
  ON public.service_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = organizer_id AND
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_campaigns.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Society organizers can update campaigns"
  ON public.service_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = organizer_id OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_campaigns.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.4 campaign_pricing_tiers RLS
CREATE POLICY "Society members and invited providers can view pricing tiers"
  ON public.campaign_pricing_tiers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = campaign_pricing_tiers.campaign_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_pricing_tiers.campaign_id
        AND sc.organizer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      JOIN public.campaign_provider_invites cpi ON cpi.provider_id = p.id
      WHERE cpi.campaign_id = campaign_pricing_tiers.campaign_id AND p.user_id = auth.uid()
    )
  );

-- 3.5 campaign_participants RLS
CREATE POLICY "Society members can view campaign participation counts"
  ON public.campaign_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = campaign_participants.campaign_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_participants.campaign_id
        AND sc.organizer_id = auth.uid()
    )
  );

-- 3.6 booking_slots RLS
CREATE POLICY "Society members and campaign providers can view booking slots"
  ON public.booking_slots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = booking_slots.campaign_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = booking_slots.campaign_id
        AND sc.organizer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.providers p ON p.id = sc.selected_provider_id
      WHERE sc.id = booking_slots.campaign_id AND p.user_id = auth.uid()
    )
  );

-- 3.7 bookings RLS
CREATE POLICY "Authorized parties can view bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    -- Resident who booked
    user_id = auth.uid() OR
    -- Assigned Provider user
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()
    ) OR
    -- Society Organizer / Committee
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = bookings.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Residents can create bookings in their society"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = bookings.society_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Authorized parties can update bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = bookings.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.8 booking_payments RLS
DROP POLICY IF EXISTS "Users can view own booking payments" ON public.booking_payments;
CREATE POLICY "Authorized parties can view booking payments"
  ON public.booking_payments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = booking_payments.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.9 service_completions RLS
CREATE POLICY "Authorized parties can view service completions"
  ON public.service_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = service_completions.booking_id AND b.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_completions.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.society_members sm ON sm.society_id = b.society_id
      WHERE b.id = service_completions.booking_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Providers can mark completion"
  ON public.service_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Residents or organizers can update completion status"
  ON public.service_completions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = service_completions.booking_id AND b.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_completions.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.society_members sm ON sm.society_id = b.society_id
      WHERE b.id = service_completions.booking_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.10 service_issues RLS
CREATE POLICY "Authorized parties can view service issues"
  ON public.service_issues
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_issues.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_issues.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Residents can create service issues for their bookings"
  ON public.service_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = service_issues.booking_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizers and providers can update issue resolution"
  ON public.service_issues
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_issues.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_issues.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('organizer', 'committee')
        AND sm.status = 'active'
    )
  );

-- 3.11 service_ratings RLS
CREATE POLICY "Society members can view ratings in their campaigns"
  ON public.service_ratings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_ratings.provider_id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = service_ratings.campaign_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

-- 3.12 campaign_events RLS
CREATE POLICY "Society members and providers can view campaign events"
  ON public.campaign_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = campaign_events.campaign_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_events.campaign_id
        AND sc.organizer_id = auth.uid()
    )
  );
