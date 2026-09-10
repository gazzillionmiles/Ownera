import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ServiceCampaign, ServiceCatalogItem, Booking } from '@/src/types/ownera';
import { fetchUserSocieties, SocietiesData } from '@/src/shared/lib/api';

export const QUERY_KEYS = {
  userSocieties: ['user-societies'] as const,
  services: ['services'] as const,
  polls: (societyId?: string, role?: string) => ['polls', societyId || 'all', role || 'resident'] as const,
  bookings: (societyId?: string, role?: string) => ['bookings', societyId || 'all', role || 'resident'] as const,
  adminBootstrap: ['admin-bootstrap'] as const,
  notifications: ['notifications'] as const,
};

/**
 * 1. Single shared query hook for user societies.
 * Used across Header, HomePage, SocietyDashboardPage, ProfilePage, and OnboardingPage.
 * Stale time: 60 seconds (shared cache across all navigation).
 */
export function useUserSocieties(enabled = true) {
  return useQuery<SocietiesData>({
    queryKey: QUERY_KEYS.userSocieties,
    queryFn: () => fetchUserSocieties(false),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * 2. Shared query hook for services catalog.
 * Stale time: 5 minutes (standardized catalog changes rarely).
 */
export function useServices(enabled = true) {
  return useQuery<ServiceCatalogItem[]>({
    queryKey: QUERY_KEYS.services,
    queryFn: async () => {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to load services');
      const data = await res.json();
      return (data.services || []) as ServiceCatalogItem[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}

export interface PollsResponse {
  polls: ServiceCampaign[];
  active_polls: ServiceCampaign[];
  my_polls: ServiceCampaign[];
  society_polls: ServiceCampaign[];
  upcoming_services: ServiceCampaign[];
  previous_campaigns: ServiceCampaign[];
}

/**
 * 3. Shared query hook for polls / campaigns scoped to society and role.
 * Stale time: 45 seconds.
 */
export function usePolls(societyId?: string, role = 'resident', enabled = true) {
  return useQuery<PollsResponse>({
    queryKey: QUERY_KEYS.polls(societyId, role),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (societyId) params.set('societyId', societyId);
      if (role === 'provider') params.set('role', 'provider');
      const res = await fetch(`/api/polls?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load polls');
      const data = await res.json();
      return {
        polls: data.polls || [],
        active_polls: data.active_polls || [],
        my_polls: data.my_polls || [],
        society_polls: data.society_polls || [],
        upcoming_services: data.upcoming_services || [],
        previous_campaigns: data.previous_campaigns || [],
      };
    },
    staleTime: 45 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: enabled && (role === 'provider' || Boolean(societyId)),
  });
}

/**
 * 4. Shared query hook for bookings scoped to role and society.
 * Stale time: 30 seconds.
 */
export function useBookings(role = 'resident', societyId?: string, enabled = true) {
  return useQuery<Booking[]>({
    queryKey: QUERY_KEYS.bookings(societyId, role),
    queryFn: async () => {
      const params = new URLSearchParams({ role });
      if (societyId) params.set('societyId', societyId);
      const res = await fetch(`/api/bookings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load bookings');
      const data = await res.json();
      return (data.bookings || []) as Booking[];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: enabled && (role === 'provider' || Boolean(societyId)),
  });
}

/**
 * Cache invalidation helper
 */
export function useInvalidateAppData() {
  const queryClient = useQueryClient();
  return {
    invalidateSocieties: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userSocieties }),
    invalidatePolls: (societyId?: string) =>
      queryClient.invalidateQueries({ queryKey: ['polls', societyId || 'all'] }),
    invalidateBookings: (societyId?: string) =>
      queryClient.invalidateQueries({ queryKey: ['bookings', societyId || 'all'] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
