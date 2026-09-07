'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import { DesktopShell } from '@/src/shared/components/DesktopShell';
import { ProviderView } from '@/src/shared/components/ProviderView';
import { Provider, ProviderBid, Booking, ServiceCampaign } from '@/src/types/ownera';
import { Loader2, Wrench, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PartnerDashboardPage() {
  const router = useRouter();
  const { uiUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('opportunities');
  const [providerProfile, setProviderProfile] = useState<Provider | null>(null);
  const [campaigns, setCampaigns] = useState<ServiceCampaign[]>([]);
  const [providerBids, setProviderBids] = useState<ProviderBid[]>([]);
  const [providerBookings, setProviderBookings] = useState<Booking[]>([]);

  const fetchProviderData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch provider profile
      const profRes = await fetch('/api/providers?self=true');
      const profData = await profRes.json();
      if (!profData.provider) {
        // Not registered as provider yet, route to registration
        router.replace('/partner/register');
        return;
      }
      setProviderProfile(profData.provider);

      // 2. Fetch invited campaigns / polls
      const campRes = await fetch('/api/polls?role=provider');
      const campData = await campRes.json();
      setCampaigns(campData.polls || []);

      // 3. Fetch provider bids
      const bidsRes = await fetch('/api/providers/bids');
      const bidsData = await bidsRes.json();
      setProviderBids(bidsData.bids || []);

      // 4. Fetch provider bookings / jobs
      const bookRes = await fetch('/api/bookings?role=provider');
      const bookData = await bookRes.json();
      setProviderBookings(bookData.bookings || []);
    } catch (err) {
      console.error('[PartnerDashboard] Error fetching provider data:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (uiUser.isLoggedIn) {
      fetchProviderData();
    }
  }, [uiUser.isLoggedIn, fetchProviderData]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading Service Partner Portal...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DesktopShell
        activeRole="provider"
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        user={uiUser}
      >
        <ProviderView
          campaigns={campaigns}
          providerBookings={providerBookings}
          providerBids={providerBids}
          providerProfile={providerProfile}
          user={uiUser}
          activeTab={activeTab}
          onRefresh={fetchProviderData}
          onTabChange={(tab) => setActiveTab(tab)}
        />
      </DesktopShell>
    </ProtectedRoute>
  );
}
