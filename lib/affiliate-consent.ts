import { createAdminClient } from '@/lib/supabase/service';
import {
  AFFILIATE_AGREEMENT_EFFECTIVE_DATE,
  AFFILIATE_AGREEMENT_HASH,
  AFFILIATE_AGREEMENT_VERSION,
} from '@/lib/affiliate-agreement';

export interface AffiliateConsentRecord {
  agreement_version: string;
  agreement_effective_date: string;
  agreement_hash: string;
  accepted_at: string;
  ip_address: string | null;
}

export function getAffiliateRequestIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || headers.get('x-real-ip') || null;
}

export async function getLatestAffiliateConsent(userId: string): Promise<AffiliateConsentRecord | null> {
  const serviceSupabase = createAdminClient();
  const { data, error } = await serviceSupabase
    .from('affiliate_consents')
    .select('agreement_version, agreement_effective_date, agreement_hash, accepted_at, ip_address')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function isAffiliateConsentCurrent(consent: AffiliateConsentRecord | null) {
  return Boolean(
    consent &&
      consent.agreement_version === AFFILIATE_AGREEMENT_VERSION &&
      consent.agreement_effective_date === AFFILIATE_AGREEMENT_EFFECTIVE_DATE &&
      consent.agreement_hash === AFFILIATE_AGREEMENT_HASH
  );
}

export async function recordAffiliateConsent(userId: string, headers: Headers) {
  const serviceSupabase = createAdminClient();
  const { error } = await serviceSupabase.from('affiliate_consents').insert({
    user_id: userId,
    agreement_version: AFFILIATE_AGREEMENT_VERSION,
    agreement_effective_date: AFFILIATE_AGREEMENT_EFFECTIVE_DATE,
    agreement_hash: AFFILIATE_AGREEMENT_HASH,
    ip_address: getAffiliateRequestIp(headers),
    user_agent: headers.get('user-agent'),
  });

  if (error) {
    throw error;
  }
}

export async function getAffiliateConsentStatus(userId: string) {
  const latestConsent = await getLatestAffiliateConsent(userId);

  return {
    latestConsent,
    currentVersion: AFFILIATE_AGREEMENT_VERSION,
    currentEffectiveDate: AFFILIATE_AGREEMENT_EFFECTIVE_DATE,
    currentHash: AFFILIATE_AGREEMENT_HASH,
    hasCurrentConsent: isAffiliateConsentCurrent(latestConsent),
    needsReacceptance: !isAffiliateConsentCurrent(latestConsent),
  };
}
