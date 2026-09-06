/**
 * lib/credits/execute-action.ts
 * Provider-agnostic, credit-gated operation execution wrapper.
 * 
 * Pattern:
 * 1. Atomically checks & reserves credits before running any expensive external task (LLM, scraping, background job).
 * 2. Executes the user-supplied operation wrapped in retryWithBackoff.
 * 3. Automatically triggers refund_credits RPC if the operation fails or encounters an unrecoverable error.
 */

import { createAdminClient } from '@/lib/supabase/service';
import { retryWithBackoff } from '@/lib/retry';
import { generateRequestId, log, logError } from '@/lib/logger';

export interface ExecuteCreditActionOptions<T> {
  userId: string;
  creditCost: number;
  reason: string;
  actionName: string;
  operation: (referenceId: string) => Promise<T>;
  referenceIdPrefix?: string;
  requestId?: string;
}

export interface CreditActionResult<T> {
  success: boolean;
  data?: T;
  newBalance?: number;
  error?: string;
  statusCode?: number;
}

export async function executeCreditGatedAction<T>({
  userId,
  creditCost,
  reason,
  actionName,
  operation,
  referenceIdPrefix = 'act',
  requestId,
}: ExecuteCreditActionOptions<T>): Promise<CreditActionResult<T>> {
  const rid = requestId || generateRequestId();
  const referenceId = `${referenceIdPrefix}_${generateRequestId()}`;
  const serviceSupabase = createAdminClient();

  // 1. Check & reserve credits atomically via PostgreSQL RPC
  log({
    component: 'Credits',
    step: 'Consume Credits Attempt',
    explanation: `Attempting to deduct ${creditCost} credits for action "${actionName}".`,
    data: { userId, creditCost, reason, referenceId },
    requestId: rid,
  });

  const { data: creditResult, error: creditError } = await serviceSupabase.rpc('consume_credits', {
    p_amount: creditCost,
    p_reason: reason,
    p_reference_id: referenceId,
    p_user_id: userId,
  });

  if (creditError || !creditResult || creditResult.status !== 'success') {
    const isInsufficient = creditResult?.status === 'insufficient_credits';
    log({
      component: 'Credits',
      step: 'Credit Deduction Failed',
      level: 'WARN',
      explanation: isInsufficient ? 'User has insufficient credits.' : 'Database RPC failed to consume credits.',
      data: { creditResult, creditError: creditError?.message },
      requestId: rid,
    });

    return {
      success: false,
      statusCode: isInsufficient ? 402 : 400,
      error: isInsufficient ? 'Insufficient credits' : 'Credit deduction failed',
    };
  }

  // 2. Execute the provider-agnostic operation
  try {
    const data = await retryWithBackoff(() => operation(referenceId));

    log({
      component: 'Credits',
      step: 'Action Completed Successfully',
      explanation: `Action "${actionName}" succeeded. Balance is ${creditResult.new_balance}.`,
      data: { userId, referenceId, newBalance: creditResult.new_balance },
      requestId: rid,
    });

    return {
      success: true,
      data,
      newBalance: creditResult.new_balance,
    };
  } catch (opErr: unknown) {
    const message = opErr instanceof Error ? opErr.message : String(opErr);
    logError('Credits', 'executeActionFailure', opErr, { userId, referenceId, actionName }, 'Triggering automatic credit refund', rid);

    // 3. Atomically refund credits on failure
    try {
      await serviceSupabase.rpc('refund_credits', {
        p_amount: creditCost,
        p_reason: `${reason}_failed_refund`,
        p_reference_id: `${referenceId}_refund`,
        p_original_reference_id: referenceId,
        p_user_id: userId,
      });

      log({
        component: 'Credits',
        step: 'Credits Refunded',
        level: 'INFO',
        explanation: `Refunded ${creditCost} credits to user ${userId} due to operation failure.`,
        data: { userId, referenceId },
        requestId: rid,
      });
    } catch (refundErr) {
      logError('Credits', 'refundCreditsRpcError', refundErr, { userId, referenceId }, 'Critical: Failed to process refund RPC', rid);
    }

    return {
      success: false,
      statusCode: 502,
      error: message || 'Operation failed. Your credits were refunded.',
    };
  }
}
