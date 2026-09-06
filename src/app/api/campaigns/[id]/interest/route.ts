import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { expressInterestSchema } from '@/src/shared/validations/ownera';
import { calculateTierPrice } from '@/lib/ownera/campaigns';
import { requireSocietyMember } from '@/lib/ownera/auth';

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
      return NextResponse.json({ error: 'Unauthorized. Please sign in to participate.' }, { status: 401 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = expressInterestSchema.safeParse({ ...json, campaignId: id });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid participation payload', details: parsed.error.format() }, { status: 400 });
    }

    const { quantity, unitIdentifier, notes } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Verify campaign exists and user is an active member of its society
    const { data: campaign, error: campErr } = await serviceSupabase
      .from('service_campaigns')
      .select('*, pricing_tiers:campaign_pricing_tiers(*)')
      .eq('id', id)
      .maybeSingle();

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    try {
      await requireSocietyMember(supabase, user.id, campaign.society_id);
    } catch (memErr: any) {
      return NextResponse.json(
        { error: 'You must be a member of this society to participate in its campaigns.' },
        { status: 403 }
      );
    }

    // Check if participant already exists
    const { data: existing } = await serviceSupabase
      .from('campaign_participants')
      .select('*')
      .eq('campaign_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    let newStatus = 'interested';
    let message = 'You have expressed interest in this campaign!';

    if (existing) {
      if (existing.status === 'interested') {
        // Toggle off
        newStatus = 'cancelled';
        message = 'You have removed your interest from this campaign.';
      } else if (existing.status === 'cancelled') {
        newStatus = 'interested';
        message = 'You are now interested in this campaign!';
      } else {
        return NextResponse.json({
          error: `Cannot toggle interest while in state: ${existing.status}`,
        }, { status: 400 });
      }

      await serviceSupabase
        .from('campaign_participants')
        .update({
          status: newStatus,
          quantity,
          unit_identifier: unitIdentifier,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await serviceSupabase
        .from('campaign_participants')
        .insert({
          campaign_id: id,
          user_id: user.id,
          quantity,
          unit_identifier: unitIdentifier,
          status: 'interested',
          notes,
        });
    }

    // Recalculate interested counts and update pricing
    const { data: allParticipants } = await serviceSupabase
      .from('campaign_participants')
      .select('quantity, status')
      .eq('campaign_id', id)
      .in('status', ['interested', 'confirmed']);

    const totalCount = allParticipants?.length || 0;

    const priceInfo = calculateTierPrice(totalCount, campaign.pricing_tiers || [], campaign.current_price);
    
    let campaignStatus = campaign.status;
    if (totalCount >= campaign.minimum_customers && campaignStatus === 'open') {
      campaignStatus = 'threshold_reached';
      // Record threshold reached event
      await serviceSupabase.from('campaign_events').insert({
        campaign_id: id,
        society_id: campaign.society_id,
        event_type: 'threshold_reached',
        metadata: { total_participants: totalCount, unlocked_price: priceInfo.currentPrice },
      });
    }

    await serviceSupabase
      .from('service_campaigns')
      .update({
        current_price: priceInfo.currentPrice,
        status: campaignStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log campaign event
    await serviceSupabase.from('campaign_events').insert({
      campaign_id: id,
      society_id: campaign.society_id,
      event_type: newStatus === 'interested' ? 'interest_added' : 'interest_removed',
      metadata: { user_id: user.id, quantity, unit_identifier: unitIdentifier },
    });

    return NextResponse.json({
      success: true,
      message,
      status: newStatus,
    });
  } catch (err: any) {
    console.error('[API/campaigns/[id]/interest] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
