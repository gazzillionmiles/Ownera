import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { acceptInvitationSchema } from '@/src/shared/validations/ownera';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      );
    }

    const json = await request.json();
    const parsed = acceptInvitationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid acceptance payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { token, flatNumber } = parsed.data;
    const serviceSupabase = createAdminClient();

    // 1. Fetch invitation record
    const { data: invite, error: inviteErr } = await serviceSupabase
      .from('society_invitations')
      .select('*, society:societies(*)')
      .eq('token', token.trim())
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token.' },
        { status: 404 }
      );
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await serviceSupabase
        .from('society_invitations')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      return NextResponse.json(
        { error: 'This invitation has expired.' },
        { status: 400 }
      );
    }

    // Check optional email match
    if (invite.email && user.email) {
      if (
        invite.email.toLowerCase().trim() !== user.email.toLowerCase().trim()
      ) {
        return NextResponse.json(
          {
            error: `This invitation was issued to ${invite.email}. Please sign in with that email.`,
          },
          { status: 403 }
        );
      }
    }

    // 2. If accepting secretary role, transfer/replace existing secretary atomically
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

    // 3. Upsert society_members with granted role
    const { data: member, error: memberError } = await serviceSupabase
      .from('society_members')
      .upsert(
        {
          society_id: invite.society_id,
          user_id: user.id,
          flat_number: flatNumber,
          role: invite.role,
          status: 'active',
        },
        { onConflict: 'society_id,user_id' }
      )
      .select()
      .single();

    if (memberError || !member) {
      console.error(
        '[API/societies/invitations/accept] Member upsert failed:',
        memberError
      );
      return NextResponse.json(
        { error: 'Failed to activate membership' },
        { status: 500 }
      );
    }

    // 4. Mark invitation accepted
    await serviceSupabase
      .from('society_invitations')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    // 5. Update primary_society_id in profile
    const profileRole =
      invite.role === 'secretary' ||
      invite.role === 'committee' ||
      invite.role === 'organizer'
        ? 'organizer'
        : 'resident';
    await serviceSupabase
      .from('profiles')
      .update({
        primary_society_id: invite.society_id,
        active_role: profileRole,
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${invite.society?.name || 'society'} as ${invite.role}!`,
      society: invite.society,
      member,
    });
  } catch (err: any) {
    console.error('[API/societies/invitations/accept] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
