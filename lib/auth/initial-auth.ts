import { createClient } from '@/lib/supabase/server';

// Note: intentionally not depending on the `server-only` package since it
// isn't already in package.json. This module is only ever imported from
// src/app/layout.tsx (a Server Component), and lib/supabase/server.ts
// already calls next/headers' cookies(), which itself throws if invoked
// from client code — so this can't accidentally end up in a client bundle.

/**
 * Resolved once per request on the server (in the root layout, a Server
 * Component) and passed down as a prop to the client AuthProvider.
 *
 * Why: AuthProvider previously started from `user: null, profile: null,
 * loading: true` on every page load and only resolved after a client-side
 * waterfall — getSession() -> fetchOrCreateProfile() (select('*'), with up
 * to 3 retries 300ms apart on a miss) -> fingerprint sync -> referral check
 * -> consent check — all running *after* hydration. Nothing meaningful
 * could render until that chain finished, which was a major contributor to
 * LCP. Resolving the user + profile here, during SSR (in parallel with the
 * rest of the page render, using the request's own cookies — no extra
 * round trip from the browser), lets AuthProvider start already-hydrated.
 */
export interface InitialAuthData {
  userId: string | null;
  userEmail: string | null;
  // Loosely typed here on purpose — this is a plain data-transfer shape
  // for SSR -> client hydration. AuthProvider casts it to its own
  // (client-side) ProfileRecord type, which is the source of truth.
  profile: Record<string, unknown> | null;
}

export async function getInitialAuth(): Promise<InitialAuthData> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { userId: null, userEmail: null, profile: null };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return {
      userId: user.id,
      userEmail: user.email ?? null,
      profile: profile ?? null,
    };
  } catch (err) {
    // Never let a failure here break the page — AuthProvider's existing
    // client-side fetch is still the fallback path.
    console.error('[getInitialAuth] Failed to resolve SSR auth state:', err);
    return { userId: null, userEmail: null, profile: null };
  }
}
