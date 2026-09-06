import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createPendingOauthConsentValue,
  normalizeAuthProvider,
  OAUTH_CONSENT_COOKIE_NAME,
} from '@/lib/consent';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

const oauthPrepareSchema = z.object({
  provider: z.string().min(1),
  consentAccepted: z.literal(true),
});

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit({
    key: `ratelimit:oauth_prepare:ip:${clientIp}`,
    limit: 15,
    windowSeconds: 600,
  });
  if (!rateLimitResult.success) {
    return createRateLimitResponse('Too many attempts. Please try again later.');
  }

  let parsedBody: z.infer<typeof oauthPrepareSchema>;

  try {
    const json = await request.json();
    parsedBody = oauthPrepareSchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: 'You must accept the Terms & Conditions and Privacy Policy before continuing' },
      { status: 400 }
    );
  }

  const provider = normalizeAuthProvider(parsedBody.provider);
  if (provider === 'unknown') {
    return NextResponse.json({ error: 'Unsupported OAuth provider' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OAUTH_CONSENT_COOKIE_NAME, encodeURIComponent(createPendingOauthConsentValue(provider)), {
    httpOnly: true,
    maxAge: 15 * 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
  });

  return response;
}
