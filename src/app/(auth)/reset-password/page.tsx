'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Footer } from '@/src/shared/components/Footer';
import { Loader2, CheckCircle2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters long';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        const msg = error.message || 'Failed to update password';
        setErrorMessage(msg);
        toast.error(msg);
      } else {
        setSuccess(true);
        toast.success('Password updated successfully!');
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      }
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#141414] text-white relative overflow-hidden">
      <div className="relative z-10 flex-1 flex items-center justify-center py-12 px-6">
        <div className="max-w-sm w-full mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold mx-auto mb-3 shadow-md">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Set New Password</h2>
            <p className="text-xs text-[#BDBDBD] mt-1.5">
              Enter your new password for {APP_NAME}.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {errorMessage}
            </div>
          )}

          {success ? (
            <div className="p-4 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="w-8 h-8 text-[#2CB7A5] mx-auto mb-2" />
              <div className="font-semibold text-xs text-white">Password Updated!</div>
              <p className="text-[11px] text-[#BDBDBD] mt-1">
                Your password has been reset. Redirecting to your dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#BDBDBD] mb-1.5">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  disabled={loading}
                  className="w-full px-3 py-2.5 rounded-lg text-xs border bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666] focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#BDBDBD] mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  disabled={loading}
                  className="w-full px-3 py-2.5 rounded-lg text-xs border bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666] focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full py-3 px-4 rounded-lg bg-[#2CB7A5] text-[#121316] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Password</span>}
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer theme="dark" />
    </div>
  );
}
