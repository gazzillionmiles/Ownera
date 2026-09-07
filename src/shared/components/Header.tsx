'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Bell,
  ChevronDown,
  LogOut,
  Plus,
  Shield,
  ShieldCheck,
  Wrench,
  User,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_NAME } from '@/src/constants';
import { UserRole, Society } from '@/src/types/ownera';
import { toast } from 'sonner';

interface HeaderProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  activeRole?: UserRole;
  activeSociety?: Society | null;
  onJoinSocietyClick?: () => void;
  onOpenCreate?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRole = 'resident',
  activeSociety,
  onJoinSocietyClick,
  onOpenCreate,
}) => {
  const router = useRouter();
  const { uiUser, signOut } = useAuth();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSocietyMenuOpen, setIsSocietyMenuOpen] = useState(false);
  const [userSocieties, setUserSocieties] = useState<Society[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPlatformAdminUser, setIsPlatformAdminUser] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const societyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uiUser.isLoggedIn) {
      fetch('/api/notifications')
        .then((res) => res.json())
        .then((data) => {
          if (data.notifications) {
            setNotifications(data.notifications);
            setUnreadCount(data.notifications.filter((n: any) => !n.read).length);
          }
        })
        .catch(() => {});

      fetch('/api/societies')
        .then((res) => res.json())
        .then((data) => {
          if (data.societies) {
            setUserSocieties(data.societies);
          }
        })
        .catch(() => {});

      fetch('/api/admin/bootstrap')
        .then((res) => res.json())
        .then((data) => {
          if (data?.is_admin) {
            setIsPlatformAdminUser(true);
          }
        })
        .catch(() => {});
    }
  }, [uiUser.isLoggedIn]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (societyMenuRef.current && !societyMenuRef.current.contains(e.target as Node)) {
        setIsSocietyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSocietySelect = (soc: Society) => {
    setIsSocietyMenuOpen(false);
    router.push(`/s/${soc.slug}`);
    toast.success(`Switched society to ${soc.name}`);
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await signOut();
    router.push('/login');
  };

  const currentRole = activeRole || uiUser.activeRole || 'resident';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand & Society Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (activeSociety) {
                  router.push(`/s/${activeSociety.slug}`);
                } else {
                  router.push('/home');
                }
              }}
              className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-base shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                O
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight group-hover:text-blue-600 transition-colors">
                    {APP_NAME.toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block truncate max-w-[220px]">
                  {activeSociety?.name || 'Bulk Services Hub'}
                </p>
              </div>
            </button>

            {/* Society Switcher Dropdown */}
            <div className="relative" ref={societyMenuRef}>
              {activeSociety ? (
                <button
                  onClick={() => setIsSocietyMenuOpen(!isSocietyMenuOpen)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-slate-50/80 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[150px] font-bold text-slate-800">
                    {activeSociety.name}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              ) : (
                onJoinSocietyClick && (
                  <button
                    onClick={onJoinSocietyClick}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Join Society</span>
                  </button>
                )
              )}

              {isSocietyMenuOpen && (
                <div className="absolute top-12 left-0 w-72 rounded-2xl border border-slate-100 bg-white shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Your Societies ({userSocieties.length})
                  </div>

                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {userSocieties.map((soc) => {
                      const isCurrent = activeSociety?.id === soc.id;
                      return (
                        <button
                          key={soc.id}
                          onClick={() => handleSocietySelect(soc)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-50 text-emerald-800 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate">
                            <div className="font-bold truncate text-slate-900">{soc.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {soc.city} • {soc.member_count !== undefined ? `${soc.member_count} members` : `${soc.total_homes} units`}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="my-1.5 border-t border-slate-100" />

                  {onJoinSocietyClick && (
                    <button
                      onClick={() => {
                        setIsSocietyMenuOpen(false);
                        onJoinSocietyClick();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-bold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Join or Create Society</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick "+ Create" Trigger */}
            {onOpenCreate && (
              <button
                onClick={onOpenCreate}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Create</span>
              </button>
            )}

            {/* Role Badge Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold">
              {currentRole === 'organizer' || currentRole === 'secretary' || currentRole === 'committee' ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-slate-800">Secretary</span>
                </>
              ) : currentRole === 'provider' ? (
                <>
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-800">Provider</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">Resident</span>
                </>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute top-12 right-0 w-80 rounded-2xl border border-slate-100 bg-white shadow-xl p-3 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-extrabold text-xs text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No new notifications
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl text-xs transition ${
                            n.read
                              ? 'bg-slate-50 text-slate-600'
                              : 'bg-blue-50/70 text-slate-900 border border-blue-100'
                          }`}
                        >
                          <div className="font-bold text-slate-900">{n.title}</div>
                          <div className="text-[11px] mt-0.5 leading-snug text-slate-600">{n.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-85 transition cursor-pointer"
                aria-label="Profile menu"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-xs font-black text-white shadow-2xs">
                  {uiUser.name ? uiUser.name[0].toUpperCase() : 'U'}
                </div>
                <div className="leading-tight text-left hidden lg:block">
                  <span className="block text-xs font-extrabold text-slate-900 truncate max-w-[120px]">
                    {uiUser.name || 'Resident'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 truncate max-w-[120px]">
                    {uiUser.unitNumber ? `Unit ${uiUser.unitNumber}` : 'Resident Member'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition duration-200 ${
                    isProfileOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProfileOpen && (
                <div className="absolute top-12 right-0 w-64 rounded-2xl border border-slate-100 bg-white shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-2">
                    <div className="flex items-center justify-between">
                      <p className="font-extrabold text-xs text-slate-900 truncate">{uiUser.name || 'User'}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {currentRole === 'organizer' ? 'Secretary' : currentRole}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{uiUser.email}</p>
                    {activeSociety && (
                      <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-bold">
                        <Building2 className="w-3 h-3" /> {activeSociety.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-0.5 text-xs font-bold text-slate-700">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        router.push('/profile');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-slate-50 transition cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Account Profile</span>
                    </button>

                    {isPlatformAdminUser && (
                      <>
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            router.push('/admin/issues');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5 text-amber-600" />
                          <span>Platform Admin Portal</span>
                        </button>
                        <div className="my-1.5 border-t border-slate-100" />
                      </>
                    )}
                  </div>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold text-left transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
