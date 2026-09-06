-- ==============================================================================
-- Migration: 013_ownera_rbac.sql
-- Description: Ownera Role-Based Access Control (RBAC):
--              - Database-backed platform_admins model (platform_admin, support_admin)
--              - Safe migration of legacy 'organizer' role to 'secretary'
--              - Enforce ONE primary secretary per society via partial unique index
--              - Society invitations table for controlled secretary/committee invites
--              - Atomic stored procedure for secretary transfer
--              - Updated RLS policies reflecting platform, secretary, committee, resident, and provider scopes
-- ==============================================================================

-- 1. Platform Admins Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'support_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_status ON public.platform_admins(status);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Non-recursive helper for RLS evaluations
CREATE OR REPLACE FUNCTION public.is_active_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = p_user_id AND status = 'active'
  );
$$;

CREATE POLICY "Platform admins and support admins can view platform_admins"
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR public.is_active_platform_admin(auth.uid())
  );

-- 2. Society Members Role Constraint & Migration
-- ------------------------------------------------------------------------------
-- Migrate legacy 'organizer' roles to 'secretary'
UPDATE public.society_members 
SET role = 'secretary' 
WHERE role = 'organizer';

-- Update check constraint to enforce resident, secretary, committee
ALTER TABLE public.society_members DROP CONSTRAINT IF EXISTS society_members_role_check;
ALTER TABLE public.society_members ADD CONSTRAINT society_members_role_check 
  CHECK (role IN ('resident', 'secretary', 'committee'));

-- Enforce ONE primary active secretary per society
CREATE UNIQUE INDEX IF NOT EXISTS idx_society_members_primary_secretary 
  ON public.society_members(society_id) 
  WHERE role = 'secretary' AND status = 'active';

-- 3. Society Invitations Table (Controlled Secretary / Committee Invitations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.society_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('secretary', 'committee', 'resident')),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_society_invitations_society ON public.society_invitations(society_id);
CREATE INDEX IF NOT EXISTS idx_society_invitations_token ON public.society_invitations(token);
CREATE INDEX IF NOT EXISTS idx_society_invitations_email ON public.society_invitations(email);
CREATE INDEX IF NOT EXISTS idx_society_invitations_status ON public.society_invitations(status);

ALTER TABLE public.society_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Society organizers or platform admins can view invitations"
  ON public.society_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa 
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_invitations.society_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'secretary'
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Secretary or platform admin can insert invitations"
  ON public.society_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa 
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'secretary'
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Secretary or platform admin can update invitations"
  ON public.society_invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa 
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_invitations.society_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'secretary'
        AND sm.status = 'active'
    )
  );

-- 4. Atomic Stored Procedure for Secretary Transfer
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_society_secretary(
  p_society_id UUID,
  p_new_secretary_user_id UUID,
  p_current_user_id UUID,
  p_old_secretary_role TEXT DEFAULT 'committee'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_platform_admin BOOLEAN;
  v_is_current_secretary BOOLEAN;
  v_target_membership RECORD;
  v_current_secretary_id UUID;
BEGIN
  -- Validate target fallback role
  IF p_old_secretary_role NOT IN ('committee', 'resident') THEN
    p_old_secretary_role := 'committee';
  END IF;

  -- 1. Check if caller is platform_admin
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = p_current_user_id AND status = 'active' AND role = 'platform_admin'
  ) INTO v_is_platform_admin;

  -- 2. Check if caller is current secretary of the society
  SELECT EXISTS (
    SELECT 1 FROM public.society_members
    WHERE society_id = p_society_id AND user_id = p_current_user_id AND role = 'secretary' AND status = 'active'
  ) INTO v_is_current_secretary;

  IF NOT (v_is_platform_admin OR v_is_current_secretary) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only the current primary secretary or platform admin can transfer secretary role'
    );
  END IF;

  -- 3. Check target user is an active member in this society
  SELECT * INTO v_target_membership
  FROM public.society_members
  WHERE society_id = p_society_id AND user_id = p_new_secretary_user_id AND status = 'active'
  FOR UPDATE;

  IF v_target_membership IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target user must be an active member of this society before becoming secretary'
    );
  END IF;

  -- 4. Find current secretary of this society
  SELECT user_id INTO v_current_secretary_id
  FROM public.society_members
  WHERE society_id = p_society_id AND role = 'secretary' AND status = 'active'
  LIMIT 1
  FOR UPDATE;

  -- 5. Atomically update existing secretary if different
  IF v_current_secretary_id IS NOT NULL AND v_current_secretary_id != p_new_secretary_user_id THEN
    UPDATE public.society_members
    SET role = p_old_secretary_role
    WHERE society_id = p_society_id AND user_id = v_current_secretary_id;
  END IF;

  -- 6. Promote target user to secretary
  UPDATE public.society_members
  SET role = 'secretary'
  WHERE society_id = p_society_id AND user_id = p_new_secretary_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'society_id', p_society_id,
    'new_secretary_user_id', p_new_secretary_user_id,
    'previous_secretary_user_id', v_current_secretary_id,
    'previous_secretary_new_role', p_old_secretary_role
  );
