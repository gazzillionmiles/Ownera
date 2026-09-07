'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/src/types/ownera';
import {
  Sparkles,
  Building2,
  Calendar,
  Briefcase,
  Layers,
  Home,
  CheckSquare,
  Users,
  TrendingUp,
  User,
  Plus,
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeRole: UserRole;
  theme?: 'dark' | 'light';
  onOpenCreate?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(
  ({ activeTab, onTabChange, activeRole = 'resident', onOpenCreate }) => {
    const router = useRouter();

    if (activeRole === 'provider') {
      const providerTabs = [
        { id: 'overview', label: 'Earnings', icon: TrendingUp },
        { id: 'opportunities', label: 'Demand', icon: Layers },
        { id: 'schedule', label: 'Jobs', icon: CheckSquare },
        { id: 'profile', label: 'Profile', icon: Briefcase },
      ];

      return (
        <nav
          id="provider-bottom-nav"
          aria-label="Provider Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2 shadow-lg"
        >
          <div className="flex items-center justify-between max-w-md mx-auto">
            {providerTabs.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'profile') router.push('/profile');
                    else onTabChange(item.id);
                  }}
                  className={`flex flex-col items-center gap-1 min-w-[54px] transition-colors cursor-pointer ${
                    isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                  <span className="text-[10px] font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      );
    }

    if (activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee') {
      return (
        <nav
          id="secretary-bottom-nav"
          aria-label="Secretary Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 shadow-lg"
        >
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => onTabChange('overview')}
              className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
                activeTab === 'overview' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Home className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[10px] font-bold">Overview</span>
            </button>

            <button
              onClick={() => onTabChange('campaigns')}
              className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
                activeTab === 'campaigns' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Layers className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[10px] font-bold">Camps</span>
            </button>

            {onOpenCreate && (
              <div className="relative -top-4">
                <button
                  onClick={onOpenCreate}
                  aria-label="Create new poll or campaign"
                  className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all cursor-pointer"
                >
                  <Plus className="w-6 h-6 stroke-[2.8]" />
                </button>
              </div>
            )}

            <button
              onClick={() => onTabChange('members')}
              className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
                activeTab === 'members' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[10px] font-bold">Members</span>
            </button>

            <button
              onClick={() => onTabChange('schedule')}
              className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
                activeTab === 'schedule' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Calendar className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[10px] font-bold">Schedule</span>
            </button>
          </div>
        </nav>
      );
    }

    // Default: Resident Bottom Navigation
    return (
      <nav
        id="resident-bottom-nav"
        aria-label="Resident Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 shadow-lg"
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Camps / Home */}
          <button
            id="bottom-nav-camps"
            onClick={() => onTabChange('campaigns')}
            className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
              activeTab === 'campaigns' || activeTab === 'home'
                ? 'text-blue-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sparkles className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Camps</span>
          </button>

          {/* Bookings */}
          <button
            id="bottom-nav-bookings"
            onClick={() => onTabChange('bookings')}
            className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
              activeTab === 'bookings' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Bookings</span>
          </button>

          {/* Center Floating Plus Action */}
          {onOpenCreate && (
            <div className="relative -top-4">
              <button
                id="bottom-nav-create"
                onClick={onOpenCreate}
                aria-label="Create new poll or request"
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition-all cursor-pointer"
              >
                <Plus className="w-6 h-6 stroke-[2.8]" />
              </button>
            </div>
          )}

          {/* Society Hub */}
          <button
            id="bottom-nav-society"
            onClick={() => onTabChange('society')}
            className={`flex flex-col items-center gap-1 min-w-[48px] transition-colors cursor-pointer ${
              activeTab === 'society' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Building2 className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Society</span>
          </button>

          {/* User Profile */}
          <button
            id="bottom-nav-profile"
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center gap-1 min-w-[48px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <User className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>
      </nav>
    );
  }
);

BottomNav.displayName = 'BottomNav';
