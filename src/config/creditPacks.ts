/**
 * src/config/creditPacks.ts
 * EXAMPLE CREDIT PACK CONFIGURATION
 * 
 * This file serves as a reference implementation for defining billable credit packs.
 * Replace these placeholder tiers with your product's specific pricing model.
 */

import { CreditPack } from '@/src/types/saas';

export interface PackConfig {
  id: string;
  name: string;
  price: number;
  credits: number;
  isPopular?: boolean;
  badge?: string;
}

/**
 * Example credit packs: configure your pricing tiers here or load dynamically from a database / Stripe product catalog.
 */
export const CREDIT_PACKS: PackConfig[] = [
  {
    id: process.env.CREDIT_PACK_1_ID || 'tier_small',
    name: 'Small Pack',
    price: Number(process.env.CREDIT_PACK_1_PRICE) || 10,
    credits: Number(process.env.CREDIT_PACK_1_CREDITS) || 100,
  },
  {
    id: process.env.CREDIT_PACK_2_ID || 'tier_medium',
    name: 'Medium Pack',
    price: Number(process.env.CREDIT_PACK_2_PRICE) || 25,
    credits: Number(process.env.CREDIT_PACK_2_CREDITS) || 300,
    isPopular: true,
    badge: 'Popular',
  },
  {
    id: process.env.CREDIT_PACK_3_ID || 'tier_large',
    name: 'Large Pack',
    price: Number(process.env.CREDIT_PACK_3_PRICE) || 50,
    credits: Number(process.env.CREDIT_PACK_3_CREDITS) || 750,
  },
];

export function getPackById(packId: string): PackConfig | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}

export function getAllPacks(): CreditPack[] {
  return CREDIT_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    credits: p.credits,
    costPerCredit: p.credits > 0 ? parseFloat((p.price / p.credits).toFixed(4)) : 0,
    isPopular: p.isPopular ?? false,
    badge: p.badge,
  }));
}
