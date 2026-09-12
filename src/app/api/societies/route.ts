import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { createSocietySchema } from '@/src/shared/validations/ownera';
import { isPlatformAdmin } from '@/lib/ownera/rbac';
import { setOnboardStatusCookie } from '@/lib/supabase/middleware';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    const serviceSupabase = createAdminClient();
    const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);

    // If platform admin requests all societies
    if (all && isPlatform) {
      const { data: allSocieties } = await serviceSupabase
        .from('societies')
        .select('*')
        .order('name', { ascending: true });

      return NextResponse.json({
        societies: allSocieties || [],
        memberships: [],
      });
    }

    // Get societies user belongs to using service client to bypass any RLS join issues
    const { data: rawMemberships } = await serviceSupabase
      .from('society_members')
      .select('*, society:societies(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const memberships = rawMemberships || [];

    // Only run auto-heal reconciliation if user has 0 memberships or explicitly requested
    const heal = searchParams.get('heal') === 'true';
    if (memberships.length === 0 || heal) {
      const { data: createdSocieties } = await serviceSupabase
        .from('societies')
        .select('*')
        .eq('created_by', user.id);

      if (createdSocieties && createdSocieties.length > 0) {
        const existingSocietyIds = new Set(
          memberships.map((m) => m.society_id)
        );
        for (const soc of createdSocieties) {
          if (!existingSocietyIds.has(soc.id)) {
            const { data: healedMem } = await serviceSupabase
              .from('society_members')
              .upsert(
                {
                  society_id: soc.id,
                  user_id: user.id,
                  flat_number: 'Secretary Unit',
                  role: 'secretary',
                  status: 'active',
                },
                { onConflict: 'society_id,user_id' }
              )
              .select('*, society:societies(*)')
              .single();

            if (healedMem) {
              memberships.push(healedMem);
            }
          }
        }
      }
    }

    // Compute active member counts for each society
    const societyIds = Array.from(
      new Set(memberships.map((m) => m.society_id).filter(Boolean))
    );
    const memberCountMap = new Map<string, number>();

    if (societyIds.length > 0) {
      const { data: allMembersInSocieties } = await serviceSupabase
        .from('society_members')
        .select('society_id')
        .in('society_id', societyIds)
        .eq('status', 'active');

      (allMembersInSocieties || []).forEach((m) => {
        memberCountMap.set(
          m.society_id,
          (memberCountMap.get(m.society_id) || 0) + 1
        );
      });
    }

    const societiesList = memberships
      .filter((m) => {
        const soc = Array.isArray(m.society) ? m.society[0] : m.society;
        return soc && soc.id;
      })
      .map((m) => {
        const soc = Array.isArray(m.society) ? m.society[0] : m.society;
        return {
          ...soc,
          user_role: m.role || 'resident',
          flat_number: m.flat_number || m.unit_number || '',
          property_type: m.property_type || 'apartment',
          member_count: memberCountMap.get(m.society_id) || 1,
        };
      });

    // Auto-heal profiles.primary_society_id and reconcile active_role if user is secretary/organizer
    const { data: userProfile } = await serviceSupabase
      .from('profiles')
      .select('primary_society_id, active_role')
      .eq('id', user.id)
      .maybeSingle();

    const elevatedSoc =
      societiesList.find((s) => s.user_role === 'secretary') ||
      societiesList.find(
        (s) => s.user_role === 'organizer' || s.user_role === 'committee'
      );
    const isElevated = Boolean(elevatedSoc);

    if (isElevated && userProfile && userProfile.active_role !== 'organizer' && userProfile.active_role !== 'admin') {
      await serviceSupabase
        .from('profiles')
        .update({
          active_role: 'organizer',
          ...(userProfile.primary_society_id ? {} : { primary_society_id: elevatedSoc?.id }),
        })
        .eq('id', user.id);
    } else if (!userProfile?.primary_society_id && societiesList.length > 0) {
      const targetSoc = elevatedSoc || societiesList[0];
      await serviceSupabase
        .from('profiles')
        .update({
          primary_society_id: targetSoc.id,
          active_role: isElevated ? 'organizer' : 'resident',
        })
        .eq('id', user.id);
    }

    return NextResponse.json({
      memberships,
      societies: societiesList,
    });
  } catch (err: any) {
    console.error('[API/societies] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();

    const json = await request.json();
    const parsed = createSocietySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid society data', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      name,
      address,
      city,
      state,
      pincode,
      totalHomes,
      secretaryUserId,
      flatNumber,
      propertyType = 'apartment',
    } = parsed.data;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    // Insert society (backward-compatible if remote DB still has NOT NULL on legacy invite_code)
    const societyPayload: Record<string, any> = {
      name,
      slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
      address,
      city,
      state,
      pincode,
      total_homes: totalHomes,
      created_by: user.id,
    };

    let { data: society, error: insertError } = await serviceSupabase
      .from('societies')
      .insert(societyPayload)
      .select()
      .single();

    if (
      insertError &&
      insertError.code === '23502' &&
      (insertError.message?.includes('invite_code') ||
        insertError.details?.includes('invite_code'))
    ) {
      const fallbackCode = `SOC${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const retryResult = await serviceSupabase
        .from('societies')
        .insert({
          ...societyPayload,
          invite_code: fallbackCode,
        })
        .select()
        .single();
      society = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError || !society) {
      console.error('[API/societies] Error inserting society:', insertError);
      return NextResponse.json(
        { error: 'Failed to create society' },
        { status: 500 }
      );
    }

    // Assign initial primary secretary
    const targetSecretaryId = secretaryUserId || user.id;
    let member = null;

    const { data: memberData, error: memberError } = await serviceSupabase
      .from('society_members')
      .upsert(
        {
          society_id: society.id,
          user_id: targetSecretaryId,
          flat_number: flatNumber || 'Unit 1',
          unit_number: flatNumber || 'Unit 1',
          property_type: propertyType,
          role: 'secretary',
          status: 'active',
        },
        { onConflict: 'society_id,user_id' }
      )
      .select()
      .single();

    if (memberError) {
      console.warn(
        '[API/societies] Retrying basic secretary membership insert:',
        memberError.message
      );
      const { data: retryMember, error: retryErr } = await serviceSupabase
        .from('society_members')
        .upsert(
          {
            society_id: society.id,
            user_id: targetSecretaryId,
            flat_number: flatNumber || 'Unit 1',
            role: 'secretary',
            status: 'active',
          },
          { onConflict: 'society_id,user_id' }
        )
        .select()
        .single();

      if (retryErr) {
        console.error(
          '[API/societies] Error inserting secretary membership:',
          retryErr
        );
      } else {
        member = retryMember;
      }
    } else {
      member = memberData;
    }

    // Update profile with valid active_role ('organizer') matching profiles_active_role_check constraint
    const { error: profileUpdateError } = await serviceSupabase
      .from('profiles')
      .update({
        primary_society_id: society.id,
        active_role: 'organizer',
        property_type: propertyType,
        unit_number: flatNumber || 'Unit 1',
      })
      .eq('id', targetSecretaryId);

    if (profileUpdateError) {
      console.error(
        '[API/societies] Error updating creator profile:',
        profileUpdateError
      );
      // Attempt safe fallback update for primary_society_id and active_role
      const { error: fallbackError } = await serviceSupabase
        .from('profiles')
        .update({
          primary_society_id: society.id,
          active_role: 'organizer',
        })
        .eq('id', targetSecretaryId);

      if (fallbackError) {
        console.error(
          '[API/societies] Fallback profile update failed:',
          fallbackError
        );
        return NextResponse.json(
          {
            error:
              'Society was created, but failed to link profile. Please refresh or rejoin.',
          },
          { status: 500 }
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      society: {
        ...society,
        user_role: 'secretary',
        flat_number: flatNumber || 'Unit 1',
        property_type: propertyType,
      },
      member,
    });

    return setOnboardStatusCookie(response, {
      userId: user.id,
      activeRole: 'organizer',
      primarySocietyId: society.id,
    });
  } catch (err: any) {
    console.error('[API/societies] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
