'use client';

import React, { useState } from 'react';
import { ThemeMode } from '@/src/types/saas';
import { BaseUserProfile } from '@/src/types/auth';
import { Sun, Moon, LogOut, User, Clock, ChevronRight, Bug } from 'lucide-react';
import { ReportIssueModal } from '@/src/shared/components/ReportIssueModal';
import { useTheme } from '@/src/shared/components/ui/theme-provider';

interface SettingsViewProps {
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  user: BaseUserProfile;
  onUpdateUser?: (updates: Partial<BaseUserProfile>) => void;
  onRequestDeleteAccount?: () => void;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme: propTheme,
  onToggleTheme: propToggleTheme,
  user,
  onRequestDeleteAccount,
  onLogout,
}) => {
  const { theme: ctxTheme, toggleTheme } = useTheme();
  const theme = propTheme || ctxTheme;
  const onToggleTheme = propToggleTheme || toggleTheme;
  const isDark = theme === 'dark';
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  return (
    <div className="space-y-8 pb-8 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings &amp; Preferences</h1>
      </div>

      {/* Account Info */}
      <div className="rounded-2xl border border-white/10 bg-[#18191D] p-5 space-y-4">
        <div className="font-semibold text-xs tracking-wider uppercase text-zinc-400">Account</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] flex items-center justify-center font-bold text-sm">
              {user.name ? user.name.substring(0, 1).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-semibold text-sm text-white flex items-center gap-2">
                <span>{user.name}</span>
              </div>
              <div className="text-xs text-zinc-400">{user.email || 'No email associated'}</div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs px-3.5 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl border border-white/10 bg-[#18191D] p-5 space-y-4">
        <div className="font-semibold text-xs tracking-wider uppercase text-zinc-400">Preferences</div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white">Appearance Theme</div>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-white/10 text-xs hover:bg-white/5 transition"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Privacy & Retention */}
      <div className="rounded-2xl border border-white/10 bg-[#18191D] p-5 space-y-4 text-xs">
        <div className="font-semibold tracking-wider uppercase text-zinc-400">Privacy &amp; Data Retention</div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-zinc-300">
            <Clock className="w-4 h-4 text-[#2CB7A5]" /> Automated data retention cleanup
          </div>
          <div className="text-zinc-500">180-day cycle</div>
        </div>
      </div>

      {/* Support */}
      <div className="rounded-2xl border border-white/10 bg-[#18191D] p-5 space-y-3">
        <div className="font-semibold text-xs tracking-wider uppercase text-zinc-400">Feedback &amp; Issues</div>
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 hover:bg-white/5 transition text-left text-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#2CB7A5]/10 text-[#2CB7A5]">
              <Bug className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Report an Issue / Feedback</div>
              <div className="text-zinc-500">Send logs and feedback directly to administrators</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-3 text-xs">
        <div className="font-semibold uppercase tracking-wider text-red-400">Danger Zone</div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm text-red-300">Delete Account</div>
            <div className="text-zinc-400 mt-0.5">
              Permanently schedule your account for deletion with a 30-day grace period.
            </div>
          </div>
          {onRequestDeleteAccount && (
            <button
              onClick={onRequestDeleteAccount}
              className="text-xs px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold hover:bg-red-500/30 transition shrink-0"
            >
              Delete Account
            </button>
          )}
        </div>
      </div>

      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};
