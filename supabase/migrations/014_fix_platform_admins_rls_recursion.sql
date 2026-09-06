-- ==============================================================================
-- Migration: 014_fix_platform_admins_rls_recursion.sql
-- Description: Fix infinite recursion (42P17) in platform_admins RLS policy.
--              1. Drop recursive self-referencing policy on platform_admins.
--              2. Create a SECURITY DEFINER helper function to safely check
--                 platform admin status without triggering RLS recursion.
--              3. Replace platform_admins RLS policy and update references.
-- ==============================================================================

-- 1. Helper function: SECURITY DEFINER bypasses RLS on platform_admins safely
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

-- 2. Drop the recursive policy on platform_admins
DROP POLICY IF EXISTS "Platform admins and support admins can view platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "Users can view platform_admins" ON public.platform_admins;

-- 3. Create non-recursive policy for platform_admins:
-- A user can view their own platform admin record directly, or any active admin can view all
CREATE POLICY "Users can view their own platform admin record or active admins can view"
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR public.is_active_platform_admin(auth.uid())
  );

-- 4. Clean and optimize society_members RLS policies to use is_active_platform_admin
DROP POLICY IF EXISTS "Members or platform admins can view society members" ON public.society_members;
DROP POLICY IF EXISTS "Users can update own flat or secretary can manage members" ON public.society_members;

CREATE POLICY "Members or platform admins can view society members"
  ON public.society_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
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
    public.is_active_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = society_members.society_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'secretary'
        AND sm.status = 'active'
    )
  );

-- 5. Clean societies RLS policies
DROP POLICY IF EXISTS "Authenticated users or platform admins can view society" ON public.societies;
DROP POLICY IF EXISTS "Platform admins or creators can update society" ON public.societies;

CREATE POLICY "Authenticated users or platform admins can view society"
  ON public.societies
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    public.is_active_platform_admin(auth.uid()) OR
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
    public.is_active_platform_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.society_members sm
      WHERE sm.society_id = societies.id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('secretary', 'committee')
        AND sm.status = 'active'
    )
  );
