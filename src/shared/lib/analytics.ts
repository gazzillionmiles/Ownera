import posthog from 'posthog-js';

/**
 * Privacy-safe Analytics Tracking Layer for Ownera
 * Enforces strict metadata-only payloads without sensitive inputs.
 */

function canTrack(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
}

export function identifyUser(userId: string): void {
  if (!canTrack() || !userId) return;
  try {
    posthog.identify(userId);
  } catch (err) {
    console.error('[Analytics] identify error:', err);
  }
}

export function resetUser(): void {
  if (!canTrack()) return;
  try {
    posthog.reset();
  } catch (err) {
    console.error('[Analytics] reset error:', err);
  }
}

export function trackPageView(url?: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('$pageview', url ? { $current_url: url } : undefined);
  } catch (err) {
    console.error('[Analytics] pageview error:', err);
  }
}

export function trackSignupCompleted(
  method: 'email' | 'google' | 'otp' = 'email'
): void {
  if (!canTrack()) return;
  try {
    posthog.capture('signup_completed', {
      auth_method: method,
    });
  } catch (err) {
    console.error('[Analytics] signup_completed error:', err);
  }
}

// -------------------------------------------------------------
// OWNERA CORE MARKETPLACE EVENTS
// -------------------------------------------------------------

export function trackSocietyJoined(societyId: string, societyName: string, role: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('society_joined', {
      society_id: societyId,
      society_name: societyName,
      role,
    });
  } catch (err) {
    console.error('[Analytics] society_joined error:', err);
  }
}

export function trackCampaignViewed(campaignId: string, serviceName: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('campaign_viewed', {
      campaign_id: campaignId,
      service_name: serviceName,
    });
  } catch (err) {
    console.error('[Analytics] campaign_viewed error:', err);
  }
}

export function trackCampaignInterestAdded(campaignId: string, quantity: number): void {
  if (!canTrack()) return;
  try {
    posthog.capture('campaign_interest_added', {
      campaign_id: campaignId,
      quantity,
    });
  } catch (err) {
    console.error('[Analytics] campaign_interest_added error:', err);
  }
}

export function trackCampaignThresholdReached(campaignId: string, participantsCount: number, unlockedPrice: number): void {
  if (!canTrack()) return;
  try {
    posthog.capture('campaign_threshold_reached', {
      campaign_id: campaignId,
      participants_count: participantsCount,
      unlocked_price: unlockedPrice,
    });
  } catch (err) {
    console.error('[Analytics] campaign_threshold_reached error:', err);
  }
}

export function trackProviderBidSubmitted(campaignId: string, pricePerUnit: number, maxCapacity: number): void {
  if (!canTrack()) return;
  try {
    posthog.capture('provider_bid_submitted', {
      campaign_id: campaignId,
      price_per_unit: pricePerUnit,
      max_capacity: maxCapacity,
    });
  } catch (err) {
    console.error('[Analytics] provider_bid_submitted error:', err);
  }
}

export function trackProviderSelected(campaignId: string, providerId: string, winningPrice: number): void {
  if (!canTrack()) return;
  try {
    posthog.capture('provider_selected', {
      campaign_id: campaignId,
      provider_id: providerId,
      winning_price: winningPrice,
    });
  } catch (err) {
    console.error('[Analytics] provider_selected error:', err);
  }
}

export function trackBookingConfirmed(bookingId: string, campaignId: string, depositAmount: number): void {
  if (!canTrack()) return;
  try {
    posthog.capture('booking_confirmed', {
      booking_id: bookingId,
      campaign_id: campaignId,
      deposit_amount: depositAmount,
    });
  } catch (err) {
    console.error('[Analytics] booking_confirmed error:', err);
  }
}

export function trackPaymentCompleted(paymentId: string, amount: number, paymentType: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('payment_completed', {
      payment_id: paymentId,
      amount,
      payment_type: paymentType,
    });
  } catch (err) {
    console.error('[Analytics] payment_completed error:', err);
  }
}

export function trackServiceCompleted(bookingId: string, providerId: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('service_completed', {
      booking_id: bookingId,
      provider_id: providerId,
    });
  } catch (err) {
    console.error('[Analytics] service_completed error:', err);
  }
}

export function trackIssueReported(bookingId: string, category: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('issue_reported', {
      booking_id: bookingId,
      category,
    });
  } catch (err) {
    console.error('[Analytics] issue_reported error:', err);
  }
}

export function trackRatingSubmitted(bookingId: string, rating: number): void {
  if (!canTrack()) return;
  try {
    posthog.capture('rating_submitted', {
      booking_id: bookingId,
      rating,
    });
  } catch (err) {
    console.error('[Analytics] rating_submitted error:', err);
  }
}

export function trackReferralSignupCompleted(referralCode: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('referral_signup_completed', {
      referral_code: referralCode,
    });
  } catch (err) {
    console.error('[Analytics] referral_signup_completed error:', err);
  }
}

export function trackReferralLinkUsed(referralCode: string): void {
  if (!canTrack()) return;
  try {
    posthog.capture('referral_link_used', {
      referral_code: referralCode,
    });
  } catch (err) {
    console.error('[Analytics] referral_link_used error:', err);
  }
}

export function trackCreditPackPurchaseInitiated(params: {
  pack_id: string;
  amount: number;
  was_referred: boolean;
}): void {
  if (!canTrack()) return;
  try {
    posthog.capture('credit_pack_purchase_initiated', params);
  } catch (err) {
    console.error('[Analytics] credit_pack_purchase_initiated error:', err);
  }
}

export function trackCreditPackPurchaseCompleted(params: {
  pack_id: string;
  amount: number;
  was_referred: boolean;
}): void {
  if (!canTrack()) return;
  try {
    posthog.capture('credit_pack_purchase_completed', params);
  } catch (err) {
    console.error('[Analytics] credit_pack_purchase_completed error:', err);
  }
}
