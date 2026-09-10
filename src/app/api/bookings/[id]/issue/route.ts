import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { reportIssueSchema } from '@/src/shared/validations/ownera';

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
    const parsed = reportIssueSchema.safeParse({ ...json, bookingId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid issue payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { description, category, photoUrl, providerId } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Verify booking
    const { data: booking, error: bError } = await serviceSupabase
      .from('bookings')
      .select('*, campaign:service_campaigns(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (bError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Insert issue report with society_id
    const societyId = booking.society_id || booking.campaign?.society_id;
    const { data: issue, error: issueError } = await serviceSupabase
      .from('service_issues')
      .insert({
        society_id: societyId,
        booking_id: id,
        user_id: user.id,
        provider_id: providerId || booking.provider_id || null,
        description,
        category,
        photo_url: photoUrl || null,
        status: 'open',
      })
      .select()
      .single();

    if (issueError) {
      console.error('[API/bookings/[id]/issue] Insert error:', issueError);
      return NextResponse.json(
        { error: 'Failed to record issue report' },
        { status: 500 }
      );
    }

    // Update booking status to disputed
    await serviceSupabase
      .from('bookings')
      .update({ status: 'disputed' })
      .eq('id', id);

    // Update participant status
    await serviceSupabase
      .from('campaign_participants')
      .update({ status: 'issue_reported' })
      .eq('campaign_id', booking.campaign_id)
      .eq('user_id', user.id);

    // Notify campaign organizer
    if (booking.campaign?.organizer_id) {
      await serviceSupabase.from('notifications').insert({
        user_id: booking.campaign.organizer_id,
        title: 'Service Issue Reported ⚠️',
        message: `Flat ${booking.flat_number} reported a problem with ${booking.campaign.title}: "${description.substring(0, 80)}..."`,
        link: `/home`,
        type: 'general',
      });
    }

    return NextResponse.json({
      success: true,
      message:
        'Issue report submitted. The organizer and provider have been notified to assist.',
      issue,
    });
  } catch (err: any) {
    console.error('[API/bookings/[id]/issue] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
