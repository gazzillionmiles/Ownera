import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { createPollSchema } from '@/src/shared/validations/ownera';
import { calculateTierPrice } from '@/lib/ownera/campaigns';
import { getSocietyBySlug, requireSocietyMember, isCommittee } from '@/lib/ownera/auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let societyId = searchParams.get('societyId');
    const societySlug = searchParams.get('societySlug');
    const scope = searchParams.get('scope');

    if (societySlug && !societyId) {
      const soc = await getSocietyBySlug(supabase, societySlug);
      if (soc) {
        societyId = soc.id;
      }
    }

    const serviceSupabase = createAdminClient();

    let query = serviceSupabase
      .from('service_campaigns')
      .select(`
        *,
        society:societies(*),
        service:services(*),
        selected_provider:providers(*),
        selected_bid:provider_bids(*),
        pricing_tiers:campaign_pricing_tiers(*)
      `)
      .order('created_at', { ascending: false });

    if (societyId) {
      query = query.eq('society_id', societyId);
    } else {
      // Scoped strictly to societies the user belongs to
      const { data: userSocieties } = await serviceSupabase
        .from('society_members')
        .select('society_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const allowedSocietyIds = (userSocieties || []).map((m) => m.society_id).filter(Boolean);
      if (allowedSocietyIds.length > 0) {
        query = query.in('society_id', allowedSocietyIds);
      } else {
        return NextResponse.json({
          polls: [],
          active_polls: [],
          my_polls: [],
          society_polls: [],
          upcoming_services: [],
          previous_campaigns: [],
        });
      }
    }

    if (scope) {
      query = query.eq('scope', scope);
    }

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      console.error('[API/polls GET] Error fetching polls:', campaignsError);
      return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        polls: [],
        active_polls: [],
        my_polls: [],
        society_polls: [],
        upcoming_services: [],
        previous_campaigns: [],
      });
    }

    const campaignIds = campaigns.map((c) => c.id);

    // Fetch poll votes
    const { data: votes } = await serviceSupabase
      .from('poll_votes')
      .select('*')
      .in('campaign_id', campaignIds);

    // Fetch bids
    const { data: bids } = await serviceSupabase
      .from('provider_bids')
      .select('*, provider:providers(*)')
      .in('campaign_id', campaignIds);

    // Fetch user bookings
    const { data: userBookings } = await serviceSupabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .in('campaign_id', campaignIds);

    // Fetch vendor invites
    const { data: vendorInvites } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select('*')
      .in('campaign_id', campaignIds);

    // Fetch creator profiles
    const creatorUserIds = Array.from(new Set(campaigns.map((c) => c.organizer_id)));
    const { data: creatorProfiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, email, phone')
      .in('id', creatorUserIds);
    const creatorMap = new Map((creatorProfiles || []).map((p) => [p.id, p]));

    const enrichedPolls = campaigns.map((c) => {
      const campVotes = votes?.filter((v) => v.campaign_id === c.id) || [];
      const campBids = bids?.filter((b) => b.campaign_id === c.id) || [];
      const campInvites = vendorInvites?.filter((vi) => vi.campaign_id === c.id) || [];
      const userVote = campVotes.find((v) => v.user_id === user.id) || null;
      const userBooking = userBookings?.find((ub) => ub.campaign_id === c.id) || null;

      // Group vote counts by option
      const voteBreakdown: Record<string, number> = {};
      (c.poll_options || ['Yes', 'No']).forEach((opt: string) => {
        voteBreakdown[opt] = 0;
      });
      campVotes.forEach((v) => {
        voteBreakdown[v.option_selected] = (voteBreakdown[v.option_selected] || 0) + 1;
      });

      const totalVotes = campVotes.length;
      const interestedCount = voteBreakdown['Yes'] !== undefined
        ? voteBreakdown['Yes']
        : totalVotes;

      const priceInfo = calculateTierPrice(
        interestedCount,
        c.pricing_tiers || [],
        c.current_price
      );

      return {
        ...c,
        creator_profile: creatorMap.get(c.organizer_id) || null,
        total_votes: totalVotes,
        vote_breakdown: voteBreakdown,
        interested_count: interestedCount,
        poll_votes: campVotes,
        bids: campBids,
        bids_count: campBids.length,
        vendor_invites: campInvites,
        user_vote: userVote,
        user_booking: userBooking,
        price_info: priceInfo,
      };
    });

    // Categorized feeds for Home Dashboard
    const activePolls = enrichedPolls.filter(
      (p) => p.status === 'poll_active' || p.status === 'open' || p.status === 'threshold_reached' || p.status === 'pending_secretary_approval'
    );
    const myPolls = enrichedPolls.filter((p) => p.organizer_id === user.id);
    const societyPolls = enrichedPolls.filter((p) => p.scope === 'society');
    const upcomingServices = enrichedPolls.filter(
      (p) => p.status === 'quote_selected' || p.status === 'booking_open' || p.status === 'scheduled' || p.status === 'in_progress'
    );
    const previousCampaigns = enrichedPolls.filter((p) => p.status === 'completed');

    return NextResponse.json({
      polls: enrichedPolls,
      active_polls: activePolls,
      my_polls: myPolls,
      society_polls: societyPolls,
      upcoming_services: upcomingServices,
      previous_campaigns: previousCampaigns,
    });
  } catch (err: any) {
    console.error('[API/polls GET] Unexpected error:', err);
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
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createPollSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid poll data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      societyId,
      scope,
      targetPropertyUnit,
      serviceId,
      isCustomService,
      customServiceName,
      title,
      description,
      pollQuestion,
      pollOptions,
      pollDeadlineDays,
      eventDate,
      minimumCustomers,
      targetCustomers,
    } = parsed.data;

    const serviceSupabase = createAdminClient();

    // Verify society exists in database (check by id, slug, or invite code)
    const isSocietyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(societyId);
    let socQuery = serviceSupabase.from('societies').select('id, name, slug');
    if (isSocietyUuid) {
      socQuery = socQuery.or(`id.eq.${societyId},slug.ilike.${societyId}`);
    } else {
      socQuery = socQuery.or(`slug.ilike.${societyId},invite_code.ilike.${societyId}`);
    }
    const { data: societiesList, error: socErr } = await socQuery;
    const targetSociety = societiesList && societiesList.length > 0 ? societiesList[0] : null;

    if (socErr || !targetSociety) {
      return NextResponse.json(
        { error: 'Society not found. Please select or join a valid society first.' },
        { status: 404 }
      );
    }

    const resolvedSocietyId = targetSociety.id;

    // Verify user belongs to society
    try {
      await requireSocietyMember(supabase, user.id, resolvedSocietyId);
    } catch {
      // Auto-join as resident to this confirmed society if user is not yet a member
      await serviceSupabase.from('society_members').upsert({
        society_id: resolvedSocietyId,
        user_id: user.id,
        flat_number: targetPropertyUnit || 'Resident Unit',
        unit_number: targetPropertyUnit || 'Resident Unit',
        role: 'resident',
        status: 'active',
      }, { onConflict: 'society_id,user_id' });
    }

    // Check if caller is Secretary / Committee
    const isSecOrCom = await isCommittee(user.id, resolvedSocietyId, serviceSupabase);

    // Determine initial approval status & lifecycle status
    let secretaryApprovalStatus: 'none' | 'pending' | 'approved' = 'pending';
    let initialStatus: string = 'poll_active';

    if (scope === 'my_house') {
      // Individual house request: No secretary approval required
      secretaryApprovalStatus = 'none';
      initialStatus = 'approved';
    } else if (isSecOrCom) {
      // Created directly by Secretary / Committee: Auto-approved
      secretaryApprovalStatus = 'approved';
      initialStatus = 'poll_active';
    } else {
      // Created by resident for society: Pending secretary sign-off for vendor campaign
      secretaryApprovalStatus = 'pending';
      initialStatus = 'poll_active';
    }

    // Resolve service info safely (no random service fallbacks)
    let basePrice = 699;
    let finalServiceId: string | null = null;

    if (!isCustomService && serviceId && serviceId.trim()) {
      const cleanServiceId = serviceId.trim();
      const isServiceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanServiceId);

      let servQuery = serviceSupabase.from('services').select('id, base_price_estimate, name, slug');
      if (isServiceUuid) {
        servQuery = servQuery.or(`id.eq.${cleanServiceId},slug.ilike.${cleanServiceId}`);
      } else {
        servQuery = servQuery.or(`slug.ilike.${cleanServiceId},name.ilike.${cleanServiceId}`);
      }

      const { data: servList } = await servQuery.limit(1);
      const serv = servList && servList.length > 0 ? servList[0] : null;

      if (serv) {
        finalServiceId = serv.id;
        basePrice = Number(serv.base_price_estimate) || 699;
      }
    }

    if (!isCustomService && !finalServiceId) {
      // Check if standard service with matching name exists
      const targetName = (customServiceName || title || '').trim();
      if (targetName) {
        const { data: matchServ } = await serviceSupabase
          .from('services')
          .select('id, base_price_estimate')
          .ilike('name', targetName)
          .maybeSingle();

        if (matchServ) {
          finalServiceId = matchServ.id;
          basePrice = Number(matchServ.base_price_estimate) || 699;
        }
      }
    }

    const pollDeadline = new Date(Date.now() + (pollDeadlineDays || 5) * 86400000).toISOString();

    // Create Poll / Campaign
    const { data: poll, error: pollError } = await serviceSupabase
      .from('service_campaigns')
      .insert({
        society_id: resolvedSocietyId,
        organizer_id: user.id,
        service_id: finalServiceId,
        title,
        description,
        scope,
        target_property_unit: targetPropertyUnit || null,
        poll_question: pollQuestion,
        poll_options: pollOptions,
        poll_deadline: pollDeadline,
        secretary_approval_status: secretaryApprovalStatus,
        is_custom_service: isCustomService,
        custom_service_name: customServiceName || null,
        event_date: eventDate,
        interest_deadline: pollDeadline,
        booking_deadline: new Date(new Date(eventDate).getTime() - 86400000).toISOString(),
        minimum_customers: minimumCustomers,
        target_customers: targetCustomers,
        deposit_amount: 0, // Zero payments in MVP
        status: initialStatus,
        current_price: basePrice,
      })
      .select()
      .single();

    if (pollError || !poll) {
      console.error('[API/polls POST] Error creating poll:', pollError);
      return NextResponse.json({ error: pollError?.message || 'Failed to create poll' }, { status: 500 });
    }

    // Automatically record vote for creator as first option
    await serviceSupabase.from('poll_votes').upsert({
      campaign_id: poll.id,
      user_id: user.id,
      option_selected: pollOptions[0] || 'Yes',
      unit_identifier: targetPropertyUnit || 'Resident Unit',
      notes: 'Poll Creator Vote',
    }, { onConflict: 'campaign_id,user_id' });

    // Notify Secretary if pending approval
    if (secretaryApprovalStatus === 'pending') {
      const { data: secretaryMember } = await serviceSupabase
        .from('society_members')
        .select('user_id')
        .eq('society_id', societyId)
        .eq('role', 'secretary')
        .eq('status', 'active')
        .maybeSingle();

      if (secretaryMember?.user_id) {
        await serviceSupabase.from('notifications').insert({
          user_id: secretaryMember.user_id,
          title: 'New Society Poll Created 📋',
          message: `${user.user_metadata?.name || 'A resident'} created "${title}". Review and approve for vendor outreach.`,
          link: `/home`,
          type: 'poll',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: scope === 'my_house'
        ? 'Individual request created!'
        : secretaryApprovalStatus === 'approved'
        ? 'Society poll active!'
        : 'Poll created! Sent to secretary for vendor approval.',
      poll,
    });
  } catch (err: any) {
    console.error('[API/polls POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
