'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ServiceCampaign,
  Society,
  ServiceCatalogItem,
  Booking,
  SocietyMember,
} from '@/src/types/ownera';
import { BaseUserProfile } from '@/src/types/auth';
import {
  Plus,
  Users,
  Calendar,
  CheckSquare,
  Building2,
  Key,
  ShieldCheck,
  X,
  Clock,
  Briefcase,
  Shield,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { CreatePollModal } from './CreatePollModal';
import { QuoteComparisonModal } from './QuoteComparisonModal';
import { InviteVendorModal } from './InviteVendorModal';
import { SecretaryApprovalCard } from './SecretaryApprovalCard';

interface OrganizerViewProps {
  polls: ServiceCampaign[];
  campaigns: ServiceCampaign[];
  activeSociety: Society | null;
  services: ServiceCatalogItem[];
  allBookings: Booking[];
  user: BaseUserProfile;
  activeTab: string;
  onVote: (pollId: string, option: string) => Promise<void>;
  onRefresh: () => void;
}

export const OrganizerView: React.FC<OrganizerViewProps> = ({
  polls,
  campaigns,
  activeSociety,
  services,
  allBookings,
  user,
  activeTab,
  onRefresh,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedCampaignForBids, setSelectedCampaignForBids] = useState<ServiceCampaign | null>(null);
  const [inviteVendorCamp, setInviteVendorCamp] = useState<ServiceCampaign | null>(null);

  // Members state
  const [members, setMembers] = useState<SocietyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invitation Form
  const [inviteRole, setInviteRole] = useState<'secretary' | 'committee' | 'resident'>('committee');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  // Transfer Secretary Form
  const [selectedNewSecretaryId, setSelectedNewSecretaryId] = useState('');
  const [oldSecretaryRole, setOldSecretaryRole] = useState<'committee' | 'resident'>('committee');
  const [isTransferring, setIsTransferring] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!activeSociety?.id) return;
    try {
      setLoadingMembers(true);
      const res = await fetch(`/api/societies/members?societyId=${activeSociety.id}`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [activeSociety]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSociety?.id) return;

    setIsInviting(true);
    try {
      const res = await fetch('/api/societies/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          societyId: activeSociety.id,
          email: inviteEmail.trim() || undefined,
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invitation');

      toast.success(`Invitation created for ${inviteRole}!`);
      setGeneratedInviteLink(data.invitation?.token || null);
    } catch (err: any) {
      toast.error(err.message || 'Error creating invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleTransferSecretary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSociety?.id || !selectedNewSecretaryId) {
      toast.error('Please select a member to transfer secretary role to');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch('/api/societies/transfer-secretary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          societyId: activeSociety.id,
          newSecretaryUserId: selectedNewSecretaryId,
          oldSecretaryRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to transfer secretary role');

      toast.success('Secretary role successfully transferred!');
      setIsTransferModalOpen(false);
      fetchMembers();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Error transferring secretary role');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleToggleMemberRole = async (member: SocietyMember) => {
    if (!activeSociety?.id) return;
    const targetRole = member.role === 'committee' ? 'resident' : 'committee';
    try {
      const res = await fetch('/api/societies/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          societyId: activeSociety.id,
          targetUserId: member.user_id,
          newRole: targetRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update member role');

      toast.success(`Updated role to ${targetRole}`);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Error updating member role');
    }
  };

  const currentUserMembership = members.find((m) => m.user_id === user.id);
  const isPrimarySecretary = currentUserMembership?.role === 'secretary';
  const pendingApprovals = campaigns.filter(
    (c) => c.secretary_approval_status === 'pending' && c.scope === 'society'
  );

  const totalConfirmedBookings = allBookings.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Header Stats */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#18191D] via-[#16171A] to-[#141518] border border-white/10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5" /> Society {isPrimarySecretary ? 'Secretary' : 'Committee'} Dashboard
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeSociety?.name || 'Society Hub'}
              </h1>
              <p className="text-xs text-zinc-400">
                {members.length} Registered {members.length === 1 ? 'Member' : 'Members'}
                {activeSociety?.invite_code ? ` • Invite Code: ` : ''}
                {activeSociety?.invite_code && (
                  <strong className="text-zinc-200 font-mono">{activeSociety.invite_code}</strong>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="px-4 py-3 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-200 font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition flex items-center gap-2"
              >
                <Key className="w-4 h-4 text-[#2CB7A5]" />
                <span>Invite</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition shadow-lg flex items-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Poll</span>
              </button>
            </div>
          </div>

          {/* Secretary Approval Queue Notice Card */}
          {pendingApprovals.length > 0 && (
            <SecretaryApprovalCard
              pendingPolls={pendingApprovals}
              onRefresh={onRefresh}
            />
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#18191D] border border-white/5 space-y-1">
              <div className="text-xs text-zinc-400">Active Polls &amp; Camps</div>
              <div className="text-3xl font-bold font-mono text-white">{campaigns.length}</div>
              <div className="text-[11px] text-[#2CB7A5]">In your society</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#18191D] border border-white/5 space-y-1">
              <div className="text-xs text-zinc-400">Pending Approvals</div>
              <div className="text-3xl font-bold font-mono text-amber-400">
                {pendingApprovals.length}
              </div>
              <div className="text-[11px] text-zinc-500">Awaiting sign-off</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#18191D] border border-white/5 space-y-1">
              <div className="text-xs text-zinc-400">Confirmed Bookings</div>
              <div className="text-3xl font-bold font-mono text-emerald-400">{totalConfirmedBookings}</div>
              <div className="text-[11px] text-zinc-500">Service slots taken</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#18191D] border border-white/5 space-y-1">
              <div className="text-xs text-zinc-400">Society Members</div>
              <div className="text-3xl font-bold font-mono text-white">{members.length}</div>
              <div className="text-[11px] text-zinc-500">Registered units</div>
            </div>
          </div>

          {/* Active Camps List with Vendor Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2CB7A5]" />
                <span>Society Service Campaigns</span>
              </h2>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#18191D] border border-white/5 text-zinc-400 text-xs">
                No active campaigns. Click &ldquo;Create Poll&rdquo; above to organize your first community deal.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-5 rounded-2xl bg-[#18191D] border border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] uppercase">
                        {camp.event_date}
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {camp.total_votes || camp.poll_votes?.length || camp.confirmed_count || 0} Residents Responded
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{camp.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {camp.selected_provider
                          ? `Selected Provider: ${camp.selected_provider.company_name} (₹${camp.current_price}/unit)`
                          : `${camp.bids?.length || camp.bids_count || 0} Vendor Offers received`}
                      </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setInviteVendorCamp(camp)}
                        className="flex-1 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        + Invite Vendor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForBids(camp)}
                        className="flex-1 py-2 rounded-xl bg-[#2CB7A5]/15 border border-[#2CB7A5]/30 text-xs font-bold text-[#2CB7A5] hover:bg-[#2CB7A5]/25 transition"
                      >
                        Review Offers ({camp.bids?.length || camp.bids_count || 0})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SOCIETY MEMBERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Society Members &amp; Leadership</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Manage secretary, committee members, and registered apartment units.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isPrimarySecretary && (
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs uppercase hover:bg-amber-500/20 transition flex items-center gap-1.5"
                >
                  <Shield className="w-4 h-4" />
                  <span>Transfer Secretary</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase hover:bg-[#25A08F] transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Member</span>
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#18191D] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Registered Residents &amp; Committee ({members.length})
              </span>
            </div>

            {members.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                {loadingMembers ? 'Loading members...' : 'No registered members found.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {members.map((m) => {
                  const isSec = m.role === 'secretary';
                  const isCom = m.role === 'committee';

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl bg-zinc-900/50 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800 text-white flex items-center justify-center font-bold text-xs">
                          {m.user_profile?.name ? m.user_profile.name[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{m.user_profile?.name || 'Resident'}</span>
                            <span className="text-xs font-mono text-zinc-400">Unit {m.unit_number || m.flat_number}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500">{m.user_profile?.email || 'Registered User'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                            isSec
                              ? 'bg-[#2CB7A5]/20 text-[#2CB7A5] border border-[#2CB7A5]/30'
                              : isCom
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {m.role}
                        </span>

                        {isPrimarySecretary && !isSec && (
                          <button
                            type="button"
                            onClick={() => handleToggleMemberRole(m)}
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 border border-white/10 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-700 transition"
                          >
                            {isCom ? 'Set as Resident' : 'Make Committee'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3 & 4: CAMPAIGNS & SCHEDULE */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'campaigns' || activeTab === 'schedule') && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {activeTab === 'campaigns' ? 'Society Service Campaigns' : 'Service Schedule'}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                {activeTab === 'campaigns'
                  ? 'Manage active demand polls, review vendor bids, and open resident booking slots.'
                  : 'Confirmed resident bookings across society campaigns.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create Poll</span>
            </button>
          </div>

          {activeTab === 'campaigns' ? (
            campaigns.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#16171B] space-y-3">
                <Layers className="w-10 h-10 text-zinc-500 mx-auto" />
                <div className="text-base font-bold text-white">No campaigns created yet</div>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  Click &ldquo;Create Poll&rdquo; to launch your society&apos;s first collective service deal.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-5 rounded-2xl bg-[#18191D] border border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] uppercase">
                        {camp.event_date}
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {camp.total_votes || camp.poll_votes?.length || camp.confirmed_count || 0} Residents Responded
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{camp.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {camp.selected_provider
                          ? `Selected Provider: ${camp.selected_provider.company_name} (₹${camp.current_price}/unit)`
                          : `${camp.bids?.length || camp.bids_count || 0} Vendor Offers received`}
                      </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setInviteVendorCamp(camp)}
                        className="flex-1 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        + Invite Vendor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForBids(camp)}
                        className="flex-1 py-2 rounded-xl bg-[#2CB7A5]/15 border border-[#2CB7A5]/30 text-xs font-bold text-[#2CB7A5] hover:bg-[#2CB7A5]/25 transition"
                      >
                        Review Offers ({camp.bids?.length || camp.bids_count || 0})
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            allBookings.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#16171B] space-y-3">
                <Calendar className="w-10 h-10 text-zinc-500 mx-auto" />
                <div className="text-base font-bold text-white">No confirmed bookings yet</div>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  When residents select time slots for approved camps, their schedule will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl bg-[#18191D] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-white/10">
                          Flat {b.flat_number}
                        </span>
                        <span className="text-xs font-semibold text-white">{b.campaign?.title || 'Service Camp'}</span>
                        <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#2CB7A5]" /> {b.slot?.slot_time || 'Service day timing'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Resident: {b.user_profile?.name || 'Resident'} • Quantity: {b.quantity} unit(s) • Amount: ₹{b.total_amount} (Direct on service day)
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full uppercase font-mono ${
                        b.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#2CB7A5]/20 text-[#2CB7A5] border border-[#2CB7A5]/30'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS - ALWAYS MOUNTED FOR ALL TABS */}
      {/* ------------------------------------------------------------- */}
      <CreatePollModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        activeSociety={activeSociety}
        services={services}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          onRefresh();
        }}
      />

      <QuoteComparisonModal
        isOpen={!!selectedCampaignForBids}
        onClose={() => setSelectedCampaignForBids(null)}
        campaign={selectedCampaignForBids}
        onSuccess={() => {
          setSelectedCampaignForBids(null);
          onRefresh();
        }}
      />

      <InviteVendorModal
        isOpen={!!inviteVendorCamp}
        onClose={() => setInviteVendorCamp(null)}
        campaign={inviteVendorCamp}
        onSuccess={() => {
          setInviteVendorCamp(null);
          onRefresh();
        }}
      />

      {/* Transfer Secretary Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span>Transfer Primary Secretary</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Select an active society member to become the new primary secretary.
              </p>
            </div>

            <form onSubmit={handleTransferSecretary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Select New Secretary
                </label>
                <select
                  value={selectedNewSecretaryId}
                  onChange={(e) => setSelectedNewSecretaryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                >
                  <option value="">-- Choose Society Member --</option>
                  {members
                    .filter((m) => m.user_id !== user.id)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user_profile?.name || 'Member'} (Unit {m.unit_number || m.flat_number}) - Current: {m.role}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Your New Role after transfer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOldSecretaryRole('committee')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                      oldSecretaryRole === 'committee'
                        ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-[#2CB7A5]'
                        : 'border-white/10 bg-zinc-900/60 text-zinc-400'
                    }`}
                  >
                    Committee Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setOldSecretaryRole('resident')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                      oldSecretaryRole === 'resident'
                        ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-[#2CB7A5]'
                        : 'border-white/10 bg-zinc-900/60 text-zinc-400'
                    }`}
                  >
                    Normal Resident
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isTransferring || !selectedNewSecretaryId}
                className="w-full py-3.5 rounded-2xl bg-amber-500 text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition disabled:opacity-50"
              >
                {isTransferring ? 'Transferring Role...' : 'Confirm Secretary Transfer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              type="button"
              onClick={() => {
                setIsInviteModalOpen(false);
                setGeneratedInviteLink(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-[#2CB7A5]" />
                <span>Invite Society Member</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Issue an invitation token with a designated role for your society.
              </p>
            </div>

            {generatedInviteLink ? (
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-[#2CB7A5]/30 space-y-3">
                <div className="text-xs font-bold text-[#2CB7A5]">Invitation Token Generated:</div>
                <div className="p-2.5 rounded-xl bg-black border border-white/10 text-xs font-mono text-zinc-200 select-all break-all">
                  {generatedInviteLink}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedInviteLink);
                    toast.success('Token copied to clipboard!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs"
                >
                  Copy Token
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvitation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Invited Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteRole('committee')}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition ${
                        inviteRole === 'committee'
                          ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-[#2CB7A5]'
                          : 'border-white/10 bg-zinc-900/60 text-zinc-400'
                      }`}
                    >
                      Committee
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole('resident')}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition ${
                        inviteRole === 'resident'
                          ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-[#2CB7A5]'
                          : 'border-white/10 bg-zinc-900/60 text-zinc-400'
                      }`}
                    >
                      Resident
                    </button>
                    {isPrimarySecretary && (
                      <button
                        type="button"
                        onClick={() => setInviteRole('secretary')}
                        className={`p-2 rounded-xl border text-xs font-semibold text-center transition ${
                          inviteRole === 'secretary'
                            ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-[#2CB7A5]'
                            : 'border-white/10 bg-zinc-900/60 text-zinc-400'
                        }`}
                      >
                        Secretary
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Recipient Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. member@society.in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isInviting}
                  className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition disabled:opacity-50"
                >
                  {isInviting ? 'Generating...' : 'Create Invitation Token'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
