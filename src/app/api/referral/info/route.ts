import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { getAffiliateConsentStatus } from '@/lib/affiliate-consent';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();
    const affiliateConsentStatus = await getAffiliateConsentStatus(user.id);

    // Fetch user profile for referral_code, instagram_username, upi_id
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('referral_code, instagram_username, upi_id')
      .eq('id', user.id)
      .single();

    let referralCode = profile?.referral_code;

    // Lazily generate code if missing
    if (!referralCode) {
      referralCode = generateCode();
      await serviceSupabase
        .from('profiles')
        .update({ referral_code: referralCode, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    // Get referral stats for current user as a referrer
    const { data: userReferrals } = await serviceSupabase
      .from('referrals')
      .select('status')
      .eq('referrer_user_id', user.id);

    const totalReferrals = userReferrals?.length || 0;
    const activeReferrals = userReferrals?.filter((r) => r.status === 'active').length || 0;
    const flaggedReferrals = userReferrals?.filter((r) => r.status === 'flagged').length || 0;

    // Check if current user is a referred user with an active discount
    const { data: userDiscountRef } = await serviceSupabase
      .from('referrals')
      .select('status')
      .eq('referred_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasDiscount = !!userDiscountRef;

    const origin = request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';
    const shareUrl = `${origin}/?ref=${referralCode}`;

    return NextResponse.json({
      referral_code: referralCode,
      share_url: shareUrl,
      instagram_username: profile?.instagram_username || '',
      upi_id: profile?.upi_id || '',
      stats: {
        total: totalReferrals,
        active: activeReferrals,
        flagged: flaggedReferrals,
      },
      affiliate_consent: {
        current_version: affiliateConsentStatus.currentVersion,
        current_effective_date: affiliateConsentStatus.currentEffectiveDate,
        latest: affiliateConsentStatus.latestConsent,
        needs_reacceptance: affiliateConsentStatus.needsReacceptance,
        has_current_consent: affiliateConsentStatus.hasCurrentConsent,
      },
      has_discount: hasDiscount,
      discount_percent: hasDiscount ? 20 : 0,
    });
  } catch (err: any) {
    console.error('[API/referral/info] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
