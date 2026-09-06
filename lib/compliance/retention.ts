/**
 * lib/compliance/retention.ts
 * Reusable account lifecycle, DPDP/GDPR deletion grace period, and IP scrubbing utilities.
 */

import { createAdminClient } from '@/lib/supabase/service';
import { log, logError } from '@/lib/logger';
import crypto from 'crypto';

export const ACCOUNT_DELETION_GRACE_DAYS = 30;
export const IP_RETENTION_DAYS = 180;

export function hashForAntiAbuse(value: string, salt?: string): string {
  const effectiveSalt = salt || process.env.ANTI_ABUSE_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'anti-abuse-salt';
  return crypto.createHmac('sha256', effectiveSalt).update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Initiates 30-day soft deletion for an authenticated user.
 */
export async function scheduleAccountDeletion({
  userId,
  reason,
  ipAddress,
  userAgent,
}: {
  userId: string;
  reason?: string;
  ipAddress: string;
  userAgent: string;
}): Promise<{ success: boolean; scheduledPurgeAt: string }> {
  const serviceSupabase = createAdminClient();
  const now = new Date();
  const purgeDate = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const { error: profileError } = await serviceSupabase
    .from('profiles')
    .update({
      deletion_status: 'pending_deletion',
      deletion_requested_at: now.toISOString(),
      scheduled_purge_at: purgeDate.toISOString(),
      deletion_reason: reason ? reason.substring(0, 500) : null,
      deletion_ip_address: ipAddress,
      updated_at: now.toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    logError('Compliance', 'scheduleAccountDeletion', profileError, { userId });
    throw new Error('Failed to update account deletion status');
  }

  await serviceSupabase.from('account_lifecycle_logs').insert({
    user_id: userId,
    event_type: 'deletion_requested',
    actor_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      reason: reason || null,
      scheduled_purge_at: purgeDate.toISOString(),
    },
  });

  log({
    component: 'Compliance',
    step: 'Account Deletion Scheduled',
    level: 'INFO',
    explanation: `User ${userId} scheduled for deletion on ${purgeDate.toISOString()}`,
    data: { userId, scheduledPurgeAt: purgeDate.toISOString() },
  });

  return { success: true, scheduledPurgeAt: purgeDate.toISOString() };
}

/**
 * Cancels pending deletion and restores user account.
 */
export async function restoreAccount({
  userId,
  ipAddress,
  userAgent,
}: {
  userId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<{ success: boolean }> {
  const serviceSupabase = createAdminClient();
  const now = new Date();

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('restoration_count')
    .eq('id', userId)
    .single();

  const nextRestorationCount = (profile?.restoration_count ?? 0) + 1;

  const { error: updateError } = await serviceSupabase
    .from('profiles')
    .update({
      deletion_status: 'active',
      deletion_requested_at: null,
      scheduled_purge_at: null,
      deletion_reason: null,
      deletion_ip_address: null,
      restored_at: now.toISOString(),
      restoration_count: nextRestorationCount,
      updated_at: now.toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    logError('Compliance', 'restoreAccount', updateError, { userId });
    throw new Error('Failed to restore account');
  }

  await serviceSupabase.from('account_lifecycle_logs').insert({
    user_id: userId,
    event_type: 'deletion_cancelled',
    actor_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      restoration_count: nextRestorationCount,
      restored_at: now.toISOString(),
    },
  });

  return { success: true };
}
