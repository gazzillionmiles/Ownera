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
    <div className="space-y-6 pb-8 max-w-4xl mx-auto w-full animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Settings &amp; Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage system preferences, privacy controls, and feedback.
        </p>
      </div>

      {/* Account Info */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 shadow-xs">
        <div className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400">Account</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {user.name ? user.name.substring(0, 1).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>{user.name}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{user.email || 'No email associated'}</div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 transition font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 shadow-xs">
        <div className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400">Preferences</div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Appearance Theme</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select between light and dark visual themes
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Privacy & Retention */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-4 text-xs shadow-xs">
        <div className="font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">Privacy &amp; Data Retention</div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Automated data retention cleanup
          </div>
          <div className="text-slate-500 dark:text-slate-400 font-medium">180-day cycle</div>
        </div>
      </div>

      {/* Support */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] p-6 space-y-3 shadow-xs">
        <div className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400">Feedback &amp; Issues</div>
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-900 transition text-left text-xs cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
              <Bug className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white">Report an Issue / Feedback</div>
              <div className="text-slate-500 dark:text-slate-400">Send logs and feedback directly to administrators</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-3xl border border-rose-200/80 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10 p-6 space-y-3 text-xs shadow-xs">
        <div className="font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Danger Zone</div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-sm text-rose-900 dark:text-rose-300">Delete Account</div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">
              Permanently schedule your account for deletion with a 30-day grace period.
            </div>
          </div>
          {onRequestDeleteAccount && (
            <button
              onClick={onRequestDeleteAccount}
              className="text-xs px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shrink-0 cursor-pointer"
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
