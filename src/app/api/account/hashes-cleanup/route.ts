import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { logError, log } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logError('API', 'hashesCleanupConfigError', new Error('CRON_SECRET not configured'), {}, 'Missing CRON_SECRET');
    return NextResponse.json({ error: 'Cron configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const secretHeader = request.headers.get('x-cron-secret') || '';

  const isAuthorized =
    authHeader === `Bearer ${expectedSecret}` ||
    secretHeader === expectedSecret;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized cron caller' }, { status: 401 });
  }

  const serviceSupabase = createAdminClient();
  const now = new Date().toISOString();

  try {
    // 1. Clear expired device fingerprint hashes (retained for 180 days)
    const { data: expiredHashes, error: selectError } = await serviceSupabase
      .from('deleted_account_hashes')
      .select('id')
      .lte('fp_expires_at', now)
      .not('fingerprint_hash', 'is', null);

    let fpClearedCount = 0;
    if (expiredHashes && expiredHashes.length > 0) {
      const idsToClear = expiredHashes.map((h) => h.id);
      const { error: updateFpError } = await serviceSupabase
        .from('deleted_account_hashes')
        .update({ fingerprint_hash: null })
        .in('id', idsToClear);

      if (!updateFpError) {
        fpClearedCount = idsToClear.length;
      }
    }

    // 2. Anonymize IP addresses older than 180 days via RPC
    const { data: ipScrubResult, error: ipRpcError } = await serviceSupabase.rpc('anonymize_expired_ips', {
      p_retention_days: 180,
    });

    if (ipRpcError) {
      logError('Database', 'anonymizeExpiredIpsRpcError', ipRpcError, {}, 'anonymize_expired_ips RPC failed');
    }

    log({
      component: 'HashesCleanupCron',
      step: 'Cleanup Executed',
      level: 'INFO',
      explanation: `Cleared ${fpClearedCount} expired fingerprint hashes and scrubbed IP logs older than 180 days.`,
      data: { fpClearedCount, ipScrubResult },
    });

    return NextResponse.json({
      success: true,
      cleared_fingerprint_hashes: fpClearedCount,
      ip_scrub_result: ipScrubResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('API', 'hashesCleanupCronException', err, {}, 'Unhandled hashes cleanup exception');
    return NextResponse.json({ error: 'Failed during hashes cleanup', details: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
