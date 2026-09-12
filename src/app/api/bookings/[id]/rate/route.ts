import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { submitRatingSchema } from '@/src/shared/validations/ownera';

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
    const parsed = submitRatingSchema.safeParse({ ...json, bookingId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid rating payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { campaignId, providerId, rating, review } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Verify booking belongs to user
    const { data: booking, error: bError } = await serviceSupabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (bError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Defense in depth: the UI only offers rating once a job is marked
    // completed, but enforce it server-side too so the endpoint can't be
    // called directly against a booking that hasn't happened yet.
    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'You can only rate a service after it has been marked completed.' },
        { status: 400 }
      );
    }

    // Insert or update rating
    const { data: ratingRecord, error: rError } = await serviceSupabase
      .from('service_ratings')
      .upsert(
        {
          society_id: booking.society_id,
          booking_id: id,
          user_id: user.id,
          provider_id: providerId,
          campaign_id: campaignId,
          rating,
          review,
        },
        { onConflict: 'booking_id' }
      )
      .select()
      .single();

    if (rError) {
      console.error('[API/bookings/[id]/rate] Rating error:', rError);
      return NextResponse.json(
        { error: 'Failed to record rating' },
        { status: 500 }
      );
    }

    // Recompute provider's average rating
    const { data: allRatings } = await serviceSupabase
      .from('service_ratings')
      .select('rating')
      .eq('provider_id', providerId);

    if (allRatings && allRatings.length > 0) {
      const avg =
        allRatings.reduce((acc, curr) => acc + curr.rating, 0) /
        allRatings.length;
      await serviceSupabase
        .from('providers')
        .update({ rating: Math.round(avg * 10) / 10 })
        .eq('id', providerId);
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your rating and review!',
      rating: ratingRecord,
    });
  } catch (err: any) {
    console.error('[API/bookings/[id]/rate] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
