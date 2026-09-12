import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { logError, createErrorResponse } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logError('API', 'historyCleanupConfigError', new Error('CRON_SECRET not configured'), {}, 'Missing CRON_SECRET environment variable');
    return NextResponse.json({ error: 'Cron service configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const secretHeader = request.headers.get('x-cron-secret') || '';

  const isAuthorized =
    authHeader === `Bearer ${expectedSecret}` ||
    secretHeader === expectedSecret;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized cron caller' }, { status: 401 });
  }

  const RETENTION_DAYS = 90;
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const serviceSupabase = createAdminClient();

  try {
    // Delete database records older than retention window
    const { data: deletedRows, error: deleteError } = await serviceSupabase
      .from('activity_logs')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id');

    if (deleteError) {
      logError('Database', 'cleanupDeleteRows', deleteError, { cutoffDate }, 'Failed to delete expired activity log rows');
      return NextResponse.json({ error: 'Failed to delete expired activity log rows' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cleaned_count: deletedRows?.length || 0,
      retention_days: RETENTION_DAYS,
      cutoff: cutoffDate,
    });
  } catch (err: unknown) {
    return createErrorResponse(
      'API',
      'historyCleanupException',
      err,
      'Failed during history cleanup',
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
