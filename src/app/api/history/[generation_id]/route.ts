import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { logError } from '@/lib/logger';
import { getClientIp, checkHistoryRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

/**
 * Universal Activity History Detail API (GET /api/history/[generation_id] & DELETE)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generation_id: string }> }
) {
  const { generation_id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = await checkHistoryRateLimit(user.id, clientIp);
  if (!rateLimitResult.success) {
    return createRateLimitResponse('Too many history requests. Please try again later.');
  }

  if (!generation_id) {
    return NextResponse.json({ error: 'Missing reference_id parameter' }, { status: 400 });
  }

  const serviceSupabase = createAdminClient();

  try {
    const { data: row, error: fetchError } = await serviceSupabase
      .from('activity_logs')
      .select('*')
      .or(`reference_id.eq.${generation_id},id.eq.${generation_id}`)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Activity record not found' }, { status: 404 });
    }

    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      id: row.id,
      reference_id: row.reference_id,
      created_at: row.created_at,
      action_name: row.action_name || 'task_execution',
      credits_spent: row.credits_spent,
      status: row.status || 'completed',
      summary: row.summary,
      asset_url: row.asset_url,
      payload: row.metadata,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('API', 'getActivityDetailException', err, { generation_id, userId: user.id }, 'Detail view error');
    return NextResponse.json({ error: 'Failed to retrieve activity detail', details: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ generation_id: string }> }
) {
  const { generation_id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = await checkHistoryRateLimit(user.id, clientIp);
  if (!rateLimitResult.success) {
    return createRateLimitResponse('Too many history requests. Please try again later.');
  }

  if (!generation_id) {
    return NextResponse.json({ error: 'Missing reference_id parameter' }, { status: 400 });
  }

  const serviceSupabase = createAdminClient();

  try {
    const { data: row, error: fetchError } = await serviceSupabase
      .from('activity_logs')
      .select('id, user_id, reference_id')
      .or(`reference_id.eq.${generation_id},id.eq.${generation_id}`)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Activity record not found' }, { status: 404 });
    }

    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await serviceSupabase
      .from('activity_logs')
      .delete()
      .eq('id', row.id)
      .eq('user_id', user.id);

    if (deleteError) {
      logError('Database', 'deleteSingleHistory', deleteError, { generation_id, userId: user.id }, 'DB delete failed');
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted_id: generation_id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('API', 'deleteActivityException', err, { generation_id, userId: user.id }, 'Delete exception');
    return NextResponse.json({ error: 'Failed to delete record', details: message }, { status: 500 });
  }
}
