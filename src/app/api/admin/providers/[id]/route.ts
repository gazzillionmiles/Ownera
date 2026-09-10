import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { requirePlatformPermission } from '@/lib/ownera/rbac';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const providerId = resolvedParams.id;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(
        serviceSupabase,
        user.id,
        'platform.providers.manage'
      );
    } catch (authErr: any) {
      return NextResponse.json(
        { error: authErr.message || 'Platform administrator access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, verification_status } = body;

    let targetStatus: 'verified' | 'rejected' | 'banned' | 'pending';

    if (action === 'approve') {
      targetStatus = 'verified';
    } else if (action === 'reject') {
      targetStatus = 'rejected';
    } else if (action === 'ban') {
      targetStatus = 'banned';
    } else if (action === 'unban') {
      targetStatus = 'verified';
    } else if (
      verification_status &&
      ['verified', 'rejected', 'banned', 'pending'].includes(
        verification_status
      )
    ) {
      targetStatus = verification_status;
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid moderation action. Must be approve, reject, ban, or unban.',
        },
        { status: 400 }
      );
    }

    // 1. Fetch current provider record
    const { data: existingProvider, error: selectErr } = await serviceSupabase
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (selectErr || !existingProvider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // 2. Update provider verification status
    const { data: updatedProvider, error: updateErr } = await serviceSupabase
      .from('providers')
      .update({
        verification_status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', providerId)
      .select()
      .single();

    if (updateErr) {
      console.error(
        '[API/admin/providers/[id] PATCH] Update error:',
        updateErr
      );
      return NextResponse.json(
        { error: 'Failed to update provider status' },
        { status: 500 }
      );
    }

    const actionVerb =
      targetStatus === 'verified'
        ? 'approved and verified'
        : targetStatus === 'banned'
          ? 'banned'
          : targetStatus === 'rejected'
            ? 'rejected'
            : 'marked as pending';

    return NextResponse.json({
      success: true,
      message: `Vendor "${updatedProvider.company_name}" has been ${actionVerb}.`,
      provider: updatedProvider,
    });
  } catch (err: any) {
    console.error('[API/admin/providers/[id] PATCH] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
