import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { logError, createErrorResponse } from '@/lib/logger';

const MAX_RESTORATIONS = 3;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();

    // Fetch current profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('deletion_status, restoration_count, scheduled_purge_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (profile.deletion_status !== 'pending_deletion') {
      return NextResponse.json(
        { error: 'Account is not pending deletion' },
        { status: 400 }
      );
    }

    const currentRestorationCount = profile.restoration_count ?? 0;
    if (currentRestorationCount >= MAX_RESTORATIONS) {
      return NextResponse.json(
        {
          error: `Restoration limit reached (${MAX_RESTORATIONS} restorations maximum). Please contact support.`,
        },
        { status: 403 }
      );
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const now = new Date();

    const newRestorationCount = currentRestorationCount + 1;

    // 1. Restore profile state
    const { error: updateError } = await serviceSupabase
      .from('profiles')
      .update({
        deletion_status: 'active',
        deletion_requested_at: null,
        scheduled_purge_at: null,
        deletion_reason: null,
        deletion_ip_address: null,
        restored_at: now.toISOString(),
        restoration_count: newRestorationCount,
        updated_at: now.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      logError(
        'Database',
        'restoreAccount',
        updateError,
        { userId: user.id },
        'Failed to restore profile state'
      );
      return NextResponse.json(
        { error: 'Failed to restore account' },
        { status: 500 }
      );
    }

    // 2. Reactivate referral status if flagged as pending deletion
    await serviceSupabase
      .from('referrals')
      .update({ status: 'active', updated_at: now.toISOString() })
      .eq('referred_user_id', user.id)
      .eq('status', 'flagged');

    // 3. Append immutable audit log
    await serviceSupabase.from('account_lifecycle_logs').insert({
      user_id: user.id,
      event_type: 'deletion_cancelled',
      actor_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        restoration_number: newRestorationCount,
        max_restorations_allowed: MAX_RESTORATIONS,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account restored successfully!',
      restoration_count: newRestorationCount,
    });
  } catch (err: unknown) {
    return createErrorResponse(
      'API',
      'restoreAccountException',
      err,
      'Internal server error',
      500,
      { step: 'restore_account' }
    );
  }
}
