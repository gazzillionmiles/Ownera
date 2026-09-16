import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { submitBidSchema } from '@/src/shared/validations/ownera';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();

    // Find provider record for user
    const { data: provider } = await serviceSupabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!provider) {
      return NextResponse.json({ bids: [] });
    }

    const { data: bids, error } = await serviceSupabase
      .from('provider_bids')
      .select(`
        *,
        campaign:service_campaigns(
          *,
          society:societies(*),
          service:services(*)
        )
      `)
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API/providers/bids] Error fetching bids:', error);
      return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
    }

    return NextResponse.json({ bids: bids || [] });
  } catch (err: any) {
    console.error('[API/providers/bids] Unexpected error:', err);
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
    const parsed = submitBidSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid bid data', details: parsed.error.format() }, { status: 400 });
    }

    const {
      campaignId,
      pricePerUnit,
      maxCapacity,
      availableDate,
      serviceDurationMinutes,
      warrantyDays,
      inclusions,
      exclusions,
      notes,
    } = parsed.data;

    const availableStartTime = json.availableStartTime || '10:00 AM';
    const simultaneousCapacity = Number(json.simultaneousCapacity) || Number(json.techniciansCount) || Number(maxCapacity) || 5;
    const techniciansCount = Number(json.techniciansCount) || simultaneousCapacity;
    const estimatedDurationMinutes = Number(json.estimatedDurationMinutes) || Number(serviceDurationMinutes) || 30;
    const totalCapacity = Number(json.totalCapacity) || (simultaneousCapacity * 8) || 40;

    const serviceSupabase = createAdminClient();

    // Ensure provider profile exists for this user
    let { data: provider } = await serviceSupabase
      .from('providers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!provider) {
      // Auto-create a default provider profile if not yet created (defaults to pending review)
      const { data: newProvider, error: pErr } = await serviceSupabase
        .from('providers')
        .insert({
          user_id: user.id,
          company_name: `${user.user_metadata?.name || 'Pro'} Services`,
          contact_person: user.user_metadata?.name || 'Provider',
          phone: user.phone || '9876543210',
          email: user.email || 'provider@ownera.in',
          verification_status: 'pending',
        })
        .select()
        .single();

      if (pErr) {
        return NextResponse.json({ error: 'Failed to create provider profile' }, { status: 500 });
      }
      provider = newProvider;
    }

    // Strict Vendor Verification Guard: Vendors must be manually approved by administrators before submitting bids
    if (provider.verification_status === 'banned') {
      return NextResponse.json(
        { error: 'Your vendor account has been banned by administrators. You cannot submit quotes.' },
        { status: 403 }
      );
    }

    if (provider.verification_status === 'pending' || provider.verification_status === 'unverified') {
      return NextResponse.json(
        { error: 'Your vendor profile is currently under review. Bidding will be enabled once your account is approved by an administrator.' },
        { status: 403 }
      );
    }

    if (provider.verification_status === 'rejected') {
      return NextResponse.json(
        { error: 'Your vendor profile application was rejected by administrators.' },
        { status: 403 }
      );
    }

    // Insert bid
    const { data: bid, error: bidError } = await serviceSupabase
      .from('provider_bids')
      .insert({
        campaign_id: campaignId,
        provider_id: provider.id,
        price_per_unit: pricePerUnit,
        available_date: availableDate,
        available_start_time: availableStartTime,
        simultaneous_capacity: simultaneousCapacity,
        technicians_count: techniciansCount,
        estimated_duration_minutes: estimatedDurationMinutes,
        total_capacity: totalCapacity,
        max_capacity: totalCapacity,
        service_duration_minutes: estimatedDurationMinutes,
        warranty_days: Number(warrantyDays) || 0,
        inclusions: inclusions || [],
        exclusions: exclusions || [],
        notes,
        status: 'submitted',
      })
      .select()
      .single();

    if (bidError) {
      console.error('[API/providers/bids] Error submitting bid:', bidError);
      return NextResponse.json({ error: 'Failed to submit bid' }, { status: 500 });
    }

    // Record campaign event
    await serviceSupabase.from('campaign_events').insert({
      campaign_id: campaignId,
      event_type: 'bid_submitted',
      metadata: {
        provider_id: provider.id,
        company_name: provider.company_name,
        price_per_unit: pricePerUnit,
      },
    });

    // Notify campaign organizer
    const { data: campaign } = await serviceSupabase
      .from('service_campaigns')
      .select('organizer_id, title')
      .eq('id', campaignId)
      .single();

    if (campaign?.organizer_id) {
      await serviceSupabase.from('notifications').insert({
        user_id: campaign.organizer_id,
        title: 'New Bid Received 🎯',
        message: `${provider.company_name} submitted a bid of ₹${pricePerUnit}/unit for "${campaign.title}".`,
        link: `/home`,
        type: 'bid',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Bid of ₹${pricePerUnit} submitted successfully!`,
      bid,
    });
  } catch (err: any) {
    console.error('[API/providers/bids] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
