import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { isUserSupportAdmin } from '@/lib/admin/auth';
import { logError } from '@/lib/logger';
import { getClientIp, checkAdminRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status') || 'all';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = serviceSupabase
      .from('issue_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status && status !== 'all' && ['open', 'reviewing', 'resolved', 'wont_fix'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: rows, count, error: fetchError } = await query.range(from, to);

    if (fetchError) {
      logError('Database', 'getAdminIssues', fetchError, {}, 'Failed to fetch issue reports');
      return NextResponse.json({ error: 'Failed to fetch issue reports' }, { status: 500 });
    }

    // Resolve user profiles
    const userIds = Array.from(new Set((rows || []).map((r) => r.user_id)));
    const userMap: Record<string, { id: string; email: string; name: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await serviceSupabase
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      (profiles || []).forEach((p) => {
        userMap[p.id] = { id: p.id, email: p.email, name: p.name };
      });
    }

    const items = (rows || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user: userMap[row.user_id] || { id: row.user_id, email: 'Unknown', name: 'Unknown' },
      description: row.description,
      page_url: row.page_url,
      user_agent: row.user_agent,
      status: row.status,
      admin_note: row.admin_note,
      created_at: row.created_at,
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
    logError('API', 'getAdminIssuesException', err, {}, 'Exception fetching admin issue reports');
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
