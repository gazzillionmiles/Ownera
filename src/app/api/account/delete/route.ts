import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { logError } from '@/lib/logger';

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

    let body: { confirmation_text?: string; reason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body optional
    }

    if (body.confirmation_text !== 'DELETE') {
      return NextResponse.json(
        { error: 'Invalid confirmation text. Please type DELETE to confirm.' },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();

    // Check profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('deletion_status, restoration_count')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (profile.deletion_status === 'pending_deletion') {
      return NextResponse.json(
        { error: 'Account is already pending deletion' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const now = new Date();
    const purgeDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day grace period

    // 1. Update profiles table to pending_deletion
    const { error: updateError } = await serviceSupabase
      .from('profiles')
      .update({
        deletion_status: 'pending_deletion',
        deletion_requested_at: now.toISOString(),
        scheduled_purge_at: purgeDate.toISOString(),
        deletion_reason: body.reason ? body.reason.substring(0, 500) : null,
        deletion_ip_address: ipAddress,
        updated_at: now.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      logError('Database', 'requestAccountDeletion', updateError, { userId: user.id }, 'Failed to set deletion_status');
      return NextResponse.json({ error: 'Failed to request account deletion' }, { status: 500 });
    }

    // 2. Append immutable audit log
    await serviceSupabase.from('account_lifecycle_logs').insert({
      user_id: user.id,
      event_type: 'deletion_requested',
      actor_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        reason: body.reason || null,
        scheduled_purge_at: purgeDate.toISOString(),
      },
    });

    // 3. Sign out session on server
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: 'Account scheduled for deletion in 30 days',
      scheduled_purge_at: purgeDate.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('API', 'deleteAccountException', err, {}, 'Unhandled deletion request exception');
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
