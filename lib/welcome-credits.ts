import { createAdminClient } from '@/lib/supabase/service';
import { log } from '@/lib/logger';
import crypto from 'crypto';

function computeHmac(input: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(input.trim().toLowerCase()).digest('hex');
}

export async function checkAndGrantWelcomeCredits({
  userId,
  email,
  deviceFingerprint,
}: {
  userId: string;
  email?: string | null;
  deviceFingerprint?: string | null;
}): Promise<{ granted: boolean; creditsGranted: number; reason: string }> {
  const serviceSupabase = createAdminClient();

  // 1. Configurable welcome credits from server environment (default 5 if not configured)
  const WELCOME_CREDITS = parseInt(process.env.WELCOME_CREDITS || '5', 10);
  const salt = process.env.ANTI_ABUSE_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'saas-anti-abuse-salt';

  if (WELCOME_CREDITS <= 0) {
    return { granted: false, creditsGranted: 0, reason: 'welcome_credits_disabled_by_config' };
  }

  try {
    // 2. Check if welcome bonus was already granted or attempted for this user
    const { data: existingBonus } = await serviceSupabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .or(`reason.eq.welcome_bonus,reason.eq.welcome_bonus_ineligible_prior_account,reference_id.eq.welcome_${userId}`)
      .maybeSingle();

    if (existingBonus) {
      return { granted: false, creditsGranted: 0, reason: 'welcome_credits_already_claimed' };
    }

    // 3. Anti-abuse check against deleted_account_hashes
    let isPriorAccountMatch = false;

    if (email) {
      const emailHash = computeHmac(email, salt);
      const { data: matchedEmail } = await serviceSupabase
        .from('deleted_account_hashes')
        .select('id')
        .eq('email_hash', emailHash)
        .maybeSingle();

      if (matchedEmail) {
        isPriorAccountMatch = true;
      }
    }

    if (!isPriorAccountMatch && deviceFingerprint) {
      const fpHash = computeHmac(deviceFingerprint, salt);
      const { data: matchedFp } = await serviceSupabase
        .from('deleted_account_hashes')
        .select('id')
        .eq('fingerprint_hash', fpHash)
        .gt('fp_expires_at', new Date().toISOString())
        .maybeSingle();

      if (matchedFp) {
        isPriorAccountMatch = true;
      }
    }

    if (isPriorAccountMatch) {
      log({
        component: 'WelcomeCredits',
        step: 'Ineligible Prior Account Match',
        level: 'WARN',
        explanation: `User ${userId} matched a prior deleted account hash; 0 welcome credits granted.`,
        data: { userId, email },
      });

      // Insert zero bonus record atomically (reference_id constraint prevents re-run)
      await serviceSupabase.from('credit_transactions').insert({
        user_id: userId,
        amount: 0,
        type: 'bonus',
        reason: 'welcome_bonus_ineligible_prior_account',
        reference_id: `welcome_${userId}`,
        balance_after: 0,
      });

      return { granted: false, creditsGranted: 0, reason: 'welcome_bonus_ineligible_prior_account' };
    }

    // 4. Atomically reserve welcome credit transaction FIRST via unique reference_id constraint
    const { data: insertedTx, error: txError } = await serviceSupabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: WELCOME_CREDITS,
        type: 'bonus',
        reason: 'welcome_bonus',
        reference_id: `welcome_${userId}`,
        balance_after: WELCOME_CREDITS,
      })
      .select('id')
      .single();

    if (txError || !insertedTx) {
      // Unique constraint violation on reference_id means welcome credits were already claimed
      return { granted: false, creditsGranted: 0, reason: 'welcome_credits_already_claimed' };
    }

    // 5. Update profile balance ONLY after transaction reservation succeeds
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    const currentCredits = profile?.credits ?? 0;
    const newCredits = currentCredits + WELCOME_CREDITS;

    await serviceSupabase
      .from('profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('id', userId);

    await serviceSupabase
      .from('credit_transactions')
      .update({ balance_after: newCredits })
      .eq('id', insertedTx.id);

    log({
      component: 'WelcomeCredits',
      step: 'Welcome Credits Granted',
      level: 'INFO',
      explanation: `Granted ${WELCOME_CREDITS} dynamic welcome credits to user ${userId}.`,
      data: { userId, WELCOME_CREDITS, newCredits },
    });

    return { granted: true, creditsGranted: WELCOME_CREDITS, reason: 'success' };
  } catch (err) {
    console.error('[WelcomeCredits] Error granting credits:', err);
    return { granted: false, creditsGranted: 0, reason: 'internal_error' };
  }
}
