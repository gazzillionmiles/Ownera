import { createAdminClient } from '@/lib/supabase/service';
import { Redis } from '@upstash/redis';
import { log } from '@/lib/logger';
import { env } from '@/src/config/env';

const redis = Redis.fromEnv();

export interface FingerprintCheckResult {
  flagged: boolean;
  fingerprintCount: number;
  matchingUserIds: string[];
}

export interface QuotaCheckResult {
  allowed: boolean;
  currentCount: number;
  reason?: 'user_daily_quota_exceeded' | 'fingerprint_daily_quota_exceeded';
}

/**
 * Associates a device fingerprint with a user profile and checks whether this
 * fingerprint is shared across multiple user accounts.
 *
 * Soft deterrent: NEVER blocks signups or updates; flags and logs for abuse detection.
 */
export async function recordAndCheckFingerprint({
  userId,
  clientId,
  fingerprint,
}: {
  userId: string;
  clientId?: string;
  fingerprint: string;
}): Promise<FingerprintCheckResult> {
  const serviceSupabase = createAdminClient();

  // Find all other users sharing this device_fingerprint
  const { data: otherProfiles, error } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('device_fingerprint', fingerprint)
    .neq('id', userId);

  if (error) {
    console.error('[Fingerprint] Error checking existing fingerprints:', error);
  }

  const existingUsers = otherProfiles || [];
  const matchingUserIds = existingUsers.map((u) => u.id);
  const flagged = matchingUserIds.length > 0;
  const fingerprintCount = matchingUserIds.length + 1;

  // Update profile with device_fingerprint and flagged status
  const { error: updateError } = await serviceSupabase
    .from('profiles')
    .update({
      device_fingerprint: fingerprint,
      fingerprint_flagged: flagged,
      fingerprint_count: fingerprintCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[Fingerprint] Error updating profile fingerprint:', updateError);
  }

  // Log flag event if repeat signup / shared fingerprint detected
  if (flagged) {
    try {
      await serviceSupabase.from('fingerprint_flag_logs').insert({
        user_id: userId,
        client_id: clientId || null,
        device_fingerprint: fingerprint,
        event_type: 'signup_flagged',
        matching_user_ids: matchingUserIds,
        details: {
          matching_count: matchingUserIds.length,
          total_accounts: fingerprintCount,
          message: `Device fingerprint shared across ${fingerprintCount} accounts`,
        },
      });

      log({
        component: 'Fingerprint',
        step: 'Repeat Signup Flagged',
        level: 'WARN',
        explanation: `User ${userId} shares device fingerprint with ${matchingUserIds.length} other user account(s).`,
        data: { userId, clientId, fingerprint, matchingUserIds, fingerprintCount },
      });
    } catch (logErr) {
      console.error('[Fingerprint] Error logging flag event:', logErr);
    }
  } else {
    log({
      component: 'Fingerprint',
      step: 'Fingerprint Recorded',
      level: 'INFO',
      explanation: `Device fingerprint recorded for user ${userId}.`,
      data: { userId, clientId, fingerprint },
    });
  }

  return {
    flagged,
    fingerprintCount,
    matchingUserIds,
  };
}

/**
 * Checks and updates rate limits / daily free-tier quota considering BOTH
 * the user ID and device fingerprint.
 *
 * Prevents repeat signups on the same device from resetting free daily allowance to 0,
 * while allowing shared family devices to generate as long as total daily quota is not exhausted.
 */
export async function checkAndIncrementDailyQuota({
  userId,
  fingerprint,
  today,
}: {
  userId: string;
  fingerprint?: string | null;
  today: string;
}): Promise<QuotaCheckResult> {
  const userRateKey = `ratelimit:user:${userId}:${today}`;
  const fpRateKey = fingerprint ? `ratelimit:fp:${fingerprint}:${today}` : null;

  // Get current user count
  const rawUserCount = await redis.get<number | string>(userRateKey);
  const userCount = Number(rawUserCount || 0);

  // Get current fingerprint count if fingerprint provided
  let fpCount = 0;
  if (fpRateKey) {
    const rawFpCount = await redis.get<number | string>(fpRateKey);
    fpCount = Number(rawFpCount || 0);
  }

  // Check limits
  if (userCount >= env.RATE_LIMIT) {
    return {
      allowed: false,
      currentCount: userCount,
      reason: 'user_daily_quota_exceeded',
    };
  }

  if (fpRateKey && fpCount >= env.RATE_LIMIT) {
    // Log fingerprint quota flag event
    try {
      const serviceSupabase = createAdminClient();
      await serviceSupabase.from('fingerprint_flag_logs').insert({
        user_id: userId,
        device_fingerprint: fingerprint!,
        event_type: 'quota_check_flagged',
        details: {
          user_count: userCount,
          fingerprint_count: fpCount,
          limit: env.RATE_LIMIT,
          message: 'Fingerprint daily allowance exhausted across accounts on this device',
        },
      });

      log({
        component: 'Fingerprint',
        step: 'Quota Limit Flagged',
        level: 'WARN',
        explanation: `Device fingerprint ${fingerprint} hit daily quota limit (${fpCount}/${env.RATE_LIMIT}).`,
        data: { userId, fingerprint, userCount, fpCount },
      });
    } catch (err) {
      console.error('[Fingerprint] Error logging quota flag event:', err);
    }

    return {
      allowed: false,
      currentCount: fpCount,
      reason: 'fingerprint_daily_quota_exceeded',
    };
  }

  // Increment user rate key
  const newUserCount = await redis.incr(userRateKey);
  if (newUserCount === 1) {
    await redis.expire(userRateKey, 86400);
  }

  // Increment fingerprint rate key if provided
  let newFpCount = 0;
  if (fpRateKey) {
    newFpCount = await redis.incr(fpRateKey);
    if (newFpCount === 1) {
      await redis.expire(fpRateKey, 86400);
    }
  }

  return {
    allowed: true,
    currentCount: Math.max(newUserCount, newFpCount),
  };
}

/**
 * Logs a fingerprint audit event to fingerprint_flag_logs table.
 */
export async function logFingerprintEvent({
  userId,
  clientId,
  fingerprint,
  eventType,
  details,
  matchingUserIds = [],
}: {
  userId?: string | null;
  clientId?: string | null;
  fingerprint: string;
  eventType: string;
  details?: Record<string, any>;
  matchingUserIds?: string[];
}) {
  try {
    const serviceSupabase = createAdminClient();
    await serviceSupabase.from('fingerprint_flag_logs').insert({
      user_id: userId || null,
      client_id: clientId || null,
      device_fingerprint: fingerprint,
      event_type: eventType,
      matching_user_ids: matchingUserIds,
      details: details || {},
    });
  } catch (err) {
    console.error('[Fingerprint] Error logging fingerprint event:', err);
  }
}
