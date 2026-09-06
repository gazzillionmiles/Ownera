'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { HomeView } from '@/src/shared/components/HomeView';
import { UserRole, Society } from '@/src/types/ownera';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { JoinSocietyModal } from '@/src/shared/components/JoinSocietyModal';

export default function SocietyDashboardPage({
  params,
}: {
  params: Promise<{ society_slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { uiUser } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>('resident');
  const [activeTab, setActiveTab] = useState<string>('campaigns');
  const [society, setSociety] = useState<Society | null>(null);
  const [societyRole, setSocietyRole] = useState<string>('resident');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const [isJoiningSecretary, setIsJoiningSecretary] = useState(false);

  useEffect(() => {
    async function loadSociety() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/societies');
        if (res.status === 401) {
          router.push(`/login?next=/s/${resolvedParams.society_slug}`);
          return;
        }
        if (!res.ok) {
          throw new Error('Unable to fetch your society memberships. Please sign in or join.');
        }
        const data = await res.json();
        const userSocieties: Society[] = data.societies || [];

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
            setActiveTab('overview');
          } else {
            setActiveRole('resident');
            setActiveTab('campaigns');
          }
        } else {
          setError(
            `You are not yet a member of "${resolvedParams.society_slug}". Join below as Resident or Secretary.`
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to verify society membership');
      } finally {
        setLoading(false);
      }
    }

    if (uiUser.isLoggedIn) {
      loadSociety();
    }
  }, [resolvedParams.society_slug, uiUser.isLoggedIn, router]);

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
        />
      </DesktopShell>
    </ProtectedRoute>
  );
}
