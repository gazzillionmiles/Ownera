-- ==============================================================================
-- Migration: 009_ownera_core_schema.sql
-- Description: Core Ownera schema for residential collective buying platform
-- ==============================================================================

-- 1. Extend profiles with Ownera active_role and phone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'active_role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN active_role TEXT DEFAULT 'resident' CHECK (active_role IN ('resident', 'organizer', 'provider', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'primary_society_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN primary_society_id UUID;
  END IF;
END $$;

-- 2. Societies table
CREATE TABLE IF NOT EXISTS public.societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  invite_code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  state TEXT DEFAULT 'Karnataka',
  pincode TEXT,
  total_homes INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_societies_invite_code ON public.societies(invite_code);
CREATE INDEX IF NOT EXISTS idx_societies_slug ON public.societies(slug);
CREATE INDEX IF NOT EXISTS idx_societies_city ON public.societies(city);

ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view societies"
  ON public.societies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create societies"
  ON public.societies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Organizers or creators can update society"
  ON public.societies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- 3. Society Members table
CREATE TABLE IF NOT EXISTS public.society_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flat_number TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'organizer', 'committee')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(society_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_society_members_user ON public.society_members(user_id);
CREATE INDEX IF NOT EXISTS idx_society_members_society ON public.society_members(society_id);

ALTER TABLE public.society_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view members in same society"
  ON public.society_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_members.society_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join a society"
  ON public.society_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

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
    )
  );

-- 4. Standardized Services Catalog
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  inclusions JSONB DEFAULT '[]'::jsonb,
  exclusions JSONB DEFAULT '[]'::jsonb,
  typical_duration_minutes INTEGER DEFAULT 60,
  suggested_campaign_days INTEGER DEFAULT 7,
  suggested_slot_duration_minutes INTEGER DEFAULT 90,
  base_price_estimate NUMERIC(10, 2) DEFAULT 699.00,
  icon TEXT DEFAULT 'Wrench',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view services"
  ON public.services
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Service Providers
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  services_offered JSONB DEFAULT '[]'::jsonb,
  operating_cities JSONB DEFAULT '["Bengaluru"]'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  rating NUMERIC(3, 2) DEFAULT 4.8,
  total_jobs_completed INTEGER DEFAULT 0,
  completion_rate NUMERIC(5, 2) DEFAULT 98.5,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON public.providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_verification ON public.providers(verification_status);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view providers"
  ON public.providers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Provider user can manage own provider profile"
  ON public.providers
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Service Campaigns
CREATE TABLE IF NOT EXISTS public.service_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  interest_deadline TIMESTAMPTZ NOT NULL,
  booking_deadline TIMESTAMPTZ NOT NULL,
  minimum_customers INTEGER NOT NULL DEFAULT 10,
  target_customers INTEGER NOT NULL DEFAULT 30,
  maximum_customers INTEGER DEFAULT 100,
  deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 49.00,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'threshold_reached', 'bidding', 'provider_selected', 'booking_open', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  selected_provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  selected_bid_id UUID,
  current_price NUMERIC(10, 2) NOT NULL DEFAULT 699.00,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_society_id ON public.service_campaigns(society_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.service_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_event_date ON public.service_campaigns(event_date);

ALTER TABLE public.service_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view society campaigns"
  ON public.service_campaigns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Organizers can insert campaigns"
  ON public.service_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own campaigns"
  ON public.service_campaigns
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = organizer_id);

-- 7. Campaign Pricing Tiers
CREATE TABLE IF NOT EXISTS public.campaign_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  price_per_unit NUMERIC(10, 2) NOT NULL,
  tier_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_campaign ON public.campaign_pricing_tiers(campaign_id);

ALTER TABLE public.campaign_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view pricing tiers"
  ON public.campaign_pricing_tiers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Campaign organizers can manage pricing tiers"
  ON public.campaign_pricing_tiers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      WHERE sc.id = campaign_pricing_tiers.campaign_id AND sc.organizer_id = auth.uid()
    )
  );

-- 8. Campaign Provider Invites
CREATE TABLE IF NOT EXISTS public.campaign_provider_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'bid_submitted', 'declined', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_invites_campaign ON public.campaign_provider_invites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invites_provider ON public.campaign_provider_invites(provider_id);

ALTER TABLE public.campaign_provider_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers and organizers can view invites"
  ON public.campaign_provider_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = campaign_provider_invites.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_provider_invites.campaign_id AND sc.organizer_id = auth.uid())
  );

CREATE POLICY "Organizers can create invites"
  ON public.campaign_provider_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_id AND sc.organizer_id = auth.uid())
  );

CREATE POLICY "Invited parties can update invites"
  ON public.campaign_provider_invites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = campaign_provider_invites.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_provider_invites.campaign_id AND sc.organizer_id = auth.uid())
  );

