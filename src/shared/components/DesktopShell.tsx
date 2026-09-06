'use client';

import React from 'react';
import { BaseUserProfile } from '@/src/types/auth';
import { UserRole, Society } from '@/src/types/ownera';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
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
} from 'lucide-react';

interface DesktopShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  activeRole?: UserRole;
  activeSociety?: Society | null;
  onJoinSocietyClick?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  user?: BaseUserProfile;
}

export const DesktopShell: React.FC<DesktopShellProps> = ({
  children,
  activeTab = 'campaigns',
  onTabChange = () => {},
  activeRole = 'resident',
  activeSociety = null,
  onJoinSocietyClick = () => {},
  theme = 'dark',
}) => {
  // Determine desktop secondary tabs matching active role
  let navItems: { id: string; label: string; icon: React.FC<{ className?: string }> }[] = [];

  if (activeRole === 'resident') {
    navItems = [
      { id: 'campaigns', label: 'Service Camps', icon: Sparkles },
      { id: 'bookings', label: 'My Bookings', icon: Calendar },
      { id: 'society', label: 'Society Hub', icon: Building2 },
    ];
  } else if (activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee') {
    navItems = [
      { id: 'overview', label: 'Overview', icon: Home },
      { id: 'campaigns', label: 'Campaigns & Bids', icon: Layers },
      { id: 'members', label: 'Society Members', icon: Users },
      { id: 'schedule', label: 'Service Schedule', icon: Calendar },
    ];
  } else if (activeRole === 'provider') {
    navItems = [
      { id: 'overview', label: 'Earnings & Stats', icon: TrendingUp },
      { id: 'opportunities', label: 'Demand Opportunities', icon: Layers },
      { id: 'schedule', label: 'Jobs Checklist', icon: CheckSquare },
      { id: 'profile', label: 'Provider Profile', icon: Briefcase },
    ];
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#121316] text-[#FAF8F5]">
      <Header
        theme={theme}
        activeRole={activeRole}
        activeSociety={activeSociety}
        onJoinSocietyClick={onJoinSocietyClick}
      />

      <main className="flex-1 relative z-10 pb-20 md:pb-10 pt-4 sm:pt-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Desktop Secondary Navigation Bar */}
          {activeSociety && navItems.length > 0 && (
            <div className="hidden md:flex items-center justify-between border-b border-white/[0.08] pb-3 mb-6">
              <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-2xl border border-white/5 shadow-inner">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#2CB7A5] text-zinc-950 font-bold shadow-md'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-[#2CB7A5]" />
                <span className="capitalize">{activeRole === 'organizer' ? 'Secretary' : activeRole}</span>
              </div>
            </div>
          )}

          {children}
        </div>
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        activeRole={activeRole}
      />
    </div>
  );
};
