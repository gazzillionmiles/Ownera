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
  ArrowRight,
  Check,
  Copy,
  RefreshCw,
  Link2,
  Loader2,
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
  onTabChange?: (tab: string) => void;
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
  onTabChange,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedCampaignForBids, setSelectedCampaignForBids] = useState<ServiceCampaign | null>(null);
  const [inviteVendorCamp, setInviteVendorCamp] = useState<ServiceCampaign | null>(null);

  // Members state
  const [members, setMembers] = useState<SocietyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invite Link (replaces the old role-selectable invitation token flow)
  const [inviteJoinPath, setInviteJoinPath] = useState<string | null>(null);
  const [loadingInviteLink, setLoadingInviteLink] = useState(false);
  const [isRotatingLink, setIsRotatingLink] = useState(false);

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

  const fetchInviteLink = useCallback(async () => {
    if (!activeSociety?.id) return;
    setLoadingInviteLink(true);
    try {
      const res = await fetch(`/api/societies/invite-link?societyId=${activeSociety.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invite link');
      setInviteJoinPath(data.joinPath || null);
    } catch (err: any) {
      toast.error(err.message || 'Error loading invite link');
    } finally {
      setLoadingInviteLink(false);
    }
  }, [activeSociety]);

  useEffect(() => {
    if (isInviteModalOpen) {
      fetchInviteLink();
    }
  }, [isInviteModalOpen, fetchInviteLink]);

  const handleRotateInviteLink = async () => {
    if (!activeSociety?.id) return;
    setIsRotatingLink(true);
    try {
      const res = await fetch('/api/societies/invite-link/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ societyId: activeSociety.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate a new link');

      setInviteJoinPath(data.joinPath || null);
      toast.success('New invite link generated — the old one no longer works.');
    } catch (err: any) {
      toast.error(err.message || 'Error generating new link');
    } finally {
      setIsRotatingLink(false);
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Header Stats */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Society {isPrimarySecretary ? 'Secretary' : 'Committee'} Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {activeSociety?.name || 'Society Hub'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {members.length} Registered Members
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 border border-slate-200 cursor-pointer"
              >
                <Key className="w-4 h-4 text-blue-600" />
                <span>Invite</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Propose Campaign</span>
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
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
              <div className="text-xs font-bold text-slate-500">Active Services</div>
              <div className="text-3xl font-black font-mono text-slate-900">{campaigns.length}</div>
              <div className="text-xs font-semibold text-blue-600">In society hub</div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
              <div className="text-xs font-bold text-slate-500">Pending Approvals</div>
              <div className="text-3xl font-black font-mono text-amber-600">
                {pendingApprovals.length}
              </div>
              <div className="text-xs font-semibold text-slate-400">Awaiting review</div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
              <div className="text-xs font-bold text-slate-500">Confirmed Bookings</div>
              <div className="text-3xl font-black font-mono text-emerald-600">{totalConfirmedBookings}</div>
              <div className="text-xs font-semibold text-slate-400">Slots reserved</div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
              <div className="text-xs font-bold text-slate-500">Members</div>
              <div className="text-3xl font-black font-mono text-slate-900">{members.length}</div>
              <div className="text-xs font-semibold text-slate-400">Registered units</div>
            </div>
          </div>

          {/* Active Campaigns List with Vendor Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span>Society Service Campaigns</span>
              </h2>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs text-slate-500 text-xs">
                No active campaigns. Click &ldquo;Propose Campaign&rdquo; above to organize your first community deal.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 uppercase border border-blue-100/60">
                        {camp.event_date || 'Upcoming'}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        {camp.total_votes || camp.poll_votes?.length || camp.confirmed_count || 0} Residents Pledged
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug">{camp.title}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {camp.selected_provider
                          ? `Partner: ${camp.selected_provider.company_name} • Quote accepted`
                          : `${camp.bids?.length || camp.bids_count || 0} Vendor Offers received`}
                      </p>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setInviteVendorCamp(camp)}
                        className="flex-1 min-w-[120px] min-h-[40px] py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition flex items-center justify-center cursor-pointer"
                      >
                        + Invite Vendor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForBids(camp)}
                        className={`flex-1 min-w-[120px] min-h-[40px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          (camp.bids?.length || camp.bids_count || 0) > 0
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            : 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700'
                        }`}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Members &amp; Leadership</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Manage committee members, invite residents, and monitor registered apartment units.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isPrimarySecretary && (
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-50 dark:!bg-amber-50 border border-amber-200 dark:border-amber-200 text-amber-900 dark:!text-amber-900 font-bold text-xs uppercase hover:bg-amber-100 dark:hover:!bg-amber-100 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Transfer Secretary</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Member</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Registered Residents &amp; Committee ({members.length})
              </span>
            </div>

            {members.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
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
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black text-xs shadow-2xs">
                          {m.user_profile?.name ? m.user_profile.name[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">{m.user_profile?.name || 'Resident'}</span>
                            <span className="text-xs font-bold text-slate-500">Unit {m.unit_number || m.flat_number}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">{m.user_profile?.email || 'Registered Member'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            isSec
                              ? 'bg-amber-100 dark:!bg-amber-100 text-amber-900 dark:!text-amber-900 border border-amber-200 dark:border-amber-200'
                              : isCom
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-slate-200/80 text-slate-700 dark:!text-slate-700'
                          }`}
                        >
                          {m.role}
                        </span>

                        {isPrimarySecretary && !isSec && (
                          <button
                            type="button"
                            onClick={() => handleToggleMemberRole(m)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {isCom ? 'Set as Resident' : 'Promote to Committee'}
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {activeTab === 'campaigns' ? 'My Actions & Campaigns' : 'Service Schedule'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                {activeTab === 'campaigns'
                  ? 'Review pending approvals, compare vendor bids, and manage service campaigns.'
                  : 'Confirmed resident bookings and technician dispatch schedule.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Propose Campaign</span>
            </button>
          </div>

          {/* Secretary Approval Queue Notice Card */}
          {activeTab === 'campaigns' && pendingApprovals.length > 0 && (
            <SecretaryApprovalCard
              pendingPolls={pendingApprovals}
              onRefresh={onRefresh}
            />
          )}

          {activeTab === 'campaigns' ? (
            campaigns.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-3">
                <Layers className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="text-base font-bold text-slate-900">No campaigns created yet</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Click &ldquo;Propose Campaign&rdquo; to launch your society&apos;s first collective service deal.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 uppercase border border-blue-100/60">
                        {camp.event_date || 'Upcoming'}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        {camp.total_votes || camp.poll_votes?.length || camp.confirmed_count || 0} Residents Pledged
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug">{camp.title}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {camp.selected_provider
                          ? `Partner: ${camp.selected_provider.company_name} • Quote accepted`
                          : `${camp.bids?.length || camp.bids_count || 0} Vendor Offers received`}
                      </p>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setInviteVendorCamp(camp)}
                        className="flex-1 min-w-[120px] min-h-[40px] py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition flex items-center justify-center cursor-pointer"
                      >
                        + Invite Vendor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForBids(camp)}
                        className={`flex-1 min-w-[120px] min-h-[40px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          (camp.bids?.length || camp.bids_count || 0) > 0
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            : 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700'
                        }`}
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
              <div className="p-10 text-center rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-3">
                <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="text-base font-bold text-slate-900">No confirmed bookings yet</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  When residents select arrival slots for confirmed camps, their schedule will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                          Unit {b.flat_number}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">{b.campaign?.title || 'Service Camp'}</span>
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {b.slot?.slot_time || 'Service day timing'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Resident: <strong className="text-slate-800">{b.user_profile?.name || 'Resident'}</strong> • Quantity: {b.quantity} unit(s) • Amount: <strong className="text-emerald-600">₹{b.total_amount}</strong>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full uppercase border shrink-0 ${
                        b.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
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
      {/* MODALS */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Transfer Primary Secretary</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Select an active society member to become the new primary secretary.
              </p>
            </div>

            <form onSubmit={handleTransferSecretary} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Select New Secretary
                </label>
                <select
                  value={selectedNewSecretaryId}
                  onChange={(e) => setSelectedNewSecretaryId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Your New Role after transfer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOldSecretaryRole('committee')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                      oldSecretaryRole === 'committee'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Committee Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setOldSecretaryRole('resident')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                      oldSecretaryRole === 'resident'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Normal Resident
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isTransferring || !selectedNewSecretaryId}
                className="w-full min-h-[44px] py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 font-black text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isTransferring ? 'Transferring Role...' : 'Confirm Secretary Transfer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-600" />
                <span>Invite Society Members</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Share this link — anyone who signs up through it joins as a resident. You can promote them to committee or secretary afterwards from the Members tab.
              </p>
            </div>

            {loadingInviteLink ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading your invite link...
              </div>
            ) : inviteJoinPath ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-emerald-700">Your Society&apos;s Invite Link:</div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 select-all break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}${inviteJoinPath}` : inviteJoinPath}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const fullLink = typeof window !== 'undefined' ? `${window.location.origin}${inviteJoinPath}` : inviteJoinPath;
                    navigator.clipboard.writeText(fullLink);
                    toast.success('Invite link copied to clipboard!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Invite Link</span>
                </button>
                {isPrimarySecretary && (
                  <button
                    type="button"
                    onClick={handleRotateInviteLink}
                    disabled={isRotatingLink}
                    className="w-full py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isRotatingLink ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Generate New Link (old one stops working)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-red-500">
                Couldn&apos;t load an invite link. Please try again.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
