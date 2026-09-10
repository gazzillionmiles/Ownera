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
  checkPromoClaimRateLimit,
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
    const rateLimitResult = await checkPromoClaimRateLimit(user.id, clientIp);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        'Too many claim attempts. Please try again later.'
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const {
      promo_code,
      referral_code,
      device_fingerprint: bodyFp,
      client_id: bodyClientId,
    } = body || {};
    const code = (promo_code || referral_code || '').trim();

    if (!code) {
      return NextResponse.json(
        { error: 'promo_code or referral_code is required' },
        { status: 400 }
      );
    }

    let fingerprint = bodyFp || request.headers.get('x-device-fingerprint');
    const appCookiePrefix = process.env.APP_COOKIE_PREFIX || 'saas';
    const clientId =
      bodyClientId ||
      request.cookies.get(`${appCookiePrefix}_client_id`)?.value;

    const serviceSupabase = createAdminClient();

    if (!fingerprint) {
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('device_fingerprint')
        .eq('id', user.id)
        .single();
      fingerprint = profile?.device_fingerprint || null;
    }

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

      // Also check if fingerprint has recent promo claims from other accounts in fingerprint_flag_logs
      if (!isFlagged) {
        const { data: recentPromoLogs } = await serviceSupabase
          .from('fingerprint_flag_logs')
          .select('user_id')
          .eq('device_fingerprint', fingerprint)
          .eq('event_type', 'promo_claim_flagged')
          .neq('user_id', user.id);

        if (recentPromoLogs && recentPromoLogs.length > 0) {
          isFlagged = true;
          matchingUserIds = recentPromoLogs
            .map((l) => l.user_id)
            .filter(Boolean) as string[];
        }
      }
    } else {
      // Missing fingerprint signal on financial promo claim -> soft flag for manual review
      isFlagged = true;
    }

    // Check if code matches a referral_code
    const { data: referrerProfile } = await serviceSupabase
      .from('profiles')
      .select('id, device_fingerprint, fingerprint_flagged')
      .eq('referral_code', code.toUpperCase())
      .maybeSingle();

    if (referrerProfile) {
      if (referrerProfile.id === user.id) {
        return NextResponse.json(
          { error: 'Self-referral is not allowed' },
          { status: 400 }
        );
      }

      const { data: existingRef } = await serviceSupabase
        .from('referrals')
        .select('*')
        .eq('referred_user_id', user.id)
        .maybeSingle();

      if (existingRef) {
        return NextResponse.json({
          success: true,
          status: existingRef.status,
          message:
            existingRef.status === 'active'
              ? '20% Referral discount is already active on your account!'
              : 'Your referral claim is under review by admin.',
        });
      }

      if (
        referrerProfile.device_fingerprint &&
        referrerProfile.device_fingerprint === fingerprint
      ) {
        isFlagged = true;
      }
      if (matchingUserIds.includes(referrerProfile.id)) {
        isFlagged = true;
      }
      if (referrerProfile.fingerprint_flagged) {
        isFlagged = true;
      }

      const referralStatus = isFlagged ? 'flagged' : 'active';

      await serviceSupabase.from('referrals').insert({
        referrer_user_id: referrerProfile.id,
        referred_user_id: user.id,
        referral_code_used: code.toUpperCase(),
        status: referralStatus,
        fingerprint_flagged: isFlagged,
      });

      if (isFlagged) {
        await logFingerprintEvent({
          userId: user.id,
          clientId,
          fingerprint: fingerprint || 'unknown',
          eventType: 'referral_flagged',
          matchingUserIds,
          details: {
            code,
            referrerUserId: referrerProfile.id,
            reason: 'Referral claim flagged due to fingerprint match',
          },
        });

        return NextResponse.json({
          success: true,
          status: 'pending_review',
          flagged: true,
          message: 'Your referral code was received and is under review.',
        });
      }

      await logFingerprintEvent({
        userId: user.id,
        clientId,
        fingerprint: fingerprint!,
        eventType: 'referral_approved',
        details: { code, status: 'approved' },
      });

      return NextResponse.json({
        success: true,
        status: 'approved',
        flagged: false,
        message:
          '20% Referral discount applied successfully! All credit packs are now 20% off.',
      });
    }

    return NextResponse.json(
      { error: 'Invalid or expired referral code' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[API/promo/claim] Error processing claim:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
