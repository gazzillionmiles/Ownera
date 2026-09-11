'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { BaseUserProfile } from '@/src/types/auth';
import { UserRole } from '@/src/types/ownera';
import {
  getVisitorFingerprint,
  getAppClientId,
} from '@/lib/fingerprint/client';
import {
  identifyUser,
  resetUser,
  trackReferralSignupCompleted,
} from '@/src/shared/lib/analytics';
import { getSafePostAuthRedirect } from '@/lib/consent';
import type { InitialAuthData } from '@/lib/auth/initial-auth';

const APP_PREFIX = process.env.NEXT_PUBLIC_APP_COOKIE_PREFIX || 'ownera';
const REF_COOKIE_NAME = `${APP_PREFIX}_ref_code`;

export interface ProfileRecord {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  theme: string;
  is_premium: boolean;
  credits?: number;
  active_role?: UserRole;
  phone?: string | null;
  property_type?: string | null;
  unit_number?: string | null;
  primary_society_id?: string | null;
  deletion_status?: 'active' | 'pending_deletion' | 'purged';
  scheduled_purge_at?: string | null;
  restoration_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ProfileRecord | null;
  uiUser: BaseUserProfile;
  loading: boolean;
  hasTermsConsent: boolean;
  signInWithGoogle: (nextParam?: string) => Promise<{ error: Error | null }>;
  signInWithEmailOtp: (
    email: string,
    nextParam?: string
  ) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    nextParam?: string
  ) => Promise<{
    data: { user?: unknown; session?: unknown } | null;
    error: Error | null;
  }>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ data: unknown; error: Error | null }>;
  resetPasswordForEmail: (
    email: string
  ) => Promise<{ error: Error | null; message?: string }>;
  updatePassword: (
    newPassword: string
  ) => Promise<{ data: unknown; error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (
    updates: Partial<ProfileRecord>
  ) => Promise<{ error: Error | null }>;
  updateCredits: (newCredits: number) => void;
  setActiveRole: (role: UserRole) => Promise<{ error: Error | null }>;
  acceptTermsConsent: () => Promise<{ error: Error | null }>;
}

