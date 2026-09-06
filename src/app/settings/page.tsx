'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { SettingsView } from '@/src/shared/components/SettingsView';
import { DeleteAccountModal } from '@/src/shared/components/DeleteAccountModal';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { uiUser, signOut, updateProfile } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'settings') return;
    router.push(`/${tab}`);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  return (
    <ProtectedRoute>
      <DesktopShell
        activeTab="settings"
        onTabChange={handleTabChange}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={uiUser}
      >
        <SettingsView
          theme={theme}
          onToggleTheme={handleToggleTheme}
          user={uiUser}
          onLogout={handleLogout}
          onRequestDeleteAccount={() => setIsDeleteModalOpen(true)}
          onUpdateUser={(updates) => {
            updateProfile(updates);
          }}
        />

        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
        />
      </DesktopShell>
    </ProtectedRoute>
  );
}
