import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { selectQuoteSchema } from '@/src/shared/validations/ownera';
import { isCommittee, isPlatformAdmin } from '@/lib/ownera/rbac';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = selectQuoteSchema.safeParse({ ...json, campaignId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid selection payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { bidId } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Fetch campaign
    const { data: campaign, error: campErr } = await serviceSupabase
      .from('service_campaigns')
      .select('*, society:societies(*)')
      .eq('id', id)
      .single();

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify caller is campaign creator or secretary/committee or platform_admin
    const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
    const isSecOrCom = await isCommittee(user.id, campaign.society_id, serviceSupabase);
    const isCreator = campaign.organizer_id === user.id;

    if (!isCreator && !isSecOrCom && !isPlatform) {
      return NextResponse.json(
        { error: 'Forbidden: Only the campaign creator or society secretary can select the winning quote' },
        { status: 403 }
      );
    }

    // Fetch selected bid/quote
    const { data: selectedBid, error: bidErr } = await serviceSupabase
      .from('provider_bids')
      .select('*, provider:providers(*)')
      .eq('id', bidId)
      .eq('campaign_id', id)
      .single();

    if (bidErr || !selectedBid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }

    // Update bids: mark selected as accepted, all others as rejected
    await serviceSupabase
      .from('provider_bids')
      .update({ status: 'rejected' })
      .eq('campaign_id', id);

    await serviceSupabase
      .from('provider_bids')
      .update({ status: 'accepted' })
      .eq('id', bidId);

    // Update campaign: set selected_provider_id, selected_bid_id, current_price, status = 'booking_open'
    await serviceSupabase
      .from('service_campaigns')
      .update({
        selected_provider_id: selectedBid.provider_id || null,
        selected_bid_id: bidId,
        current_price: selectedBid.price_per_unit,
        status: 'booking_open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Dynamic Slot Generation based on Provider Capacity
    // If provider has simultaneous_capacity = 5, duration = 30 min, start = 10:00 AM
    const slotDuration = selectedBid.estimated_duration_minutes || selectedBid.service_duration_minutes || 30;
    const simultaneousCap = selectedBid.simultaneous_capacity || selectedBid.technicians_count || 5;

    // Remove old slots
    await serviceSupabase.from('booking_slots').delete().eq('campaign_id', id);

    // Generate 6 time buckets for service day
    const timeSlots = [
      '10:00 AM - 10:45 AM',
      '11:00 AM - 11:45 AM',
      '12:00 PM - 12:45 PM',
      '02:00 PM - 02:45 PM',
      '03:00 PM - 03:45 PM',
      '04:00 PM - 04:45 PM',
    ];

    const slotRows = timeSlots.map((timeStr) => ({
      campaign_id: id,
      slot_time: timeStr,
      max_capacity: simultaneousCap,
      booked_count: 0,
    }));

    await serviceSupabase.from('booking_slots').insert(slotRows);

    // Notify selected provider if registered
    if (selectedBid.provider?.user_id) {
      await serviceSupabase.from('notifications').insert({
        user_id: selectedBid.provider.user_id,
        title: 'Offer Accepted! 🎉',
        message: `Your quote of ₹${selectedBid.price_per_unit} for "${campaign.title}" was accepted! Residents are now booking slots.`,
        link: `/home`,
        type: 'bid',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Accepted offer from ${selectedBid.provider?.company_name || 'Provider'} for ₹${selectedBid.price_per_unit}/unit. Bookings are now open!`,
      selectedBid,
      capacityPerSlot: simultaneousCap,
    });
  } catch (err: any) {
    console.error('[API/polls/[id]/select-quote] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