-- 9. Provider Bids
CREATE TABLE IF NOT EXISTS public.provider_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  price_per_unit NUMERIC(10, 2) NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 30,
  available_date DATE NOT NULL,
  service_duration_minutes INTEGER DEFAULT 60,
  warranty_days INTEGER DEFAULT 30,
  inclusions JSONB DEFAULT '[]'::jsonb,
  exclusions JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_bids_campaign ON public.provider_bids(campaign_id);
CREATE INDEX IF NOT EXISTS idx_provider_bids_provider ON public.provider_bids(provider_id);

ALTER TABLE public.provider_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers and submitting provider can view bids"
  ON public.provider_bids
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_bids.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = provider_bids.campaign_id AND sc.organizer_id = auth.uid())
  );

CREATE POLICY "Providers can insert their own bids"
  ON public.provider_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Providers and organizers can update bids"
  ON public.provider_bids
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_bids.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = provider_bids.campaign_id AND sc.organizer_id = auth.uid())
  );

-- 10. Campaign Participants (Expression of interest and confirmation states)
CREATE TABLE IF NOT EXISTS public.campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'confirmed', 'cancelled', 'completed', 'issue_reported')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_campaign ON public.campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.campaign_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.campaign_participants(status);

ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and organizers can view participants"
  ON public.campaign_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_participants.campaign_id AND sc.organizer_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = campaign_participants.campaign_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can express interest or join campaign"
  ON public.campaign_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation"
  ON public.campaign_participants
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_participants.campaign_id AND sc.organizer_id = auth.uid())
  );

-- 11. Booking Slots
CREATE TABLE IF NOT EXISTS public.booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  slot_time TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 5,
  booked_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_campaign ON public.booking_slots(campaign_id);

ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view booking slots"
  ON public.booking_slots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Organizers can manage booking slots"
  ON public.booking_slots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = booking_slots.campaign_id AND sc.organizer_id = auth.uid())
  );

-- 12. Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  slot_id UUID REFERENCES public.booking_slots(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  flat_number TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 49.00,
  balance_amount NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'disputed')),
  resident_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_campaign_id ON public.bookings(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users, providers, and organizers can view bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = bookings.campaign_id AND sc.organizer_id = auth.uid())
  );

CREATE POLICY "Users can create bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users, providers and organizers can update bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = bookings.campaign_id AND sc.organizer_id = auth.uid())
  );

-- 13. Booking Payments
CREATE TABLE IF NOT EXISTS public.booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT NOT NULL DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'balance', 'full')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'refunded', 'failed')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON public.booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_order ON public.booking_payments(razorpay_order_id);

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booking payments"
  ON public.booking_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 14. Service Completions
CREATE TABLE IF NOT EXISTS public.service_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  marked_completed_at TIMESTAMPTZ DEFAULT NOW(),
  resident_confirmed_at TIMESTAMPTZ,
  resident_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (resident_status IN ('unconfirmed', 'confirmed', 'disputed')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_completions_booking ON public.service_completions(booking_id);

ALTER TABLE public.service_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view service completions"
  ON public.service_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = service_completions.booking_id AND b.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_completions.provider_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Providers can mark completion"
  ON public.service_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Residents can update completion status"
  ON public.service_completions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = service_completions.booking_id AND b.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_completions.provider_id AND p.user_id = auth.uid())
  );

-- 15. Service Issues
CREATE TABLE IF NOT EXISTS public.service_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'quality' CHECK (category IN ('quality', 'no_show', 'damage', 'pricing', 'delay', 'other')),
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'escalated')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_issues_booking ON public.service_issues(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_issues_user ON public.service_issues(user_id);

ALTER TABLE public.service_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users, providers, organizers can view issues"
  ON public.service_issues
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_issues.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.service_campaigns sc ON sc.id = b.campaign_id
      WHERE b.id = service_issues.booking_id AND sc.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Users can create issues"
  ON public.service_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Organizers and providers can update issue resolution"
  ON public.service_issues
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = service_issues.provider_id AND p.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.service_campaigns sc ON sc.id = b.campaign_id
      WHERE b.id = service_issues.booking_id AND sc.organizer_id = auth.uid()
    )
  );

-- 16. Service Ratings
CREATE TABLE IF NOT EXISTS public.service_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_ratings_provider ON public.service_ratings(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_ratings_campaign ON public.service_ratings(campaign_id);

ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ratings"
  ON public.service_ratings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Residents can insert rating for their booking"
  ON public.service_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 17. Campaign Events Ledger
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON public.campaign_events(campaign_id);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view campaign events"
  ON public.campaign_events
  FOR SELECT
  TO authenticated
  USING (true);

-- 18. In-App Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
