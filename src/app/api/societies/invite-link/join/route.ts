import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { joinByInviteTokenSchema } from '@/src/shared/validations/ownera';
import { joinSocietyByInviteToken } from '@/lib/ownera/invite-links';
import { setOnboardStatusCookie } from '@/lib/supabase/middleware';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. You must be signed in to join a society.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Explicit security enforcement: The client schema strictly parses { token, flatNumber, unitNumber, propertyType }
    // Any injected societyId, society_id, or slug is stripped and ignored by Zod parsing.
    const parsed = joinByInviteTokenSchema.safeParse(body);

    if (!parsed.success) {
      const errorMsg =
        parsed.error.issues?.[0]?.message || 'Invalid join request payload';
      return NextResponse.json(
        { error: errorMsg, details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { token, flatNumber, unitNumber, propertyType } = parsed.data;

    const result = await joinSocietyByInviteToken({
      token,
      userId: user.id,
      unitNumber: unitNumber || flatNumber,
      propertyType,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, reason: result.reason },
        { status: result.statusCode }
      );
    }

    const memberRole = result.member?.role || 'resident';
    const profileRole =
      memberRole === 'secretary' ||
      memberRole === 'committee' ||
      memberRole === 'organizer'
        ? 'organizer'
        : 'resident';

    const response = NextResponse.json({
      success: true,
      alreadyMember: result.alreadyMember,
      message: result.message,
      society: result.society,
      member: result.member,
    });

    return setOnboardStatusCookie(response, {
      userId: user.id,
      activeRole: profileRole,
      primarySocietyId: result.society?.id || '',
    });
  } catch (err: any) {
    console.error('[API/societies/invite-link/join POST] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
