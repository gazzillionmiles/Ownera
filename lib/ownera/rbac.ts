/**
 * lib/ownera/rbac.ts
 * Centralized Role-Based Access Control (RBAC) & Authority Layer for Ownera.
 * 
 * Scope Separation:
 * 1. Platform Roles: platform_admin, support_admin, user (backed by platform_admins table)
 * 2. Society Roles: secretary, committee, resident (backed by society_members table scoped by society_id)
 * 3. Provider Role: provider identity (backed by providers table owned by user_id)
 * 
 * Critical: UI views/tabs NEVER grant authority. All permissions are verified server-side.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/service';
import type {
  PlatformRole,
  SocietyRole,
  PlatformAdmin,
  SocietyMember,
  Provider,
} from '@/src/types/ownera';

// -----------------------------------------------------------------------------
// Explicit Permission Types
// -----------------------------------------------------------------------------

export type PlatformPermission =
  | 'platform.view'
  | 'platform.societies.manage'
  | 'platform.societies.create'
  | 'platform.users.manage'
  | 'platform.providers.manage'
  | 'platform.campaigns.manage'
  | 'platform.bookings.manage'
  | 'platform.payments.manage'
  | 'platform.issues.manage'
  | 'platform.admins.manage';

export type SocietyPermission =
  | 'society.view'
  | 'society.update'
  | 'society.members.view'
  | 'society.members.manage'
  | 'society.secretary.manage'
  | 'society.secretary.transfer'
  | 'society.committee.manage'
  | 'society.campaigns.create'
  | 'society.campaigns.manage'
  | 'society.campaigns.select_provider'
  | 'society.campaigns.view'
  | 'society.bookings.view_all'
  | 'society.bookings.manage'
  | 'society.issues.manage'
  | 'society.info.view';

export type ResidentPermission =
  | 'campaign.participate'
  | 'booking.create'
  | 'booking.view_own'
  | 'booking.pay'
  | 'issue.create'
  | 'rating.create';

export type ProviderPermission =
  | 'provider.profile.manage'
  | 'provider.bid.submit'
  | 'provider.bid.view_own'
  | 'provider.booking.view_assigned'
  | 'provider.booking.complete'
  | 'provider.earnings.view';

export type OwneraPermission =
  | PlatformPermission
  | SocietyPermission
  | ResidentPermission
  | ProviderPermission;

// -----------------------------------------------------------------------------
// Permission Maps
// -----------------------------------------------------------------------------

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  platform_admin: [
    'platform.view',
    'platform.societies.manage',
    'platform.societies.create',
    'platform.users.manage',
    'platform.providers.manage',
    'platform.campaigns.manage',
    'platform.bookings.manage',
    'platform.payments.manage',
    'platform.issues.manage',
    'platform.admins.manage',
  ],
  support_admin: [
    'platform.view',
    'platform.users.manage',
    'platform.providers.manage',
    'platform.campaigns.manage',
    'platform.bookings.manage',
    'platform.issues.manage',
  ],
};

export const SOCIETY_ROLE_PERMISSIONS: Record<SocietyRole, SocietyPermission[]> = {
  secretary: [
    'society.view',
    'society.update',
    'society.members.view',
    'society.members.manage',
    'society.secretary.manage',
    'society.secretary.transfer',
    'society.committee.manage',
    'society.campaigns.create',
    'society.campaigns.manage',
    'society.campaigns.select_provider',
    'society.campaigns.view',
    'society.bookings.view_all',
    'society.bookings.manage',
    'society.issues.manage',
    'society.info.view',
  ],
  committee: [
    'society.view',
    'society.members.view',
    'society.campaigns.create',
    'society.campaigns.manage',
    'society.campaigns.select_provider',
    'society.campaigns.view',
    'society.bookings.view_all',
    'society.issues.manage',
    'society.info.view',
  ],
  resident: [
    'society.view',
    'society.campaigns.view',
    'society.info.view',
  ],
};

// -----------------------------------------------------------------------------
// Authorization Error
// -----------------------------------------------------------------------------

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(
    message: string = 'Forbidden: Insufficient permissions',
    statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

// -----------------------------------------------------------------------------
// Server-Side Authority Checkers
// -----------------------------------------------------------------------------

/**
 * Resolves the platform admin record for a user if active.
 */
export async function getPlatformAdminRecord(
  userId: string,
  client?: SupabaseClient
): Promise<PlatformAdmin | null> {
  if (!userId) return null;
  const db = client || createAdminClient();

  const { data, error } = await db
    .from('platform_admins')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as PlatformAdmin;
}

/**
 * Checks if user is a verified active platform admin.
 */
