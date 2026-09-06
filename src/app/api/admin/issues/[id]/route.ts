import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { isUserSupportAdmin } from '@/lib/admin/auth';
import { logError } from '@/lib/logger';
import { getClientIp, checkAdminRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();
    const hasAdminAccess = await isUserSupportAdmin(user, serviceSupabase);

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: 'Forbidden. Access restricted to administrator account only.' },
        { status: 403 }
      );
    }

    const clientIp = getClientIp(request);
    const rateLimitResult = await checkAdminRateLimit(user.id, clientIp);
    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many admin requests. Please slow down.');
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing issue report ID' }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { status, admin_note } = body || {};

    const allowedStatuses = ['open', 'reviewing', 'resolved', 'wont_fix'];
    const updates: Record<string, any> = {};

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status value. Allowed: ${allowedStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (typeof admin_note === 'string' || admin_note === null) {
      updates.admin_note = admin_note;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    const { data: updatedReport, error: updateError } = await serviceSupabase
      .from('issue_reports')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updatedReport) {
      logError('Database', 'updateIssueReport', updateError, { id }, 'Failed to update issue report');
      return NextResponse.json({ error: 'Issue report not found or update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('API', 'updateIssueReportException', err, {}, 'Exception updating issue report');
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
