import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { requirePlatformPermission, AuthorizationError } from '@/lib/ownera/auth';

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

    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(serviceSupabase, user.id, 'platform.issues.manage');
    } catch (authErr: any) {
      if (authErr instanceof AuthorizationError) {
        return NextResponse.json({ error: authErr.message }, { status: authErr.statusCode });
      }
      throw authErr;
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';
    const providerId = searchParams.get('providerId');

    let query = serviceSupabase
      .from('service_issues')
      .select(
        `
        id, society_id, booking_id, user_id, provider_id, description, category,
        photo_url, status, resolution_notes, created_at, updated_at,
        society:societies(id, name),
        provider:providers(id, company_name, verification_status, rating),
        booking:bookings(flat_number)
      `
      )
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data: issues, error: issuesErr } = await query;

    if (issuesErr) {
      console.error('[API/admin/vendor-issues GET] Fetch error:', issuesErr);
      return NextResponse.json(
        { error: 'Failed to fetch vendor issues' },
        { status: 500 }
      );
    }

    // Surface repeat offenders: count open/investigating/escalated issues per provider.
    const counts: Record<string, { providerName: string; total: number; unresolved: number }> = {};
    (issues || []).forEach((i: any) => {
      const pid = i.provider_id || 'unknown';
      if (!counts[pid]) {
        counts[pid] = { providerName: i.provider?.company_name || 'Unknown Vendor', total: 0, unresolved: 0 };
      }
      counts[pid].total += 1;
      if (i.status === 'open' || i.status === 'investigating' || i.status === 'escalated') {
        counts[pid].unresolved += 1;
      }
    });

    const topOffenders = Object.entries(counts)
      .map(([providerId, v]) => ({ providerId, ...v }))
      .sort((a, b) => b.unresolved - a.unresolved || b.total - a.total)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      issues: issues || [],
      stats: {
        total: (issues || []).length,
        open: (issues || []).filter((i: any) => i.status === 'open').length,
        investigating: (issues || []).filter((i: any) => i.status === 'investigating').length,
        resolved: (issues || []).filter((i: any) => i.status === 'resolved').length,
        escalated: (issues || []).filter((i: any) => i.status === 'escalated').length,
      },
      topOffenders,
    });
  } catch (err: any) {
    console.error('[API/admin/vendor-issues GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
