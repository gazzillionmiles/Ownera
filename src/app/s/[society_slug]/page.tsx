'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { HomeView } from '@/src/shared/components/HomeView';
import { UserRole, Society } from '@/src/types/ownera';
import { Loader2, AlertTriangle } from 'lucide-react';
import { JoinSocietyModal } from '@/src/shared/components/JoinSocietyModal';
import { useUserSocieties } from '@/src/shared/hooks/useQueries';

function SocietyDashboardPage({
  params,
}: {
  params: Promise<{ society_slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { uiUser, refreshProfile } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>('resident');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'home');
  const [society, setSociety] = useState<Society | null>(null);
  const [societyRole, setSocietyRole] = useState<string>('resident');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Sync tab from query parameter without re-fetching society data
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const { data: societiesData, isLoading: societiesLoading, error: societiesFetchError } = useUserSocieties(uiUser.isLoggedIn);

  useEffect(() => {
    if (societiesFetchError) {
      const err: any = societiesFetchError;
      if (err?.status === 401) {
        router.push(`/login?next=/s/${resolvedParams.society_slug}`);
        return;
      }
      setError(err?.message || 'Failed to verify society membership');
      setLoading(false);
      return;
    }

    if (societiesData) {
      const userSocieties = societiesData.societies || [];
      const targetSoc = userSocieties.find(
        (s) => s.slug.toLowerCase() === resolvedParams.society_slug.toLowerCase()
      );

      if (targetSoc) {
        setSociety(targetSoc);
        const roleInThisSociety = targetSoc.user_role || 'resident';
        setSocietyRole(roleInThisSociety);

        // Context-aware role activation: automatically switch view according to role in this society
        if (roleInThisSociety === 'secretary' || roleInThisSociety === 'organizer' || roleInThisSociety === 'committee') {
          setActiveRole('organizer');
          if (!tabParam) setActiveTab('overview');
        } else {
          setActiveRole('resident');
          if (!tabParam) setActiveTab('home');
        }

        if (!uiUser.primarySocietyId) {
          refreshProfile().catch(() => {});
        }
        setError(null);
      } else {
        setError(
          `You are not yet a member of "${resolvedParams.society_slug}". Join below as Resident or Secretary.`
        );
      }
      setLoading(false);
    } else if (societiesLoading) {
      setLoading(true);
    }
  }, [societiesData, societiesLoading, societiesFetchError, resolvedParams.society_slug, router, tabParam, uiUser.primarySocietyId, refreshProfile]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading society dashboard...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !society) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
          <h1 className="text-xl font-bold mb-2">Access Restricted</h1>
          <p className="text-xs text-slate-500 max-w-md mb-6">{error || 'Society not found'}</p>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition cursor-pointer"
          >
            Join Society
          </button>
          <JoinSocietyModal
            isOpen={isJoinModalOpen}
            onClose={() => setIsJoinModalOpen(false)}
            onSuccess={(soc) => {
              setSociety(soc);
              setError(null);
            }}
          />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DesktopShell
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        activeRole={activeRole}
        activeSociety={society}
        onJoinSocietyClick={() => setIsJoinModalOpen(true)}
        user={uiUser}
      >
        <HomeView
          user={uiUser}
          activeRole={activeRole}
          activeTab={activeTab}
          activeSociety={society}
          onSocietyChange={(soc) => {
            setSociety(soc);
            router.push(`/s/${soc.slug}`);
          }}
          isJoinModalOpen={isJoinModalOpen}
          setIsJoinModalOpen={setIsJoinModalOpen}
          onTabChange={(tab) => setActiveTab(tab)}
        />
      </DesktopShell>
    </ProtectedRoute>
  );
}

export default function SocietyDashboardPageWrapper(props: {
  params: Promise<{ society_slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading society dashboard...</p>
        </div>
      }
    >
      <SocietyDashboardPage {...props} />
    </Suspense>
  );
}
