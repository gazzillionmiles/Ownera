import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { getInviteLinkQuerySchema } from '@/src/shared/validations/ownera';
import { getOrCreateActiveInviteLink } from '@/lib/ownera/invite-links';
import { AuthorizationError } from '@/lib/ownera/rbac';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const societyId = searchParams.get('societyId');

    const parsed = getInviteLinkQuerySchema.safeParse({ societyId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid societyId query parameter is required' },
        { status: 400 }
      );
    }

    const result = await getOrCreateActiveInviteLink(
      parsed.data.societyId,
      user.id
    );

    return NextResponse.json({
      success: true,
      inviteLink: result.inviteLink,
      joinPath: `/join/${result.inviteLink.token}`,
      isNew: result.isNew,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('[API/societies/invite-link GET] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
