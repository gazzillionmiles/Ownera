import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import {
  getAffiliateConsentStatus,
  recordAffiliateConsent,
} from '@/lib/affiliate-consent';

const affiliateEnrollSchema = z.object({
  instagram_username: z.string().trim().optional().default(''),
  upi_id: z.string().trim().optional().default(''),
  affiliateAgreementAccepted: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = affiliateEnrollSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!body.success) {
      return NextResponse.json(
        { error: 'Invalid affiliate enrollment payload' },
        { status: 400 }
      );
    }

    const consentStatus = await getAffiliateConsentStatus(user.id);
    if (
      consentStatus.needsReacceptance &&
      body.data.affiliateAgreementAccepted !== true
    ) {
      return NextResponse.json(
        {
          error:
            'You must accept the current Affiliate Agreement before joining or updating affiliate details',
        },
        { status: 400 }
      );
    }

    if (consentStatus.needsReacceptance) {
      await recordAffiliateConsent(user.id, request.headers);
    }

    const serviceSupabase = createAdminClient();
    const profileUpdates = {
      instagram_username: body.data.instagram_username,
      upi_id: body.data.upi_id,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: updateError } = await serviceSupabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id)
      .select('id, instagram_username, upi_id')
      .single();

    if (updateError) {
      console.error(
        '[API/affiliate/enroll] Profile update failed:',
        updateError
      );
      return NextResponse.json(
        { error: 'Failed to save affiliate details' },
        { status: 500 }
      );
    }

    const refreshedConsentStatus = await getAffiliateConsentStatus(user.id);

    return NextResponse.json({
      success: true,
      profile,
      affiliate_consent: {
        current_version: refreshedConsentStatus.currentVersion,
        current_effective_date: refreshedConsentStatus.currentEffectiveDate,
        latest: refreshedConsentStatus.latestConsent,
        needs_reacceptance: refreshedConsentStatus.needsReacceptance,
        has_current_consent: refreshedConsentStatus.hasCurrentConsent,
      },
    });
  } catch (error) {
    console.error('[API/affiliate/enroll] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
