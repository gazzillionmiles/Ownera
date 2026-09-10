import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { markCompleteSchema } from '@/src/shared/validations/ownera';

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

    const json = await request.json().catch(() => ({}));
    const parsed = markCompleteSchema.safeParse({ ...json, bookingId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { notes } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Fetch booking details
    const { data: booking, error: bError } = await serviceSupabase
      .from('bookings')
      .select('*, campaign:service_campaigns(*), provider:providers(*)')
      .eq('id', id)
      .single();

    if (bError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Determine if actor is provider or resident
    const isResident = booking.user_id === user.id;
    const isProvider = booking.provider?.user_id === user.id;

    if (!isResident && !isProvider) {
      return NextResponse.json(
        {
          error: 'You are not authorized to update completion for this booking',
        },
        { status: 403 }
      );
    }

    if (isProvider) {
      // Provider marks service completed
      await serviceSupabase
        .from('bookings')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      // Record in service_completions
      await serviceSupabase.from('service_completions').insert({
        booking_id: id,
        provider_id: booking.provider_id,
        marked_completed_at: new Date().toISOString(),
        resident_status: 'unconfirmed',
        notes,
      });

      // Update participant status
      await serviceSupabase
        .from('campaign_participants')
        .update({ status: 'completed' })
        .eq('campaign_id', booking.campaign_id)
        .eq('user_id', booking.user_id);

      // Increment provider total_jobs_completed
      if (booking.provider_id) {
        const { data: prov } = await serviceSupabase
          .from('providers')
          .select('total_jobs_completed')
          .eq('id', booking.provider_id)
          .single();

        if (prov) {
          await serviceSupabase
            .from('providers')
            .update({
              total_jobs_completed: (prov.total_jobs_completed || 0) + 1,
            })
            .eq('id', booking.provider_id);
        }
      }

      // Notify resident
      await serviceSupabase.from('notifications').insert({
        user_id: booking.user_id,
        title: 'Service Completed! 🌟',
        message: `Your ${booking.campaign?.title || 'service'} has been marked completed. How was your experience?`,
        link: `/home`,
        type: 'completion',
      });

      return NextResponse.json({
        success: true,
        message:
          'Job marked as completed. Resident has been prompted for confirmation & rating.',
      });
    }

    if (isResident) {
      // Resident confirms service completion
      await serviceSupabase
        .from('service_completions')
        .update({
          resident_status: 'confirmed',
          resident_confirmed_at: new Date().toISOString(),
        })
        .eq('booking_id', id);

      await serviceSupabase
        .from('bookings')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        message: 'Completion confirmed by resident!',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/bookings/[id]/complete] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
