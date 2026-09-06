-- ==============================================================================
-- Migration: 016_fix_society_members_rls_and_integrity.sql
-- Description: Fix infinite recursion in RLS policies (society_members, service_campaigns, provider_bids)
--              and ensure real data integrity:
--              1. SECURITY DEFINER helpers for society membership and campaign authorization.
--              2. Clean, non-recursive RLS policies for society_members, societies, poll_votes,
--                 service_campaigns, provider_bids, booking_slots, campaign_participants,
--                 campaign_pricing_tiers, campaign_vendor_invites, and bookings.
--              3. Clean fake default rating from providers table.
-- ==============================================================================

-- 1. Helper functions: SECURITY DEFINER safely bypasses RLS recursion
CREATE OR REPLACE FUNCTION public.is_active_society_member(p_society_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.society_members
    WHERE society_id = p_society_id AND user_id = p_user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_society_secretary(p_society_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.society_members
    WHERE society_id = p_society_id AND user_id = p_user_id AND role = 'secretary' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_society_committee_or_secretary(p_society_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.society_members
    WHERE society_id = p_society_id AND user_id = p_user_id AND role IN ('secretary', 'committee') AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_organizer(p_campaign_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_campaigns
    WHERE id = p_campaign_id AND organizer_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_provider_user(p_provider_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers
    WHERE id = p_provider_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_invited_or_bid_provider(p_campaign_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.user_id = p_user_id AND (
      EXISTS (
        SELECT 1 FROM public.campaign_provider_invites cpi
        WHERE cpi.campaign_id = p_campaign_id AND cpi.provider_id = p.id
      ) OR
      EXISTS (
        SELECT 1 FROM public.campaign_vendor_invites cvi
        WHERE cvi.campaign_id = p_campaign_id AND cvi.provider_id = p.id
      ) OR
      EXISTS (
        SELECT 1 FROM public.provider_bids pb
        WHERE pb.campaign_id = p_campaign_id AND pb.provider_id = p.id
      ) OR
      EXISTS (
        SELECT 1 FROM public.service_campaigns sc
        WHERE sc.id = p_campaign_id AND sc.selected_provider_id = p.id
      )
    )
  );
$$;

-- 2. Clean society_members RLS policies
DROP POLICY IF EXISTS "Members or platform admins can view society members" ON public.society_members;
DROP POLICY IF EXISTS "Members can view members in same society" ON public.society_members;
DROP POLICY IF EXISTS "Users can update own flat or secretary can manage members" ON public.society_members;
DROP POLICY IF EXISTS "Users can update own membership or organizers can manage" ON public.society_members;
DROP POLICY IF EXISTS "Users can join a society" ON public.society_members;

CREATE POLICY "Members or platform admins can view society members"
  ON public.society_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_member(society_id, auth.uid())
  );

CREATE POLICY "Users can join a society"
  ON public.society_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own flat or secretary can manage members"
  ON public.society_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_secretary(society_id, auth.uid())
  );

-- 3. Clean societies RLS policies
DROP POLICY IF EXISTS "Authenticated users or platform admins can view society" ON public.societies;
DROP POLICY IF EXISTS "Anyone authenticated can view societies" ON public.societies;
DROP POLICY IF EXISTS "Authenticated users can view societies" ON public.societies;
DROP POLICY IF EXISTS "Platform admins or creators can update society" ON public.societies;
DROP POLICY IF EXISTS "Creators or secretaries can update society" ON public.societies;

CREATE POLICY "Authenticated users can view societies"
  ON public.societies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Creators or secretaries can update society"
  ON public.societies
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_secretary(id, auth.uid())
  );

-- 4. Clean poll_votes RLS policies
DROP POLICY IF EXISTS "Society members can view poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Society members can vote in polls" ON public.poll_votes;

CREATE POLICY "Society members can view poll votes"
  ON public.poll_votes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = poll_votes.campaign_id AND public.is_active_society_member(sc.society_id, auth.uid())
    )
  );

CREATE POLICY "Society members can vote in polls"
  ON public.poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_id AND public.is_active_society_member(sc.society_id, auth.uid())
    )
  );

-- 5. Clean service_campaigns RLS policies (eliminate circular recursion with provider_bids)
DROP POLICY IF EXISTS "Members, organizers, providers, and platform admins can view campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Secretary, committee, or platform admin can insert campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Secretary, committee, or platform admin can update campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Society members, organizers and associated providers can view campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Society organizers can insert campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Society organizers can update campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Anyone authenticated can view society campaigns" ON public.service_campaigns;

