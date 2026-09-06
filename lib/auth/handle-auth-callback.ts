import { NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import {
  getSafePostAuthRedirect,
  OAUTH_CONSENT_COOKIE_NAME,
} from '@/lib/consent';
import { getClientIp, checkAuthCallbackRateLimit } from '@/lib/ratelimit';
import { checkAndGrantWelcomeCredits } from '@/lib/welcome-credits';

function buildLoginRedirect(origin: string, errorMessage: string) {
  const encoded = encodeURIComponent(errorMessage);
  return `${origin}/login?error=${encoded}`;
}

function buildClientCallbackResponse(origin: string, next: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verifying Authentication | Ownera</title>
  <style>
    body {
      background-color: #141414;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(44, 183, 165, 0.2);
      border-top-color: #2CB7A5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .card {
      text-align: center;
      padding: 24px;
      max-width: 400px;
    }
    .text {
      font-size: 14px;
      color: #a1a1aa;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div class="text">Completing verification...</div>
  </div>
  <script>
    (function() {
      try {
        var rawHash = window.location.hash || '';
        var hash = rawHash.startsWith('#') ? rawHash.substring(1) : rawHash;
        var hashParams = new URLSearchParams(hash);
        var searchParams = new URLSearchParams(window.location.search);
        var targetNext = searchParams.get('next') || ${JSON.stringify(next)} || '/home';

        // Check for error in hash or query
        var error = hashParams.get('error') || searchParams.get('error');
        var errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
        if (error || errorDesc) {
          window.location.replace('/login?error=' + encodeURIComponent(errorDesc || error || 'Authentication failed'));
          return;
        }

        var accessToken = hashParams.get('access_token');
        var refreshToken = hashParams.get('refresh_token');
        var type = hashParams.get('type') || searchParams.get('type');

        if (type === 'recovery') {
          window.location.replace('/reset-password' + rawHash);
          return;
        }

        if (accessToken && refreshToken) {
          window.location.replace(targetNext + rawHash);
          return;
        }

        // Email verified, redirect to login with confirmation
        window.location.replace('/login?message=' + encodeURIComponent('Email verified successfully! Please sign in to continue.'));
      } catch (e) {
        window.location.replace('/login?message=' + encodeURIComponent('Email verified successfully! Please sign in to continue.'));
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function handleAuthCallback(request: Request) {
  const origin = new URL(request.url).origin;
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkAuthCallbackRateLimit(clientIp);
  if (!rateLimitResult.success) {
    return NextResponse.redirect(buildLoginRedirect(origin, 'Too many verification attempts. Please try again later.'));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token');
  const type = (requestUrl.searchParams.get('type') as EmailOtpType) || 'signup';
  const errorDescription =
    requestUrl.searchParams.get('error_description') ||
    requestUrl.searchParams.get('error');
  let next = getSafePostAuthRedirect(requestUrl.searchParams.get('next'));

  if (errorDescription) {
    return NextResponse.redirect(buildLoginRedirect(origin, errorDescription));
  }

  const supabase = await createClient();
  let user: { id: string; email?: string } | null = null;

  if (tokenHash) {
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (verifyError) {
      return NextResponse.redirect(buildLoginRedirect(origin, verifyError.message || 'Verification failed. The link may have expired.'));
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    if (verifyData?.user) {
      user = verifyData.user;
    }
  } else if (code) {
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(buildLoginRedirect(origin, exchangeError.message || 'Authentication failed'));
    }

    if (next === '/reset-password' || type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    if (exchangeData?.user) {
      user = exchangeData.user;
    }
  } else {
    return buildClientCallbackResponse(origin, next);
  }

  if (!user) {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;
  }

  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent('Email verified successfully! Please sign in to continue.')}`
    );
  }

  // Ensure welcome credits are committed before redirecting to prevent stale 0 credit balance
  try {
    await checkAndGrantWelcomeCredits({
      userId: user.id,
      email: user.email,
    });
  } catch (creditErr) {
    console.error('[AuthCallback] Error granting welcome credits:', creditErr);
  }

  // Auto-join society if pending invite code exists in cookie
  const APP_PREFIX = process.env.NEXT_PUBLIC_APP_COOKIE_PREFIX || 'ownera';
  const INVITE_COOKIE_NAME = `${APP_PREFIX}_invite_code`;
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${INVITE_COOKIE_NAME}=([^;]*)`));
  const rawPendingCode = match ? decodeURIComponent(match[1])?.trim().toUpperCase() : null;
  const isAuthHexToken = Boolean(rawPendingCode && (rawPendingCode.length > 25 || /^[0-9A-F]{32,}$/.test(rawPendingCode)));
  const pendingInviteCode = isAuthHexToken ? null : rawPendingCode;

  if (pendingInviteCode) {
    try {
      const serviceSupabase = createAdminClient();
      const { data: society } = await serviceSupabase
        .from('societies')
        .select('id, slug, name')
        .ilike('invite_code', pendingInviteCode)
        .maybeSingle();

      if (society) {
        await serviceSupabase
          .from('society_members')
          .upsert(
            {
              society_id: society.id,
              user_id: user.id,
              flat_number: 'Unassigned',
              role: 'resident',
              status: 'active',
            },
            { onConflict: 'society_id,user_id' }
          );

        await serviceSupabase
          .from('profiles')
          .update({
            primary_society_id: society.id,
            active_role: 'resident',
          })
          .eq('id', user.id);

        if (next === '/home' || !next) {
          next = `/s/${society.slug}`;
        }
      }
    } catch (socErr) {
      console.error('[AuthCallback] Error auto-joining society from invite code:', socErr);
    }
  } else {
    try {
      const serviceSupabase = createAdminClient();
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('primary_society_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.primary_society_id && (next === '/home' || !next)) {
        next = '/onboarding';
      }
    } catch (profErr) {
      console.error('[AuthCallback] Error checking primary society:', profErr);
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const redirectUrl = isLocalEnv
    ? `${origin}${next}`
    : forwardedHost
    ? `https://${forwardedHost}${next}`
    : `${origin}${next}`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(OAUTH_CONSENT_COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
  });

  if (pendingInviteCode) {
    response.cookies.set(INVITE_COOKIE_NAME, '', {
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
    });
  }

  return response;
}
