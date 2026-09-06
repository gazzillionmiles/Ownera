/**
 * lib/retry.ts
 * Centralized retry-with-backoff utility for AI generation calls.
 */

import { log } from "@/lib/logger";

export class HighDemandError extends Error {
  code: string;
  constructor(message = "We're experiencing high demand right now, try again in a bit") {
    super(message);
    this.name = "HighDemandError";
    this.code = "high_demand";
  }
}

/**
 * Determines whether an error represents a transient failure eligible for retry.
 * Transient errors: 429, 502, 503, 504, timeouts, network fetch failures.
 * Non-transient errors: 400, 401, 403, 404 (our bugs / auth failures / bad requests).
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;

  const status = error?.status || error?.statusCode || error?.response?.status || error?.code;

  if (typeof status === "number") {
    if (status >= 400 && status < 500 && status !== 429) {
      return false; // Bad request, auth, forbidden, not found, etc.
    }
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }
  }

  const message = (typeof error === "string" ? error : error?.message || error?.toString() || "").toLowerCase();

  // Explicit non-transient 4xx checks if no transient status was present
  if (
    message.includes("400 bad request") ||
    message.includes("401 unauthorized") ||
    message.includes("403 forbidden") ||
    message.includes("404 not found") ||
    message.includes("invalid api key") ||
    message.includes("unauthorized")
  ) {
    return false;
  }

  // Transient keyword/pattern checks
  const isTransientKeyword =
    message.includes("429") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("resource_exhausted") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("deadline_exceeded") ||
    message.includes("high demand") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    error?.name === "TypeError";

  if (isTransientKeyword) {
    return true;
  }

  // If status code is 5xx or unclassified error object, default to retryable
  return true;
}

export interface RetryOptions {
  maxRetries?: number; // default 3 (4 total attempts)
  delaysMs?: number[]; // default [5000, 10000, 15000]
  onRetry?: (attempt: number, delayMs: number, error: any) => void;
}

/**
 * Executes an async function with retry-with-backoff on transient errors.
 * Sequence:
 * - Attempt 1: immediate
 * - Attempt 2: wait 5s, retry
 * - Attempt 3: wait 10s, retry
 * - Attempt 4: wait 15s, retry
 * If all attempts fail, throws HighDemandError.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const delays = options.delaysMs || [5000, 10000, 15000];
  const maxAttempts = delays.length + 1; // 4 attempts total

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (!isTransientError(error)) {
        // Non-transient failure: fail immediately without retrying
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = delays[attempt - 1];
        if (options.onRetry) {
          options.onRetry(attempt, delay, error);
        } else {
          log({
            component: "Retry",
            step: "Transient Failure",
            level: "WARN",
            explanation: `Attempt ${attempt}/${maxAttempts} failed with transient error. Retrying in ${delay}ms...`,
            data: { attempt, delay, error: error?.message || String(error) },
          });
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted on transient errors
  throw lastError instanceof HighDemandError ? lastError : new HighDemandError();
}
