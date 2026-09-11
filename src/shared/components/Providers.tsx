'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { ThemeProvider } from '@/src/shared/components/ui/theme-provider';
import { AuthProvider } from '@/providers/AuthProvider';
import { NetworkStatusProvider } from '@/providers/NetworkStatusProvider';
import { OfflineBanner } from '@/src/shared/components/pwa/OfflineBanner';
import { ReconnectNotification } from '@/src/shared/components/pwa/ReconnectNotification';
import { InstallPWA } from '@/src/shared/components/pwa/InstallPWA';
import { ServiceWorkerRegister } from '@/src/shared/components/pwa/ServiceWorkerRegister';
import { ReferralTracker } from '@/src/shared/components/ReferralTracker';
import type { InitialAuthData } from '@/lib/auth/initial-auth';

export function Providers({
  children,
  initialAuth,
}: {
  children: React.ReactNode;
  initialAuth?: InitialAuthData;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      })
  );

  return (
    <ThemeProvider defaultTheme="light">
      <NetworkStatusProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider initialAuth={initialAuth}>
            <ReferralTracker />
            <ServiceWorkerRegister />
            {/* <OfflineBanner /> */}
            <ReconnectNotification />
            <InstallPWA />
            {children}
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </QueryClientProvider>
      </NetworkStatusProvider>
    </ThemeProvider>
  );
}
