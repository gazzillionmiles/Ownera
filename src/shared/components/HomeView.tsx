'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BaseUserProfile } from '@/src/types/auth';
import {
  ServiceCampaign,
  Society,
  ServiceCatalogItem,
  Booking,
  Provider,
  ProviderBid,
  UserRole,
} from '@/src/types/ownera';
import { ResidentView } from './ResidentView';
import { OrganizerView } from './OrganizerView';
import { ProviderView } from './ProviderView';
import { JoinSocietyModal } from './JoinSocietyModal';
import { Loader2 } from 'lucide-react';

interface HomeViewProps {
  user: BaseUserProfile;
  activeRole: UserRole;
  activeTab: string;
  activeSociety: Society | null;
  onSocietyChange: (society: Society) => void;
  isJoinModalOpen: boolean;
  setIsJoinModalOpen: (open: boolean) => void;
  onTabChange?: (tab: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  activeRole,
  activeTab,
  activeSociety,
  onSocietyChange,
  isJoinModalOpen,
  setIsJoinModalOpen,
  onTabChange,
}) => {
  const [polls, setPolls] = useState<ServiceCampaign[]>([]);
  const [activePolls, setActivePolls] = useState<ServiceCampaign[]>([]);
  const [myPolls, setMyPolls] = useState<ServiceCampaign[]>([]);
  const [societyPolls, setSocietyPolls] = useState<ServiceCampaign[]>([]);
  const [upcomingServices, setUpcomingServices] = useState<ServiceCampaign[]>([]);
  const [previousCampaigns, setPreviousCampaigns] = useState<ServiceCampaign[]>([]);

  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [organizerBookings, setOrganizerBookings] = useState<Booking[]>([]);
  const [providerBookings, setProviderBookings] = useState<Booking[]>([]);
  const [providerBids, setProviderBids] = useState<ProviderBid[]>([]);
  const [providerProfile, setProviderProfile] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  const isOrganizer = activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee';
  const isProvider = activeRole === 'provider';
  const isResident = !isOrganizer && !isProvider;

  const fetchAllData = useCallback(async () => {
    // If not provider, wait for valid activeSociety id before executing society-scoped requests
    if (!isProvider && !activeSociety?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const societyParam = activeSociety?.id ? `?societyId=${activeSociety.id}` : '';
      const societyPrefix = activeSociety?.id ? `&societyId=${activeSociety.id}` : '';

      const promises: Promise<any>[] = [];

      // 1. Services Catalog & Polls/Campaigns (relevant for resident and organizer)
      if (!isProvider) {
        promises.push(
          fetch('/api/services')
            .then((r) => r.json())
            .then((servData) => {
              setServices(servData.services || []);
            })
            .catch(() => {})
        );

        promises.push(
          fetch(`/api/polls${societyParam}`)
            .then((r) => r.json())
            .then((pollsData) => {
              setPolls(pollsData.polls || []);
              setActivePolls(pollsData.active_polls || []);
              setMyPolls(pollsData.my_polls || []);
              setSocietyPolls(pollsData.society_polls || []);
              setUpcomingServices(pollsData.upcoming_services || []);
              setPreviousCampaigns(pollsData.previous_campaigns || []);
            })
            .catch(() => {})
        );
      }

      // 2. Resident bookings (only for resident)
      if (isResident) {
        promises.push(
          fetch(`/api/bookings?role=resident${societyPrefix}`)
            .then((r) => r.json())
            .then((bookData) => {
              setUserBookings(bookData.bookings || []);
            })
            .catch(() => {})
        );
      }

      // 3. Organizer bookings (only for secretary / committee)
      if (isOrganizer) {
        promises.push(
          fetch(`/api/bookings?role=organizer${societyPrefix}`)
            .then((r) => r.json())
            .then((orgBookData) => {
              setOrganizerBookings(orgBookData.bookings || []);
            })
            .catch(() => {})
        );
      }

      // 4. Provider specific endpoints (only for provider)
      if (isProvider) {
        promises.push(
          fetch('/api/polls?role=provider')
            .then((r) => r.json())
            .then((pollsData) => {
              setPolls(pollsData.polls || []);
            })
            .catch(() => {}),
          fetch('/api/bookings?role=provider')
            .then((r) => r.json())
            .then((provBookData) => {
              setProviderBookings(provBookData.bookings || []);
            })
            .catch(() => {}),
          fetch('/api/providers?self=true')
            .then((r) => r.json())
            .then((provData) => {
              setProviderProfile(provData.provider || null);
            })
            .catch(() => {}),
          fetch('/api/providers/bids')
            .then((r) => r.json())
            .then((bidsData) => {
              setProviderBids(bidsData.bids || []);
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);
    } catch (err) {
      console.error('[HomeView] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSociety?.id, isOrganizer, isProvider, isResident]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleVote = async (pollId: string, option: string) => {
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        optionSelected: option,
        unitIdentifier: user.unitNumber || 'Resident Unit',
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record vote');
    }
    fetchAllData();
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#2CB7A5]" />
        <p className="text-xs text-zinc-400">Loading Ownera hub...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Dynamic Role Views */}
      {activeRole === 'resident' && (
        <ResidentView
          polls={polls}
          activePolls={activePolls}
          myPolls={myPolls}
          societyPolls={societyPolls}
          upcomingServices={upcomingServices}
          previousCampaigns={previousCampaigns}
          campaigns={polls}
          userBookings={userBookings}
          activeSociety={activeSociety}
          services={services}
          user={user}
          activeTab={activeTab}
          onVote={handleVote}
          onRefresh={fetchAllData}
          onOpenJoinModal={() => setIsJoinModalOpen(true)}
          onTabChange={onTabChange}
        />
      )}

      {(activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee') && (
        <OrganizerView
          polls={polls}
          campaigns={polls}
          activeSociety={activeSociety}
          services={services}
          allBookings={organizerBookings}
          user={user}
          activeTab={activeTab}
          onVote={handleVote}
          onRefresh={fetchAllData}
          onTabChange={onTabChange}
        />
      )}

      {activeRole === 'provider' && (
        <ProviderView
          campaigns={polls}
          providerBookings={providerBookings}
          providerBids={providerBids}
          providerProfile={providerProfile}
          user={user}
          activeTab={activeTab}
          onRefresh={fetchAllData}
          onTabChange={onTabChange}
        />
      )}

      {/* Join Society Modal */}
      <JoinSocietyModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={(society) => {
          onSocietyChange(society);
          fetchAllData();
        }}
      />
    </div>
  );
};
