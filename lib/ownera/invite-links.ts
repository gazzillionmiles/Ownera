/**
 * lib/ownera/invite-links.ts
 * Reusable Society Resident Invite Links Architecture.
 * 
 * Capabilities:
 * 1. Cryptographically secure, URL-safe token generation with collision protection.
 * 2. Get or create active reusable invite link for a society (Secretary / Platform Admin only).
 * 3. Rotate active invite link (invalidates old link immediately; existing members unaffected).
 * 4. Validate invite token server-side (returns safe society preview, no member/secretary secrets).
 * 5. Join society through invite token strictly (client cannot supply or manipulate society ID).
 */

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/service';
import { isSecretary, isPlatformAdmin, AuthorizationError } from './rbac';
import type { SocietyInviteLink, PropertyType, SocietyMember } from '@/src/types/ownera';

export interface ValidatedInviteLinkResult {
  valid: true;
  society: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    city: string;
    state: string | null;
    total_homes: number;
  };
}

export interface InvalidInviteLinkResult {
  valid: false;
  reason: 'not_found' | 'inactive';
  error: string;
}

export type ValidateInviteTokenResult = ValidatedInviteLinkResult | InvalidInviteLinkResult;

export interface JoinByInviteTokenParams {
  token: string;
  userId: string;
  unitNumber?: string | null;
  propertyType?: PropertyType;
}

export interface JoinByInviteTokenSuccessResult {
  success: true;
  alreadyMember: boolean;
  message: string;
  society: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    city: string;
    state: string | null;
    total_homes: number;
  };
  member: SocietyMember;
}

export interface JoinByInviteTokenFailureResult {
  success: false;
  reason: 'not_found' | 'inactive' | 'error';
  error: string;
  statusCode: number;
}

export type JoinByInviteTokenResult = JoinByInviteTokenSuccessResult | JoinByInviteTokenFailureResult;

/**
 * Generates a cryptographically secure, URL-safe token with collision resistance.
 * Format: soc_<32 url-safe base64url characters> (192 bits of entropy).
 */
export async function generateUniqueInviteToken(client?: SupabaseClient): Promise<string> {
  const db = client || createAdminClient();
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rawEntropy = crypto.randomBytes(24).toString('base64url');
    const token = `soc_${rawEntropy}`;

    // Verify token does not collide with existing invite links
    const { data: existing, error } = await db
      .from('society_invite_links')
      .select('id')
      .eq('token', token)
      .maybeSingle();

    if (!error && !existing) {
      return token;
    }
  }

  // Fallback with timestamp salt if multiple collisions occur
  const timestampSalt = Date.now().toString(36);
  const fallbackEntropy = crypto.randomBytes(20).toString('base64url');
  return `soc_${timestampSalt}_${fallbackEntropy}`;
}

/**
 * Retrieves the currently active reusable invite link for a Society.
 * If none exists, generates and persists one.
 * Restricted strictly to the Society Secretary or Platform Admin.
 */
export async function getOrCreateActiveInviteLink(
  societyId: string,
  actorUserId: string,
  client?: SupabaseClient
): Promise<{ inviteLink: SocietyInviteLink; isNew: boolean }> {
  if (!societyId || !actorUserId) {
    throw new AuthorizationError('Missing society or user context', 400);
  }

  const db = client || createAdminClient();

  // 1. Authorize actor: Must be active secretary of this society or platform admin
  const isPlatform = await isPlatformAdmin(actorUserId, db);
  const isSec = await isSecretary(actorUserId, societyId, db);

  if (!isPlatform && !isSec) {
    throw new AuthorizationError(
      'Forbidden: Only the society secretary or a platform admin can manage invite links',
      403
    );
  }

  // 2. Check for existing active invite link
  const { data: existingLink, error: fetchErr } = await db
    .from('society_invite_links')
    .select('*, society:societies(*)')
    .eq('society_id', societyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLink && !fetchErr) {
    return {
      inviteLink: existingLink as SocietyInviteLink,
      isNew: false,
    };
  }

  // 3. Generate a new active invite link
  const token = await generateUniqueInviteToken(db);
  const { data: newLink, error: insertErr } = await db
    .from('society_invite_links')
    .insert({
      society_id: societyId,
      token,
      is_active: true,
      created_by: actorUserId,
    })
    .select('*, society:societies(*)')
    .single();

  if (insertErr || !newLink) {
    console.error('[getOrCreateActiveInviteLink] Insert error:', insertErr);
    throw new Error(`Failed to create society invite link: ${insertErr?.message || 'Database error'}`);
  }

  return {
    inviteLink: newLink as SocietyInviteLink,
    isNew: true,
  };
}

