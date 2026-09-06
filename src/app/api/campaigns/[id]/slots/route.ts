import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const serviceSupabase = createAdminClient();

    const { data: slots, error } = await serviceSupabase
      .from('booking_slots')
      .select('*')
      .eq('campaign_id', id)
      .order('slot_time', { ascending: true });

    if (error) {
      console.error('[API/campaigns/[id]/slots] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
    }

    return NextResponse.json({ slots: slots || [] });
  } catch (err: any) {
    console.error('[API/campaigns/[id]/slots] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { slotTime, maxCapacity = 5 } = json;

    if (!slotTime || typeof slotTime !== 'string') {
      return NextResponse.json({ error: 'slotTime is required' }, { status: 400 });
    }

    const serviceSupabase = createAdminClient();

    const { data: slot, error } = await serviceSupabase
      .from('booking_slots')
      .insert({
        campaign_id: id,
        slot_time: slotTime,
        max_capacity: maxCapacity,
        booked_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[API/campaigns/[id]/slots] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
    }

    return NextResponse.json({ success: true, slot });
  } catch (err: any) {
    console.error('[API/campaigns/[id]/slots] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
