'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { JoinSocietyModal } from '@/src/shared/components/JoinSocietyModal';
import { Building2, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { Society } from '@/src/types/ownera';
import { useUserSocieties } from '@/src/shared/hooks/useQueries';

export default function HomePage() {
  const router = useRouter();
  const { uiUser, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'join' | 'create'>('join');
  const hasResolvedRef = useRef(false);

  const { data: societiesData, isLoading: societiesLoading, error: societiesFetchError } = useUserSocieties(uiUser.isLoggedIn);

  useEffect(() => {
    async function resolveUserSocieties() {
      if (hasResolvedRef.current) return;

      if (uiUser.activeRole === 'provider') {
        hasResolvedRef.current = true;
        setLoading(true);
        const provRes = await fetch('/api/providers?self=true');
        const provData = await provRes.json().catch(() => ({}));
        if (provData?.provider) {
          router.replace('/partner');
        } else {
          router.replace('/partner/register');
        }
        return;
      }

      if (societiesFetchError) {
        hasResolvedRef.current = true;
        const err: any = societiesFetchError;
        if (err?.status === 401) {
          router.replace('/login');
          return;
        }
        setLoading(false);
        return;
      }

      if (societiesData) {
        hasResolvedRef.current = true;
        const userSocieties: Society[] = societiesData.societies || [];
        setSocieties(userSocieties);

        if (userSocieties.length > 0) {
          if (!uiUser.primarySocietyId) {
            await refreshProfile().catch(() => {});
          }
          const primary = userSocieties.find((s) => s.id === uiUser.primarySocietyId) || userSocieties[0];
          router.replace(`/s/${primary.slug}`);
        } else {
          router.replace('/onboarding');
        }
      } else if (societiesLoading) {
        setLoading(true);
      }
    }

    if (uiUser.isLoggedIn) {
      resolveUserSocieties();
    }
  }, [uiUser.isLoggedIn, uiUser.activeRole, uiUser.primarySocietyId, router, refreshProfile, societiesData, societiesLoading, societiesFetchError]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading your society hub...</p>
        </div>
      </ProtectedRoute>
    );
  }

  // If user has 0 societies, show clear Join/Create Society Welcome Screen
  return (
    <ProtectedRoute>
      <DesktopShell
        user={uiUser}
        onJoinSocietyClick={() => {
          setModalTab('join');
          setIsJoinModalOpen(true);
        }}
      >
        <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-md">
            <Building2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome to Ownera
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Create your residential community to manage campaigns as Secretary, or join an existing apartment complex with an invite code.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-md space-y-3">
            <button
              onClick={() => {
                setModalTab('create');
                setIsJoinModalOpen(true);
              }}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Society (As Secretary)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setModalTab('join');
                setIsJoinModalOpen(true);
              }}
              className="w-full py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Join Existing Society with Code</span>
            </button>
          </div>

          <JoinSocietyModal
            isOpen={isJoinModalOpen}
            initialTab={modalTab}
            onClose={() => setIsJoinModalOpen(false)}
            onSuccess={(society) => {
              router.push(`/s/${society.slug}`);
            }}
          />
        </div>
      </DesktopShell>
    </ProtectedRoute>
  );
}
