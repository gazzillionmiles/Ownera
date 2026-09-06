export interface CampaignPricingTier {
  min_quantity: number;
  max_quantity?: number | null;
  price_per_unit: number;
  tier_order?: number;
}

/**
 * Calculates current active price per unit given participant count and pricing tiers.
 * Returns current unit price, next tier threshold if available, and potential savings.
 */
export function calculateTierPrice(
  participantCount: number,
  pricingTiers: CampaignPricingTier[],
  defaultPrice: number = 699
) {
  if (!pricingTiers || pricingTiers.length === 0) {
    return {
      currentPrice: defaultPrice,
      basePrice: defaultPrice,
      maxSavings: 0,
      currentSavings: 0,
      nextTier: null,
      isThresholdReached: false,
    };
  }

  // Sort tiers by min_quantity ascending
  const sortedTiers = [...pricingTiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const basePrice = sortedTiers[0].price_per_unit;
  const lowestPrice = Math.min(...sortedTiers.map((t) => t.price_per_unit));
  const maxSavings = Math.max(0, basePrice - lowestPrice);

  let currentPrice = basePrice;
  let nextTier: { neededCount: number; price: number; savings: number } | null = null;
  let isThresholdReached = false;

  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    if (participantCount >= tier.min_quantity) {
      currentPrice = tier.price_per_unit;
      if (i > 0) {
        isThresholdReached = true;
      }
    } else if (!nextTier && participantCount < tier.min_quantity) {
      nextTier = {
        neededCount: tier.min_quantity - participantCount,
        price: tier.price_per_unit,
        savings: basePrice - tier.price_per_unit,
      };
    }
  }

  const currentSavings = Math.max(0, basePrice - currentPrice);

  return {
    currentPrice,
    basePrice,
    maxSavings,
    currentSavings,
    nextTier,
    isThresholdReached,
  };
}
