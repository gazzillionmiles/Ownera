'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  Loader2,
  Check,
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
    <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50/70 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Secretary Review Queue ({pendingPolls.length} Pending)</span>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100/80 text-amber-900 border border-amber-200/60 rounded-full">
          Committee Sign-Off
        </span>
      </div>

      <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
        The following campaigns have gathered resident interest. Authorize them to solicit competitive quotes from verified service partners, or decline if unsuitable.
      </p>

      <div className="space-y-3 pt-1">
        {pendingPolls.map((poll) => {
          const isRejectingThis = rejectingId === poll.id;
          const creatorName = poll.creator_profile?.name || 'A Resident';

          return (
            <div
              key={poll.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 uppercase border border-blue-100/60">
                      {poll.service?.name || 'Service'}
                    </span>
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5 px-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Date: {poll.event_date || 'Upcoming'}</span>
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900">{poll.title}</h4>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Proposed by: <strong className="text-slate-800 font-bold">{creatorName}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">Poll: &ldquo;{poll.poll_question}&rdquo;</span>
                <span className="font-bold text-blue-600 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{poll.total_votes || poll.poll_votes?.length || 0} residents responded</span>
                </span>
              </div>

              {isRejectingThis ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Reason for rejection (shared with resident)
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Society already has an active annual AMC..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => setRejectingId(null)}
                      className="min-h-[36px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAction(poll.id, 'reject')}
                      disabled={actionLoadingId === poll.id}
                      className="min-h-[36px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    onClick={() => setRejectingId(poll.id)}
                    disabled={actionLoadingId === poll.id}
                    className="min-h-[40px] px-4 py-2.5 rounded-xl border border-slate-200 hover:border-rose-300 text-xs font-bold text-rose-600 hover:bg-rose-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>

                  <button
                    onClick={() => handleAction(poll.id, 'approve')}
                    disabled={actionLoadingId === poll.id}
                    className="min-h-[40px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {actionLoadingId === poll.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                    <span>Approve &amp; Invite Bids</span>
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
