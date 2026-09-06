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
} from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeRole: UserRole;
  theme?: 'dark' | 'light';
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(
  ({ activeTab, onTabChange, activeRole = 'resident' }) => {
    const router = useRouter();

    // Determine tabs based on active role
    let navItems: { id: string; label: string; icon: React.FC<{ className?: string }> }[] = [];

    if (activeRole === 'resident') {
      navItems = [
        { id: 'campaigns', label: 'Camps', icon: Sparkles },
        { id: 'bookings', label: 'Bookings', icon: Calendar },
        { id: 'society', label: 'Society', icon: Building2 },
        { id: 'profile', label: 'Profile', icon: User },
      ];
    } else if (activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee') {
      navItems = [
        { id: 'overview', label: 'Overview', icon: Home },
        { id: 'campaigns', label: 'Camps', icon: Layers },
        { id: 'members', label: 'Members', icon: Users },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
      ];
    } else if (activeRole === 'provider') {
      navItems = [
        { id: 'overview', label: 'Earnings', icon: TrendingUp },
        { id: 'opportunities', label: 'Demand', icon: Layers },
        { id: 'schedule', label: 'Jobs', icon: CheckSquare },
        { id: 'profile', label: 'Profile', icon: Briefcase },
      ];
    }

    const handleItemClick = (id: string) => {
      if (id === 'profile') {
        router.push('/profile');
      } else {
        onTabChange(id);
      }
    };

    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-2 border-t border-white/[0.08] bg-[#121316]/95 backdrop-blur-2xl md:hidden">
        <nav className="flex items-center justify-around max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all group focus:outline-none active:scale-95"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavCapsule"
                    className="absolute inset-0 rounded-2xl bg-[#2CB7A5]/15 border border-[#2CB7A5]/25"
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}

                <Icon
                  className={`w-4 h-4 z-10 transition-transform duration-200 ${
                    isActive ? 'text-[#2CB7A5] scale-110' : 'text-zinc-400 group-hover:text-white'
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 z-10 font-bold tracking-tight transition-colors ${
                    isActive ? 'text-[#2CB7A5]' : 'text-zinc-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }
);

BottomNav.displayName = 'BottomNav';
