import { User, SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/service';

/**
 * Checks whether the user is a designated system administrator via environment variables.
 * Supported env vars: OWNERA_BOOTSTRAP_ADMIN_EMAIL, ADMIN_EMAILS, ADMIN_USER_IDS, ADMIN_EMAIL.
 */
export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;

  const userEmail = (user.email || user.user_metadata?.email || '').toLowerCase().trim();
  const userId = user.id;

  // 1. Check bootstrap admin email
  const bootstrapEmail = (
    process.env.OWNERA_BOOTSTRAP_ADMIN_EMAIL ||
    process.env.ADMIN_BOOTSTRAP_EMAIL ||
    ''
  ).toLowerCase().trim();
  if (bootstrapEmail && userEmail && userEmail === bootstrapEmail) {
    return true;
  }

  // 2. Check configured admin user IDs (comma-separated or single)
  const rawAdminUserIds = process.env.ADMIN_USER_IDS || process.env.ADMIN_USER_ID || process.env.NEXT_PUBLIC_ADMIN_USER_ID || '';
  const adminUserIds = rawAdminUserIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (adminUserIds.includes(userId)) {
    return true;
  }

  // 3. Check configured admin emails (comma-separated or single)
  const rawAdminEmails = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
  const adminEmails = rawAdminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (userEmail && adminEmails.includes(userEmail)) {
    return true;
  }

  // 4. Local development fallback (only when no admin emails or IDs are explicitly set)
  if (process.env.NODE_ENV === 'development' && adminUserIds.length === 0 && adminEmails.length === 0 && !bootstrapEmail) {
    return true;
  }

  return false;
}

/**
 * Strictly verifies whether the authenticated user is a database-backed platform admin
 * or authorized bootstrap admin.
 */
export async function isUserPlatformAdmin(
  user: User | null,
  client?: SupabaseClient
): Promise<boolean> {
  if (!user) return false;

  const db = client || createAdminClient();
  const { data: adminRecord } = await db
    .from('platform_admins')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (adminRecord && adminRecord.role === 'platform_admin') {
    return true;
  }

  return isUserAdmin(user);
}

/**
 * Checks whether user is a database-backed support admin or platform admin.
 */
export async function isUserSupportAdmin(
  user: User | null,
  client?: SupabaseClient
): Promise<boolean> {
  if (!user) return false;

  const db = client || createAdminClient();
  const { data: adminRecord } = await db
    .from('platform_admins')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (adminRecord && (adminRecord.role === 'support_admin' || adminRecord.role === 'platform_admin')) {
    return true;
  }

  return isUserAdmin(user);
}
