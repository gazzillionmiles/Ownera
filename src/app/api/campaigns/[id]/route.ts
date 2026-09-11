import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { calculateTierPrice } from '@/lib/ownera/campaigns';
import { isPlatformAdmin } from '@/lib/ownera/rbac';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await getVerifiedUser(request, supabase);

    const serviceSupabase = createAdminClient();

    // Fetch campaign with related entities
    const { data: campaign, error: campaignError } = await serviceSupabase
      .from('service_campaigns')
      .select(
        `
        *,
        society:societies(*),
        service:services(*),
        pricing_tiers:campaign_pricing_tiers(*),
        selected_provider:providers(*),
        selected_bid:provider_bids(*)
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Check if current user is an active member of this society, secretary/committee, or authorized provider
    let isSocietyMember = false;
    let isOrganizer = false;

    if (user) {
      const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
      const { data: member } = await serviceSupabase
        .from('society_members')
        .select('role, status')
        .eq('society_id', campaign.society_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (member) {
        isSocietyMember = true;
        isOrganizer =
          member.role === 'secretary' ||
          member.role === 'committee' ||
          member.role === 'organizer' ||
          campaign.organizer_id === user.id ||
          isPlatform;
      } else if (isPlatform) {
        isOrganizer = true;
      }
    }

    // Fetch provider bids (Only organizers or submitting providers can see bids)
    let bids: any[] = [];
    if (isOrganizer) {
      const { data: allBids } = await serviceSupabase
        .from('provider_bids')
        .select('*, provider:providers(*)')
        .eq('campaign_id', id)
        .order('price_per_unit', { ascending: true });
      bids = allBids || [];
    } else if (user) {
      const { data: prov } = await serviceSupabase
        .from('providers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prov) {
        const { data: myBids } = await serviceSupabase
          .from('provider_bids')
          .select('*, provider:providers(*)')
          .eq('campaign_id', id)
          .eq('provider_id', prov.id);
        bids = myBids || [];
      }
    }

    // Fetch participants
    const { data: rawParticipants } = await serviceSupabase
      .from('campaign_participants')
      .select('*, profile:profiles(name, email, avatar_url)')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false });

    const participantsList = rawParticipants || [];

    // Sanitize participants if not organizer (do not expose private emails)
    const sanitizedParticipants = participantsList.map((p) => {
      if (isOrganizer || (user && p.user_id === user.id)) {
        return p;
      }
      return {
        id: p.id,
        campaign_id: p.campaign_id,
        unit_identifier: p.unit_identifier,
        status: p.status,
        quantity: p.quantity,
        created_at: p.created_at,
        profile: p.profile
          ? { name: p.profile.name, avatar_url: p.profile.avatar_url }
          : null,
      };
    });

    // Fetch booking slots
    const { data: slots } = await serviceSupabase
      .from('booking_slots')
      .select('*')
      .eq('campaign_id', id)
      .order('slot_time', { ascending: true });

    // Fetch user specific state
    let userParticipant = null;
    let userBooking = null;

    if (user) {
      userParticipant =
        participantsList.find((p) => p.user_id === user.id) || null;

      const { data: booking } = await serviceSupabase
        .from('bookings')
        .select(
          `
          *,
          provider:providers(*),
          slot:booking_slots(*),
          service_issue:service_issues(*),
          service_rating:service_ratings(*)
        `
        )
        .eq('campaign_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      userBooking = booking || null;
    }

    const interestedCount = participantsList.filter(
      (p) => p.status === 'interested' || p.status === 'confirmed'
    ).length;
    const confirmedCount = participantsList.filter(
      (p) => p.status === 'confirmed'
    ).length;
    const completedCount = participantsList.filter(
      (p) => p.status === 'completed'
    ).length;

    const priceInfo = calculateTierPrice(
      confirmedCount > 0 ? confirmedCount : interestedCount,
      campaign.pricing_tiers || [],
      campaign.current_price
    );

    return NextResponse.json({
      campaign: {
        ...campaign,
        interested_count: interestedCount,
        confirmed_count: confirmedCount,
        completed_count: completedCount,
        bids_count: bids.length,
        price_info: priceInfo,
        bids,
        participants: sanitizedParticipants,
        slots: slots || [],
        user_participant: userParticipant,
        user_booking: userBooking,
      },
      is_member: isSocietyMember,
      is_organizer: isOrganizer,
    });
  } catch (err: any) {
    console.error('[API/campaigns/[id]] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
