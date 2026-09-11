import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { selectProviderBidSchema } from '@/src/shared/validations/ownera';
import { requireOrganizer } from '@/lib/ownera/auth';

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
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = selectProviderBidSchema.safeParse({
      ...json,
      campaignId: id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid selection payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { bidId, providerId } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Check that campaign exists
    const { data: campaign, error: campError } = await serviceSupabase
      .from('service_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (campError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Check that user is an organizer of this society or the creator
    try {
      await requireOrganizer(supabase, user.id, campaign.society_id);
    } catch {
      if (campaign.organizer_id !== user.id) {
        return NextResponse.json(
          { error: 'Only the society organizer can select a provider' },
          { status: 403 }
        );
      }
    }

    // Check bid exists
    const { data: bid, error: bidError } = await serviceSupabase
      .from('provider_bids')
      .select('*, provider:providers(*)')
      .eq('id', bidId)
      .eq('campaign_id', id)
      .single();

    if (bidError || !bid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }

    // Update all bids for this campaign: accept selected, reject others
    await serviceSupabase
      .from('provider_bids')
      .update({ status: 'rejected' })
      .eq('campaign_id', id);

    await serviceSupabase
      .from('provider_bids')
      .update({ status: 'accepted' })
      .eq('id', bidId);

    // Update campaign with selected provider & bid, transition status to 'booking_open'
    await serviceSupabase
      .from('service_campaigns')
      .update({
        selected_provider_id: providerId,
        selected_bid_id: bidId,
        current_price: bid.price_per_unit,
        status: 'booking_open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log campaign event with society_id
    await serviceSupabase.from('campaign_events').insert({
      campaign_id: id,
      society_id: campaign.society_id,
      event_type: 'provider_selected',
      metadata: {
        provider_id: providerId,
        company_name: bid.provider?.company_name,
        winning_price: bid.price_per_unit,
      },
    });

    // Notify provider
    if (bid.provider?.user_id) {
      await serviceSupabase.from('notifications').insert({
        user_id: bid.provider.user_id,
        title: 'Bid Accepted! 🎉',
        message: `Your bid of ₹${bid.price_per_unit} for "${campaign.title}" was selected by the organizer!`,
        link: `/home`,
        type: 'bid',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Selected ${bid.provider?.company_name || 'Provider'} for ₹${bid.price_per_unit}/unit. Bookings are now open!`,
      selectedProvider: bid.provider,
      selectedBid: bid,
    });
  } catch (err: any) {
    console.error(
      '[API/campaigns/[id]/select-provider] Unexpected error:',
      err
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
