import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { logError } from '@/lib/logger';
import { getClientIp, checkIssueBurstRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

const redis = Redis.fromEnv();

function getISTDate(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString().split('T')[0];
}

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

    const clientIp = getClientIp(request);
    const burstResult = await checkIssueBurstRateLimit(user.id, clientIp);
    if (!burstResult.success) {
      return createRateLimitResponse('Too many reports submitted. Please wait a minute before submitting another.');
    }

    // Rate-limit: Max 10 reports/day per user via Upstash Redis
    const today = getISTDate();
    const rateLimitKey = `issue_reports_count:${user.id}:${today}`;
    try {
      const currentCount = await redis.incr(rateLimitKey);
      if (currentCount === 1) {
        await redis.expire(rateLimitKey, 86400); // 24-hour TTL
      }
      if (currentCount > 10) {
        return NextResponse.json(
          { error: 'Daily issue report limit reached (10 max per day).' },
          { status: 429 }
        );
      }
    } catch (redisErr) {
      logError('Redis', 'rateLimitIssueReports', redisErr, { userId: user.id }, 'Non-blocking Redis rate limit error');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { description, page_url, user_agent } = body || {};

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json(
        { error: 'Description must be at least 10 characters long.' },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();
    const finalPageUrl = (typeof page_url === 'string' && page_url.trim()) ? page_url.trim() : request.headers.get('referer') || null;
    const finalUserAgent = (typeof user_agent === 'string' && user_agent.trim()) ? user_agent.trim() : request.headers.get('user-agent') || null;

    const { data: report, error: insertError } = await serviceSupabase
      .from('issue_reports')
      .insert({
        user_id: user.id,
        description: description.trim(),
        page_url: finalPageUrl,
        user_agent: finalUserAgent,
        status: 'open',
      })
      .select('*')
      .single();

    if (insertError) {
      logError('Database', 'createIssueReport', insertError, { userId: user.id }, 'Failed to insert issue report');
      return NextResponse.json({ error: 'Failed to save issue report' }, { status: 500 });
    }

    return NextResponse.json({ success: true, report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('API', 'createIssueReportException', err, {}, 'Exception in issue report submission');
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
