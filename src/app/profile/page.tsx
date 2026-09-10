'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/src/shared/components/ui/theme-provider';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { User, LogOut, Mail, Shield, Calendar, Building2, Briefcase, Key, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Provider } from '@/src/types/ownera';
import { useUserSocieties } from '@/src/shared/hooks/useQueries';

export default function ProfilePage() {
  const router = useRouter();
  const { uiUser, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: societiesData } = useUserSocieties(uiUser.isLoggedIn);
  const societies = societiesData?.societies || [];
  const [provider, setProvider] = useState<Provider | null>(null);
  const [platformAdminInfo, setPlatformAdminInfo] = useState<{ is_admin: boolean; role: string } | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  useEffect(() => {
    if (uiUser.isLoggedIn) {
      // 1. Fetch provider profile
      fetch('/api/providers?self=true')
        .then((res) => res.json())
        .then((data) => {
          if (data.provider) setProvider(data.provider);
        })
        .catch(() => {});

      // 2. Fetch admin status
      fetch('/api/admin/bootstrap')
        .then((res) => res.json())
        .then((data) => {
          if (data) setPlatformAdminInfo(data);
        })
        .catch(() => {});
    }
  }, [uiUser.isLoggedIn]);

  const handleTabChange = (tab: string) => {
    router.push(`/${tab}`);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const handleBootstrapAdmin = async () => {
    setIsBootstrapping(true);
    try {
      const res = await fetch('/api/admin/bootstrap', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bootstrap failed');
      }
      toast.success(data.message || 'Platform admin verified!');
      setPlatformAdminInfo({ is_admin: true, role: data.admin?.role || 'platform_admin' });
    } catch (err: any) {
      toast.error(err.message || 'Unauthorized bootstrap attempt');
    } finally {
      setIsBootstrapping(false);
    }
  };

  return (
    <ProtectedRoute>
      <DesktopShell
        activeTab="settings"
        onTabChange={handleTabChange}
        activeSociety={societies[0] || null}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={uiUser}
      >
        <div className="space-y-6 pb-8 max-w-lg mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">User Profile</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Account identity, society memberships, and verified platform roles.
            </p>
          </div>

          {/* Profile Card */}
          <div className="rounded-3xl border border-white/10 bg-[#18191D] p-6 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-[#2CB7A5]/15 text-[#2CB7A5] flex items-center justify-center font-bold text-2xl border border-[#2CB7A5]/30">
                {uiUser.name ? uiUser.name.substring(0, 1).toUpperCase() : <User className="w-8 h-8" />}
              </div>
              <div>
                <div className="font-semibold text-lg text-white flex items-center space-x-2">
                  <span>{uiUser.name}</span>
                  {platformAdminInfo?.is_admin && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase font-mono">
                      {platformAdminInfo.role}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{uiUser.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-white/5 text-xs">
                <div className="flex items-center space-x-2.5 text-zinc-400">
                  <Mail className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Email Address</span>
                </div>
                <span className="font-medium text-white">{uiUser.email || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-white/5 text-xs">
                <div className="flex items-center space-x-2.5 text-zinc-400">
                  <Shield className="w-4 h-4 text-[#2CB7A5]" />
                  <span>Account Type</span>
                </div>
                <span className="font-medium text-white font-mono">
                  {platformAdminInfo?.is_admin ? platformAdminInfo.role : 'Standard User'}
                </span>
              </div>

              {uiUser.createdAt && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-zinc-400">
                    <Calendar className="w-4 h-4 text-[#2CB7A5]" />
                    <span>Member Since</span>
                  </div>
                  <span className="font-medium text-white">
                    {new Date(uiUser.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Society Memberships Card */}
          <div className="rounded-3xl border border-white/10 bg-[#18191D] p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2CB7A5]" />
              <span>Society Memberships</span>
            </h2>

            {societies.length === 0 ? (
              <p className="text-xs text-zinc-500">Not currently a member of any society.</p>
            ) : (
              <div className="space-y-2">
                {societies.map((soc) => (
                  <div
                    key={soc.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-white/5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{soc.name}</div>
                      <div className="text-[11px] text-zinc-400">Flat {soc.flat_number || 'N/A'} • {soc.city}</div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
                        soc.user_role === 'secretary'
                          ? 'bg-[#2CB7A5]/20 text-[#2CB7A5] border border-[#2CB7A5]/30'
                          : soc.user_role === 'committee'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {soc.user_role || 'resident'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provider Profile Card */}
          {provider && (
            <div className="rounded-3xl border border-white/10 bg-[#18191D] p-6 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#2CB7A5]" />
                <span>Verified Provider Identity</span>
              </h2>
              <div className="p-3 rounded-2xl bg-zinc-900/50 border border-white/5 text-xs space-y-1">
                <div className="font-bold text-white text-sm">{provider.company_name}</div>
                <div className="text-zinc-400">Contact: {provider.contact_person} • {provider.phone}</div>
                <div className="text-[11px] text-[#2CB7A5] font-semibold">
                  ★ {provider.rating} Rating • {provider.total_jobs_completed} jobs completed
                </div>
              </div>
            </div>
          )}

          {/* Admin Bootstrap / Verification Trigger */}
          <div className="space-y-3">
            <button
              onClick={handleBootstrapAdmin}
              disabled={isBootstrapping}
              className="w-full py-3 px-4 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-300 font-semibold text-xs flex items-center justify-center space-x-2 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50"
            >
              <Key className="w-4 h-4 text-[#2CB7A5]" />
              <span>{isBootstrapping ? 'Verifying...' : 'Verify / Bootstrap Platform Admin'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3.5 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-xs flex items-center justify-center space-x-2 hover:bg-red-500/20 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </DesktopShell>
    </ProtectedRoute>
  );
}
