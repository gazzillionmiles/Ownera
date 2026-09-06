'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw, Zap, Shield, FileText, CreditCard, ArrowLeft } from 'lucide-react';
import { APP_NAME } from '@/src/constants';

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : false);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/icons/favicon-32x32.png', { method: 'HEAD', cache: 'no-store' });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      // Still offline
    }
    setTimeout(() => {
      setIsChecking(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 text-center">
        {/* Animated Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center rounded-2xl bg-zinc-800/80 border border-zinc-700/50 shadow-inner">
          <WifiOff className="w-10 h-10 text-amber-400 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-ping" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Offline Mode
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            You&apos;re Currently Offline
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {APP_NAME} requires an active network connection to perform operations and sync account data.
          </p>
        </div>

        {/* Live Network Status Indicator */}
        {isOnline !== null && (
          <div className={`text-xs py-2 px-3 rounded-xl border flex items-center justify-center gap-2 ${
            isOnline 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            {isOnline ? 'Network restored! You can retry now.' : 'Waiting for connection to restore...'}
          </div>
        )}

        {/* Feature Breakdown */}
        <div className="text-left space-y-3 pt-2 border-t border-zinc-800/80">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Requires Active Network
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-2 text-zinc-300">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Async Actions</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-2 text-zinc-300">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <span>File Storage</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-2 text-zinc-300">
              <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Payments</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-2 text-zinc-300">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Auth &amp; Session</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full py-3 px-4 rounded-xl bg-[#2CB7A5] text-[#121316] font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking Connection...' : 'Try Reconnecting'}
          </button>

          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium text-xs transition flex items-center justify-center gap-2 border border-zinc-700/50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
