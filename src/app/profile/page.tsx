'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/src/shared/components/ui/theme-provider';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { JoinSocietyModal } from '@/src/shared/components/JoinSocietyModal';
import {
  User,
  LogOut,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Calendar,
  Building2,
  Briefcase,
  Key,
  Edit3,
  Check,
  X,
  ArrowRight,
  ExternalLink,
  Plus,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { Provider, PropertyType, UserRole } from '@/src/types/ownera';
import { useUserSocieties } from '@/src/shared/hooks/useQueries';

export default function ProfilePage() {
  const router = useRouter();
  const { uiUser, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: societiesData, refetch: refetchSocieties } = useUserSocieties(uiUser.isLoggedIn);
  const societies = societiesData?.societies || [];
  
  const [provider, setProvider] = useState<Provider | null>(null);
  const [platformAdminInfo, setPlatformAdminInfo] = useState<{ is_admin: boolean; role: string } | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    unitNumber: '',
    propertyType: 'apartment' as PropertyType,
  });

  // Sync user data to edit form
  useEffect(() => {
    if (uiUser.isLoggedIn) {
      refetchSocieties();
      setFormData({
        name: uiUser.name || '',
        phone: uiUser.phone || '',
        unitNumber: uiUser.unitNumber || '',
        propertyType: (uiUser.propertyType as PropertyType) || 'apartment',
      });

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
  }, [uiUser.isLoggedIn, uiUser.name, uiUser.phone, uiUser.unitNumber, uiUser.propertyType]);

  const handleTabChange = (tab: string) => {
    const primary = societies[0];
    if (primary) {
      router.push(`/s/${primary.slug}?tab=${tab}`);
    } else {
      router.push('/home');
    }
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        unit_number: formData.unitNumber.trim() || null,
        property_type: formData.propertyType,
      });

      if (error) {
        throw error;
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: uiUser.name || '',
      phone: uiUser.phone || '',
      unitNumber: uiUser.unitNumber || '',
      propertyType: (uiUser.propertyType as PropertyType) || 'apartment',
    });
    setIsEditing(false);
  };

  // Accurately compute user's effective role with full role prioritization
  const detectedRole: UserRole = React.useMemo(() => {
    if (platformAdminInfo?.is_admin) {
      return (platformAdminInfo.role as UserRole) || 'admin';
    }

    const memberships = societiesData?.memberships || [];

    // 1. Check if user is secretary in any society or membership
    const hasSecretary =
      societies.some(
        (s) => s.user_role === 'secretary' || s.user_role === 'organizer'
      ) ||
      memberships.some(
        (m) => m.role === 'secretary' || m.role === 'organizer'
      );
    if (hasSecretary) return 'secretary';

    // 2. Check if user is committee in any society or membership
    const hasCommittee =
      societies.some((s) => s.user_role === 'committee') ||
      memberships.some((m) => m.role === 'committee');
    if (hasCommittee) return 'committee';

    // 3. Check primary society role
    if (uiUser.primarySocietyId) {
      const primarySoc = societies.find((s) => s.id === uiUser.primarySocietyId);
      if (primarySoc?.user_role) {
        return (primarySoc.user_role as UserRole);
      }
      const primaryMem = memberships.find((m) => m.society_id === uiUser.primarySocietyId);
      if (primaryMem?.role) {
        return (primaryMem.role as UserRole);
      }
    }

    // 4. Check first society
    if (societies.length > 0 && societies[0]?.user_role) {
      return (societies[0].user_role as UserRole);
    }

    // 5. Check if provider
    if (provider) return 'provider';

    // 6. Fallback to activeRole on profile
    if (uiUser.activeRole === 'organizer') return 'secretary';
    return uiUser.activeRole || 'resident';
  }, [
    platformAdminInfo,
    societies,
    societiesData?.memberships,
    uiUser.primarySocietyId,
    uiUser.activeRole,
    provider,
  ]);

  return (
    <ProtectedRoute>
      <DesktopShell
        activeTab="profile"
        onTabChange={handleTabChange}
        activeRole={detectedRole}
        activeSociety={null}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={uiUser}
      >
        <div className="max-w-4xl mx-auto space-y-6 pb-12 px-3 sm:px-0 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Account &amp; Profile
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage your personal identity, society memberships, and account settings.
            </p>
          </div>

          {/* Hero Profile Summary Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-extrabold text-2xl shadow-md border-2 border-white dark:border-[#141b27]">
                    {uiUser.name ? uiUser.name.substring(0, 1).toUpperCase() : <User className="w-8 h-8" />}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#141b27] shadow-xs"
                    title="Active Account"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                      {uiUser.name || 'User Profile'}
                    </h2>

                    {platformAdminInfo?.is_admin && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/80 dark:border-amber-500/30 uppercase font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        {platformAdminInfo.role}
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${
                        detectedRole === 'secretary' || detectedRole === 'organizer'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : detectedRole === 'committee'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                          : detectedRole === 'provider'
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {detectedRole === 'organizer' ? 'Secretary' : detectedRole}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{uiUser.email || 'No email associated'}</span>
                  </p>
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-bold transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>

          {/* Personal Information Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Personal Information</span>
              </h3>
              {isEditing && (
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  Editing Mode
                </span>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Unit / Flat Number
                    </label>
                    <input
                      type="text"
                      value={formData.unitNumber}
                      onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                      placeholder="e.g. A-402, Villa 12"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Property Type
                    </label>
                    <select
                      value={formData.propertyType}
                      onChange={(e) => setFormData({ ...formData, propertyType: e.target.value as PropertyType })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900"
                    >
                      <option value="apartment">Apartment</option>
                      <option value="villa">Villa</option>
                      <option value="row_house">Row House</option>
                      <option value="independent_floor">Independent Floor</option>
                      <option value="penthouse">Penthouse</option>
                      <option value="duplex">Duplex</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400">
                    <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Email Address</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                    {uiUser.email || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Phone Number</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {uiUser.phone || 'Not added'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400">
                    <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Unit / Flat</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {uiUser.unitNumber ? `Flat ${uiUser.unitNumber}` : 'Not provided'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Property Type</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {uiUser.propertyType?.replace('_', ' ') || 'Apartment'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400">
                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Account Authority</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {platformAdminInfo?.is_admin
                      ? platformAdminInfo.role
                      : detectedRole === 'secretary' || detectedRole === 'organizer'
                      ? 'Society Secretary'
                      : detectedRole === 'committee'
                      ? 'Committee Member'
                      : detectedRole === 'provider'
                      ? 'Service Provider'
                      : 'Resident Member'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                  <div className="flex items-center space-x-2.5 text-slate-500 dark:text-slate-400">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Member Since</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {uiUser.createdAt ? new Date(uiUser.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Society Memberships Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Society Memberships</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {societies.length}
                </span>
              </h3>

              {societies.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Join Society</span>
                </button>
              )}
            </div>

            {societies.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Not currently a member of any residential society
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Join an existing residential community with an invite link or register a new one to unlock group bulk deals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Join or Create a Society</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                {societies.map((soc) => (
                  <div
                    key={soc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 gap-3 hover:border-slate-200 dark:hover:border-white/10 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {soc.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                            soc.user_role === 'secretary'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                              : soc.user_role === 'committee'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {soc.user_role || 'resident'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Flat {soc.flat_number || 'N/A'} • {soc.city}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push(`/s/${soc.slug}`)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 text-xs font-bold transition shadow-2xs cursor-pointer self-start sm:self-auto"
                    >
                      <span>Open Society</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provider Identity (If applicable) */}
          {provider && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Provider Identity</span>
                </h3>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {provider.company_name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Contact: {provider.contact_person} • {provider.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/partner')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                  >
                    <span>Vendor Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-3 text-xs">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    ★ {provider.rating || '5.0'} Rating
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {provider.total_jobs_completed || 0} jobs completed
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Account Security & Actions Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Security &amp; Actions</span>
            </h3>

            <div className="space-y-3 pt-1">
              {/* Admin Bootstrap / Portal */}
              {platformAdminInfo?.is_admin ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                        Platform Administrator Active
                      </h4>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                        You have verified platform administrative access.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/admin')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer self-start sm:self-auto"
                  >
                    <span>Admin Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleBootstrapAdmin}
                  disabled={isBootstrapping}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
                >
                  <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isBootstrapping ? 'Verifying Platform Role...' : 'Verify / Bootstrap Platform Admin'}</span>
                </button>
              )}

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center space-x-2 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Ownera</span>
              </button>
            </div>
          </div>
        </div>

        {/* Join Society Modal */}
        <JoinSocietyModal
          isOpen={isJoinModalOpen}
          allowCreate={societies.length === 0}
          onClose={() => setIsJoinModalOpen(false)}
          onSuccess={() => {
            setIsJoinModalOpen(false);
            refetchSocieties();
            toast.success('Society membership updated!');
          }}
        />
      </DesktopShell>
    </ProtectedRoute>
  );
}
