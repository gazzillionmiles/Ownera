import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { selectSlotSchema } from '@/src/shared/validations/ownera';

export async function GET(
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

    const serviceSupabase = createAdminClient();

    const { data: booking, error } = await serviceSupabase
      .from('bookings')
      .select(
        `
        *,
        campaign:service_campaigns(
          *,
          society:societies(*),
          service:services(*)
        ),
        provider:providers(*),
        slot:booking_slots(*),
        service_issue:service_issues(*),
        service_rating:service_ratings(*)
      `
      )
      .eq('id', id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (err: any) {
    console.error('[API/bookings/[id]] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const serviceSupabase = createAdminClient();

    // Verify booking belongs to user
    const { data: existingBooking } = await serviceSupabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (json.slotId) {
      const parsed = selectSlotSchema.safeParse({
        bookingId: id,
        slotId: json.slotId,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid slot selection' },
          { status: 400 }
        );
      }

      // Check slot changing cutoff time (12 hours before scheduled service day)
      const { data: campaign } = await serviceSupabase
        .from('service_campaigns')
        .select('event_date, title')
        .eq('id', existingBooking.campaign_id)
        .maybeSingle();

      if (campaign?.event_date) {
        // Assume service day starts at 09:00 AM local time
        const serviceDateParsed = new Date(`${campaign.event_date}T09:00:00`);
        const now = new Date();
        const diffMs = serviceDateParsed.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 12) {
          return NextResponse.json(
            {
              error: 'SLOT_CHANGE_LOCKED',
              message:
                'Time slot modifications close 12 hours before service day so the provider can organize technician dispatch.',
            },
            { status: 400 }
          );
        }
      }

      // Decrement old slot booked count if changing to a different slot
      if (existingBooking.slot_id && existingBooking.slot_id !== json.slotId) {
        const { data: oldSlot } = await serviceSupabase
          .from('booking_slots')
          .select('booked_count')
          .eq('id', existingBooking.slot_id)
          .single();

        if (oldSlot && (oldSlot.booked_count || 0) > 0) {
          await serviceSupabase
            .from('booking_slots')
            .update({
              booked_count: Math.max(0, (oldSlot.booked_count || 1) - 1),
            })
            .eq('id', existingBooking.slot_id);
        }
      }

      updates.slot_id = json.slotId;
      updates.status = 'scheduled';

      // Increment new slot booked count
      const { data: newSlot } = await serviceSupabase
        .from('booking_slots')
        .select('booked_count')
        .eq('id', json.slotId)
        .single();

      if (newSlot) {
        await serviceSupabase
          .from('booking_slots')
          .update({ booked_count: (newSlot.booked_count || 0) + 1 })
          .eq('id', json.slotId);
      }
    }

    if (json.residentNotes) {
      updates.resident_notes = json.residentNotes;
    }

    const { data: updatedBooking, error: updateError } = await serviceSupabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        campaign:service_campaigns(*),
        provider:providers(*),
        slot:booking_slots(*)
      `
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, booking: updatedBooking });
  } catch (err: any) {
    console.error('[API/bookings/[id]] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
