import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { logError } from '@/lib/logger';
import {
  getClientIp,
  checkHistoryRateLimit,
  createRateLimitResponse,
} from '@/lib/ratelimit';

/**
 * Universal Activity History API (GET /api/history & DELETE /api/history)
 * Provides content-agnostic logging and retrieval of user operations.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await getVerifiedUser(request, supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = await checkHistoryRateLimit(user.id, clientIp);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      'Too many history requests. Please try again later.'
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get('limit') || '10', 10))
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const serviceSupabase = createAdminClient();

  try {
    const {
      data: rows,
      count,
      error: fetchError,
    } = await serviceSupabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (fetchError) {
      logError(
        'Database',
        'getHistory',
        fetchError,
        { userId: user.id },
        'Failed to fetch activity logs'
      );
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    const items = (rows || []).map((row) => ({
      id: row.id,
      reference_id: row.reference_id,
      created_at: row.created_at,
      action_name: row.action_name || 'task_execution',
      credits_spent: row.credits_spent,
      status: row.status || 'completed',
      summary: row.summary,
      asset_url: row.asset_url,
      has_result_payload: Boolean(
        row.metadata && Object.keys(row.metadata).length > 0
      ),
    }));

    const total = count || 0;
    const hasMore = to + 1 < total;

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError(
      'API',
      'getHistoryException',
      err,
      { userId: user.id },
      'Unhandled history exception'
    );
    return NextResponse.json(
      { error: 'Failed to retrieve history', details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await getVerifiedUser(request, supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = await checkHistoryRateLimit(user.id, clientIp);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      'Too many history requests. Please try again later.'
    );
  }

  const serviceSupabase = createAdminClient();

  try {
    const { error: dbDeleteError, count } = await serviceSupabase
      .from('activity_logs')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    if (dbDeleteError) {
      logError(
        'Database',
        'deleteAllHistory',
        dbDeleteError,
        { userId: user.id },
        'Failed to delete activity log rows'
      );
      return NextResponse.json(
        { error: 'Failed to delete history records' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted_count: count || 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError(
      'API',
      'deleteAllHistoryException',
      err,
      { userId: user.id },
      'Unhandled wipe history exception'
    );
    return NextResponse.json(
      { error: 'Failed to wipe history', details: message },
      { status: 500 }
    );
  }
}
