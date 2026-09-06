import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { requirePlatformPermission } from '@/lib/ownera/rbac';
import { createSocietySchema } from '@/src/shared/validations/ownera';

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

    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(serviceSupabase, user.id, 'platform.societies.manage');
    } catch (authErr: any) {
      return NextResponse.json(
        { error: authErr.message || 'Platform administrator access required' },
        { status: 403 }
      );
    }

    // Fetch all societies
    const { data: societies, error: fetchErr } = await serviceSupabase
      .from('societies')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      return NextResponse.json({ error: 'Failed to fetch societies' }, { status: 500 });
    }

    // Fetch primary secretaries
    const { data: secretaries } = await serviceSupabase
      .from('society_members')
      .select('society_id, user_id, flat_number, role, status')
      .eq('role', 'secretary')
      .eq('status', 'active');

    const secretaryUserIds = (secretaries || []).map((s) => s.user_id);
    const { data: profiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, email, phone')
      .in('id', secretaryUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const secretaryMap = new Map(
      (secretaries || []).map((s) => [
        s.society_id,
        {
          ...s,
          user_profile: profileMap.get(s.user_id) || null,
        },
      ])
    );

    const enrichedSocieties = (societies || []).map((soc) => ({
      ...soc,
      secretary: secretaryMap.get(soc.id) || null,
    }));

    return NextResponse.json({ societies: enrichedSocieties });
  } catch (err: any) {
    console.error('[API/admin/societies GET] Error:', err);
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
    try {
      await requirePlatformPermission(serviceSupabase, user.id, 'platform.societies.create');
    } catch (authErr: any) {
      return NextResponse.json(
        { error: 'Only platform administrators can create societies' },
        { status: 403 }
      );
    }

    const json = await request.json();
    const parsed = createSocietySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid society data', details: parsed.error.format() }, { status: 400 });
    }

    const {
      name,
      inviteCode,
      address,
      city,
      state,
      pincode,
      totalHomes,
      secretaryUserId,
      secretaryEmail,
      flatNumber,
    } = parsed.data;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Check unique invite code
    const { data: existingCode } = await serviceSupabase
      .from('societies')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json({ error: 'Invite code is already taken. Please choose another.' }, { status: 400 });
    }

    // Insert society
    const { data: society, error: insertError } = await serviceSupabase
      .from('societies')
      .insert({
        name,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
        invite_code: inviteCode,
        address,
        city,
        state,
        pincode,
        total_homes: totalHomes,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError || !society) {
      return NextResponse.json({ error: 'Failed to create society' }, { status: 500 });
    }

    // If initial secretary specified by user_id
    let assignedSecretary = null;
    if (secretaryUserId) {
      const { data: secMember } = await serviceSupabase
        .from('society_members')
        .insert({
          society_id: society.id,
          user_id: secretaryUserId,
          flat_number: flatNumber || 'Secretary Office',
          role: 'secretary',
          status: 'active',
        })
        .select()
        .single();
      assignedSecretary = secMember;
    } else if (secretaryEmail) {
      // Create invitation token for secretary
      const crypto = await import('crypto');
      const token = `inv_sec_${crypto.randomBytes(16).toString('hex')}`;
      await serviceSupabase.from('society_invitations').insert({
        society_id: society.id,
        email: secretaryEmail.toLowerCase().trim(),
        role: 'secretary',
        token,
        status: 'pending',
        invited_by: user.id,
      });
    }

    return NextResponse.json({
      success: true,
      society,
      secretary: assignedSecretary,
    });
  } catch (err: any) {
    console.error('[API/admin/societies POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
