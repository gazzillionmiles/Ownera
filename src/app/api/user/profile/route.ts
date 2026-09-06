import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { isPlatformAdmin, isSupportAdmin } from '@/lib/ownera/rbac';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const serviceSupabase = createAdminClient();

    // Explicitly whitelist non-sensitive editable profile fields ONLY
    const allowedUpdates: Record<string, any> = {};
    if (typeof body.name === 'string') allowedUpdates.name = body.name.trim();
    if (typeof body.preferred_language === 'string') allowedUpdates.preferred_language = body.preferred_language;
    if (typeof body.theme === 'string') allowedUpdates.theme = body.theme;
    if (typeof body.avatar_url === 'string' || body.avatar_url === null) allowedUpdates.avatar_url = body.avatar_url;
    if (typeof body.instagram_username === 'string') allowedUpdates.instagram_username = body.instagram_username.trim();
    if (typeof body.upi_id === 'string') allowedUpdates.upi_id = body.upi_id.trim();
    if (typeof body.phone === 'string' || body.phone === null) allowedUpdates.phone = body.phone?.trim() || null;
    if (typeof body.property_type === 'string' || typeof body.propertyType === 'string') {
      allowedUpdates.property_type = body.property_type || body.propertyType;
    }
    if (typeof body.unit_number === 'string' || typeof body.unitNumber === 'string' || typeof body.flatNumber === 'string') {
      allowedUpdates.unit_number = body.unit_number || body.unitNumber || body.flatNumber;
    }
    if (typeof body.primary_society_id === 'string' || body.primary_society_id === null) {
      // If setting primary_society_id, verify user is actually an active member of that society
      if (body.primary_society_id) {
        const { data: member } = await serviceSupabase
          .from('society_members')
          .select('id')
          .eq('society_id', body.primary_society_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (member) {
          allowedUpdates.primary_society_id = body.primary_society_id;
        }
      } else {
        allowedUpdates.primary_society_id = null;
      }
    }

    // Role switching view preference: Strictly verify underlying authority before saving UI view preference
    if (body.active_role) {
      if (body.active_role === 'resident') {
        allowedUpdates.active_role = 'resident';
      } else if (body.active_role === 'organizer' || body.active_role === 'secretary' || body.active_role === 'committee') {
        const { data: orgMember } = await serviceSupabase
          .from('society_members')
          .select('id, role')
          .eq('user_id', user.id)
          .in('role', ['secretary', 'committee', 'organizer'])
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (orgMember) {
          allowedUpdates.active_role = 'organizer';
        } else {
          return NextResponse.json(
            { error: 'Cannot switch view to organizer/secretary: you are not a secretary or committee member of any society.' },
            { status: 403 }
          );
        }
      } else if (body.active_role === 'provider') {
        const { data: prov } = await serviceSupabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (prov) {
          allowedUpdates.active_role = 'provider';
        } else {
          return NextResponse.json(
            { error: 'Cannot switch view to provider: no registered provider profile found for your account.' },
            { status: 403 }
          );
        }
      } else if (body.active_role === 'admin') {
        const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
        const isSupport = await isSupportAdmin(user.id, serviceSupabase);
        if (isPlatform || isSupport) {
          allowedUpdates.active_role = 'admin';
        } else {
          return NextResponse.json(
            { error: 'Forbidden: Admin role view elevation not allowed.' },
            { status: 403 }
          );
        }
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid profile updates provided' }, { status: 400 });
    }

    allowedUpdates.updated_at = new Date().toISOString();

    const { data: updatedProfile, error: updateError } = await serviceSupabase
      .from('profiles')
      .update(allowedUpdates)
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('[API/user/profile] Profile update failed:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    console.error('[API/user/profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
