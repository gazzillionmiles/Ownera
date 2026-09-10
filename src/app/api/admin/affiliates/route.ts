import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { isUserAdmin } from '@/lib/admin/auth';
import { getClientIp, checkAdminRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

interface AdminProfile {
  id: string;
  email: string;
  name: string;
  device_fingerprint?: string;
  disputed_payment_flag?: boolean;
  dispute_count?: number;
  instagram_username?: string;
  upi_id?: string;
}

interface FingerprintFlagLog {
  user_id: string | null;
  details?: {
    reason?: string;
  } | null;
}

interface AffiliateConsentAudit {
  user_id: string;
  agreement_version: string;
  agreement_effective_date: string;
  agreement_hash: string;
  accepted_at: string;
  ip_address: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();

    if (!(await isUserAdmin(user, serviceSupabase))) {
      return NextResponse.json(
        { error: 'Forbidden. Access restricted to administrator account only.' },
        { status: 403 }
      );
    }

    // 1. Fetch referrals (pending, flagged, rejected, active)
    const { data: rawReferrals, error: refErr } = await serviceSupabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (refErr) {
      console.error('[Admin/Affiliates] Error fetching referrals:', refErr);
    }

    // Gather profile IDs to resolve user details
    const userIds = new Set<string>();
    (rawReferrals || []).forEach((r) => {
      userIds.add(r.referrer_user_id);
      userIds.add(r.referred_user_id);
    });

    // 2. Fetch commission ledger entries
    const { data: rawLedger, error: commErr } = await serviceSupabase
      .from('commission_ledger')
      .select('*')
      .order('created_at', { ascending: false });

    if (commErr) {
      console.error('[Admin/Affiliates] Error fetching commission ledger:', commErr);
    }

    (rawLedger || []).forEach((c) => {
      userIds.add(c.referrer_user_id);
      userIds.add(c.referred_user_id);
    });

    const affiliateUserIds = Array.from(
      new Set([
        ...(rawReferrals || []).map((r) => r.referrer_user_id),
        ...(rawLedger || []).map((c) => c.referrer_user_id),
      ])
    );

    // Resolve profiles
    const profilesMap: Record<string, AdminProfile> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await serviceSupabase
        .from('profiles')
        .select('id, email, name, device_fingerprint, disputed_payment_flag, dispute_count, instagram_username, upi_id')
        .in('id', Array.from(userIds));

      if (profiles) {
        profiles.forEach((p) => {
          profilesMap[p.id] = p;
        });
      }
    }

    // 3. Fetch recent fingerprint flag logs for extra reason details
    const { data: flagLogs } = await serviceSupabase
      .from('fingerprint_flag_logs')
      .select('user_id, device_fingerprint, details, created_at')
      .eq('event_type', 'referral_flagged')
      .order('created_at', { ascending: false });

    const flagLogsMap: Record<string, FingerprintFlagLog> = {};
    if (flagLogs) {
      flagLogs.forEach((log) => {
        if (log.user_id && !flagLogsMap[log.user_id]) {
          flagLogsMap[log.user_id] = log;
        }
      });
    }

    const latestConsentByUserId: Record<string, AffiliateConsentAudit> = {};
    if (affiliateUserIds.length > 0) {
      const { data: consentRows } = await serviceSupabase
        .from('affiliate_consents')
        .select('user_id, agreement_version, agreement_effective_date, agreement_hash, accepted_at, ip_address')
        .in('user_id', affiliateUserIds)
        .order('accepted_at', { ascending: false });

      (consentRows || []).forEach((row) => {
        if (!latestConsentByUserId[row.user_id]) {
          latestConsentByUserId[row.user_id] = row;
        }
      });
    }

    // Format pending/flagged referrals
    const pendingReferrals = (rawReferrals || [])
      .filter((r) => r.status === 'pending' || r.status === 'flagged' || r.status === 'rejected')
      .map((r) => {
        const referrer = profilesMap[r.referrer_user_id] || { id: r.referrer_user_id, email: 'Unknown', name: 'Unknown' };
        const referred = profilesMap[r.referred_user_id] || { id: r.referred_user_id, email: 'Unknown', name: 'Unknown' };
        const flagLog = flagLogsMap[r.referred_user_id];

        let flagReason = 'Device fingerprint match or repeat account signal detected';
        if (flagLog?.details?.reason) {
          flagReason = flagLog.details.reason;
        } else if (r.fingerprint_flagged) {
          flagReason = 'Shared device fingerprint with referrer or flagged account';
        }

        return {
          id: r.id,
          referrer: {
            ...referrer,
            affiliate_consent: latestConsentByUserId[r.referrer_user_id] || null,
          },
          referred,
          referral_code_used: r.referral_code_used,
          status: r.status,
          fingerprint_flagged: r.fingerprint_flagged,
          flag_reason: flagReason,
          created_at: r.created_at,
        };
      });

    // Format commission ledger entries
    const commissionLedger = (rawLedger || []).map((c) => {
      const referrer = profilesMap[c.referrer_user_id] || { id: c.referrer_user_id, email: 'Unknown', name: 'Unknown' };
      const referred = profilesMap[c.referred_user_id] || { id: c.referred_user_id, email: 'Unknown', name: 'Unknown' };

      return {
        id: c.id,
        referrer: {
          ...referrer,
          affiliate_consent: latestConsentByUserId[c.referrer_user_id] || null,
        },
        referred,
        credit_pack_purchase_id: c.credit_pack_purchase_id,
        purchase_amount_paid: Number(c.purchase_amount_paid),
        commission_amount: Number(c.commission_amount),
        payout_status: c.payout_status,
        was_paid_before_dispute: !!c.was_paid_before_dispute,
        paid_at: c.paid_at,
        paid_by_admin_note: c.paid_by_admin_note,
        created_at: c.created_at,
      };
    });

    // Summary calculations
    let totalUnpaidCommission = 0;
    let totalPaidCommission = 0;
    (rawLedger || []).forEach((c) => {
      const amount = Number(c.commission_amount || 0);
      if (c.payout_status === 'unpaid') {
        totalUnpaidCommission += amount;
      } else if (c.payout_status === 'paid') {
        totalPaidCommission += amount;
      }
    });

    const totalActiveReferrals = (rawReferrals || []).filter((r) => r.status === 'active').length;
    const totalPendingFlagged = pendingReferrals.length;

    return NextResponse.json({
      summary: {
        total_unpaid_commission: Math.round(totalUnpaidCommission * 100) / 100,
        total_paid_commission: Math.round(totalPaidCommission * 100) / 100,
        total_active_referrals: totalActiveReferrals,
        total_pending_flagged: totalPendingFlagged,
      },
      pending_referrals: pendingReferrals,
      commission_ledger: commissionLedger,
      affiliate_consents: affiliateUserIds.map((userId) => {
        const profile = profilesMap[userId] || { id: userId, email: 'Unknown', name: 'Unknown' };
        return {
          user: profile,
          consent: latestConsentByUserId[userId] || null,
        };
      }),
    });
  } catch (error) {
    console.error('[API/admin/affiliates] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
