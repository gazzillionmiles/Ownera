import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import {
  recordAndCheckFingerprint,
  logFingerprintEvent,
} from '@/lib/fingerprint/server';
import { log } from '@/lib/logger';
import {
  getClientIp,
  checkReferralAssociateRateLimit,
  createRateLimitResponse,
} from '@/lib/ratelimit';

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

    const clientIp = getClientIp(request);
    const rateLimitResult = await checkReferralAssociateRateLimit(
      user.id,
      clientIp
    );
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        'Too many attempts. Please try again later.'
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const referralCode =
      typeof body.referral_code === 'string'
        ? body.referral_code.trim().toUpperCase()
        : '';

    if (!referralCode) {
      return NextResponse.json(
        { error: 'referral_code is required' },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();

    // 1. Check if this user is already referred by anyone
    const { data: existingRef } = await serviceSupabase
      .from('referrals')
      .select('*')
      .eq('referred_user_id', user.id)
      .maybeSingle();

    if (existingRef) {
      return NextResponse.json({
        success: true,
        alreadyAssociated: true,
        status: existingRef.status,
        flagged: existingRef.fingerprint_flagged,
      });
    }

    // 2. Find referrer by referral_code
    const { data: referrerProfile } = await serviceSupabase
      .from('profiles')
      .select('id, device_fingerprint, fingerprint_flagged')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (!referrerProfile) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    if (referrerProfile.id === user.id) {
      return NextResponse.json(
        { error: 'Self-referral is not allowed' },
        { status: 400 }
      );
    }

    // 3. Fetch user's own profile and fingerprint info
    const { data: userProfile } = await serviceSupabase
      .from('profiles')
      .select('device_fingerprint, fingerprint_flagged')
      .eq('id', user.id)
      .single();

    const fingerprint =
      body.device_fingerprint ||
      request.headers.get('x-device-fingerprint') ||
      userProfile?.device_fingerprint;
    const appCookiePrefix = process.env.APP_COOKIE_PREFIX || 'saas';
    const clientId =
      body.client_id ||
      request.cookies.get(`${appCookiePrefix}_client_id`)?.value;

    let isFlagged = false;
    let matchingUserIds: string[] = [];

    if (fingerprint) {
      const checkResult = await recordAndCheckFingerprint({
        userId: user.id,
        clientId,
        fingerprint,
      });
      isFlagged = checkResult.flagged;
      matchingUserIds = checkResult.matchingUserIds;

      // Direct device match with referrer?
      if (
        referrerProfile.device_fingerprint &&
        referrerProfile.device_fingerprint === fingerprint
      ) {
        isFlagged = true;
      }
      if (matchingUserIds.includes(referrerProfile.id)) {
        isFlagged = true;
      }
    }

    // If either referrer or user profile was flagged previously
    if (
      userProfile?.fingerprint_flagged ||
      referrerProfile.fingerprint_flagged
    ) {
      isFlagged = true;
    }

    const referralStatus = isFlagged ? 'flagged' : 'active';

    // 4. Create referral entry
    const { data: newRef, error: insertError } = await serviceSupabase
      .from('referrals')
      .insert({
        referrer_user_id: referrerProfile.id,
        referred_user_id: user.id,
        referral_code_used: referralCode,
        status: referralStatus,
        fingerprint_flagged: isFlagged,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[Referral/Associate] DB Insert Error:', insertError);
      return NextResponse.json(
        { error: 'Failed to associate referral' },
        { status: 500 }
      );
    }

    if (isFlagged) {
      await logFingerprintEvent({
        userId: user.id,
        clientId,
        fingerprint: fingerprint || 'unknown',
        eventType: 'referral_flagged',
        matchingUserIds,
        details: {
          referralCode,
          referrerUserId: referrerProfile.id,
          reason:
            'Referral flagged due to fingerprint match or prior account flags',
        },
      });

      log({
        component: 'Referral',
        step: 'Referral Flagged',
        level: 'WARN',
        explanation: `User ${user.id} referral via code ${referralCode} flagged immediately due to fingerprint signals.`,
        data: {
          userId: user.id,
          referrerId: referrerProfile.id,
          referralCode,
          fingerprint,
        },
      });
    } else {
      log({
        component: 'Referral',
        step: 'Referral Created Active',
        level: 'INFO',
        explanation: `User ${user.id} successfully associated with referrer ${referrerProfile.id} via code ${referralCode}.`,
        data: { userId: user.id, referrerId: referrerProfile.id, referralCode },
      });
    }

    return NextResponse.json({
      success: true,
      status: referralStatus,
      flagged: isFlagged,
      referral: newRef,
    });
  } catch (err: any) {
    console.error('[API/referral/associate] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
