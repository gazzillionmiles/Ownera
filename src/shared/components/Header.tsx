'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Building2,
  Bell,
  ChevronDown,
  LogOut,
  Plus,
  Shield,
  Briefcase,
  Home,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';
import { UserRole, Society } from '@/src/types/ownera';
import { toast } from 'sonner';

interface HeaderProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  activeRole?: UserRole;
  activeSociety?: Society | null;
  onJoinSocietyClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRole = 'resident',
  activeSociety,
  onJoinSocietyClick,
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
    // Fetch notifications, user societies, and admin status
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
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#121316]/95 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Society */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => {
              if (activeSociety) {
                router.push(`/s/${activeSociety.slug}`);
              } else {
                router.push('/home');
              }
            }}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2CB7A5] to-emerald-400 flex items-center justify-center text-zinc-950 shadow-md">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-white leading-none">
                {APP_NAME}
              </span>
              <span className="text-[9px] text-zinc-400 font-medium hidden sm:block">
                {APP_TAGLINE}
              </span>
            </div>
          </div>

          {/* Society Switcher Dropdown */}
          <div className="relative" ref={societyMenuRef}>
            {activeSociety ? (
              <button
                onClick={() => setIsSocietyMenuOpen(!isSocietyMenuOpen)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 text-xs text-zinc-300 hover:border-[#2CB7A5]/40 transition group"
              >
                <Building2 className="w-3.5 h-3.5 text-[#2CB7A5]" />
                <span className="font-semibold text-white truncate max-w-[140px]">
                  {activeSociety.name}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-white transition" />
              </button>
            ) : (
              onJoinSocietyClick && (
                <button
                  onClick={onJoinSocietyClick}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-[#2CB7A5] text-xs font-semibold hover:bg-[#2CB7A5]/20 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Join Society</span>
                </button>
              )
            )}

            {isSocietyMenuOpen && (
              <div className="absolute top-12 left-0 w-64 rounded-2xl border border-zinc-700/80 bg-[#18191D]/95 backdrop-blur-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Your Societies ({userSocieties.length})
                </div>

                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {userSocieties.map((soc) => {
                    const isCurrent = activeSociety?.id === soc.id;
                    return (
                      <button
                        key={soc.id}
                        onClick={() => handleSocietySelect(soc)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition ${
                          isCurrent
                            ? 'bg-[#2CB7A5]/20 text-white font-semibold'
                            : 'text-zinc-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-medium truncate">{soc.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {soc.city} • {soc.member_count !== undefined ? `${soc.member_count} ${soc.member_count === 1 ? 'member' : 'members'}` : `${soc.total_homes} units`}
                          </div>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="my-1.5 border-t border-white/10" />

                {onJoinSocietyClick && (
                  <button
                    onClick={() => {
                      setIsSocietyMenuOpen(false);
                      onJoinSocietyClick();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#2CB7A5] hover:bg-[#2CB7A5]/10 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Join or Switch Society</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Role Badge Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#2CB7A5]" />
            <span className="font-semibold text-zinc-300 capitalize">
              {currentRole === 'organizer' ? 'Secretary' : currentRole}
            </span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-xl hover:bg-white/5 transition relative text-zinc-400 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2CB7A5]" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute top-12 right-0 w-80 rounded-2xl border border-zinc-700/80 bg-[#18191D]/95 backdrop-blur-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                  <span className="font-bold text-xs text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-[#2CB7A5] hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500">
                    No new notifications
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl text-xs transition ${
                          n.read ? 'bg-zinc-900/40 text-zinc-400' : 'bg-[#2CB7A5]/10 text-zinc-200 border border-[#2CB7A5]/20'
                        }`}
                      >
                        <div className="font-semibold text-white">{n.title}</div>
                        <div className="text-[11px] mt-0.5 leading-snug">{n.message}</div>
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
              className="flex items-center gap-2 pl-2 border-l border-white/10 hover:opacity-85 transition"
              aria-label="Profile menu"
            >
              <div className="w-7 h-7 rounded-full bg-[#2CB7A5] flex items-center justify-center text-xs font-bold text-zinc-950">
                {uiUser.name ? uiUser.name[0].toUpperCase() : 'U'}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition duration-200 ${
                  isProfileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isProfileOpen && (
              <div className="absolute top-12 right-0 w-64 rounded-2xl border border-zinc-700/80 bg-[#18191D]/95 backdrop-blur-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 mb-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-white truncate">{uiUser.name || 'User'}</p>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#2CB7A5]/20 text-[#2CB7A5] font-bold uppercase">
                      {currentRole === 'organizer' ? 'Secretary' : currentRole}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">{uiUser.email}</p>
                  {activeSociety && (
                    <p className="text-[10px] text-[#2CB7A5] mt-1 flex items-center gap-1 font-semibold">
                      <Building2 className="w-3 h-3" /> {activeSociety.name}
                    </p>
                  )}
                </div>

                <div className="space-y-0.5 text-xs font-medium">
                  {isPlatformAdminUser && (
                    <>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          router.push('/admin/issues');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-amber-400 hover:bg-amber-500/10 transition"
                      >
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>Platform Admin Portal</span>
                      </button>
                      <div className="my-1.5 border-t border-white/10" />
                    </>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-xs font-semibold text-left transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
