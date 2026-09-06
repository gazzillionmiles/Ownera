import { Redis } from '@upstash/redis';
import { logError } from '@/lib/logger';
import { NextResponse, type NextRequest } from 'next/server';

let redisInstance: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisInstance) return redisInstance;
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redisInstance = Redis.fromEnv();
      return redisInstance;
    }
  } catch (err) {
    console.error('[RateLimit] Failed to initialize Redis client:', err);
  }
  return null;
}

export function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Generic fixed-window rate limiter with fail-open semantics.
 * If Redis is unavailable or fails, requests are allowed to proceed
 * to avoid taking down service for legitimate users.
 */
export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) {
    return { success: true, limit, remaining: limit, reset: 0 };
  }

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    const reset = ttl > 0 ? ttl : windowSeconds;
    const remaining = Math.max(0, limit - current);

    return {
      success: current <= limit,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    logError('RateLimit', 'checkRateLimit', error, { key, limit, windowSeconds }, 'Failing open');
    return { success: true, limit, remaining: limit, reset: 0 };
  }
}

/**
 * Creates a standard 429 response.
 */
export function createRateLimitResponse(
  message = 'Too many requests. Please try again later.',
  status = 429
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// ----------------------------------------------------------------------
// Specific Domain Rate Limit Checkers (Configurable via Environment)
// ----------------------------------------------------------------------

/**
 * Signup rate limit: default 5 attempts per 10 minutes per IP.
 */
export async function checkSignupRateLimit(ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_SIGNUP_PER_10MIN) || 5;
  return checkRateLimit({
    key: `ratelimit:signup:ip:${ip}`,
    limit,
    windowSeconds: 600,
  });
}

/**
 * Auth callback rate limit: default 10 attempts per 10 minutes per IP.
 */
export async function checkAuthCallbackRateLimit(ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_AUTH_CALLBACK_PER_10MIN) || 10;
  return checkRateLimit({
    key: `ratelimit:auth_callback:ip:${ip}`,
    limit,
    windowSeconds: 600,
  });
}

/**
 * Promo / Referral claim rate limit.
 */
export async function checkPromoClaimRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const userLimit = Number(process.env.RATE_LIMIT_CLAIM_PER_10MIN) || 5;
  const userRes = await checkRateLimit({
    key: `ratelimit:promo_claim:user:${userId}`,
    limit: userLimit,
    windowSeconds: 600,
  });
  if (!userRes.success) return userRes;

  return checkRateLimit({
    key: `ratelimit:promo_claim:ip:${ip}`,
    limit: userLimit * 2,
    windowSeconds: 600,
  });
}

/**
 * Referral association rate limit.
 */
export async function checkReferralAssociateRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_REFERRAL_ASSOC_PER_10MIN) || 5;
  const userRes = await checkRateLimit({
    key: `ratelimit:referral_assoc:user:${userId}`,
    limit,
    windowSeconds: 600,
  });
  if (!userRes.success) return userRes;

  return checkRateLimit({
    key: `ratelimit:referral_assoc:ip:${ip}`,
    limit: limit * 2,
    windowSeconds: 600,
  });
}

/**
 * Operation burst ceiling rate limit: protects external APIs and storage from DoS.
 */
export async function checkOperationBurstRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const userLimit = Number(process.env.RATE_LIMIT_BURST_PER_MIN) || 60;
  const userRes = await checkRateLimit({
    key: `ratelimit:op_burst:user:${userId}`,
    limit: userLimit,
    windowSeconds: 60,
  });
  if (!userRes.success) return userRes;

  return checkRateLimit({
    key: `ratelimit:op_burst:ip:${ip}`,
    limit: userLimit * 2,
    windowSeconds: 60,
  });
}

// Alias for backwards compatibility
export const checkGenerationBurstRateLimit = checkOperationBurstRateLimit;

/**
 * Payment order creation rate limit.
 */
export async function checkPaymentOrderRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_ORDER_PER_5MIN) || 10;
  const userRes = await checkRateLimit({
    key: `ratelimit:payment_order:user:${userId}`,
    limit,
    windowSeconds: 300,
  });
  if (!userRes.success) return userRes;

  return checkRateLimit({
    key: `ratelimit:payment_order:ip:${ip}`,
    limit: limit * 2,
    windowSeconds: 300,
  });
}

/**
 * History view & presigned URL rate limit.
 */
export async function checkHistoryRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_HISTORY_PER_MIN) || 60;
  const userRes = await checkRateLimit({
    key: `ratelimit:history:user:${userId}`,
    limit,
    windowSeconds: 60,
  });
  if (!userRes.success) return userRes;

  return checkRateLimit({
    key: `ratelimit:history:ip:${ip}`,
    limit: limit * 2,
    windowSeconds: 60,
  });
}

/**
 * Admin endpoints rate limit.
 */
export async function checkAdminRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_ADMIN_PER_MIN) || 60;
  return checkRateLimit({
    key: `ratelimit:admin:user:${userId}`,
    limit,
    windowSeconds: 60,
  });
}

/**
 * Issue report burst rate limit.
 */
export async function checkIssueBurstRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_ISSUE_PER_MIN) || 5;
  return checkRateLimit({
    key: `ratelimit:issue_burst:user:${userId}`,
    limit,
    windowSeconds: 60,
  });
}

/**
 * Unauthenticated trial rate limit.
 */
export async function checkTrialGenerationRateLimit(ip: string): Promise<RateLimitResult> {
  const limit = Number(process.env.RATE_LIMIT_TRIAL_PER_10MIN) || 5;
  return checkRateLimit({
    key: `ratelimit:trial_gen:ip:${ip}`,
    limit,
    windowSeconds: 600,
  });
}
