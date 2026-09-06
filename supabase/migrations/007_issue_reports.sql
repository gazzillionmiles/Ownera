-- ==============================================================================
-- Migration: 007_issue_reports.sql
-- Description: In-app feedback, bug reporting, and issue tracking
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'wont_fix')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_user_id ON public.issue_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created_at ON public.issue_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON public.issue_reports(status);

ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own issue reports"
  ON public.issue_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own issue reports"
  ON public.issue_reports
  FOR SELECT
  USING (auth.uid() = user_id);
