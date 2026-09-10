import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { requirePlatformPermission } from '@/lib/ownera/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const societyId = resolvedParams.id;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(serviceSupabase, user.id, 'platform.societies.manage');
    } catch (authErr: any) {
      return NextResponse.json(
        { error: authErr.message || 'Platform administrator access required' },
        { status: 403 }
      );
    }

    // 1. Fetch society record
    const { data: society, error: socErr } = await serviceSupabase
      .from('societies')
      .select('*')
      .eq('id', societyId)
      .single();

    if (socErr || !society) {
      return NextResponse.json({ error: 'Society not found' }, { status: 404 });
    }

    // 2. Fetch society members with profiles
    const { data: members } = await serviceSupabase
      .from('society_members')
      .select('id, user_id, flat_number, role, status, created_at')
      .eq('society_id', societyId)
      .order('created_at', { ascending: true });

    const memberUserIds = (members || []).map((m) => m.user_id);
    const { data: profiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, email, phone')
      .in('id', memberUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const enrichedMembers = (members || []).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || null,
    }));

    // 3. Fetch campaigns for this society
    const { data: campaigns } = await serviceSupabase
      .from('service_campaigns')
      .select('id, title, status, event_date, current_price, target_customers, created_at, service:services(name)')
      .eq('society_id', societyId)
      .order('created_at', { ascending: false });

    // 4. Fetch bookings count
    const { count: bookingsCount } = await serviceSupabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId);

    return NextResponse.json({
      society: {
        ...society,
        members: enrichedMembers,
        campaigns: campaigns || [],
        total_members_count: enrichedMembers.length,
        total_bookings_count: bookingsCount || 0,
      },
    });
  } catch (err: any) {
    console.error('[API/admin/societies/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
