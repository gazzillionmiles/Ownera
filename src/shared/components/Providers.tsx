"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { ThemeProvider } from "@/src/shared/components/ui/theme-provider";
import { AuthProvider } from "@/providers/AuthProvider";
import { NetworkStatusProvider } from "@/providers/NetworkStatusProvider";
import { OfflineBanner } from "@/src/shared/components/pwa/OfflineBanner";
import { ReconnectNotification } from "@/src/shared/components/pwa/ReconnectNotification";
import { InstallPWA } from "@/src/shared/components/pwa/InstallPWA";
import { ServiceWorkerRegister } from "@/src/shared/components/pwa/ServiceWorkerRegister";
import { ReferralTracker } from "@/src/shared/components/ReferralTracker";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  }));

  return (
    <ThemeProvider defaultTheme="dark">
      <NetworkStatusProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
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
