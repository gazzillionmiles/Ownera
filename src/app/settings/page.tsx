'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/src/shared/components/ui/theme-provider';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { SettingsView } from '@/src/shared/components/SettingsView';
import { DeleteAccountModal } from '@/src/shared/components/DeleteAccountModal';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { uiUser, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
        onToggleTheme={toggleTheme}
        user={uiUser}
      >
        <SettingsView
          theme={theme}
          onToggleTheme={toggleTheme}
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
