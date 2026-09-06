-- ==============================================================================
-- Migration: 015_Ownera_flow.sql
-- Description: Ownera Flow:
--              1. Profiles & Property Taxonomy (Flat, Apartment, Tenement, Row House, Bungalow, Other)
--              2. Scope (my_house vs society), Poll Questions, Configurable Options
--              3. Secretary Approval Workflow for Society-wide Campaigns
--              4. Poll Votes Ledger (interactive voting)
--              5. Custom Vendor Invitations (Name, Phone, WhatsApp, Token link)
--              6. Vendor Quotes with Capacity (Technicians, Simultaneous capacity, Duration)
--              7. Zero Payments in MVP: Direct-to-provider settlement model
-- ==============================================================================

-- 1. Profiles & Property Taxonomy
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN property_type TEXT DEFAULT 'apartment'
      CHECK (property_type IN ('flat', 'apartment', 'tenement', 'row_house', 'bungalow', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'unit_number'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN unit_number TEXT;
  END IF;
END $$;

-- 2. Society Members Updates
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'society_members' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE public.society_members ADD COLUMN property_type TEXT DEFAULT 'apartment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'society_members' AND column_name = 'unit_number'
  ) THEN
    ALTER TABLE public.society_members ADD COLUMN unit_number TEXT;
  END IF;
END $$;

-- Allow authenticated users to create and join societies without approval
DROP POLICY IF EXISTS "Platform admins or creators can update society" ON public.societies;
DROP POLICY IF EXISTS "Authenticated users or platform admins can view society" ON public.societies;

CREATE POLICY "Authenticated users can view societies"
  ON public.societies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create societies"
  ON public.societies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creators or secretaries can update society"
  ON public.societies
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = societies.id
        AND sm.user_id = auth.uid()
        AND sm.role = 'secretary'
        AND sm.status = 'active'
    )
  );

-- 3. Polls & Service Campaigns Schema Updates
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'scope'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN scope TEXT DEFAULT 'society'
      CHECK (scope IN ('my_house', 'society'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'target_property_unit'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN target_property_unit TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'poll_question'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN poll_question TEXT DEFAULT 'Who wants this service?';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'poll_options'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN poll_options JSONB DEFAULT '["Yes", "No"]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'poll_deadline'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN poll_deadline TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 days');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'secretary_approval_status'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN secretary_approval_status TEXT DEFAULT 'pending'
      CHECK (secretary_approval_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'secretary_reviewed_by'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN secretary_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'secretary_reviewed_at'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN secretary_reviewed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'is_custom_service'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN is_custom_service BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_campaigns' AND column_name = 'custom_service_name'
  ) THEN
    ALTER TABLE public.service_campaigns ADD COLUMN custom_service_name TEXT;
  END IF;
END $$;

-- Update status constraint on service_campaigns
ALTER TABLE public.service_campaigns DROP CONSTRAINT IF EXISTS service_campaigns_status_check;
ALTER TABLE public.service_campaigns ADD CONSTRAINT service_campaigns_status_check
  CHECK (status IN (
    'draft',
    'poll_active',
    'pending_secretary_approval',
    'approved',
    'quotes_invited',
    'quote_selected',
    'booking_open',
    'confirmed',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'threshold_reached',
    'bidding',
    'provider_selected'
  ));

-- 4. Poll Votes Table (Interactive Voting)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_selected TEXT NOT NULL,
  unit_identifier TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_campaign ON public.poll_votes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON public.poll_votes(user_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Society members can view poll votes"
  ON public.poll_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_campaigns sc
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = poll_votes.campaign_id AND sm.user_id = auth.uid() AND sm.status = 'active'
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
      JOIN public.society_members sm ON sm.society_id = sc.society_id
      WHERE sc.id = campaign_id AND sm.user_id = auth.uid() AND sm.status = 'active'
    )
  );

CREATE POLICY "Users can update their own vote"
  ON public.poll_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own vote"
  ON public.poll_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Vendor Invitations Table (Option B: Name, Phone, WhatsApp, Token Link)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_vendor_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.service_campaigns(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'quote_submitted', 'declined')),
  invite_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_invites_campaign ON public.campaign_vendor_invites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invites_token ON public.campaign_vendor_invites(invite_token);

ALTER TABLE public.campaign_vendor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign organizers and invited parties can view vendor invites"
  ON public.campaign_vendor_invites
  FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_vendor_invites.campaign_id AND sc.organizer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = campaign_vendor_invites.provider_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Campaign creators can insert vendor invites"
  ON public.campaign_vendor_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_campaigns sc WHERE sc.id = campaign_id AND sc.organizer_id = auth.uid())
  );

-- 6. Vendor Quotes Upgrades (Capacity, Team Size, Duration)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'provider_bids' AND column_name = 'available_start_time'
  ) THEN
    ALTER TABLE public.provider_bids ADD COLUMN available_start_time TEXT DEFAULT '10:00 AM';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'provider_bids' AND column_name = 'simultaneous_capacity'
  ) THEN
    ALTER TABLE public.provider_bids ADD COLUMN simultaneous_capacity INTEGER NOT NULL DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'provider_bids' AND column_name = 'technicians_count'
  ) THEN
    ALTER TABLE public.provider_bids ADD COLUMN technicians_count INTEGER NOT NULL DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'provider_bids' AND column_name = 'estimated_duration_minutes'
  ) THEN
    ALTER TABLE public.provider_bids ADD COLUMN estimated_duration_minutes INTEGER NOT NULL DEFAULT 30;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'provider_bids' AND column_name = 'total_capacity'
  ) THEN
    ALTER TABLE public.provider_bids ADD COLUMN total_capacity INTEGER NOT NULL DEFAULT 40;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'provider_bids' AND column_name = 'vendor_invite_id'
  ) THEN
    ALTER TABLE public.provider_bids ADD COLUMN vendor_invite_id UUID REFERENCES public.campaign_vendor_invites(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Zero Payments in MVP: Direct-to-Provider settlement
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'payment_mode'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN payment_mode TEXT DEFAULT 'direct_to_provider';
  END IF;
END $$;
