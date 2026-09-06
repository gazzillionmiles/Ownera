import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let societyId = searchParams.get('societyId');
    const societySlug = searchParams.get('societySlug');
    const status = searchParams.get('status');

    if (societySlug && !societyId) {
      const soc = await getSocietyBySlug(supabase, societySlug);
      if (soc) {
        societyId = soc.id;
      }
    }

    // Query via user-authenticated client under RLS
    let query = supabase
      .from('service_campaigns')
      .select(`
        *,
        society:societies(*),
        service:services(*),
        pricing_tiers:campaign_pricing_tiers(*),
        selected_provider:providers(*)
      `)
      .order('created_at', { ascending: false });

    if (societyId) {
      query = query.eq('society_id', societyId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      console.error('[API/campaigns] Error fetching campaigns:', campaignsError);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ campaigns: [] });
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
      const campParts = participants?.filter((p) => p.campaign_id === c.id) || [];
      const interestedList = campParts.filter((p) => p.status === 'interested');
      const confirmedList = campParts.filter((p) => p.status === 'confirmed');
      const completedList = campParts.filter((p) => p.status === 'completed');
      
      const interestedCount = interestedList.length + confirmedList.length;
      const confirmedCount = confirmedList.length;
      const completedCount = completedList.length;
      const campBids = bids?.filter((b) => b.campaign_id === c.id) || [];
      const campSlots = slots?.filter((s) => s.campaign_id === c.id) || [];

      const userPart = campParts.find((p) => p.user_id === user.id) || null;
      const userBooking = userBookings?.find((ub) => ub.campaign_id === c.id) || null;

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

    return NextResponse.json({ campaigns: enrichedCampaigns });
  } catch (err: any) {
    console.error('[API/campaigns] Unexpected error:', err);
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

    const json = await request.json();
    const parsed = createCampaignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid campaign data', details: parsed.error.format() }, { status: 400 });
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
        { error: authErr.message || 'You must be an organizer of this society to create campaigns.' },
        { status: 403 }
      );
    }

    // Base price is the highest price tier or starting tier
    const sortedTiers = [...(pricingTiers || [])].sort((a: any, b: any) => a.min_quantity - b.min_quantity);
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
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    // Insert Pricing Tiers
    const tierRows = ((parsed.data as any).pricingTiers || []).map((t: any, idx: number) => ({
      campaign_id: campaign.id,
      min_quantity: t.min_quantity,
      max_quantity: t.max_quantity || null,
      price_per_unit: t.price_per_unit,
      tier_order: idx + 1,
    }));

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
