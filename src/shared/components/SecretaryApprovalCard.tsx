'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  Loader2,
  Building2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCampaign } from '@/src/types/ownera';

interface SecretaryApprovalCardProps {
  pendingPolls: ServiceCampaign[];
  onRefresh: () => void;
}

export const SecretaryApprovalCard: React.FC<SecretaryApprovalCardProps> = ({
  pendingPolls,
  onRefresh,
}) => {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (pendingPolls.length === 0) return null;

  const handleAction = async (campaignId: string, action: 'approve' | 'reject') => {
    setActionLoadingId(campaignId);
    try {
      const res = await fetch(`/api/polls/${campaignId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          action,
          rejectionReason: action === 'reject' ? rejectReason.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval action failed');

      toast.success(data.message || `Campaign ${action}d!`);
      setRejectingId(null);
      setRejectReason('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Error processing approval');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-6 rounded-3xl border border-amber-500/30 bg-amber-500/5 space-y-4 shadow-xl animate-in fade-in">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
        <ShieldAlert className="w-4 h-4" />
        <span>Secretary Approval Required ({pendingPolls.length} Pending)</span>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed">
        The following society-wide campaigns were initiated by residents. Approve them to authorize vendor bidding, or reject if unsuited.
      </p>

      <div className="space-y-3 pt-1">
        {pendingPolls.map((poll) => {
          const isRejectingThis = rejectingId === poll.id;
          const creatorName = poll.creator_profile?.name || 'A Resident';

          return (
            <div
              key={poll.id}
              className="p-4 rounded-2xl bg-[#18191D] border border-white/10 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] uppercase">
                      {poll.service?.name || 'Service'}
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      Date: {poll.event_date}
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-white">{poll.title}</h4>
                </div>

                <div className="text-xs text-zinc-400">
                  Created by: <strong className="text-white">{creatorName}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Poll: &ldquo;{poll.poll_question}&rdquo;</span>
                <span className="font-mono font-bold text-[#2CB7A5]">
                  {poll.total_votes || poll.poll_votes?.length || 0} residents responded
                </span>
              </div>

              {isRejectingThis ? (
                <div className="p-3 rounded-xl bg-black/40 border border-red-500/20 space-y-2">
                  <label className="text-[11px] text-red-400 font-semibold block">
                    Reason for rejection (shared with resident)
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Society already has annual AC AMC..."
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-red-400"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setRejectingId(null)}
                      className="px-3 py-1 rounded-lg border text-xs text-zinc-400 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAction(poll.id, 'reject')}
                      disabled={actionLoadingId === poll.id}
                      className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setRejectingId(poll.id)}
                    disabled={actionLoadingId === poll.id}
                    className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => handleAction(poll.id, 'approve')}
                    disabled={actionLoadingId === poll.id}
                    className="px-5 py-2 rounded-xl bg-[#2CB7A5] text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center gap-1.5 shadow-md"
                  >
                    {actionLoadingId === poll.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Approve for Vendors</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
