import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { logError, log, createErrorResponse } from '@/lib/logger';
import { deleteS3ObjectsBatch } from '@/lib/s3';

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logError('API', 'purgeAccountConfigError', new Error('CRON_SECRET not configured'), {}, 'Missing CRON_SECRET');
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

  const serviceSupabase = createAdminClient();
  const salt = process.env.ANTI_ABUSE_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'saas-anti-abuse-salt';
  const now = new Date().toISOString();

  try {
    // Find all expired pending_deletion profiles
    const { data: expiredProfiles, error: fetchError } = await serviceSupabase
      .from('profiles')
      .select('id, email, device_fingerprint')
      .eq('deletion_status', 'pending_deletion')
      .lte('scheduled_purge_at', now);

    if (fetchError) {
      logError('Database', 'purgeFetchExpired', fetchError, { now }, 'Failed to fetch expired pending_deletion profiles');
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    if (!expiredProfiles || expiredProfiles.length === 0) {
      return NextResponse.json({ success: true, purged_count: 0, checked_at: now });
    }

    let purgedCount = 0;
    const errors: string[] = [];

    for (const p of expiredProfiles) {
      try {
        // 1. Call atomic database purge RPC
        const { data: purgeResult, error: rpcError } = await serviceSupabase.rpc('purge_expired_account', {
          p_user_id: p.id,
          p_salt: salt,
        });

        if (rpcError) {
          logError('Database', 'purgeAccountRpcError', rpcError, { userId: p.id }, 'purge_expired_account RPC failed');
          errors.push(`RPC failed for ${p.id}: ${rpcError.message}`);
          continue;
        }

        const s3Keys: string[] = purgeResult?.s3_keys || [];

        // 2. Batch delete S3 screenshots
        if (s3Keys.length > 0) {
          await deleteS3ObjectsBatch(s3Keys, { source: 'account_purge', userId: p.id });
        }

        // 3. Delete user from Supabase auth.users
        const { error: deleteAuthError } = await serviceSupabase.auth.admin.deleteUser(p.id);
        if (deleteAuthError) {
          logError('Auth', 'purgeDeleteAuthUserError', deleteAuthError, { userId: p.id }, 'Failed to delete auth.users record');
          errors.push(`Auth delete failed for ${p.id}: ${deleteAuthError.message}`);
        } else {
          purgedCount++;
          log({
            component: 'AccountPurge',
            step: 'Account Purged Successfully',
            level: 'INFO',
            explanation: `Successfully purged user ${p.id} and anonymized profile row.`,
            data: { userId: p.id, s3KeysCount: s3Keys.length },
          });
        }
      } catch (userPurgeErr: unknown) {
        const msg = userPurgeErr instanceof Error ? userPurgeErr.message : String(userPurgeErr);
        logError('API', 'purgeSingleUserException', userPurgeErr, { userId: p.id }, 'Exception during user purge');
        errors.push(`Exception for ${p.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      purged_count: purgedCount,
      total_expired_found: expiredProfiles.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    return createErrorResponse(
      'API',
      'purgeCronException',
      err,
      'Failed during purge execution',
      500,
      { step: 'purge_cron' }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
