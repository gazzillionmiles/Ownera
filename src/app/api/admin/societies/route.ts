import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { requirePlatformPermission } from '@/lib/ownera/rbac';
import { createSocietySchema } from '@/src/shared/validations/ownera';

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
      await requirePlatformPermission(
        serviceSupabase,
        user.id,
        'platform.societies.manage'
      );
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
      return NextResponse.json(
        { error: 'Failed to fetch societies' },
        { status: 500 }
      );
    }

    // Fetch active member counts
    const { data: allMembers } = await serviceSupabase
      .from('society_members')
      .select('society_id')
      .eq('status', 'active');

    const memberCountMap = new Map<string, number>();
    (allMembers || []).forEach((m) => {
      memberCountMap.set(
        m.society_id,
        (memberCountMap.get(m.society_id) || 0) + 1
      );
    });

    // Fetch campaign counts
    const { data: allCampaigns } = await serviceSupabase
      .from('service_campaigns')
      .select('society_id, status');

    const campaignCountMap = new Map<string, number>();
    const activeCampaignCountMap = new Map<string, number>();
    (allCampaigns || []).forEach((c) => {
      campaignCountMap.set(
        c.society_id,
        (campaignCountMap.get(c.society_id) || 0) + 1
      );
      if (
        [
          'open',
          'threshold_reached',
          'quotes_invited',
          'quote_selected',
          'booking_open',
          'scheduled',
        ].includes(c.status)
      ) {
        activeCampaignCountMap.set(
          c.society_id,
          (activeCampaignCountMap.get(c.society_id) || 0) + 1
        );
      }
    });

    // Fetch booking counts
    const { data: allBookings } = await serviceSupabase
      .from('bookings')
      .select('society_id, status');

    const bookingCountMap = new Map<string, number>();
    (allBookings || []).forEach((b) => {
      if (
        b.society_id &&
        ['confirmed', 'scheduled', 'completed'].includes(b.status)
      ) {
        bookingCountMap.set(
          b.society_id,
          (bookingCountMap.get(b.society_id) || 0) + 1
        );
      }
    });

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
      member_count: memberCountMap.get(soc.id) || 0,
      total_campaigns_count: campaignCountMap.get(soc.id) || 0,
      active_campaigns_count: activeCampaignCountMap.get(soc.id) || 0,
      confirmed_bookings_count: bookingCountMap.get(soc.id) || 0,
    }));

    return NextResponse.json({ societies: enrichedSocieties });
  } catch (err: any) {
    console.error('[API/admin/societies GET] Error:', err);
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

    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(
        serviceSupabase,
        user.id,
        'platform.societies.create'
      );
    } catch (authErr: any) {
      return NextResponse.json(
        { error: 'Only platform administrators can create societies' },
        { status: 403 }
      );
    }

    const json = await request.json();
    const parsed = createSocietySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid society data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      name,
      address,
      city,
      state,
      pincode,
      totalHomes,
      secretaryUserId,
      flatNumber,
    } = parsed.data;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    // Insert society
    const { data: society, error: insertError } = await serviceSupabase
      .from('societies')
      .insert({
        name,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
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
      return NextResponse.json(
        { error: 'Failed to create society' },
        { status: 500 }
      );
    }

    // If an initial secretary user_id was specified, add them directly.
    // Otherwise, generate a shareable invite link the admin can send to
    // whoever should join first (they land as a resident and can be
    // promoted to secretary from the society's member management screen).
    let assignedSecretary = null;
    let inviteJoinPath: string | null = null;
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
    } else {
      try {
        const { getOrCreateActiveInviteLink } = await import(
          '@/lib/ownera/invite-links'
        );
        const { inviteLink } = await getOrCreateActiveInviteLink(
          society.id,
          user.id,
          serviceSupabase
        );
        inviteJoinPath = `/join/${inviteLink.token}`;
      } catch (linkErr) {
        console.error(
          '[API/admin/societies POST] Error creating invite link:',
          linkErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      society,
      secretary: assignedSecretary,
      inviteJoinPath,
    });
  } catch (err: any) {
    console.error('[API/admin/societies POST] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
