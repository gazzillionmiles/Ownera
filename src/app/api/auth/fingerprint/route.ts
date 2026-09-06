import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAndCheckFingerprint } from '@/lib/fingerprint/server';
import { checkAndGrantWelcomeCredits } from '@/lib/welcome-credits';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

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

    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit({
      key: `ratelimit:fingerprint:user:${user.id}`,
      limit: 15,
      windowSeconds: 600,
    });
    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many requests. Please try again later.');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { fingerprint, client_id } = body || {};

    if (!fingerprint || typeof fingerprint !== 'string' || fingerprint.trim() === '') {
      return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 });
    }

    const cleanFp = fingerprint.trim();

    const result = await recordAndCheckFingerprint({
      userId: user.id,
      clientId: client_id,
      fingerprint: cleanFp,
    });

    // Check and grant dynamic welcome credits (with anti-abuse hash check)
    const welcomeResult = await checkAndGrantWelcomeCredits({
      userId: user.id,
      email: user.email,
      deviceFingerprint: cleanFp,
    });

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      flagged: result.flagged,
      fingerprintCount: result.fingerprintCount,
      welcomeCredits: welcomeResult,
      credits: updatedProfile?.credits ?? (welcomeResult.granted ? welcomeResult.creditsGranted : 0),
    });
  } catch (err: any) {
    console.error('[API/auth/fingerprint] Error recording fingerprint:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
