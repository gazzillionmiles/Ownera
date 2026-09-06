'use client';

import React, { useEffect } from 'react';
import { Wifi, X } from 'lucide-react';
import { useNetworkStatus } from '@/providers/NetworkStatusProvider';

export const ReconnectNotification: React.FC = () => {
  const { isOnline, wasOffline, dismissReconnectNotice } = useNetworkStatus();

  useEffect(() => {
    if (isOnline && wasOffline) {
      const timer = setTimeout(() => {
        dismissReconnectNotice();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, dismissReconnectNotice]);

  if (!isOnline || !wasOffline) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] bg-emerald-950/95 border border-emerald-500/30 text-emerald-100 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
          <Wifi className="w-4 h-4 animate-bounce" />
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-300">Back Online</p>
          <p className="text-xs text-emerald-100/80">
            Connection restored. AI features are ready.
          </p>
        </div>
      </div>
      <button
        onClick={dismissReconnectNotice}
        className="p-1 rounded-lg hover:bg-emerald-900/50 text-emerald-400 hover:text-emerald-200 transition"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
