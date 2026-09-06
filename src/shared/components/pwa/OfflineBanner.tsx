'use client';

import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/providers/NetworkStatusProvider';

export const OfflineBanner: React.FC = () => {
  const { isOnline, isSlowConnection, checkConnection } = useNetworkStatus();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnection();
    setTimeout(() => setIsRetrying(false), 500);
  };

  if (isOnline && !isSlowConnection) return null;

  return (
    <div className="w-full sticky top-0 z-50 transition-all duration-300">
      {!isOnline ? (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2 max-w-[80%]">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
            <span>
              <strong>Offline Mode:</strong> Cloud operations and sync require an active internet connection.
            </span>
          </div>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-2.5 py-1 bg-black/30 hover:bg-black/40 border border-white/20 rounded-lg flex items-center gap-1.5 transition active:scale-95 text-xs font-semibold shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Retry</span>
          </button>
        </div>
      ) : isSlowConnection ? (
        <div className="bg-amber-950/90 border-b border-amber-800/60 text-amber-200 px-4 py-2 shadow-sm flex items-center justify-between text-xs font-medium backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Weak connection detected. AI responses may take longer than usual.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
