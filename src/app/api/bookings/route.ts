import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { confirmBookingSchema } from '@/src/shared/validations/ownera';
import { requireSocietyMember, getSocietyBySlug, isPlatformAdmin, isCommittee } from '@/lib/ownera/auth';

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

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'resident';
    const campaignId = searchParams.get('campaignId');
    let societyId = searchParams.get('societyId');
    const societySlug = searchParams.get('societySlug');

    if (societySlug && !societyId) {
      const soc = await getSocietyBySlug(supabase, societySlug);
      if (soc) {
        societyId = soc.id;
      }
    }

    const serviceSupabase = createAdminClient();

    // Query with strict server-side RBAC scoping to prevent recursive RLS nested join issues
    let query = serviceSupabase
      .from('bookings')
      .select(`
        *,
        society:societies(*),
        campaign:service_campaigns(
          *,
          society:societies(*),
          service:services(*)
        ),
        provider:providers(*),
        slot:booking_slots(*),
        service_issue:service_issues(*),
        service_rating:service_ratings(*)
      `)
      .order('created_at', { ascending: false });

    if (societyId) {
      query = query.eq('society_id', societyId);
    }

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    if (role === 'resident') {
      // Resident can only ever view their own bookings
      query = query.eq('user_id', user.id);
    } else if (role === 'organizer' || role === 'secretary' || role === 'committee') {
      // Verify caller is actually authorized committee/secretary in this society or platform admin
      const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
      const isAuthorizedOrg = societyId ? await isCommittee(user.id, societyId, serviceSupabase) : false;

      if (!isPlatform && !isAuthorizedOrg) {
        // Fall back strictly to user's own bookings if not authorized
        query = query.eq('user_id', user.id);
      }
    } else if (role === 'provider') {
      const { data: provider } = await serviceSupabase
        .from('providers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!provider) {
        return NextResponse.json({ bookings: [] });
      }
      query = query.eq('provider_id', provider.id);
    }

    const { data: rawBookings, error: bookingsError } = await query;

    if (bookingsError) {
      console.error('[API/bookings] Error fetching bookings:', bookingsError);
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    if (!rawBookings || rawBookings.length === 0) {
      return NextResponse.json({ bookings: [] });
    }

    // Enrich with user profile info (name, phone, email) for organizers and providers
    const userIds = Array.from(new Set(rawBookings.map((b) => b.user_id).filter(Boolean)));
    const { data: profiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, phone, email')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const enrichedBookings = rawBookings.map((b) => ({
      ...b,
      user_profile: profileMap.get(b.user_id) || null,
    }));

    return NextResponse.json({ bookings: enrichedBookings });
  } catch (err: any) {
    console.error('[API/bookings] Unexpected error:', err);
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
    const parsed = confirmBookingSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid booking data', details: parsed.error.format() }, { status: 400 });
    }

    const { campaignId, flatNumber, quantity, slotId, residentNotes } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Fetch campaign details and verify active society membership
    const { data: campaign, error: campError } = await serviceSupabase
      .from('service_campaigns')
      .select('*, pricing_tiers:campaign_pricing_tiers(*)')
      .eq('id', campaignId)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    try {
      await requireSocietyMember(supabase, user.id, campaign.society_id);
    } catch {
      return NextResponse.json(
        { error: 'You must be a member of this society to book services in this campaign.' },
        { status: 403 }
      );
    }

    const unitPrice = campaign.current_price || 699;
    const depositPerUnit = campaign.deposit_amount !== undefined ? campaign.deposit_amount : 0;
    const totalDeposit = depositPerUnit * quantity;
    const totalAmount = unitPrice * quantity;
    const balanceAmount = totalAmount - totalDeposit;

    // Check if user already booked
    const { data: existingBooking } = await serviceSupabase
      .from('bookings')
      .select('id, slot_id')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .maybeSingle();

    // Check slot availability and capacity
    if (slotId) {
      const { data: targetSlot, error: slotErr } = await serviceSupabase
        .from('booking_slots')
        .select('*')
        .eq('id', slotId)
        .eq('campaign_id', campaignId)
        .single();

      if (slotErr || !targetSlot) {
        return NextResponse.json({ error: 'Selected time slot not found for this campaign.' }, { status: 404 });
      }

      // Check if slot has capacity (unless user is updating their existing booking with the same slot)
      const isSameSlot = existingBooking && existingBooking.slot_id === slotId;
      if (!isSameSlot && (targetSlot.booked_count || 0) >= targetSlot.max_capacity) {
        return NextResponse.json(
          { error: `The ${targetSlot.slot_time} time slot is fully booked. Please select another slot.` },
          { status: 400 }
        );
      }
    }

    let booking;

    if (existingBooking) {
      const oldSlotId = existingBooking.slot_id;
      const { data: updated, error: uErr } = await serviceSupabase
        .from('bookings')
        .update({
          society_id: campaign.society_id,
          flat_number: flatNumber,
          quantity,
          slot_id: slotId || null,
          unit_price: unitPrice,
          deposit_paid: totalDeposit,
          balance_amount: balanceAmount,
          total_amount: totalAmount,
          status: 'confirmed',
          resident_notes: residentNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBooking.id)
        .select()
        .single();

      if (uErr) {
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
      }
      booking = updated;

      // Adjust slot counts if slot changed
      if (oldSlotId && oldSlotId !== slotId) {
        const { data: oldSlot } = await serviceSupabase
          .from('booking_slots')
          .select('booked_count')
          .eq('id', oldSlotId)
          .single();
        if (oldSlot) {
          await serviceSupabase
            .from('booking_slots')
            .update({ booked_count: Math.max(0, (oldSlot.booked_count || 0) - 1) })
            .eq('id', oldSlotId);
        }
      }

      if (slotId && oldSlotId !== slotId) {
        const { data: newSlot } = await serviceSupabase
          .from('booking_slots')
          .select('booked_count')
          .eq('id', slotId)
          .single();
        if (newSlot) {
          await serviceSupabase
            .from('booking_slots')
            .update({ booked_count: (newSlot.booked_count || 0) + 1 })
            .eq('id', slotId);
        }
      }
    } else {
      const { data: created, error: cErr } = await serviceSupabase
        .from('bookings')
        .insert({
          society_id: campaign.society_id,
          campaign_id: campaignId,
          user_id: user.id,
          provider_id: campaign.selected_provider_id || null,
          slot_id: slotId || null,
          flat_number: flatNumber,
          quantity,
          unit_price: unitPrice,
          deposit_paid: totalDeposit,
          balance_amount: balanceAmount,
          total_amount: totalAmount,
          status: 'confirmed',
          resident_notes: residentNotes,
        })
        .select()
        .single();

      if (cErr) {
        console.error('[API/bookings] Error creating booking:', cErr);
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
      }
      booking = created;

      // Increment slot booked count
      if (slotId) {
        const { data: slot } = await serviceSupabase
          .from('booking_slots')
          .select('booked_count')
          .eq('id', slotId)
          .single();

        if (slot) {
          await serviceSupabase
            .from('booking_slots')
            .update({ booked_count: (slot.booked_count || 0) + 1 })
            .eq('id', slotId);
        }
      }
    }

    // Record campaign event with society_id
    await serviceSupabase.from('campaign_events').insert({
      campaign_id: campaignId,
      society_id: campaign.society_id,
      event_type: 'booking_confirmed',
      metadata: {
        booking_id: booking.id,
        user_id: user.id,
        flat_number: flatNumber,
        deposit_paid: totalDeposit,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Booking confirmed for ${flatNumber}! (Pay directly to provider on service day)`,
      booking,
    });
  } catch (err: any) {
    console.error('[API/bookings] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
