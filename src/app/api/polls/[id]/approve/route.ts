import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { approvePollSchema } from '@/src/shared/validations/ownera';
import { isCommittee, isPlatformAdmin } from '@/lib/ownera/rbac';

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
    const parsed = approvePollSchema.safeParse({ ...json, campaignId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid approval payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { action, rejectionReason } = parsed.data;
    const serviceSupabase = createAdminClient();

    // Fetch poll
    const { data: poll, error: pollErr } = await serviceSupabase
      .from('service_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (pollErr || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Verify authority: Must be Secretary/Committee in this society or platform_admin
    const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
    const isSecOrCom = await isCommittee(
      user.id,
      poll.society_id,
      serviceSupabase
    );

    if (!isPlatform && !isSecOrCom) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the Society Secretary or Committee can approve society campaigns',
        },
        { status: 403 }
      );
    }

    let nextApprovalStatus = 'approved';
    let nextStatus = 'approved';

    if (action === 'reject') {
      nextApprovalStatus = 'rejected';
      nextStatus = 'cancelled';
    } else {
      nextApprovalStatus = 'approved';
      nextStatus = 'quotes_invited';
    }

    const { data: updatedPoll, error: updateError } = await serviceSupabase
      .from('service_campaigns')
      .update({
        secretary_approval_status: nextApprovalStatus,
        secretary_reviewed_by: user.id,
        secretary_reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || null,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedPoll) {
      return NextResponse.json(
        { error: 'Failed to update campaign approval' },
        { status: 500 }
      );
    }

    // Notify poll creator
    await serviceSupabase.from('notifications').insert({
      user_id: poll.organizer_id,
      title:
        action === 'approve'
          ? 'Society Campaign Approved! 🎉'
          : 'Campaign Update ℹ️',
      message:
        action === 'approve'
          ? `The Secretary approved "${poll.title}". You can now invite and review vendor quotes.`
          : `The Secretary rejected "${poll.title}": ${rejectionReason || 'No specific reason provided.'}`,
      link: `/home`,
      type: 'poll',
    });

    return NextResponse.json({
      success: true,
      message:
        action === 'approve'
          ? 'Campaign approved for vendor outreach!'
          : 'Campaign rejected.',
      poll: updatedPoll,
    });
  } catch (err: any) {
    console.error('[API/polls/[id]/approve] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
