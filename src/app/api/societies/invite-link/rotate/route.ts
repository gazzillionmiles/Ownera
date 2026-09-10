import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { rotateInviteLinkSchema } from '@/src/shared/validations/ownera';
import { rotateInviteLink } from '@/lib/ownera/invite-links';
import { AuthorizationError } from '@/lib/ownera/rbac';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = rotateInviteLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid societyId is required in request body' },
        { status: 400 }
      );
    }

    const result = await rotateInviteLink(parsed.data.societyId, user.id);

    return NextResponse.json({
      success: true,
      message:
        'Society invite link rotated successfully. Previous link has been deactivated.',
      inviteLink: result.inviteLink,
      joinPath: `/join/${result.inviteLink.token}`,
      rotated: result.rotated,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('[API/societies/invite-link/rotate POST] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