export async function isPlatformAdmin(
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const admin = await getPlatformAdminRecord(userId, client);
  return admin?.role === 'platform_admin';
}

/**
 * Checks if user is a verified active support admin or platform admin.
 */
export async function isSupportAdmin(
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const admin = await getPlatformAdminRecord(userId, client);
  return admin?.role === 'support_admin' || admin?.role === 'platform_admin';
}

/**
 * Resolves a user's society membership record in a specific society.
 */
export async function getSocietyMembership(
  userId: string,
  societyId: string,
  client?: SupabaseClient
): Promise<SocietyMember | null> {
  if (!userId || !societyId) return null;
  const db = client || createAdminClient();

  let { data, error } = await db
    .from('society_members')
    .select('*, society:societies(*)')
    .eq('society_id', societyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // If client encountered RLS or join issue, retry with service client
  if ((error || !data) && client) {
    const adminDb = createAdminClient();
    const adminRes = await adminDb
      .from('society_members')
      .select('*, society:societies(*)')
      .eq('society_id', societyId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (adminRes.data) {
      data = adminRes.data;
      error = null;
    }
  }

  if (error || !data) {
    const adminDb = createAdminClient();
    // Check if user is the creator of the society, auto-heal secretary membership
    const { data: soc } = await adminDb
      .from('societies')
      .select('id, created_by')
      .eq('id', societyId)
      .maybeSingle();

    if (soc && soc.created_by === userId) {
      const { data: healedMember } = await adminDb
        .from('society_members')
        .upsert(
          {
            society_id: societyId,
            user_id: userId,
            role: 'secretary',
            status: 'active',
            flat_number: 'Secretary Unit',
          },
          { onConflict: 'society_id,user_id' }
        )
        .select('*, society:societies(*)')
        .single();

      if (healedMember) {
        return healedMember as SocietyMember;
      }
    }

    return null;
  }
  return data as SocietyMember;
}

/**
 * Checks if user is the active primary secretary in a specific society.
 */
export async function isSecretary(
  userId: string,
  societyId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const membership = await getSocietyMembership(userId, societyId, client);
  return membership?.role === 'secretary';
}

/**
 * Checks if user is a committee member or secretary in a specific society.
 */
export async function isCommittee(
  userId: string,
  societyId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const membership = await getSocietyMembership(userId, societyId, client);
  return (
    membership?.role === 'committee' ||
    membership?.role === 'secretary' ||
    membership?.role === 'organizer'
  );
}

/**
 * Checks if user is an active resident in a specific society.
 */
export async function isResident(
  userId: string,
  societyId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const membership = await getSocietyMembership(userId, societyId, client);
  return membership !== null && membership.status === 'active';
}

/**
 * Checks if user owns an active registered provider profile.
 */
export async function isProvider(
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  if (!userId) return false;
  const db = client || createAdminClient();

  const { data, error } = await db
    .from('providers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return !error && !!data;
}

/**
 * Verifies that a user is an active member of a specific society.
 */
export async function requireSocietyMember(
  client: SupabaseClient,
  userId: string,
  societyId: string
): Promise<SocietyMember> {
  const membership = await getSocietyMembership(userId, societyId, client);
  if (!membership) {
    throw new AuthorizationError('You are not an active member of this society', 403);
  }
  return membership;
}

// -----------------------------------------------------------------------------
// Permission Requirement Guards
// -----------------------------------------------------------------------------

/**
 * Verifies that a user has a specific platform permission.
 */
export async function requirePlatformPermission(
  client: SupabaseClient,
  userId: string,
  permission: PlatformPermission
): Promise<PlatformAdmin> {
  const admin = await getPlatformAdminRecord(userId, client);
  if (!admin) {
    throw new AuthorizationError('Access denied: Platform administrator privileges required', 403);
  }

  const allowedPermissions = PLATFORM_ROLE_PERMISSIONS[admin.role] || [];
  if (!allowedPermissions.includes(permission)) {
    throw new AuthorizationError(
      `Access denied: Role "${admin.role}" lacks "${permission}" permission`,
      403
    );
  }

  return admin;
}

/**
 * Verifies that a user is a full platform_admin.
 */
export async function requirePlatformAdmin(
  client: SupabaseClient,
  userId: string
): Promise<PlatformAdmin> {
  return requirePlatformPermission(client, userId, 'platform.admins.manage');
}

/**
 * Verifies that a user has a specific society-scoped permission.
 * Platform admins automatically pass society-level checks if needed for platform operations.
 */
export async function requireSocietyPermission(
  client: SupabaseClient,
  userId: string,
  societyId: string,
  permission: SocietyPermission
): Promise<{ membership?: SocietyMember; isPlatformAdmin: boolean }> {
  // 1. Check if user is platform admin
  const isPlatform = await isPlatformAdmin(userId, client);
  if (isPlatform) {
    const membership = await getSocietyMembership(userId, societyId, client);
    return { membership: membership || undefined, isPlatformAdmin: true };
  }

  // 2. Check society membership role
  const membership = await getSocietyMembership(userId, societyId, client);
  if (!membership) {
    throw new AuthorizationError('You are not an active member of this society', 403);
  }

  const roleKey = membership.role === 'organizer' ? 'secretary' : membership.role;
  const allowedPermissions = (SOCIETY_ROLE_PERMISSIONS as Record<string, SocietyPermission[]>)[roleKey] || [];
  if (!allowedPermissions.includes(permission)) {
    throw new AuthorizationError(
      `Access denied: Society role "${membership.role}" lacks "${permission}" permission in this society`,
      403
    );
  }

  return { membership, isPlatformAdmin: false };
}

/**
 * Verifies that a user is the primary secretary of a society.
 */
export async function requireSecretary(
  client: SupabaseClient,
  userId: string,
  societyId: string
): Promise<SocietyMember> {
  const { membership } = await requireSocietyPermission(
    client,
    userId,
    societyId,
    'society.secretary.transfer'
  );
  if (!membership || (membership.role !== 'secretary' && membership.role !== 'organizer')) {
    throw new AuthorizationError('Only the primary society secretary can perform this action', 403);
  }
  return membership;
}

/**
 * Verifies that a user is a secretary or committee member of a society.
 */
export async function requireCommitteeOrSecretary(
  client: SupabaseClient,
  userId: string,
  societyId: string
): Promise<SocietyMember> {
  const { membership } = await requireSocietyPermission(
    client,
    userId,
    societyId,
    'society.campaigns.create'
  );
  if (!membership) {
    throw new AuthorizationError('Secretary or committee permissions required in this society', 403);
  }
  return membership;
}

// -----------------------------------------------------------------------------
// Secure Admin Bootstrap Engine
// -----------------------------------------------------------------------------

/**
 * Bootstraps the first platform administrator based on server environment variable.
 * Idempotent, refuses unauthorized users, never exposes secrets.
 */
export async function bootstrapPlatformAdmin(
  userId: string,
  userEmail: string,
  client?: SupabaseClient
): Promise<{ success: boolean; admin?: PlatformAdmin; message: string }> {
  if (!userId || !userEmail) {
    return { success: false, message: 'Invalid user context' };
  }

  const db = client || createAdminClient();
  const normalizedUserEmail = userEmail.toLowerCase().trim();

  // Resolve authorized bootstrap email from environment variable
  const bootstrapEmail = (
    process.env.OWNERA_BOOTSTRAP_ADMIN_EMAIL ||
    process.env.ADMIN_BOOTSTRAP_EMAIL ||
    process.env.ADMIN_EMAIL ||
    ''
  ).toLowerCase().trim();

  if (!bootstrapEmail) {
    return {
      success: false,
      message: 'Platform admin bootstrap is not configured on this server (OWNERA_BOOTSTRAP_ADMIN_EMAIL missing)',
    };
  }

  // Verify email matches configured bootstrap address
  if (normalizedUserEmail !== bootstrapEmail) {
    return {
      success: false,
      message: 'Unauthorized: User email does not match configured OWNERA_BOOTSTRAP_ADMIN_EMAIL',
    };
  }

  // Idempotently create or verify platform_admins record
  const { data: existingAdmin } = await db
    .from('platform_admins')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingAdmin) {
    if (existingAdmin.status !== 'active' || existingAdmin.role !== 'platform_admin') {
      const { data: updatedAdmin } = await db
        .from('platform_admins')
        .update({ role: 'platform_admin', status: 'active' })
        .eq('id', existingAdmin.id)
        .select()
        .single();
      return { success: true, admin: updatedAdmin as PlatformAdmin, message: 'Platform admin access restored' };
    }
    return { success: true, admin: existingAdmin as PlatformAdmin, message: 'User is already platform_admin' };
  }

  const { data: newAdmin, error: insertError } = await db
    .from('platform_admins')
    .insert({
      user_id: userId,
      role: 'platform_admin',
      status: 'active',
      created_by: userId,
    })
    .select()
    .single();

  if (insertError || !newAdmin) {
    return { success: false, message: `Failed to bootstrap admin: ${insertError?.message || 'DB Error'}` };
  }

  return { success: true, admin: newAdmin as PlatformAdmin, message: 'Successfully bootstrapped platform_admin' };
}
