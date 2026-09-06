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
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  activeRole,
  activeTab,
  activeSociety,
  onSocietyChange,
  isJoinModalOpen,
  setIsJoinModalOpen,
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

  const fetchAllData = useCallback(async () => {
    try {
      const societyParam = activeSociety?.id ? `?societyId=${activeSociety.id}` : '';
      const societyPrefix = activeSociety?.id ? `&societyId=${activeSociety.id}` : '';

      // 1. Fetch polls and campaigns
      const pollsRes = await fetch(`/api/polls${societyParam}`);
      const pollsData = await pollsRes.json();
      const fetchedPolls = pollsData.polls || [];

      setPolls(fetchedPolls);
      setActivePolls(pollsData.active_polls || []);
      setMyPolls(pollsData.my_polls || []);
      setSocietyPolls(pollsData.society_polls || []);
      setUpcomingServices(pollsData.upcoming_services || []);
      setPreviousCampaigns(pollsData.previous_campaigns || []);

      // 2. Fetch services catalog
      const servRes = await fetch('/api/services');
      const servData = await servRes.json();
      setServices(servData.services || []);

      // 3. Fetch bookings for current user
      const bookRes = await fetch(`/api/bookings?role=resident${societyPrefix}`);
      const bookData = await bookRes.json();
      setUserBookings(bookData.bookings || []);

      // 4. Fetch bookings for organizer in this society
      const orgBookRes = await fetch(`/api/bookings?role=organizer${societyPrefix}`);
      const orgBookData = await orgBookRes.json();
      setOrganizerBookings(orgBookData.bookings || []);

      // 5. Fetch bookings for provider
      const provBookRes = await fetch('/api/bookings?role=provider');
      const provBookData = await provBookRes.json();
      setProviderBookings(provBookData.bookings || []);

      // 6. Fetch provider profile & bids
      const provRes = await fetch('/api/providers?self=true');
      const provData = await provRes.json();
      setProviderProfile(provData.provider || null);

      const bidsRes = await fetch('/api/providers/bids');
      const bidsData = await bidsRes.json();
      setProviderBids(bidsData.bids || []);
    } catch (err) {
      console.error('[HomeView] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSociety]);

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
