import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VERIFIED_USER_ID_HEADER,
  VERIFIED_USER_EMAIL_HEADER,
} from './middleware';

/**
 * Drop-in replacement for `await supabase.auth.getUser()` inside route
 * handlers. Returns the exact same shape (`{ data: { user }, error }`) so it
 * can be used as a straight find-and-replace.
 *
 * middleware.ts already calls the real `supabase.auth.getUser()` once per
 * request — a genuine network round-trip to Supabase's Auth server, not a
 * local JWT decode — and forwards the verified id/email via trusted request
 * headers (stripped from any client-supplied value first, see
 * lib/supabase/middleware.ts). Route handlers were each calling
 * `getUser()` again, doubling that latency on every single authenticated
 * request. This reuses middleware's result instead.
 *
 * Falls back to a real `supabase.auth.getUser()` call when the headers are
 * absent (route hit in a context that bypasses middleware, tests, etc.), so
 * this is never less correct than the code it replaces — only faster in the
 * common case.
 *
 * NOTE: the fallback user object only carries `id` and `email`. A handful of
 * routes read additional fields (`user.user_metadata`, `user.app_metadata`,
 * `user.phone`) — those should keep calling `supabase.auth.getUser()`
 * directly rather than using this helper.
 */
export async function getVerifiedUser(
  request: NextRequest,
  supabase: SupabaseClient
) {
  const verifiedId = request.headers.get(VERIFIED_USER_ID_HEADER);

  if (verifiedId) {
    return {
      data: {
        user: {
          id: verifiedId,
          email: request.headers.get(VERIFIED_USER_EMAIL_HEADER) || undefined,
        } as any,
      },
      error: null as any,
    };
  }

  return supabase.auth.getUser();
}
