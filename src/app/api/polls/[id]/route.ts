import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { calculateTierPrice } from '@/lib/ownera/campaigns';
import { isPlatformAdmin, isCommittee } from '@/lib/ownera/rbac';

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

    // Fetch poll/campaign with all relations
    const { data: poll, error: pollError } = await serviceSupabase
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

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    let isSocietyMember = false;
    let isSecretaryOrCommittee = false;

    if (user) {
      const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
      const isSecOrCom = await isCommittee(
        user.id,
        poll.society_id,
        serviceSupabase
      );

      const { data: member } = await serviceSupabase
        .from('society_members')
        .select('role, status')
        .eq('society_id', poll.society_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (member) {
        isSocietyMember = true;
      }
      isSecretaryOrCommittee =
        isSecOrCom || isPlatform || poll.organizer_id === user.id;
    }

    // Fetch poll votes
    const { data: votes } = await serviceSupabase
      .from('poll_votes')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false });

    // Fetch vendor invites
    const { data: vendorInvites } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select('*')
      .eq('campaign_id', id);

    // Fetch provider bids (Creator / Secretary or bidding providers can view)
    let bids: any[] = [];
    if (isSecretaryOrCommittee || (user && poll.organizer_id === user.id)) {
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

    // Fetch booking slots
    const { data: slots } = await serviceSupabase
      .from('booking_slots')
      .select('*')
      .eq('campaign_id', id)
      .order('slot_time', { ascending: true });

    // User specific state
    let userVote = null;
    let userBooking = null;

    if (user) {
      userVote = votes?.find((v) => v.user_id === user.id) || null;

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

    // Creator profile
    const { data: creatorProfile } = await serviceSupabase
      .from('profiles')
      .select('id, name, email, phone')
      .eq('id', poll.organizer_id)
      .maybeSingle();

    // Vote options tally
    const voteBreakdown: Record<string, number> = {};
    (poll.poll_options || ['Yes', 'No']).forEach((opt: string) => {
      voteBreakdown[opt] = 0;
    });
    (votes || []).forEach((v) => {
      voteBreakdown[v.option_selected] =
        (voteBreakdown[v.option_selected] || 0) + 1;
    });

    const totalVotes = votes?.length || 0;
    const interestedCount =
      voteBreakdown['Yes'] !== undefined ? voteBreakdown['Yes'] : totalVotes;

    const priceInfo = calculateTierPrice(
      interestedCount,
      poll.pricing_tiers || [],
      poll.current_price
    );

    return NextResponse.json({
      poll: {
        ...poll,
        creator_profile: creatorProfile || null,
        total_votes: totalVotes,
        vote_breakdown: voteBreakdown,
        interested_count: interestedCount,
        poll_votes: votes || [],
        vendor_invites: vendorInvites || [],
        bids,
        bids_count: bids.length,
        slots: slots || [],
        price_info: priceInfo,
        user_vote: userVote,
        user_booking: userBooking,
      },
      is_member: isSocietyMember,
      is_secretary: isSecretaryOrCommittee,
    });
  } catch (err: any) {
    console.error('[API/polls/[id] GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
