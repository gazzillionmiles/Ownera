'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BaseUserProfile } from '@/src/types/auth';
import {
  Society,
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
import { useServices, usePolls, useBookings } from '@/src/shared/hooks/useQueries';

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
  const isOrganizer = activeRole === 'organizer' || activeRole === 'secretary' || activeRole === 'committee';
  const isProvider = activeRole === 'provider';
  const isResident = !isOrganizer && !isProvider;
  const societyId = activeSociety?.id;

  const { data: services = [], refetch: refetchServices } = useServices(!isProvider);
  const { data: pollsData, isLoading: pollsLoading, refetch: refetchPolls } = usePolls(societyId, isProvider ? 'provider' : 'resident');
  const { data: residentBookings = [], refetch: refetchResBookings } = useBookings('resident', societyId, isResident && Boolean(societyId));
  const { data: organizerBookings = [], refetch: refetchOrgBookings } = useBookings('organizer', societyId, isOrganizer && Boolean(societyId));
  const { data: providerBookings = [], refetch: refetchProvBookings } = useBookings('provider', undefined, isProvider);

  const [providerProfile, setProviderProfile] = useState<Provider | null>(null);
  const [providerBids, setProviderBids] = useState<ProviderBid[]>([]);

  useEffect(() => {
    if (isProvider) {
      fetch('/api/providers?self=true')
        .then((r) => r.json())
        .then((d) => setProviderProfile(d.provider || null))
        .catch(() => {});
      fetch('/api/providers/bids')
        .then((r) => r.json())
        .then((d) => setProviderBids(d.bids || []))
        .catch(() => {});
    }
  }, [isProvider]);

  const polls = pollsData?.polls || [];
  const activePolls = pollsData?.active_polls || [];
  const myPolls = pollsData?.my_polls || [];
  const societyPolls = pollsData?.society_polls || [];
  const upcomingServices = pollsData?.upcoming_services || [];
  const previousCampaigns = pollsData?.previous_campaigns || [];

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
    refetchPolls();
  };

  const handleRefresh = useCallback(() => {
    refetchPolls();
    refetchServices();
    if (isResident) refetchResBookings();
    if (isOrganizer) refetchOrgBookings();
    if (isProvider) refetchProvBookings();
  }, [refetchPolls, refetchServices, refetchResBookings, refetchOrgBookings, refetchProvBookings, isResident, isOrganizer, isProvider]);

  const isInitialLoading = !isProvider && !societyId ? false : (pollsLoading && !pollsData);

  if (isInitialLoading) {
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
          userBookings={residentBookings}
          activeSociety={activeSociety}
          services={services}
          user={user}
          activeTab={activeTab}
          onVote={handleVote}
          onRefresh={handleRefresh}
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
          onRefresh={handleRefresh}
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
          onRefresh={handleRefresh}
          onTabChange={onTabChange}
        />
      )}

      {/* Join Society Modal */}
      <JoinSocietyModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={(society) => {
          onSocietyChange(society);
          handleRefresh();
        }}
      />
    </div>
  );
};
