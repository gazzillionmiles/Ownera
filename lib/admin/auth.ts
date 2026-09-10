import { User, SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/service';

/**
 * Strictly verifies whether the authenticated user is a database-backed platform administrator.
 * Admin roles are decided purely by database records in public.platform_admins (never via environment variables).
 */
export async function isUserPlatformAdmin(
  user: User | null,
  client?: SupabaseClient
): Promise<boolean> {
  if (!user) return false;

  const db = client || createAdminClient();
  const { data: adminRecord, error } = await db
    .from('platform_admins')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !adminRecord) {
    return false;
  }

  return adminRecord.role === 'platform_admin';
}

/**
 * Checks whether user is a database-backed support admin or platform admin.
 * Admin roles are decided purely by database records in public.platform_admins (never via environment variables).
 */
export async function isUserSupportAdmin(
  user: User | null,
  client?: SupabaseClient
): Promise<boolean> {
  if (!user) return false;

  const db = client || createAdminClient();
  const { data: adminRecord, error } = await db
    .from('platform_admins')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !adminRecord) {
    return false;
  }

  return adminRecord.role === 'support_admin' || adminRecord.role === 'platform_admin';
}

/**
 * Checks whether user has any active administrator authority in the database.
 */
export async function isUserAdmin(
  user: User | null,
  client?: SupabaseClient
): Promise<boolean> {
  return isUserSupportAdmin(user, client);
}
