import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { insertTermsConsentEvent, normalizeAuthProvider, TERMS_CONSENT_VERSION } from '@/lib/consent';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = normalizeAuthProvider(user.app_metadata?.provider);

  try {
    await insertTermsConsentEvent({
      userId: user.id,
      provider,
      headers: request.headers,
    });

    return NextResponse.json({
      success: true,
      consentVersion: TERMS_CONSENT_VERSION,
    });
  } catch (error: unknown) {
    console.error('Failed to record terms consent event:', error);
    return NextResponse.json(
      { error: 'Failed to record terms consent. Please try again.' },
      { status: 500 }
    );
  }
}
