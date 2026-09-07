-- ==============================================================================
-- Migration: 018_society_invite_links.sql
-- Description: Reusable Society Invite Links architecture
--              - Dedicated table public.society_invite_links for resident invite links
--              - Cryptographically secure token unique constraint
--              - Enforce at most ONE active reusable resident invite link per society
--              - Row Level Security (RLS) policies for secretaries and platform admins
-- ==============================================================================

-- 1. Create society_invite_links table
CREATE TABLE IF NOT EXISTS public.society_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

-- 2. Indexes for fast token lookup and performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_society_invite_links_token 
  ON public.society_invite_links(token);

CREATE INDEX IF NOT EXISTS idx_society_invite_links_society 
  ON public.society_invite_links(society_id);

-- Enforce at most ONE active reusable resident invite link per society
CREATE UNIQUE INDEX IF NOT EXISTS idx_society_invite_links_active_society 
  ON public.society_invite_links(society_id) 
  WHERE is_active = TRUE;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.society_invite_links ENABLE ROW LEVEL SECURITY;

-- Secretaries and Platform Admins can view invite links for their society
CREATE POLICY "Secretaries or platform admins can view society invite links"
  ON public.society_invite_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_secretary(society_id, auth.uid())
  );

-- Secretaries and Platform Admins can insert invite links
CREATE POLICY "Secretaries or platform admins can insert society invite links"
  ON public.society_invite_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_secretary(society_id, auth.uid())
  );

-- Secretaries and Platform Admins can update/rotate invite links
CREATE POLICY "Secretaries or platform admins can update society invite links"
  ON public.society_invite_links
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_platform_admin(auth.uid()) OR
    public.is_active_society_secretary(society_id, auth.uid())
  );