CREATE POLICY "Members, organizers, providers, and platform admins can view campaigns"
  ON public.service_campaigns
  FOR SELECT
  TO authenticated
  USING (
    organizer_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_member(society_id, auth.uid()) OR
    public.is_invited_or_bid_provider(id, auth.uid())
  );

CREATE POLICY "Secretary, committee, or platform admin can insert campaigns"
  ON public.service_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = organizer_id AND (
      public.is_active_platform_admin(auth.uid()) OR
      public.is_active_society_committee_or_secretary(society_id, auth.uid())
    )
  );

CREATE POLICY "Secretary, committee, or platform admin can update campaigns"
  ON public.service_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = organizer_id OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_committee_or_secretary(society_id, auth.uid())
  );

-- 6. Clean provider_bids RLS policies (eliminate circular recursion with service_campaigns)
DROP POLICY IF EXISTS "Organizers and submitting provider can view bids" ON public.provider_bids;
DROP POLICY IF EXISTS "Providers can insert their own bids" ON public.provider_bids;
DROP POLICY IF EXISTS "Providers and organizers can update bids" ON public.provider_bids;

CREATE POLICY "Organizers and submitting provider can view bids"
  ON public.provider_bids
  FOR SELECT
  TO authenticated
  USING (
    public.is_provider_user(provider_id, auth.uid()) OR
    public.is_campaign_organizer(campaign_id, auth.uid()) OR
    public.is_active_platform_admin(auth.uid())
  );

CREATE POLICY "Providers can insert their own bids"
  ON public.provider_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_provider_user(provider_id, auth.uid()) OR
    public.is_active_platform_admin(auth.uid())
  );

CREATE POLICY "Providers and organizers can update bids"
  ON public.provider_bids
  FOR UPDATE
  TO authenticated
  USING (
    public.is_provider_user(provider_id, auth.uid()) OR
    public.is_campaign_organizer(campaign_id, auth.uid()) OR
    public.is_active_platform_admin(auth.uid())
  );

-- 7. Clean booking_slots RLS policies
DROP POLICY IF EXISTS "Society members and campaign providers can view booking slots" ON public.booking_slots;

CREATE POLICY "Society members and campaign providers can view booking slots"
  ON public.booking_slots
  FOR SELECT
  TO authenticated
  USING (
    public.is_campaign_organizer(campaign_id, auth.uid()) OR
    public.is_active_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = booking_slots.campaign_id AND (
        public.is_active_society_member(sc.society_id, auth.uid()) OR
        public.is_provider_user(sc.selected_provider_id, auth.uid())
      )
    )
  );

-- 8. Clean campaign_participants RLS policies
DROP POLICY IF EXISTS "Society members can view campaign participation counts" ON public.campaign_participants;

CREATE POLICY "Society members can view campaign participation counts"
  ON public.campaign_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_campaign_organizer(campaign_id, auth.uid()) OR
    public.is_active_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_participants.campaign_id AND public.is_active_society_member(sc.society_id, auth.uid())
    )
  );

-- 9. Clean campaign_pricing_tiers RLS policies
DROP POLICY IF EXISTS "Society members and organizers can view pricing tiers" ON public.campaign_pricing_tiers;

CREATE POLICY "Society members and organizers can view pricing tiers"
  ON public.campaign_pricing_tiers
  FOR SELECT
  TO authenticated
  USING (
    public.is_campaign_organizer(campaign_id, auth.uid()) OR
    public.is_active_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_pricing_tiers.campaign_id AND (
        public.is_active_society_member(sc.society_id, auth.uid()) OR
        public.is_invited_or_bid_provider(sc.id, auth.uid())
      )
    )
  );

-- 10. Clean bookings RLS policies
DROP POLICY IF EXISTS "Authorized parties can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authorized parties can update bookings" ON public.bookings;

CREATE POLICY "Authorized parties can view bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_provider_user(provider_id, auth.uid()) OR
    public.is_active_society_committee_or_secretary(society_id, auth.uid())
  );

CREATE POLICY "Authorized parties can update bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
    public.is_provider_user(provider_id, auth.uid()) OR
    public.is_active_society_committee_or_secretary(society_id, auth.uid())
  );

-- 11. Remove fake default rating on providers and allow custom services in campaigns
ALTER TABLE public.providers ALTER COLUMN rating DROP DEFAULT;
ALTER TABLE public.service_campaigns ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE public.service_campaigns DROP CONSTRAINT IF EXISTS service_campaigns_service_id_fkey;
ALTER TABLE public.service_campaigns ADD CONSTRAINT service_campaigns_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
