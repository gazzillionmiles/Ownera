import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { joinSocietySchema } from '@/src/shared/validations/ownera';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = joinSocietySchema.safeParse(json);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid join details';
      return NextResponse.json({ error: errorMsg, details: parsed.error.format() }, { status: 400 });
    }

    const { propertyType = 'apartment' } = parsed.data;
    const rawInput = (
      parsed.data.inviteCode ||
      parsed.data.code ||
      parsed.data.invitationToken ||
      parsed.data.token ||
      ''
    ).trim();

    const unitNumber = (
      parsed.data.flatNumber ||
      parsed.data.unitNumber ||
      ''
    ).trim() || 'Unit 1';

    if (!rawInput) {
      return NextResponse.json({ error: 'Please enter a society invite code or invitation token' }, { status: 400 });
    }

    // Guard against users pasting their 64-char Supabase email verification token into the society invite code input
    const isHexAuthToken = /^[0-9a-f]{32,}$/i.test(rawInput) || (rawInput.length > 25 && !rawInput.startsWith('inv_'));
    if (isHexAuthToken) {
      return NextResponse.json(
        {
          error:
            'The code you entered is an email verification token, not a Society Invite Code. Society invite codes are short (e.g. PALM2026) provided by your society secretary. If you are creating your building community, select "Create Society (Secretary)".',
        },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();

    // 1. Check if input matches a society invitation token (e.g. inv_res_..., inv_sec_..., inv_com_...)
    const { data: inviteList } = await serviceSupabase
      .from('society_invitations')
      .select('*')
      .or(`token.eq.${rawInput},token.ilike.${rawInput}`)
      .limit(1);

    const invite = inviteList && inviteList.length > 0 ? inviteList[0] : null;

    if (invite) {
      // Check if invitation is expired
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await serviceSupabase
          .from('society_invitations')
          .update({ status: 'expired' })
          .eq('id', invite.id);
        return NextResponse.json({ error: 'This invitation has expired. Please ask the secretary for a new link.' }, { status: 400 });
      }

      if (invite.status !== 'pending') {
        return NextResponse.json(
          { error: `This invitation token has already been ${invite.status}. Please request a new invite code or token from your secretary.` },
          { status: 400 }
        );
      }

      // Fetch the society by ID directly
      const { data: inviteSociety, error: socErr } = await serviceSupabase
        .from('societies')
        .select('*')
        .eq('id', invite.society_id)
        .maybeSingle();

      if (socErr || !inviteSociety) {
        return NextResponse.json({ error: 'The society linked to this invitation could not be found.' }, { status: 404 });
      }

      if (invite.role === 'secretary') {
        const { data: existingSecretary } = await serviceSupabase
          .from('society_members')
          .select('user_id')
          .eq('society_id', invite.society_id)
          .eq('role', 'secretary')
          .eq('status', 'active')
          .maybeSingle();

        if (existingSecretary && existingSecretary.user_id !== user.id) {
          await serviceSupabase
            .from('society_members')
            .update({ role: 'committee' })
            .eq('society_id', invite.society_id)
            .eq('user_id', existingSecretary.user_id);
        }
      }

      const { data: member, error: mErr } = await serviceSupabase
        .from('society_members')
        .upsert(
          {
            society_id: invite.society_id,
            user_id: user.id,
            flat_number: unitNumber,
            unit_number: unitNumber,
            property_type: propertyType,
            role: invite.role,
            status: 'active',
          },
          { onConflict: 'society_id,user_id' }
        )
        .select()
        .single();

      if (mErr || !member) {
        console.error('[API/societies/join] Error recording invitation membership:', mErr);
        return NextResponse.json({ error: 'Failed to join society with invitation' }, { status: 500 });
      }

      await serviceSupabase
        .from('society_invitations')
        .update({ status: 'accepted' })
        .eq('id', invite.id);

      await serviceSupabase
        .from('profiles')
        .update({
          primary_society_id: invite.society_id,
          active_role: (invite.role === 'secretary' || invite.role === 'committee' || invite.role === 'organizer') ? 'organizer' : 'resident',
          unit_number: unitNumber,
          property_type: propertyType,
        })
        .eq('id', user.id);

      return NextResponse.json({
        success: true,
        message: `Successfully joined ${inviteSociety.name} as ${invite.role}!`,
        society: inviteSociety,
        member,
      });
    }

    // 2. Check if input matches a society invite code, slug, or ID
    const cleanCode = rawInput.replace(/[^a-zA-Z0-9_-]/g, '');
    let socQuery = serviceSupabase
      .from('societies')
      .select('*');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawInput);
    if (isUuid) {
      socQuery = socQuery.or(`id.eq.${rawInput},invite_code.ilike.${rawInput},slug.ilike.${rawInput}`);
    } else {
      socQuery = socQuery.or(`invite_code.ilike.${cleanCode},slug.ilike.${cleanCode}`);
    }

    const { data: societiesList, error: socFetchErr } = await socQuery;
    const society = societiesList && societiesList.length > 0 ? societiesList[0] : null;

    if (socFetchErr || !society) {
      return NextResponse.json(
        { error: `Society not found for code "${rawInput}". Please check the code shared by your secretary.` },
        { status: 404 }
      );
    }

    // Check existing membership
    const { data: existingMember } = await serviceSupabase
      .from('society_members')
      .select('role')
      .eq('society_id', society.id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isCreator = society.created_by === user.id;
    const assignedRole = existingMember?.role || (isCreator ? 'secretary' : 'resident');

    // Upsert membership
    const { data: member, error: memberError } = await serviceSupabase
      .from('society_members')
      .upsert(
        {
          society_id: society.id,
          user_id: user.id,
          flat_number: unitNumber,
          unit_number: unitNumber,
          property_type: propertyType,
          role: assignedRole,
          status: 'active',
        },
        { onConflict: 'society_id,user_id' }
      )
      .select()
      .single();

    if (memberError || !member) {
      console.error('[API/societies/join] Error joining society:', memberError);
      return NextResponse.json({ error: 'Failed to join society' }, { status: 500 });
    }

    // Update primary_society_id in profile
    const profileRole = (assignedRole === 'secretary' || assignedRole === 'committee' || assignedRole === 'organizer') ? 'organizer' : 'resident';
    await serviceSupabase
      .from('profiles')
      .update({
        primary_society_id: society.id,
        active_role: profileRole,
        unit_number: unitNumber,
        property_type: propertyType,
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${society.name}!`,
      society,
      member,
    });
  } catch (err: any) {
    console.error('[API/societies/join] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
