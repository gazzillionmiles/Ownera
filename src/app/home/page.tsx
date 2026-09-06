'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { JoinSocietyModal } from '@/src/shared/components/JoinSocietyModal';
import { Building2, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { Society } from '@/src/types/ownera';

export default function HomePage() {
  const router = useRouter();
  const { uiUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const [modalTab, setModalTab] = useState<'join' | 'create'>('join');

  useEffect(() => {
    async function resolveUserSocieties() {
      try {
        setLoading(true);
        const res = await fetch('/api/societies');
        if (!res.ok) throw new Error('Failed to fetch societies');
        const data = await res.json();
        const userSocieties: Society[] = data.societies || [];
        setSocieties(userSocieties);

        if (userSocieties.length > 0) {
          // If user has a preferred primary society matching their memberships, pick that; else pick first
          const primary = userSocieties.find((s) => s.id === uiUser.primarySocietyId) || userSocieties[0];
          router.replace(`/s/${primary.slug}`);
        } else {
          router.replace('/onboarding');
        }
      } catch (err) {
        console.error('[HomePage] Error loading user societies:', err);
      } finally {
        setLoading(false);
      }
    }

    if (uiUser.isLoggedIn) {
      resolveUserSocieties();
    }
  }, [uiUser.isLoggedIn, uiUser.primarySocietyId, router]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#121316] flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-[#2CB7A5] animate-spin mb-2" />
          <p className="text-xs text-zinc-400">Loading your society hub...</p>
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
          <div className="w-16 h-16 rounded-3xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5] mx-auto shadow-xl">
            <Building2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome to Ownera
            </h1>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Create your residential community to manage campaigns as Secretary, or join an existing apartment complex with an invite code.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl space-y-3">
            <button
              onClick={() => {
                setModalTab('create');
                setIsJoinModalOpen(true);
              }}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg"
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
              className="w-full py-3 rounded-2xl bg-zinc-900 border border-white/10 text-white font-semibold text-xs hover:bg-zinc-800 transition flex items-center justify-center gap-2"
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