const defaultUiUser: BaseUserProfile = {
  id: '',
  isLoggedIn: false,
  name: 'Guest User',
  email: '',
  provider: 'guest',
  isPremium: false,
  credits: 0,
  activeRole: 'resident',
  phone: null,
  primarySocietyId: null,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  uiUser: defaultUiUser,
  loading: true,
  hasTermsConsent: true,
  signInWithGoogle: async () => ({ error: null }),
  signInWithEmailOtp: async () => ({ error: null }),
  signUpWithEmail: async () => ({ data: null, error: null }),
  signInWithPassword: async () => ({ data: null, error: null }),
  resetPasswordForEmail: async () => ({ error: null }),
  updatePassword: async () => ({ data: null, error: null }),
  signOut: async () => ({ error: null }),
  refreshProfile: async () => {},
  updateProfile: async () => ({ error: null }),
  updateCredits: () => {},
  setActiveRole: async () => ({ error: null }),
  acceptTermsConsent: async () => ({ error: null }),
});

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  initialAuth?: InitialAuthData;
}> = ({ children, initialAuth }) => {
  const [supabase] = useState(() => createClient());
  // Seed from the server-resolved auth state (see lib/auth/initial-auth.ts)
  // when available, instead of always starting from null/loading. `user`
  // here is a minimal stand-in (id/email only, no user_metadata/
  // app_metadata) — it's replaced with the real Supabase User object once
  // the background getSession() call below resolves, but it's enough for
  // uiUser/isLoggedIn checks to be correct on first paint.
  const [user, setUser] = useState<User | null>(
    initialAuth?.userId
      ? ({
          id: initialAuth.userId,
          email: initialAuth.userEmail ?? undefined,
        } as User)
      : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(
    (initialAuth?.profile as ProfileRecord | null) ?? null
  );
  const [hasTermsConsent, setHasTermsConsent] = useState<boolean>(true);
  // If the server already resolved auth state (initialAuth is defined,
  // whether logged in or not), we don't need to block rendering on the
  // client-side fetch chain below — it still runs, but purely in the
  // background to reconcile the full session object.
  const [loading, setLoading] = useState(initialAuth === undefined);

  const checkTermsConsent = useCallback(
    async (userId: string) => {
      try {
        const currentTermsVersion =
          process.env.TERMS_CONSENT_VERSION || '2026-v1';
        const { data, error } = await supabase
          .from('consent_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'terms_accepted')
          .eq('consent_version', currentTermsVersion)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setHasTermsConsent(true);
        } else {
          setHasTermsConsent(false);
        }
      } catch {
        setHasTermsConsent(false);
      }
    },
    [supabase]
  );

  const fetchOrCreateProfile = useCallback(
    async (currentUser: User): Promise<ProfileRecord | null> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (data && !error) {
          return data as ProfileRecord;
        }

        for (let i = 0; i < 3; i++) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const { data: retryData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (retryData) {
            return retryData as ProfileRecord;
          }
        }

        return null;
      } catch (err) {
        console.error('Error fetching profile:', err);
        return null;
      }
    },
    [supabase]
  );

  const syncFingerprint = useCallback(async () => {
    try {
      const clientId = getAppClientId();
      const fp = await getVisitorFingerprint();
      if (fp) {
        const res = await fetch('/api/auth/fingerprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint: fp, client_id: clientId }),
        });
        const data = await res.json().catch(() => null);
        if (data && typeof data.credits === 'number') {
          setProfile((prev) =>
            prev ? { ...prev, credits: data.credits } : null
          );
        } else if (data?.welcomeCredits?.granted) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  credits:
                    (prev.credits ?? 0) +
                    (data.welcomeCredits.creditsGranted || 5),
                }
              : null
          );
        }
      }
    } catch (err) {
      console.error('Error syncing fingerprint:', err);
    }
  }, []);

  const checkAndAssociateReferral = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;

      let refCode = window.localStorage.getItem(REF_COOKIE_NAME)?.trim();
      if (!refCode) {
        const match = document.cookie.match(
          new RegExp(`(?:^|; )${REF_COOKIE_NAME}=([^;]*)`)
        );
        if (match) refCode = decodeURIComponent(match[1])?.trim();
      }

      if (!refCode) return;

      const clientId = getAppClientId();
      const fp = await getVisitorFingerprint();

      const res = await fetch('/api/referral/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: refCode,
          device_fingerprint: fp,
          client_id: clientId,
        }),
      });

      if (res.ok) {
        trackReferralSignupCompleted(refCode);
        window.localStorage.removeItem(REF_COOKIE_NAME);
        document.cookie = `${REF_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    } catch (err) {
      console.error('Error linking referral code:', err);
    }
  }, []);

  const updateCredits = useCallback((newCredits: number) => {
    setProfile((prev) => (prev ? { ...prev, credits: newCredits } : null));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchOrCreateProfile(user);
    if (p) {
      setProfile(p);
      syncFingerprint();
    }
  }, [user, fetchOrCreateProfile, syncFingerprint]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      setSession(initSession);
      const currentUser = initSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        identifyUser(currentUser.id);
        fetchOrCreateProfile(currentUser).then((p) => {
          setProfile(p);
          setLoading(false);
          syncFingerprint();
          checkAndAssociateReferral();
          checkTermsConsent(currentUser.id);
        });
      } else {
        setLoading(false);
        setHasTermsConsent(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        identifyUser(currentUser.id);
        const p = await fetchOrCreateProfile(currentUser);
        setProfile(p);
        syncFingerprint();
        checkAndAssociateReferral();
        checkTermsConsent(currentUser.id);
      } else {
        resetUser();
        setProfile(null);
        setHasTermsConsent(true);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [
    supabase,
    fetchOrCreateProfile,
    syncFingerprint,
    checkAndAssociateReferral,
    checkTermsConsent,
  ]);

  // Realtime listener for profile & credit updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile_realtime_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            setProfile((prev) =>
              prev
                ? { ...prev, ...payload.new }
                : (payload.new as ProfileRecord)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const signInWithGoogle = useCallback(
    async (nextParam?: string) => {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const safeNext = getSafePostAuthRedirect(nextParam || null);
      const redirectTo =
        safeNext && safeNext !== '/home'
          ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
          : `${origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      return { error };
    },
    [supabase]
  );

  const signInWithEmailOtp = useCallback(
    async (email: string, nextParam?: string) => {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const safeNext = getSafePostAuthRedirect(nextParam || null);
      const emailRedirectTo =
        safeNext && safeNext !== '/home'
          ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
          : `${origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
        },
      });

      return { error };
    },
    [supabase]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, nextParam?: string) => {
      const clientId = getAppClientId();
      const fp = await getVisitorFingerprint();
      const safeNext = getSafePostAuthRedirect(nextParam || null);

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fingerprint: fp,
          client_id: clientId,
          next: safeNext,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          data: null,
          error: new Error(json?.error || 'Signup failed'),
        };
      }

      if (json?.data?.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: json.data.session.access_token,
          refresh_token: json.data.session.refresh_token,
        });

        if (sessionError) {
          return { data: null, error: sessionError };
        }

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          const p = await fetchOrCreateProfile(currentUser);
          if (p) {
            setProfile(p);
          }
        }
      }

      return { data: json?.data ?? null, error: null };
    },
    [supabase, fetchOrCreateProfile]
  );

  const acceptTermsConsent = useCallback(async () => {
    try {
      const res = await fetch('/api/consent/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        return {
          error: new Error(json?.error || 'Failed to record terms consent'),
        };
      }

      setHasTermsConsent(true);
      return { error: null };
    } catch (err: unknown) {
      return {
        error:
          err instanceof Error
            ? err
            : new Error('Failed to record terms consent'),
      };
    }
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { data: null, error: new Error('Invalid email or password') };
      }

      return { data, error: null };
    },
    [supabase]
  );

  const resetPasswordForEmail = useCallback(
    async (email: string) => {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${origin}/auth/callback?next=/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many requests')) {
          return {
            error: new Error(
              'Too many requests. Please try again in a few minutes.'
            ),
          };
        }
      }

      return {
        error: null,
        message:
          'If an account exists for this email, a reset link has been sent',
      };
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    resetUser();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    return { error };
  }, [supabase]);

  const updateProfile = useCallback(
    async (updates: Partial<ProfileRecord>) => {
      if (!user) return { error: new Error('User not authenticated') };

      try {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const json = await res.json();
        if (!res.ok || json.error) {
          return { error: new Error(json.error || 'Failed to update profile') };
        }

        if (json.profile) {
          setProfile(json.profile as ProfileRecord);
        }

        return { error: null };
      } catch (error: unknown) {
        return {
          error:
            error instanceof Error
              ? error
              : new Error('Failed to update profile'),
        };
      }
    },
    [user]
  );

  const setActiveRole = useCallback(
    async (role: UserRole) => {
      setProfile((prev) => (prev ? { ...prev, active_role: role } : null));
      return await updateProfile({ active_role: role });
    },
    [updateProfile]
  );

  const uiUser: BaseUserProfile = React.useMemo(() => {
    const rawProvider = user?.app_metadata?.provider;
    const resolvedProvider: BaseUserProfile['provider'] =
      rawProvider === 'apple' ||
      rawProvider === 'google' ||
      rawProvider === 'email'
        ? rawProvider
        : user
          ? 'email'
          : 'guest';

    return {
      id: user?.id || '',
      isLoggedIn: !!user,
      name:
        profile?.name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'User',
      email: profile?.email || user?.email || '',
      avatarUrl: profile?.avatar_url || user?.user_metadata?.avatar_url || null,
      provider: resolvedProvider,
      isPremium: profile?.is_premium || false,
      credits: profile?.credits ?? 0,
      activeRole: profile?.active_role || 'resident',
      phone: profile?.phone || null,
      propertyType: profile?.property_type || 'apartment',
      unitNumber: profile?.unit_number || null,
      primarySocietyId: profile?.primary_society_id || null,
      deletionStatus: profile?.deletion_status || 'active',
      scheduledPurgeAt: profile?.scheduled_purge_at || null,
      restorationCount: profile?.restoration_count ?? 0,
      createdAt: profile?.created_at,
      updatedAt: profile?.updated_at,
    };
  }, [user, profile]);

  const value = React.useMemo(
    () => ({
      user,
      session,
      profile,
      uiUser,
      loading,
      hasTermsConsent,
      signInWithGoogle,
      signInWithEmailOtp,
      signUpWithEmail,
      signInWithPassword,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      refreshProfile,
      updateProfile,
      updateCredits,
      setActiveRole,
      acceptTermsConsent,
    }),
    [
      user,
      session,
      profile,
      uiUser,
      loading,
      hasTermsConsent,
      signInWithGoogle,
      signInWithEmailOtp,
      signUpWithEmail,
      signInWithPassword,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      refreshProfile,
      updateProfile,
      updateCredits,
      setActiveRole,
      acceptTermsConsent,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);
