import { createAdminClient } from '@/lib/supabase/service';

export const TERMS_CONSENT_EVENT_TYPE = 'terms_accepted';
export const TERMS_CONSENT_VERSION = process.env.TERMS_CONSENT_VERSION || '2026-v1';
export const OAUTH_CONSENT_COOKIE_NAME = `${process.env.APP_COOKIE_PREFIX || 'saas'}_oauth_signup_consent`;
export const NEW_SIGNUP_CONSENT_WINDOW_MS = 15 * 60 * 1000;

export type SupportedAuthProvider = 'email' | 'google' | 'apple' | 'unknown';

interface ConsentEventMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

interface PendingOauthConsent {
  consentVersion: string;
  provider: SupportedAuthProvider;
  timestamp: number;
}

export function getConsentEventMetadata(headers: Headers): ConsentEventMetadata {
  const forwardedFor = headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || headers.get('x-real-ip');
  const userAgent = headers.get('user-agent');

  return {
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  };
}

export function normalizeAuthProvider(provider: string | null | undefined): SupportedAuthProvider {
  if (!provider) return 'unknown';

  const normalized = provider.toLowerCase();
  if (normalized === 'email' || normalized === 'google' || normalized === 'apple') {
    return normalized;
  }

  return 'unknown';
}

export function createPendingOauthConsentValue(provider: SupportedAuthProvider): string {
  return JSON.stringify({
    consentVersion: TERMS_CONSENT_VERSION,
    provider,
    timestamp: Date.now(),
  } satisfies PendingOauthConsent);
}

export function parsePendingOauthConsentValue(rawValue: string | undefined): PendingOauthConsent | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<PendingOauthConsent>;
    if (
      typeof parsed.consentVersion !== 'string' ||
      typeof parsed.provider !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return null;
    }

    return {
      consentVersion: parsed.consentVersion,
      provider: normalizeAuthProvider(parsed.provider),
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

export function isTermsConsentCurrent(consent: { consent_version?: string | null } | null | undefined): boolean {
  return Boolean(consent && consent.consent_version === TERMS_CONSENT_VERSION);
}

export async function hasUserAcceptedTerms(userId: string): Promise<boolean> {
  const latest = await findLatestTermsConsentEvent(userId);
  return isTermsConsentCurrent(latest);
}

export async function findLatestTermsConsentEvent(userId: string) {
  const serviceSupabase = createAdminClient();

  const { data, error } = await serviceSupabase
    .from('consent_events')
    .select('id, consent_version, auth_provider, created_at')
    .eq('user_id', userId)
    .eq('event_type', TERMS_CONSENT_EVENT_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertTermsConsentEvent(params: {
  userId: string;
  provider: SupportedAuthProvider;
  headers: Headers;
}) {
  const serviceSupabase = createAdminClient();
  const metadata = getConsentEventMetadata(params.headers);

  const { error } = await serviceSupabase.from('consent_events').insert({
    user_id: params.userId,
    event_type: TERMS_CONSENT_EVENT_TYPE,
    ip_address: metadata.ipAddress,
    user_agent: metadata.userAgent,
    consent_version: TERMS_CONSENT_VERSION,
    auth_provider: params.provider,
  });

  if (error) {
    throw error;
  }
}

export function getSafePostAuthRedirect(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') {
    return '/home';
  }

  const trimmed = next.trim();
  // Must start with single slash, not protocol-relative (//) or backslash (/\ or \..)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\\')) {
    return '/home';
  }

  // Ensure it is a valid relative path containing URL-safe characters only
  if (!/^\/[a-zA-Z0-9_\-.~%!$&'()*+,;=:@/?#[\]]*$/.test(trimmed)) {
    return '/home';
  }

  return trimmed;
}
