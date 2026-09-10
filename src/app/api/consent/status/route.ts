import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import {
  findLatestTermsConsentEvent,
  isTermsConsentCurrent,
} from '@/lib/consent';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await getVerifiedUser(request, supabase);

  if (authError || !user) {
    return NextResponse.json({ hasConsent: false, consentVersion: null });
  }

  try {
    const latestConsent = await findLatestTermsConsentEvent(user.id);
    const hasConsent = isTermsConsentCurrent(latestConsent);

    return NextResponse.json({
      hasConsent,
      consentVersion: latestConsent?.consent_version || null,
    });
  } catch (error: unknown) {
    console.error('Failed to get terms consent status:', error);
    return NextResponse.json({ hasConsent: false, consentVersion: null });
  }
}
