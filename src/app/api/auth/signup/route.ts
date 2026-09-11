import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { insertTermsConsentEvent, getSafePostAuthRedirect } from '@/lib/consent';
import { checkAndGrantWelcomeCredits } from '@/lib/welcome-credits';
import { recordAndCheckFingerprint } from '@/lib/fingerprint/server';
import { getClientIp, checkSignupRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  consentAccepted: z.boolean().optional(),
  fingerprint: z.string().optional(),
  client_id: z.string().optional(),
  next: z.string().optional(),
});

function createAnonSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkSignupRateLimit(clientIp);
  if (!rateLimitResult.success) {
    return createRateLimitResponse('Too many signup attempts. Please try again later.');
  }

  let parsedBody: z.infer<typeof signupSchema>;

  try {
    const json = await request.json();
    parsedBody = signupSchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: 'You must accept the Terms & Conditions and Privacy Policy before creating an account' },
      { status: 400 }
    );
  }

  const supabase = createAnonSupabaseClient();
  const origin = new URL(request.url).origin;
  const safeNext = getSafePostAuthRedirect(parsedBody.next || null);
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const { data, error } = await supabase.auth.signUp({
    email: parsedBody.email,
    password: parsedBody.password,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    const lowerMessage = error.message.toLowerCase();
    const isDuplicate =
      lowerMessage.includes('already registered') ||
      lowerMessage.includes('already exists') ||
      lowerMessage.includes('user_already_exists');

    return NextResponse.json(
      { error: isDuplicate ? 'An account with this email already exists' : error.message || 'Signup failed' },
      { status: isDuplicate ? 409 : 400 }
    );
  }

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  if (!data.user) {
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }

  const cleanFp = parsedBody.fingerprint?.trim();

  // 1. Record fingerprint if provided
  if (cleanFp) {
    try {
      await recordAndCheckFingerprint({
        userId: data.user.id,
        clientId: parsedBody.client_id,
        fingerprint: cleanFp,
      });
    } catch (fpErr) {
      console.error('[Signup] Fingerprint record error:', fpErr);
    }
  }

  // 2. Grant welcome credits immediately before returning to prevent stale client credit state
  try {
    await checkAndGrantWelcomeCredits({
      userId: data.user.id,
      email: data.user.email,
      deviceFingerprint: cleanFp || null,
    });
  } catch (credErr) {
    console.error('[Signup] Welcome credits error:', credErr);
  }

  // 3. Record terms consent if accepted
  if (parsedBody.consentAccepted) {
    try {
      await insertTermsConsentEvent({
        userId: data.user.id,
        provider: 'email',
        headers: request.headers,
      });
    } catch (consentErr) {
      console.error('[Signup] Terms consent error:', consentErr);
    }
  }

  const response = NextResponse.json({
    data: {
      user: data.user,
      session: data.session,
    },
  });

  return response;
}
