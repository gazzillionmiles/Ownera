import { SupabaseClient, User } from '@supabase/supabase-js';
import type { Society, SocietyMember, Provider } from '@/src/types/ownera';
import { createClient } from '@/lib/supabase/server';
import {
  isPlatformAdmin as checkPlatformAdmin,
  isSupportAdmin as checkSupportAdmin,
  isSecretary as checkSecretary,
  isCommittee as checkCommittee,
  isResident as checkResident,
  isProvider as checkProvider,
  requireSocietyMember as guardSocietyMember,
  requirePlatformAdmin as guardPlatformAdmin,
  requirePlatformPermission as guardPlatformPermission,
  requireSocietyPermission as guardSocietyPermission,
  requireSecretary as guardSecretary,
  requireCommitteeOrSecretary as guardCommitteeOrSecretary,
  bootstrapPlatformAdmin as runBootstrapPlatformAdmin,
  AuthorizationError,
} from './rbac';

export {
  AuthorizationError,
  checkPlatformAdmin as isPlatformAdmin,
  checkSupportAdmin as isSupportAdmin,
  checkSecretary as isSecretary,
  checkCommittee as isCommittee,
  checkResident as isResident,
  checkProvider as isProvider,
  guardSocietyMember as requireSocietyMember,
  guardPlatformAdmin as requirePlatformAdmin,
  guardPlatformPermission as requirePlatformPermission,
  guardSocietyPermission as requireSocietyPermission,
  guardSecretary as requireSecretary,
  guardCommitteeOrSecretary as requireCommitteeOrSecretary,
  runBootstrapPlatformAdmin as bootstrapPlatformAdmin,
};

export interface SocietyContext {
  user: User;
  society: Society;
  membership: SocietyMember;
}

/**
 * Resolves the authenticated user from the current request session.
 */
export async function getAuthenticatedUser(
  client?: SupabaseClient
): Promise<User | null> {
  const supabase = client || (await createClient());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }
  return user;
}

/**
 * Fetches a society record by its URL slug.
 */
export async function getSocietyBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Society | null> {
  if (!slug) return null;

  const { data: society, error } = await supabase
    .from('societies')
    .select('*')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle();

  if (error || !society) {
    return null;
  }
  return society as Society;
}

/**
 * Resolves a society record by its ID.
 */
export async function getSocietyById(
  supabase: SupabaseClient,
  societyId: string
): Promise<Society | null> {
  if (!societyId) return null;

  const { data: society, error } = await supabase
    .from('societies')
    .select('*')
    .eq('id', societyId)
    .maybeSingle();

  if (error || !society) {
    return null;
  }
  return society as Society;
}

/**
 * Verifies that a user has one of the required roles in a specific society.
 */
export async function requireSocietyRole(
  supabase: SupabaseClient,
  userId: string,
  societyId: string,
  allowedRoles: ('resident' | 'secretary' | 'committee' | 'organizer')[]
): Promise<SocietyMember> {
  const membership = await guardSocietyMember(supabase, userId, societyId);

  // Map legacy 'organizer' request to include 'secretary'
  const normalizedRoles = allowedRoles.flatMap((r) =>
    r === 'organizer' ? ['organizer', 'secretary'] : [r]
  );

  if (!normalizedRoles.includes(membership.role)) {
    throw new AuthorizationError(
      `Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}`,
      403
    );
  }

  return membership;
}

/**
 * Verifies that a user is an organizer/secretary or committee member in the society.
 */
export async function requireOrganizer(
  supabase: SupabaseClient,
  userId: string,
  societyId: string
): Promise<SocietyMember> {
  return requireSocietyRole(supabase, userId, societyId, ['secretary', 'committee', 'organizer']);
}

/**
 * Verifies that a user owns an active provider profile.
 */
export async function requireProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<Provider> {
  if (!userId) {
    throw new AuthorizationError('Authentication required', 401);
  }

  const { data: provider, error } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !provider) {
    throw new AuthorizationError('Registered provider profile required', 403);
  }

  return provider as Provider;
}

/**
 * Checks if a provider has legitimate access to a campaign (invited, bid, or selected).
 */
export async function requireProviderCampaignAccess(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string
): Promise<{ provider: Provider; isAuthorized: boolean }> {
  const provider = await requireProvider(supabase, userId);

  // Check if invited, submitted bid, or selected
  const { data: campaign } = await supabase
    .from('service_campaigns')
    .select('selected_provider_id')
    .eq('id', campaignId)
    .maybeSingle();

  if (campaign?.selected_provider_id === provider.id) {
    return { provider, isAuthorized: true };
  }

  const { data: invite } = await supabase
    .from('campaign_provider_invites')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('provider_id', provider.id)
    .maybeSingle();

  if (invite) {
    return { provider, isAuthorized: true };
  }

  const { data: bid } = await supabase
    .from('provider_bids')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('provider_id', provider.id)
    .maybeSingle();

  if (bid) {
    return { provider, isAuthorized: true };
  }

  throw new AuthorizationError('Provider is not authorized for this campaign', 403);
}

/**
 * Resolves society context from URL slug and validates current user membership.
 */
export async function resolveCurrentSocietyContext(
  slug: string
): Promise<SocietyContext> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    throw new AuthorizationError('Please sign in to access society features', 401);
  }

  const society = await getSocietyBySlug(supabase, slug);
  if (!society) {
    throw new AuthorizationError('Society not found', 404);
  }

  const membership = await guardSocietyMember(supabase, user.id, society.id);

  return {
    user,
    society,
    membership,
  };
}
