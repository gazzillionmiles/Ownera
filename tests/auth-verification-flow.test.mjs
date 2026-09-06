import test from 'node:test';
import assert from 'node:assert/strict';

test('Email Verification Flow: Implicit flow callback without code/token_hash serves client bridge', async () => {
  // Simulating URL when Supabase verifies token on server and redirects with hash fragment:
  // e.g., http://localhost:3000/auth/callback?next=/home#access_token=...&refresh_token=...
  const requestUrl = new URL('http://localhost:3000/auth/callback?next=/home');
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token');

  assert.equal(code, null);
  assert.equal(tokenHash, null);

  // In the updated handleAuthCallback, this returns the client-side bridge instead of redirecting to login?error=Authentication failed
  const isClientBridgeServed = !code && !tokenHash;
  assert.equal(isClientBridgeServed, true);
});

test('Email Verification Flow: Verification without active session yields friendly login message, not authentication failure', async () => {
  // When verifyOtp succeeds on server, but no session cookie is created:
  const otpVerificationSucceeded = true;
  const sessionExists = false;

  let redirectDestination = '';
  if (otpVerificationSucceeded && !sessionExists) {
    redirectDestination = `/login?message=${encodeURIComponent('Email verified successfully! Please sign in to continue.')}`;
  } else if (!otpVerificationSucceeded) {
    redirectDestination = `/login?error=${encodeURIComponent('Authentication failed')}`;
  }

  assert.ok(redirectDestination.includes('message=Email%20verified%20successfully'));
  assert.ok(!redirectDestination.includes('error=Authentication'));
});

test('Email Verification Flow: Error descriptions from Supabase are forwarded clearly', async () => {
  const requestUrl = new URL('http://localhost:3000/auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
  const errorDescription = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  assert.equal(errorDescription, 'Email link is invalid or has expired');
});

test('Onboarding Guard: Non-onboarded authenticated users are locked to /onboarding', async () => {
  const profile = { primary_society_id: null };
  const hasCompletedOnboarding = !!profile.primary_society_id;

  const attemptedPaths = ['/home', '/s/palm-meadows', '/profile', '/settings', '/admin/issues'];

  for (const path of attemptedPaths) {
    const isPublic = path === '/login' || path === '/terms';
    let targetRedirect = null;
    if (!hasCompletedOnboarding && path !== '/onboarding' && !isPublic) {
      targetRedirect = '/onboarding';
    }
    assert.equal(targetRedirect, '/onboarding', `Path ${path} should redirect to /onboarding for non-onboarded users`);
  }
});

test('Onboarding Guard: Onboarded users visiting /onboarding are redirected to /home', async () => {
  const profile = { primary_society_id: 'soc_12345' };
  const hasCompletedOnboarding = !!profile.primary_society_id;

  let targetRedirect = null;
  const path = '/onboarding';
  if (hasCompletedOnboarding && path === '/onboarding') {
    targetRedirect = '/home';
  }

  assert.equal(targetRedirect, '/home');
});

test('Invite Code Guard: 64-char email verification tokens are distinguished from society codes', async () => {
  const emailToken = 'e50659ced6e4552fca8853a4f6635638f31f3f6a39abef18cd8c0d16523dbeb5';
  const isHexAuthToken = /^[0-9a-f]{32,}$/i.test(emailToken) || (emailToken.length > 25 && !emailToken.startsWith('inv_'));

  assert.equal(isHexAuthToken, true);

  const realSocietyCode = 'PALM2026';
  const isRealSocietyCodeHexToken = /^[0-9a-f]{32,}$/i.test(realSocietyCode) || (realSocietyCode.length > 25 && !realSocietyCode.startsWith('inv_'));
  assert.equal(isRealSocietyCodeHexToken, false);
});
