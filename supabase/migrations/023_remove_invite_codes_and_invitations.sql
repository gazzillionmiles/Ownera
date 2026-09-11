-- ==============================================================================
-- Migration: 023_remove_invite_codes_and_invitations.sql
-- Description: Removes the legacy society-joining mechanisms now that the
--              reusable secretary-managed invite LINK (society_invite_links +
--              /join/[token]) is the single supported way to join a society.
--
--              Removed:
--              1. society_invitations table (per-invitation, role-selectable,
--                 single-use tokens issued from the old "Invite Member" modal)
--              2. societies.invite_code column (short static per-society code,
--                 typed manually or auto-applied via ?invite_code= cookie flow)
--
--              Unaffected / kept:
--              - society_invite_links (secretary/admin managed reusable link)
--              - society_members, transfer_secretary, RBAC helpers
-- ==============================================================================

-- 1. Drop society_invitations table (RLS policies and indexes cascade with it)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.society_invitations CASCADE;

-- 2. Drop the static invite_code column from societies
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_societies_invite_code;

ALTER TABLE public.societies
  DROP CONSTRAINT IF EXISTS societies_invite_code_key;

ALTER TABLE public.societies
  DROP COLUMN IF EXISTS invite_code;
