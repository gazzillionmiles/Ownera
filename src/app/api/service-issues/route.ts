import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import {
  requireSocietyPermission,
  isPlatformAdmin,
  AuthorizationError,
} from '@/lib/ownera/auth';

const ISSUE_COLUMNS = `
  id, society_id, booking_id, user_id, provider_id, description, category,
  photo_url, status, resolution_notes, created_at, updated_at,
  booking:bookings(flat_number, campaign:service_campaigns(title)),
  provider:providers(company_name)
`;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const societyId = searchParams.get('societyId');
    const providerId = searchParams.get('providerId');
    const mine = searchParams.get('mine') === 'true';
    const statusFilter = searchParams.get('status');

    if (!societyId && !providerId && !mine) {
      return NextResponse.json(
        { error: 'One of societyId, providerId, or mine=true is required' },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();
    let query = serviceSupabase.from('service_issues').select(ISSUE_COLUMNS);

    if (mine) {
      // A resident viewing the issues they personally reported.
      query = query.eq('user_id', user.id);
    } else if (providerId) {
      // A vendor viewing complaints reported against their own jobs.
      const { data: ownProvider } = await serviceSupabase
        .from('providers')
        .select('id')
        .eq('id', providerId)
        .eq('user_id', user.id)
        .maybeSingle();

      const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);

      if (!ownProvider && !isPlatform) {
        return NextResponse.json(
          { error: 'Forbidden: You can only view issues reported against your own provider profile' },
          { status: 403 }
        );
      }
      query = query.eq('provider_id', providerId);
    } else if (societyId) {
      // A secretary/committee member managing complaints for their society.
      try {
        await requireSocietyPermission(
          serviceSupabase,
          user.id,
          societyId,
          'society.issues.manage'
        );
      } catch (authErr: any) {
        if (authErr instanceof AuthorizationError) {
          return NextResponse.json(
            { error: authErr.message },
            { status: authErr.statusCode }
          );
        }
        throw authErr;
      }
      query = query.eq('society_id', societyId);
    }

    if (statusFilter && ['open', 'investigating', 'resolved', 'escalated'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: issues, error: issuesErr } = await query.order('created_at', {
      ascending: false,
    });

    if (issuesErr) {
      console.error('[API/service-issues GET] Fetch error:', issuesErr);
      return NextResponse.json(
        { error: 'Failed to fetch issue reports' },
        { status: 500 }
      );
    }

    // service_issues.user_id references auth.users, not profiles directly,
    // so reviewer names can't be embedded via PostgREST — fetch separately.
    const userIds = Array.from(new Set((issues || []).map((i: any) => i.user_id)));
    let profilesByUserId: Record<string, { name?: string | null; email?: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await serviceSupabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      profilesByUserId = Object.fromEntries(
        (profiles || []).map((p) => [p.id, { name: p.name, email: p.email }])
      );
    }

    const enrichedIssues = (issues || []).map((issue: any) => ({
      ...issue,
      user_profile: profilesByUserId[issue.user_id] || null,
    }));

    return NextResponse.json({ success: true, issues: enrichedIssues });
  } catch (err: any) {
    console.error('[API/service-issues GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