END;
$$;

-- 5. Updated Hardened RLS Policies for RBAC
-- ------------------------------------------------------------------------------

-- 5.1 societies RLS
DROP POLICY IF EXISTS "Members or creators can view society" ON public.societies;
DROP POLICY IF EXISTS "Organizers or creators can update society" ON public.societies;
DROP POLICY IF EXISTS "Users can create societies" ON public.societies;

CREATE POLICY "Authenticated users or platform admins can view society"
  ON public.societies
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = societies.id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Platform admins or creators can update society"
  ON public.societies
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = societies.id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );

-- 5.2 society_members RLS
DROP POLICY IF EXISTS "Members can view members in same society" ON public.society_members;
DROP POLICY IF EXISTS "Users can update own membership or organizers can manage" ON public.society_members;

CREATE POLICY "Members or platform admins can view society members"
  ON public.society_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_members.society_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Users can update own flat or secretary can manage members"
  ON public.society_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_members.society_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'secretary'
        AND sm.status = 'active'
    )
  );

-- 5.3 service_campaigns RLS
DROP POLICY IF EXISTS "Society members, organizers and associated providers can view campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Society organizers can insert campaigns" ON public.service_campaigns;
DROP POLICY IF EXISTS "Society organizers can update campaigns" ON public.service_campaigns;

CREATE POLICY "Members, organizers, providers, and platform admins can view campaigns"
  ON public.service_campaigns
  FOR SELECT
  TO authenticated
  USING (
    organizer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
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

CREATE POLICY "Secretary, committee, or platform admin can insert campaigns"
  ON public.service_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = organizer_id AND (
      EXISTS (
        SELECT 1 FROM public.platform_admins pa
        WHERE pa.user_id = auth.uid() AND pa.status = 'active'
      ) OR
      EXISTS (
        SELECT 1 FROM public.society_members sm
        WHERE sm.society_id = service_campaigns.society_id
          AND sm.user_id = auth.uid()
          AND sm.role IN ('secretary', 'committee')
          AND sm.status = 'active'
      )
    )
  );

CREATE POLICY "Secretary, committee, or platform admin can update campaigns"
  ON public.service_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = organizer_id OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_campaigns.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );

-- 5.4 bookings RLS
DROP POLICY IF EXISTS "Authorized parties can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authorized parties can update bookings" ON public.bookings;

CREATE POLICY "Authorized parties can view bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = bookings.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
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
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = bookings.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );

-- 5.5 booking_payments RLS
DROP POLICY IF EXISTS "Authorized parties can view booking payments" ON public.booking_payments;

CREATE POLICY "Authorized parties can view booking payments"
  ON public.booking_payments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = booking_payments.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );

-- 5.6 service_issues RLS
DROP POLICY IF EXISTS "Authorized parties can view service issues" ON public.service_issues;
DROP POLICY IF EXISTS "Organizers and providers can update issue resolution" ON public.service_issues;

CREATE POLICY "Authorized parties can view service issues"
  ON public.service_issues
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_issues.provider_id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_issues.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );

CREATE POLICY "Secretary, committee, provider, or platform admin can update issue resolution"
  ON public.service_issues
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_issues.provider_id AND p.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = service_issues.society_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );
