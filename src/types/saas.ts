/**
 * src/types/saas.ts
 * Generic SaaS UI, theme, navigation, and credit pack types.
 */

export type ThemeMode = 'dark' | 'light';
export type TabType = 'home' | 'history' | 'premium' | 'settings' | 'landing' | 'login';

export interface CreditPack {
  id: string;
  name?: string;
  price: number;
  credits: number;
  costPerCredit: number;
  isPopular?: boolean;
  badge?: string;
  originalPrice?: number;
  isDiscounted?: boolean;
  discountPercent?: number;
}

export interface GenericActivityItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'completed' | 'processing' | 'failed';
  creditsSpent: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
