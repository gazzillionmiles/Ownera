'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { HomeView } from '@/src/shared/components/HomeView';
import { UserRole, Society } from '@/src/types/ownera';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { fetchUserSocieties } from '@/src/shared/lib/api';
import { BrandLoadingScreen } from '@/src/shared/components/ui/loading';

export default function SocietyCampaignsPage({
  params,
}: {
  params: Promise<{ society_slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { uiUser, refreshProfile } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>('resident');
  const [society, setSociety] = useState<Society | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    async function loadSociety() {
      try {
        setLoading(true);
        const data = await fetchUserSocieties();
        const userSocieties: Society[] = data.societies || [];

        const targetSoc = userSocieties.find(
          (s) => s.slug.toLowerCase() === resolvedParams.society_slug.toLowerCase()
        );

        if (targetSoc) {
          setSociety(targetSoc);
          const roleInThisSociety = targetSoc.user_role || 'resident';
          if (roleInThisSociety === 'secretary' || roleInThisSociety === 'organizer' || roleInThisSociety === 'committee') {
            setActiveRole('organizer');
          } else {
            setActiveRole('resident');
          }
          if (!uiUser.primarySocietyId) {
            refreshProfile().catch(() => {});
          }
        } else {
          setError(`You are not a registered active member of "${resolvedParams.society_slug}".`);
        }
      } catch (err: any) {
        if (err?.status === 401) {
          router.push(`/login?next=/s/${resolvedParams.society_slug}/campaigns`);
          return;
        }
        setError(err.message || 'Failed to verify society membership');
      } finally {
        setLoading(false);
      }
    }

    if (uiUser.isLoggedIn) {
      loadSociety();
    }
  }, [resolvedParams.society_slug, uiUser.isLoggedIn, router, refreshProfile]);

  if (loading) {
    return (
      <ProtectedRoute>
        <BrandLoadingScreen message="Loading society campaigns..." />
      </ProtectedRoute>
    );
  }

  if (error || !society) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
          <h1 className="text-xl font-bold mb-2">Access Restricted</h1>
          <p className="text-xs text-slate-500 max-w-md mb-6">{error}</p>
          <Link href="/home" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition">
            Back to Home
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const handleTabChange = (tab: string) => {
    if (!society) return;
    if (tab === 'bookings') {
      router.push(`/s/${society.slug}/bookings`);
    } else if (tab === 'campaigns') {
      router.push(`/s/${society.slug}/campaigns`);
    } else if (tab === 'home' || tab === 'overview') {
      router.push(`/s/${society.slug}`);
    } else {
      router.push(`/s/${society.slug}?tab=${tab}`);
    }
  };

  return (
    <ProtectedRoute>
      <DesktopShell
        activeTab="campaigns"
        onTabChange={handleTabChange}
        activeRole={activeRole}
        activeSociety={society}
        onJoinSocietyClick={() => setIsJoinModalOpen(true)}
        user={uiUser}
      >
        <HomeView
          user={uiUser}
          activeRole={activeRole}
          activeTab="campaigns"
          activeSociety={society}
          onSocietyChange={(soc) => {
            setSociety(soc);
            router.push(`/s/${soc.slug}`);
          }}
          isJoinModalOpen={isJoinModalOpen}
          setIsJoinModalOpen={setIsJoinModalOpen}
          onTabChange={handleTabChange}
        />
      </DesktopShell>
    </ProtectedRoute>
  );
}
