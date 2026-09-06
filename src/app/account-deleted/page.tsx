'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert, RotateCcw, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountDeletedPage() {
  const router = useRouter();
  const { uiUser, signOut, refreshProfile } = useAuth();
  const [restoring, setRestoring] = useState(false);

  const purgeDate = uiUser.scheduledPurgeAt
    ? new Date(uiUser.scheduledPurgeAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '30 days from request';

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch('/api/account/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to restore account.');
        setRestoring(false);
        return;
      }

      toast.success('Welcome back! Your account has been restored.');
      await refreshProfile();
      router.push('/home');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#121316] text-[#1C1C1C] dark:text-white p-4">
      <div className="max-w-md w-full rounded-3xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Account Scheduled for Deletion
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Your account is currently in a 30-day grace period and is scheduled for permanent purge on{' '}
            <strong className="text-amber-500 font-semibold">{purgeDate}</strong>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 text-xs text-zinc-400 text-left space-y-1.5 border border-white/10">
          <div className="font-semibold text-white">During this grace period:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Your account access and operations are paused.</li>
            <li>Your saved history and data remain safe.</li>
            <li>You can cancel deletion and restore your account at any time before the purge date.</li>
          </ul>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#2CB7A5] text-[#121316] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#2CB7A5]/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {restoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Restoring Account...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Cancel Deletion &amp; Restore Account</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 rounded-2xl border border-white/10 text-xs font-semibold text-zinc-400 hover:bg-white/5 flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
