import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { isUserAdmin } from '@/lib/admin/auth';
import { getClientIp, checkAdminRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

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

    if (!isUserAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden. Access restricted to administrator account only.' },
        { status: 403 }
      );
    }

    const clientIp = getClientIp(request);
    const rateLimitResult = await checkAdminRateLimit(user.id, clientIp);
    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many admin requests. Please slow down.');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { referral_id, action } = body || {};

    if (!referral_id || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'referral_id and valid action (approve | reject) are required' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected';
    const serviceSupabase = createAdminClient();

    const { data: updated, error: updateError } = await serviceSupabase
      .from('referrals')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', referral_id)
      .select('*')
      .single();

    if (updateError) {
      console.error('[Admin/Referrals/Action] Error updating referral:', updateError);
      return NextResponse.json({ error: 'Failed to update referral status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      status: newStatus,
      referral: updated,
    });
  } catch (err: any) {
    console.error('[Admin/Referrals/Action] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
