/**
 * src/config/credits.ts
 * Example credit cost definitions for billable actions in your SaaS product.
 * 
 * Customize the keys and credit costs below based on your product's unit economics.
 */

export const CREDIT_COSTS = {
  /** Example standard action (e.g. document analysis, report generation) */
  STANDARD_ACTION: 1,
  /** Example advanced/heavy action (e.g. deep research, batch execution) */
  ADVANCED_ACTION: 3,
  /** Example quick refresh/re-run action */
  QUICK_REFRESH: 0.5,
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

export function getCreditCost(key: CreditCostKey): number {
  return CREDIT_COSTS[key] ?? 1;
}
