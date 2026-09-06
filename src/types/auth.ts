/**
 * src/types/auth.ts
 * Generic SaaS user, authentication, profile, and subscription types.
 */

import type { UserRole, PropertyType } from './ownera';

export type AuthProviderType = 'google' | 'email' | 'apple' | 'guest';

export interface BaseUserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  provider: AuthProviderType;
  isLoggedIn: boolean;
  isPremium: boolean;
  credits: number;
  activeRole?: UserRole;
  phone?: string | null;
  propertyType?: PropertyType | string;
  unitNumber?: string | null;
  primarySocietyId?: string | null;
  deletionStatus?: 'active' | 'pending_deletion' | 'purged';
  scheduledPurgeAt?: string | null;
  restorationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSessionState {
  user: BaseUserProfile | null;
  loading: boolean;
  hasTermsConsent: boolean;
}
