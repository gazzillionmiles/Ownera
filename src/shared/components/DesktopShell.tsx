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
  user?: BaseUserProfile;
  onOpenCreate?: () => void;
  theme?: any;
  onToggleTheme?: () => void;
}

export const DesktopShell: React.FC<DesktopShellProps> = ({
  children,
  activeTab = 'campaigns',
  onTabChange = () => {},
  activeRole = 'resident',
  activeSociety = null,
  onJoinSocietyClick = () => {},
  onOpenCreate,
}) => {

  // Determine desktop secondary tabs matching active role
  let navItems: { id: string; label: string; icon: React.FC<{ className?: string }> }[] = [];

  if (activeRole === 'resident') {
    navItems = [
      { id: 'campaigns', label: 'Services', icon: Sparkles },
      { id: 'bookings', label: 'My Bookings', icon: Calendar },
      { id: 'society', label: 'Society', icon: Building2 },
    ];
  } else if (activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee') {
    navItems = [
      { id: 'overview', label: 'Home', icon: Home },
      { id: 'campaigns', label: 'My Actions', icon: Layers },
      { id: 'members', label: 'Members', icon: Users },
      { id: 'schedule', label: 'Schedule', icon: Calendar },
    ];
  } else if (activeRole === 'provider') {
    navItems = [
      { id: 'opportunities', label: 'Opportunities', icon: Layers },
      { id: 'schedule', label: 'My Jobs', icon: CheckSquare },
      { id: 'overview', label: 'Payments', icon: TrendingUp },
    ];
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900 font-sans">
      <Header
        activeRole={activeRole}
        activeSociety={activeSociety}
        onJoinSocietyClick={onJoinSocietyClick}
        onOpenCreate={onOpenCreate}
      />

      <main className="flex-1 relative z-10 pb-20 md:pb-12 pt-4 sm:pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Secondary Navigation Bar */}
          {activeSociety && navItems.length > 0 && (
            <div className="hidden md:flex items-center justify-between border-b border-slate-200/80 pb-3 mb-6">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id || (activeRole === 'resident' && item.id === 'campaigns' && activeTab === 'home');
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
        onOpenCreate={onOpenCreate}
      />
    </div>
  );
};