/**
 * Rotates the active reusable invite link for a Society.
 * Deactivates all current active links and generates a new active token.
 * Old links immediately stop working for joining; existing members are unaffected.
 * Restricted strictly to the Society Secretary or Platform Admin.
 */
export async function rotateInviteLink(
  societyId: string,
  actorUserId: string,
  client?: SupabaseClient
): Promise<{ inviteLink: SocietyInviteLink; rotated: boolean }> {
  if (!societyId || !actorUserId) {
    throw new AuthorizationError('Missing society or user context', 400);
  }

  const db = client || createAdminClient();

  // 1. Authorize actor: Must be active secretary of this society or platform admin
  const isPlatform = await isPlatformAdmin(actorUserId, db);
  const isSec = await isSecretary(actorUserId, societyId, db);

  if (!isPlatform && !isSec) {
    throw new AuthorizationError(
      'Forbidden: Only the society secretary or a platform admin can rotate invite links',
      403
    );
  }

  const nowIso = new Date().toISOString();

  // 2. Mark existing active links as inactive
  const { error: updateErr } = await db
    .from('society_invite_links')
    .update({
      is_active: false,
      rotated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('society_id', societyId)
    .eq('is_active', true);

  if (updateErr) {
    console.error('[rotateInviteLink] Error deactivating old links:', updateErr);
    throw new Error(`Failed to deactivate existing invite links: ${updateErr.message}`);
  }

  // 3. Generate and insert new active invite link
  const newToken = await generateUniqueInviteToken(db);
  const { data: newLink, error: insertErr } = await db
    .from('society_invite_links')
    .insert({
      society_id: societyId,
      token: newToken,
      is_active: true,
      created_by: actorUserId,
    })
    .select('*, society:societies(*)')
    .single();

  if (insertErr || !newLink) {
    console.error('[rotateInviteLink] Error inserting rotated link:', insertErr);
    throw new Error(`Failed to create rotated invite link: ${insertErr?.message || 'Database error'}`);
  }

  return {
    inviteLink: newLink as SocietyInviteLink,
    rotated: true,
  };
}

/**
 * Validates an invite token server-side.
 * Returns only the safe public Society metadata required for the join preview.
 * Never exposes member lists, secretary credentials, or internal secrets.
 */
export async function validateInviteToken(
  token: string,
  client?: SupabaseClient
): Promise<ValidateInviteTokenResult> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      reason: 'not_found',
      error: 'Invite token is required and must be a valid string.',
    };
  }

  const cleanToken = token.trim();
  const db = client || createAdminClient();

  const { data: link, error } = await db
    .from('society_invite_links')
    .select('id, society_id, token, is_active, created_at, rotated_at, society:societies(id, name, slug, address, city, state, total_homes)')
    .eq('token', cleanToken)
    .maybeSingle();

  if (error || !link) {
    return {
      valid: false,
      reason: 'not_found',
      error: 'Invalid invite link. The link does not exist or may have been typed incorrectly.',
    };
  }

  if (!link.is_active) {
    return {
      valid: false,
      reason: 'inactive',
      error: 'This invite link is inactive or has been rotated by the society secretary. Please ask for an updated link.',
    };
  }

  const society = link.society as any;
  if (!society || !society.id) {
    return {
      valid: false,
      reason: 'not_found',
      error: 'The residential society associated with this invite link was not found.',
    };
  }

  return {
    valid: true,
    society: {
      id: society.id,
      name: society.name,
      slug: society.slug,
      address: society.address || null,
      city: society.city,
      state: society.state || null,
      total_homes: society.total_homes,
    },
  };
}

