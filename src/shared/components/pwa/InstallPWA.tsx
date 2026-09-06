'use client';

import React, { useEffect, useState } from 'react';
import { X, Layers } from 'lucide-react';
import { APP_NAME } from '@/src/constants';

const APP_PREFIX = process.env.NEXT_PUBLIC_APP_COOKIE_PREFIX || 'saas';
const DISMISSED_KEY = `${APP_PREFIX}_pwa_dismissed`;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandaloneApp =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneApp);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowInstallBanner(false);
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (isStandalone || !showInstallBanner || !deferredPrompt) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[min(360px,calc(100%-2rem))] w-full px-3">
      <div className="bg-[#18191D] border border-white/[0.08] text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#2CB7A5] flex items-center justify-center text-zinc-950 font-bold shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-100">Install {APP_NAME}</p>
            <p className="text-[10px] text-zinc-400 truncate">Add to home screen</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-4 py-1.5 bg-white text-[#09090b] text-xs font-semibold rounded-xl active:bg-zinc-200 transition"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 text-zinc-400 hover:text-white transition rounded-lg"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
