'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { trackSignupCompleted } from '@/src/shared/lib/analytics';
import { APP_NAME } from '@/src/constants';
import { getSafePostAuthRedirect } from '@/lib/consent';

export type AuthMode = 'signin' | 'signup' | 'forgot';

interface LoginViewProps {
  theme?: 'dark' | 'light';
  onBack?: () => void;
  initialMode?: AuthMode;
}

const LoginViewContent: React.FC<LoginViewProps> = ({
  theme = 'dark',
  onBack,
  initialMode = 'signin',
}) => {
  const isDark = theme === 'dark';
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    signInWithGoogle,
    signInWithEmailOtp,
    signUpWithEmail,
    signInWithPassword,
    resetPasswordForEmail,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const routeErrorMessage = searchParams.get('error');
  const routeInfoMessage = searchParams.get('message');
  const routeMode = searchParams.get('mode');
  const visibleErrorMessage = errorMessage ?? routeErrorMessage;

  useEffect(() => {
    if (routeMode === 'signup' || searchParams.get('signup')) {
      setMode('signup');
    }
    const rawCode = (
      searchParams.get('invite_code') ||
      searchParams.get('inviteCode') ||
      searchParams.get('code')
    )
      ?.trim()
      .toUpperCase();

    // Only store genuine invite codes (<= 25 chars, not 32+ hex auth codes)
    const isAuthToken = Boolean(
      rawCode && (rawCode.length > 25 || /^[0-9A-F]{32,}$/.test(rawCode))
    );
    const codeParam = isAuthToken ? null : rawCode;

    if (typeof document !== 'undefined') {
      if (codeParam) {
        document.cookie = `ownera_invite_code=${encodeURIComponent(codeParam)}; path=/; max-age=2592000; SameSite=Lax`;
        try {
          window.localStorage.setItem('ownera_invite_code', codeParam);
        } catch {}
      } else if (isAuthToken) {
        // Clear any stale auth token stored in the invite cookie by mistake
        document.cookie =
          'ownera_invite_code=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        try {
          window.localStorage.removeItem('ownera_invite_code');
        } catch {}
      }
    }
  }, [routeMode, searchParams]);

  useEffect(() => {
    if (user) {
      const targetNext = getSafePostAuthRedirect(searchParams.get('next'));
      router.replace(targetNext);
    }
  }, [user, router, searchParams]);

  const resetFormState = () => {
    setErrorMessage(null);
    setEmailSentMessage(null);
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  };

  const switchMode = (newMode: AuthMode) => {
    resetFormState();
    setMode(newMode);
  };

  const handleGoogleLogin = async () => {
    resetFormState();
    setLoadingGoogle(true);
    try {
      const targetNext = getSafePostAuthRedirect(searchParams.get('next'));
      const { error } = await signInWithGoogle(targetNext);
      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message || 'Google sign-in failed');
        setLoadingGoogle(false);
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'An unexpected error occurred');
      setErrorMessage(msg);
      toast.error(msg);
      setLoadingGoogle(false);
    }
  };

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    resetFormState();
    setLoading(true);
    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        setErrorMessage('Invalid email or password');
        toast.error('Invalid email or password');
      } else {
        toast.success('Signed in successfully!');
        const targetNext = getSafePostAuthRedirect(searchParams.get('next'));
        router.replace(targetNext);
      }
    } catch {
      setErrorMessage('Invalid email or password');
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

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

    resetFormState();
    setLoading(true);
    try {
      const targetNext = getSafePostAuthRedirect(searchParams.get('next'));
      const { data, error } = await signUpWithEmail(
        email,
        password,
        undefined,
        targetNext
      );
      if (error) {
        const msg = error.message || 'Signup failed';
        setErrorMessage(msg);
        toast.error(msg);
      } else if (data?.session) {
        trackSignupCompleted('email');
        toast.success('Account created successfully!');
        router.replace(targetNext);
      } else {
        trackSignupCompleted('email');
        setEmailSentMessage(
          'Check your email to verify your account before logging in.'
        );
        toast.success('Verification email sent! Check your inbox.');
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Signup failed');
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    resetFormState();
    setLoading(true);
    try {
      const { error, message } = await resetPasswordForEmail(email);
      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
      } else {
        setEmailSentMessage(
          message ||
            'If an account exists for this email, a reset link has been sent.'
        );
        toast.success('Reset email sent if account exists');
      }
    } catch {
      setEmailSentMessage(
        'If an account exists for this email, a reset link has been sent.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    resetFormState();
    setLoading(true);
    try {
      const targetNext = getSafePostAuthRedirect(searchParams.get('next'));
      const { error } = await signInWithEmailOtp(email, targetNext);
      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message || 'Failed to send magic link');
      } else {
        setEmailSentMessage(
          'We sent a magic link to your email. Click the link to log in.'
        );
        toast.success('Magic link sent! Check your email inbox.');
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Failed to send magic link');
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-sm mx-auto w-full">
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className={`mb-6 p-2 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              isDark
                ? 'border-[#2D2D2D] text-[#BDBDBD] hover:bg-[#1C1C1C]'
                : 'border-[#E6E1D8] text-[#666666] hover:bg-white'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        )}

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold mx-auto mb-3 shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'signup'
              ? 'Create an Account'
              : mode === 'forgot'
                ? 'Reset Password'
                : `Welcome to ${APP_NAME}`}
          </h2>
          <p
            className={`text-xs mt-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
          >
            {mode === 'signup'
              ? 'Join your residential society to unlock collective bulk savings on home services.'
              : mode === 'forgot'
                ? 'Enter your email to receive a password reset link.'
                : 'Sign in to access your society service camps and bookings.'}
          </p>
        </div>

        {visibleErrorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {visibleErrorMessage}
          </div>
        )}

        {routeInfoMessage && !visibleErrorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-[#2CB7A5] text-xs leading-relaxed flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 shrink-0 text-[#2CB7A5]" />
            <span>{routeInfoMessage}</span>
          </div>
        )}

        {/* Email verification / Sent message banner */}
        {emailSentMessage ? (
          <div className="p-4 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/30 text-center animate-in fade-in zoom-in duration-300">
            <CheckCircle2 className="w-8 h-8 text-[#2CB7A5] mx-auto mb-2" />
            <div className="font-semibold text-xs text-white">
              Check Your Email
            </div>
            <p className="text-[11px] text-[#BDBDBD] mt-1.5 leading-relaxed">
              {emailSentMessage}
            </p>
            <button
              onClick={() => {
                resetFormState();
                switchMode('signin');
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-[#2CB7A5] text-[#121316] text-xs font-semibold hover:opacity-90 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            {mode !== 'forgot' && (
              <div className="space-y-3 mb-6">
                {/* Google OAuth */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loadingGoogle || loading}
                  className={`w-full py-3 px-4 rounded-lg text-sm font-semibold flex items-center justify-center space-x-3 border transition-all active:scale-[0.98] disabled:opacity-50 ${
                    isDark
                      ? 'bg-[#1C1C1C] border-[#2A2A2A] text-white hover:bg-[#232323]'
                      : 'bg-white border-[#E6E1D8] text-[#1A1A1A] hover:bg-[#F5F2EB]'
                  }`}
                >
                  {loadingGoogle ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#2CB7A5]" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>
                    {loadingGoogle ? 'Connecting...' : 'Continue with Google'}
                  </span>
                </button>

                <div className="relative flex items-center justify-center my-4">
                  <div
                    className={`w-full border-t ${isDark ? 'border-[#2A2A2A]' : 'border-[#E6E1D8]'}`}
                  />
                  <span
                    className={`absolute px-2 text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'bg-[#141414] text-[#888]' : 'bg-[#FAF7F2] text-[#888]'}`}
                  >
                    or
                  </span>
                </div>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === 'signin' && (
              <div className="space-y-4">
                {showMagicLink ? (
                  <form onSubmit={handleMagicLinkSignIn} className="space-y-3">
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                      >
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        required
                        disabled={loading || loadingGoogle}
                        className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                          isDark
                            ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                            : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || loadingGoogle || !email}
                      className="w-full py-2.5 rounded-lg bg-[#2CB7A5] text-[#121316] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Send Magic Link</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMagicLink(false)}
                      className="w-full text-center text-[11px] text-[#2CB7A5] hover:underline pt-1"
                    >
                      Sign in with password instead
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={handleEmailPasswordSignIn}
                    className="space-y-3"
                  >
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                      >
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        required
                        disabled={loading || loadingGoogle}
                        className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                          isDark
                            ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                            : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          className={`text-xs font-medium ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                        >
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-[11px] text-[#2CB7A5] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={loading || loadingGoogle}
                        className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                          isDark
                            ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                            : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                        }`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || loadingGoogle || !email || !password}
                      className="w-full py-3 rounded-lg bg-[#2CB7A5] text-[#121316] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Sign In</span>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setShowMagicLink(true)}
                        className="text-[11px] text-[#BDBDBD] hover:text-white hover:underline transition-colors"
                      >
                        Sign in with magic link instead
                      </button>
                    </div>
                  </form>
                )}

                <div className="text-center pt-4 border-t border-white/10">
                  <span
                    className={`text-xs ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                  >
                    Don&apos;t have an account?{' '}
                  </span>
                  <button
                    onClick={() => switchMode('signup')}
                    className="text-xs font-semibold text-[#2CB7A5] hover:underline"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}

            {/* SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div>
                  <label
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                  >
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                    disabled={loading || loadingGoogle}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                      isDark
                        ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                        : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                  >
                    Password (min 8 characters)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    disabled={loading || loadingGoogle}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                      isDark
                        ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                        : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                  >
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    disabled={loading || loadingGoogle}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                      isDark
                        ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                        : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    loadingGoogle ||
                    !email ||
                    !password ||
                    !confirmPassword
                  }
                  className="w-full py-3 rounded-lg bg-[#2CB7A5] text-[#121316] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>

                <div className="text-center pt-4 border-t border-white/10">
                  <span
                    className={`text-xs ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                  >
                    Already have an account?{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-xs font-semibold text-[#2CB7A5] hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div>
                  <label
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-[#BDBDBD]' : 'text-[#666666]'}`}
                  >
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                    disabled={loading}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:border-[#2CB7A5] ${
                      isDark
                        ? 'bg-[#1C1C1C] border-[#2D2D2D] text-white placeholder-[#666]'
                        : 'bg-white border-[#E6E1D8] text-black placeholder-[#999]'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 rounded-lg bg-[#2CB7A5] text-[#121316] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>

                <div className="text-center pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-xs font-semibold text-[#2CB7A5] hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const LoginView: React.FC<LoginViewProps> = (props) => (
  <React.Suspense fallback={null}>
    <LoginViewContent {...props} />
  </React.Suspense>
);