/**
 * Joins an authenticated user to a Society using ONLY a valid invite token.
 * 
 * Security Guarantees:
 * 1. Society ID is resolved exclusively from the verified active token.
 *    Any client-provided society ID is ignored/rejected.
 * 2. If the user is already an active member, returns idempotent success without modifying existing roles.
 * 3. Assigns strictly the 'resident' role to new members.
 * 4. Updates profile.primary_society_id and unit details safely.
 */
export async function joinSocietyByInviteToken(
  params: JoinByInviteTokenParams,
  client?: SupabaseClient
): Promise<JoinByInviteTokenResult> {
  const { token, userId, unitNumber, propertyType = 'apartment' } = params;

  if (!userId) {
    return {
      success: false,
      reason: 'error',
      error: 'Authentication required. Please sign in to join.',
      statusCode: 401,
    };
  }

  const db = client || createAdminClient();

  // 1. Validate token server-side
  const validation = await validateInviteToken(token, db);
  if (!validation.valid) {
    return {
      success: false,
      reason: validation.reason,
      error: validation.error,
      statusCode: validation.reason === 'inactive' ? 410 : 404,
    };
  }

  const targetSociety = validation.society;
  const cleanUnitNumber = (unitNumber || '').trim() || 'Unit 1';
  const cleanPropertyType = propertyType || 'apartment';

  // 2. Check if user is already an active member of this society
  const { data: existingMember, error: fetchMemErr } = await db
    .from('society_members')
    .select('*')
    .eq('society_id', targetSociety.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchMemErr) {
    console.error('[joinSocietyByInviteToken] Error checking existing membership:', fetchMemErr);
    return {
      success: false,
      reason: 'error',
      error: 'Failed to verify membership status.',
      statusCode: 500,
    };
  }

  // 3. Idempotent return if already active member
  if (existingMember && existingMember.status === 'active') {
    // If unit details were previously unset, update them without modifying role
    if (cleanUnitNumber && cleanUnitNumber !== 'Unit 1' && (!existingMember.unit_number || existingMember.unit_number === 'Unassigned')) {
      await db
        .from('society_members')
        .update({
          unit_number: cleanUnitNumber,
          flat_number: cleanUnitNumber,
          property_type: cleanPropertyType,
        })
        .eq('id', existingMember.id);
    }

    // Ensure primary_society_id is set
    await db
      .from('profiles')
      .update({
        primary_society_id: targetSociety.id,
        unit_number: cleanUnitNumber,
        property_type: cleanPropertyType,
      })
      .eq('id', userId);

    return {
      success: true,
      alreadyMember: true,
      message: `You are already a member of ${targetSociety.name}.`,
      society: targetSociety,
      member: existingMember as SocietyMember,
    };
  }

  // 4. Create new resident membership via upsert
  const { data: newMember, error: insertErr } = await db
    .from('society_members')
    .upsert(
      {
        society_id: targetSociety.id,
        user_id: userId,
        flat_number: cleanUnitNumber,
        unit_number: cleanUnitNumber,
        property_type: cleanPropertyType,
        role: 'resident', // strictly assigned 'resident' role
        status: 'active',
      },
      { onConflict: 'society_id,user_id' }
    )
    .select()
    .single();

  if (insertErr || !newMember) {
    console.error('[joinSocietyByInviteToken] Membership upsert error:', insertErr);
    return {
      success: false,
      reason: 'error',
      error: 'Failed to record society membership.',
      statusCode: 500,
    };
  }

  // 5. Update user profile to link primary society and unit info
  await db
    .from('profiles')
    .update({
      primary_society_id: targetSociety.id,
      unit_number: cleanUnitNumber,
      property_type: cleanPropertyType,
      active_role: 'resident',
    })
    .eq('id', userId);

  return {
    success: true,
    alreadyMember: false,
    message: `Welcome to ${targetSociety.name}!`,
    society: targetSociety,
    member: newMember as SocietyMember,
  };
}
