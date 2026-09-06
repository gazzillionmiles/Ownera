'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface NetworkStatusContextType {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType: string | null;
  rtt: number | null;
  wasOffline: boolean;
  checkConnection: () => Promise<boolean>;
  dismissReconnectNotice: () => void;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOnline: true,
  isSlowConnection: false,
  effectiveType: null,
  rtt: null,
  wasOffline: false,
  checkConnection: async () => true,
  dismissReconnectNotice: () => {},
});

interface NetworkInformation {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSlowConnection, setIsSlowConnection] = useState<boolean>(false);
  const [effectiveType, setEffectiveType] = useState<string | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  // Connection Quality Inspection
  const updateConnectionDetails = useCallback(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as unknown as {
      connection?: NetworkInformation;
      mozConnection?: NetworkInformation;
      webkitConnection?: NetworkInformation;
    };

    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (conn) {
      const type = conn.effectiveType || null;
      const connectionRtt = conn.rtt ?? null;
      const isSlow =
        type === 'slow-2g' ||
        type === '2g' ||
        type === '3g' ||
        (connectionRtt !== null && connectionRtt > 1500) ||
        (conn.downlink !== undefined && conn.downlink < 0.5);

      setEffectiveType(type);
      setRtt(connectionRtt);
      setIsSlowConnection(isSlow);
    }
  }, []);

  // Ping check for active fetch failure / connectivity verification
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    if (!navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    try {
      // Light ping to favicon or health endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/icons/favicon-16x16.png?ping=' + Date.now(), {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const online = res.ok;
      setIsOnline((prev) => {
        if (!prev && online) {
          setWasOffline(true);
        }
        return online;
      });
      return online;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    updateConnectionDetails();

    const handleOnline = () => {
      checkConnection().then((online) => {
        if (online) {
          setWasOffline(true);
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network connection object listener
    const nav = navigator as unknown as {
      connection?: {
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    };

    const conn = nav.connection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', updateConnectionDetails);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', updateConnectionDetails);
      }
    };
  }, [checkConnection, updateConnectionDetails]);

  const dismissReconnectNotice = useCallback(() => {
    setWasOffline(false);
  }, []);

  const value = React.useMemo(() => ({
    isOnline,
    isSlowConnection,
    effectiveType,
    rtt,
    wasOffline,
    checkConnection,
    dismissReconnectNotice,
  }), [
    isOnline,
    isSlowConnection,
    effectiveType,
    rtt,
    wasOffline,
    checkConnection,
    dismissReconnectNotice,
  ]);

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => useContext(NetworkStatusContext);
