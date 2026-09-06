import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { isUserAdmin } from '@/lib/admin/auth';
import { getAffiliateConsentStatus } from '@/lib/affiliate-consent';
import { getClientIp, checkAdminRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

interface MarkPaidPayload {
  commission_id?: string;
  referrer_user_id?: string;
  note?: string;
}

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

    let body: MarkPaidPayload;
    try {
      body = (await request.json()) as MarkPaidPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { commission_id, referrer_user_id, note } = body || {};

    if (!commission_id && !referrer_user_id) {
      return NextResponse.json({ error: 'Either commission_id or referrer_user_id is required' }, { status: 400 });
    }

    const serviceSupabase = createAdminClient();
    const paidAt = new Date().toISOString();
    const noteText = typeof note === 'string' ? note.trim() : null;

    if (commission_id) {
      const { data: commissionRow, error: commissionLookupError } = await serviceSupabase
        .from('commission_ledger')
        .select('referrer_user_id')
        .eq('id', commission_id)
        .maybeSingle();

      if (commissionLookupError || !commissionRow) {
        return NextResponse.json({ error: 'Commission entry not found' }, { status: 404 });
      }

      const consentStatus = await getAffiliateConsentStatus(commissionRow.referrer_user_id);
      if (!consentStatus.hasCurrentConsent) {
        return NextResponse.json(
          { error: 'Affiliate must accept the current Affiliate Agreement before payout can be recorded' },
          { status: 409 }
        );
      }

      const { error } = await serviceSupabase
        .from('commission_ledger')
        .update({
          payout_status: 'paid',
          paid_at: paidAt,
          paid_by_admin_note: noteText,
        })
        .eq('id', commission_id);

      if (error) {
        console.error('[Admin/Commission/MarkPaid] Error marking single commission paid:', error);
        return NextResponse.json({ error: 'Failed to update commission payout status' }, { status: 500 });
      }
    } else if (referrer_user_id) {
      const consentStatus = await getAffiliateConsentStatus(referrer_user_id);
      if (!consentStatus.hasCurrentConsent) {
        return NextResponse.json(
          { error: 'Affiliate must accept the current Affiliate Agreement before payout can be recorded' },
          { status: 409 }
        );
      }

      const { error } = await serviceSupabase
        .from('commission_ledger')
        .update({
          payout_status: 'paid',
          paid_at: paidAt,
          paid_by_admin_note: noteText,
        })
        .eq('referrer_user_id', referrer_user_id)
        .eq('payout_status', 'unpaid');

      if (error) {
        console.error('[Admin/Commission/MarkPaid] Error batch marking paid:', error);
        return NextResponse.json({ error: 'Failed to batch update commission payout status' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      status: 'paid',
      paid_at: paidAt,
      note: noteText,
    });
  } catch (error) {
    console.error('[Admin/Commission/MarkPaid] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
