import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { inviteSocietyMemberSchema } from '@/src/shared/validations/ownera';
import { isPlatformAdmin, isSecretary } from '@/lib/ownera/rbac';

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

    if (!societyId) {
      return NextResponse.json(
        { error: 'societyId query parameter required' },
        { status: 400 }
      );
    }

    const isPlatform = await isPlatformAdmin(user.id);
    const isSec = await isSecretary(user.id, societyId);

    if (!isPlatform && !isSec) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the society secretary or platform admin can view invitations',
        },
        { status: 403 }
      );
    }

    const serviceSupabase = createAdminClient();
    const { data: invitations, error: fetchErr } = await serviceSupabase
      .from('society_invitations')
      .select('*')
      .eq('society_id', societyId)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitations: invitations || [] });
  } catch (err: any) {
    console.error('[API/societies/invitations GET] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = inviteSocietyMemberSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid invitation payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { societyId, email, phone, role } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Verify authority: Must be secretary of society or platform admin
    const isPlatform = await isPlatformAdmin(user.id);
    const isSec = await isSecretary(user.id, societyId);

    if (!isPlatform && !isSec) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the society secretary or a platform admin can issue invitations',
        },
        { status: 403 }
      );
    }

    // Generate secure unique token
    const prefix =
      role === 'secretary'
        ? 'inv_sec_'
        : role === 'committee'
          ? 'inv_com_'
          : 'inv_res_';
    const token = `${prefix}${crypto.randomBytes(16).toString('hex')}`;

    const { data: invitation, error: insertError } = await serviceSupabase
      .from('society_invitations')
      .insert({
        society_id: societyId,
        email: email ? email.toLowerCase().trim() : null,
        phone: phone ? phone.trim() : null,
        role,
        token,
        status: 'pending',
        invited_by: user.id,
      })
      .select('*, society:societies(*)')
      .single();

    if (insertError || !invitation) {
      console.error('[API/societies/invitations POST] Error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation created for role: ${role}`,
      invitation,
      inviteLink: `/login?invitationToken=${token}`,
    });
  } catch (err: any) {
    console.error('[API/societies/invitations POST] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
