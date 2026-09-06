import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import {
  requirePlatformPermission,
  requirePlatformAdmin,
  getPlatformAdminRecord,
} from '@/lib/ownera/rbac';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Requires at least support_admin or platform_admin view permission
    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(serviceSupabase, user.id, 'platform.view');
    } catch (authErr: any) {
      return NextResponse.json(
        { error: authErr.message || 'Platform administrator access required' },
        { status: 403 }
      );
    }

    const { data: admins, error: fetchErr } = await serviceSupabase
      .from('platform_admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      return NextResponse.json({ error: 'Failed to fetch platform admins' }, { status: 500 });
    }

    // Enrich with user profile info
    const userIds = (admins || []).map((a) => a.user_id);
    const { data: profiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const enrichedAdmins = (admins || []).map((a) => ({
      ...a,
      user_name: profileMap.get(a.user_id)?.name || 'Unknown',
      user_email: profileMap.get(a.user_id)?.email || 'Unknown',
    }));

    return NextResponse.json({ admins: enrichedAdmins });
  } catch (err: any) {
    console.error('[API/admin/admins] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();

    // Strict: only full platform_admin can manage admins (support_admin cannot)
    try {
      await requirePlatformAdmin(serviceSupabase, user.id);
    } catch (authErr: any) {
      return NextResponse.json(
        { error: 'Forbidden: Only full platform_admin can manage platform administrator roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, role, status } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
    }

    if (role && !['platform_admin', 'support_admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid platform role' }, { status: 400 });
    }

    if (status && !['active', 'suspended'].includes(status)) {
      return NextResponse.json({ error: 'Invalid admin status' }, { status: 400 });
    }

    // Prevent self-suspension or self-demotion if the caller is the target
    if (targetUserId === user.id && (status === 'suspended' || (role && role !== 'platform_admin'))) {
      return NextResponse.json(
        { error: 'Cannot demote or suspend your own platform_admin account' },
        { status: 400 }
      );
    }

    const { data: updatedAdmin, error: upsertError } = await serviceSupabase
      .from('platform_admins')
      .upsert(
        {
          user_id: targetUserId,
          role: role || 'support_admin',
          status: status || 'active',
          created_by: user.id,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('[API/admin/admins POST] Error upserting admin:', upsertError);
      return NextResponse.json({ error: 'Failed to update platform admin' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Platform admin record updated successfully for ${role || 'admin'}`,
      admin: updatedAdmin,
    });
  } catch (err: any) {
    console.error('[API/admin/admins POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
