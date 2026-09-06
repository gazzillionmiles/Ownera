import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { votePollSchema } from '@/src/shared/validations/ownera';
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
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to vote.' },
        { status: 401 }
      );
    }

    const json = await request.json().catch(() => ({}));
    const parsed = votePollSchema.safeParse({ ...json, campaignId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid vote payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { optionSelected, unitIdentifier, notes } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Verify campaign exists
    const { data: poll, error: pollErr } = await serviceSupabase
      .from('service_campaigns')
      .select('*, pricing_tiers:campaign_pricing_tiers(*)')
      .eq('id', id)
      .maybeSingle();

    if (pollErr || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Verify user is a member of this society
    try {
      await requireSocietyMember(supabase, user.id, poll.society_id);
    } catch {
      return NextResponse.json(
        { error: 'You must be a member of this society to participate in its polls.' },
        { status: 403 }
      );
    }

    // Check if user already voted
    const { data: existingVote } = await serviceSupabase
      .from('poll_votes')
      .select('*')
      .eq('campaign_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    let voteRecord;

    if (existingVote) {
      const { data: updated, error: uErr } = await serviceSupabase
        .from('poll_votes')
        .update({
          option_selected: optionSelected,
          unit_identifier: unitIdentifier,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVote.id)
        .select()
        .single();

      if (uErr) {
        return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 });
      }
      voteRecord = updated;
    } else {
      const { data: created, error: cErr } = await serviceSupabase
        .from('poll_votes')
        .insert({
          campaign_id: id,
          user_id: user.id,
          option_selected: optionSelected,
          unit_identifier: unitIdentifier,
          notes: notes || null,
        })
        .select()
        .single();

      if (cErr) {
        return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
      }
      voteRecord = created;
    }

    // Also sync campaign_participants for backwards compatibility
    await serviceSupabase
      .from('campaign_participants')
      .upsert(
        {
          campaign_id: id,
          user_id: user.id,
          quantity: 1,
          unit_identifier: unitIdentifier,
          status: optionSelected.toLowerCase() === 'no' ? 'cancelled' : 'interested',
          notes: `Voted: ${optionSelected}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'campaign_id,user_id' }
      );

    // Recalculate affirmative vote count and pricing
    const { data: allVotes } = await serviceSupabase
      .from('poll_votes')
      .select('option_selected')
      .eq('campaign_id', id);

    const affirmativeCount = (allVotes || []).filter(
      (v) => v.option_selected.toLowerCase() !== 'no'
    ).length;

    const priceInfo = calculateTierPrice(
      affirmativeCount,
      poll.pricing_tiers || [],
      poll.current_price
    );

    let pollStatus = poll.status;
    if (affirmativeCount >= poll.minimum_customers && pollStatus === 'open') {
      pollStatus = 'threshold_reached';
    }

    await serviceSupabase
      .from('service_campaigns')
      .update({
        current_price: priceInfo.currentPrice,
        status: pollStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      message: `Vote recorded: "${optionSelected}"`,
      vote: voteRecord,
      total_votes: allVotes?.length || 1,
      affirmative_count: affirmativeCount,
      current_price: priceInfo.currentPrice,
    });
  } catch (err: any) {
    console.error('[API/polls/[id]/vote] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
