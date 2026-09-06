import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { updateMemberRoleSchema } from '@/src/shared/validations/ownera';
import { isPlatformAdmin, isSecretary, requireSocietyMember } from '@/lib/ownera/rbac';

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

    const { searchParams } = new URL(request.url);
    const societyId = searchParams.get('societyId');

    if (!societyId) {
      return NextResponse.json({ error: 'societyId query parameter required' }, { status: 400 });
    }

    const serviceSupabase = createAdminClient();

    // Verify user is a member of the society or a platform admin
    const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
    if (!isPlatform) {
      try {
        await requireSocietyMember(supabase, user.id, societyId);
      } catch (authErr: any) {
        return NextResponse.json(
          { error: 'You must be a member of this society to view its member list.' },
          { status: 403 }
        );
      }
    }

    const { data: members, error: membersError } = await serviceSupabase
      .from('society_members')
      .select('*')
      .eq('society_id', societyId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Fetch user profile info
    const userIds = (members || []).map((m) => m.user_id);
    const { data: profiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, email, phone')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const enrichedMembers = (members || []).map((m) => ({
      ...m,
      user_profile: profileMap.get(m.user_id) || null,
    }));

    return NextResponse.json({
      members: enrichedMembers,
      total_members: enrichedMembers.length,
    });
  } catch (err: any) {
    console.error('[API/societies/members GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update role payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { societyId, targetUserId, newRole } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Verify authority: Only secretary of this society or platform admin can change member roles
    const isPlatform = await isPlatformAdmin(user.id);
    const isSec = await isSecretary(user.id, societyId);

    if (!isPlatform && !isSec) {
      return NextResponse.json(
        { error: 'Forbidden: Only the society secretary or a platform admin can manage member roles' },
        { status: 403 }
      );
    }

    // Secretary cannot demote themselves through this route (must use transfer-secretary)
    if (targetUserId === user.id && isSec && newRole !== 'committee') {
      return NextResponse.json(
        { error: 'To change secretary role, use the transfer secretary function' },
        { status: 400 }
      );
    }

    const { data: updatedMember, error: updateError } = await serviceSupabase
      .from('society_members')
      .update({ role: newRole })
      .eq('society_id', societyId)
      .eq('user_id', targetUserId)
      .select()
      .single();

    if (updateError || !updatedMember) {
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Updated member role to ${newRole}`,
      member: updatedMember,
    });
  } catch (err: any) {
    console.error('[API/societies/members PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
