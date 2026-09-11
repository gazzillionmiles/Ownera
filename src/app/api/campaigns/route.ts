import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { createCampaignSchema } from '@/src/shared/validations/ownera';
import { calculateTierPrice } from '@/lib/ownera/campaigns';
import { requireOrganizer, getSocietyBySlug } from '@/lib/ownera/auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let societyId = searchParams.get('societyId');
    const societySlug = searchParams.get('societySlug');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const rangeStart = (page - 1) * limit;
    const rangeEnd = rangeStart + limit - 1;

    if (societySlug && !societyId) {
      const soc = await getSocietyBySlug(supabase, societySlug);
      if (soc) {
        societyId = soc.id;
      }
    }

    // Column list mirrors the ServiceCampaign/Society/ServiceCatalogItem/
    // Provider/PricingTier interfaces in src/types/ownera.ts instead of
    // `select('*')`.
    const CAMPAIGN_COLUMNS = `
      id, society_id, organizer_id, service_id, title, description, scope, target_property_unit,
      poll_question, poll_options, poll_deadline, secretary_approval_status, secretary_reviewed_by,
      secretary_reviewed_at, rejection_reason, is_custom_service, custom_service_name, event_date,
      interest_deadline, booking_deadline, minimum_customers, target_customers, maximum_customers,
      deposit_amount, status, selected_provider_id, selected_bid_id, current_price, published_at,
      created_at, updated_at,
      society:societies(id, name, slug, address, city, state, pincode, total_homes, created_by, created_at, updated_at),
      service:services(id, name, slug, category, description, inclusions, exclusions, typical_duration_minutes, suggested_campaign_days, suggested_slot_duration_minutes, base_price_estimate, icon, created_at),
      pricing_tiers:campaign_pricing_tiers(id, campaign_id, min_quantity, max_quantity, price_per_unit, tier_order, created_at),
      selected_provider:providers(id, user_id, company_name, contact_person, phone, email, services_offered, operating_cities, verification_status, rating, total_jobs_completed, completion_rate, bio, created_at, updated_at)
    `;

    // Query via user-authenticated client under RLS
    let query = supabase
      .from('service_campaigns')
      .select(CAMPAIGN_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (societyId) {
      query = query.eq('society_id', societyId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, error: campaignsError, count } = await query;
    const total = count ?? 0;
    const hasMore = rangeStart + (campaigns?.length || 0) < total;

    if (campaignsError) {
      console.error(
        '[API/campaigns] Error fetching campaigns:',
        campaignsError
      );
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ campaigns: [], page, limit, total, hasMore });
    }

    const campaignIds = campaigns.map((c) => c.id);

    // Fetch participant counts under RLS
    const { data: participants } = await supabase
      .from('campaign_participants')
      .select('campaign_id, status, user_id, quantity')
      .in('campaign_id', campaignIds);

    // Fetch provider bids under RLS
    const { data: bids } = await supabase
      .from('provider_bids')
      .select('*, provider:providers(*)')
      .in('campaign_id', campaignIds)
      .order('price_per_unit', { ascending: true });

    // Fetch booking slots under RLS
    const { data: slots } = await supabase
      .from('booking_slots')
      .select('*')
      .in('campaign_id', campaignIds)
      .order('slot_time', { ascending: true });

    // Fetch user bookings under RLS
    const { data: userBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .in('campaign_id', campaignIds);

    const enrichedCampaigns = campaigns.map((c) => {
      const campParts =
        participants?.filter((p) => p.campaign_id === c.id) || [];
      const interestedList = campParts.filter((p) => p.status === 'interested');
      const confirmedList = campParts.filter((p) => p.status === 'confirmed');
      const completedList = campParts.filter((p) => p.status === 'completed');

      const interestedCount = interestedList.length + confirmedList.length;
      const confirmedCount = confirmedList.length;
      const completedCount = completedList.length;
      const campBids = bids?.filter((b) => b.campaign_id === c.id) || [];
      const campSlots = slots?.filter((s) => s.campaign_id === c.id) || [];

      const userPart = campParts.find((p) => p.user_id === user.id) || null;
      const userBooking =
        userBookings?.find((ub) => ub.campaign_id === c.id) || null;

      const totalActiveParticipants = campParts
        .filter((p) => p.status === 'interested' || p.status === 'confirmed')
        .reduce((sum, p) => sum + (p.quantity || 1), 0);

      const priceInfo = calculateTierPrice(
        totalActiveParticipants,
        c.pricing_tiers || [],
        c.current_price
      );

      return {
        ...c,
        interested_count: interestedCount,
        confirmed_count: confirmedCount,
        completed_count: completedCount,
        bids_count: campBids.length,
        bids: campBids,
        slots: campSlots,
        price_info: priceInfo,
        user_participant: userPart,
        user_booking: userBooking,
      };
    });

    return NextResponse.json({
      campaigns: enrichedCampaigns,
      page,
      limit,
      total,
      hasMore,
    });
  } catch (err: any) {
    console.error('[API/campaigns] Unexpected error:', err);
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
    const parsed = createCampaignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid campaign data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      societyId,
      serviceId,
      title,
      description,
      eventDate,
      interestDeadline,
      bookingDeadline,
      minimumCustomers,
      targetCustomers,
      maximumCustomers,
      depositAmount,
      pricingTiers,
    } = parsed.data;

    // Strict Organizer Authorization Check
    try {
      await requireOrganizer(supabase, user.id, societyId);
    } catch (authErr: any) {
      return NextResponse.json(
        {
          error:
            authErr.message ||
            'You must be an organizer of this society to create campaigns.',
        },
        { status: 403 }
      );
    }

    // Base price is the highest price tier or starting tier
    const sortedTiers = [...(pricingTiers || [])].sort(
      (a: any, b: any) => a.min_quantity - b.min_quantity
    );
    const startingPrice = sortedTiers[0]?.price_per_unit || 699;

    const serviceSupabase = createAdminClient();

    // Verify society exists
    const { data: targetSociety, error: socErr } = await serviceSupabase
      .from('societies')
      .select('id, name')
      .eq('id', societyId)
      .maybeSingle();

    if (socErr || !targetSociety) {
      return NextResponse.json({ error: 'Society not found' }, { status: 404 });
    }

    // Create Campaign
    const { data: campaign, error: campaignError } = await serviceSupabase
      .from('service_campaigns')
      .insert({
        society_id: societyId,
        organizer_id: user.id,
        service_id: serviceId || null,
        title,
        description,
        event_date: eventDate,
        interest_deadline: interestDeadline,
        booking_deadline: bookingDeadline,
        minimum_customers: minimumCustomers,
        target_customers: targetCustomers,
        maximum_customers: maximumCustomers,
        deposit_amount: depositAmount,
        status: 'open',
        current_price: startingPrice,
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      console.error('[API/campaigns] Error creating campaign:', campaignError);
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      );
    }

    // Insert Pricing Tiers
    const tierRows = ((parsed.data as any).pricingTiers || []).map(
      (t: any, idx: number) => ({
        campaign_id: campaign.id,
        min_quantity: t.min_quantity,
        max_quantity: t.max_quantity || null,
        price_per_unit: t.price_per_unit,
        tier_order: idx + 1,
      })
    );

    await serviceSupabase.from('campaign_pricing_tiers').insert(tierRows);

    // Create default time slots for the service day
    const defaultSlots = [
      '09:00 AM - 10:30 AM',
      '11:00 AM - 12:30 PM',
      '02:00 PM - 03:30 PM',
      '04:00 PM - 05:30 PM',
    ];

    await serviceSupabase.from('booking_slots').insert(
      defaultSlots.map((time) => ({
        campaign_id: campaign.id,
        slot_time: time,
        max_capacity: 6,
        booked_count: 0,
      }))
    );

    // Record campaign creation event with society_id
    await serviceSupabase.from('campaign_events').insert({
      campaign_id: campaign.id,
      society_id: societyId,
      event_type: 'campaign_created',
      metadata: { created_by: user.id, title, event_date: eventDate },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    console.error('[API/campaigns] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
