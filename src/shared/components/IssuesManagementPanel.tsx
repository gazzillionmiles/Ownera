'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceIssue } from '@/src/types/ownera';

interface IssuesManagementPanelProps {
  societyId: string;
}

const STATUS_OPTIONS: { value: ServiceIssue['status']; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  open: 'bg-slate-200 text-slate-700',
  investigating: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  escalated: 'bg-rose-200 text-rose-900',
};

export const IssuesManagementPanel: React.FC<IssuesManagementPanelProps> = ({ societyId }) => {
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<Record<string, ServiceIssue['status']>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!societyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ societyId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/service-issues?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load issue reports');
      setIssues(data.issues || []);
    } catch (err: any) {
      toast.error(err.message || 'Error loading issue reports');
    } finally {
      setLoading(false);
    }
  }, [societyId, statusFilter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleExpand = (issue: ServiceIssue) => {
    if (expandedId === issue.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(issue.id);
    setDraftStatus((prev) => ({ ...prev, [issue.id]: prev[issue.id] || issue.status }));
    setDraftNotes((prev) => ({ ...prev, [issue.id]: prev[issue.id] ?? (issue.resolution_notes || '') }));
  };

  const handleSave = async (issue: ServiceIssue) => {
    setSavingId(issue.id);
    try {
      const res = await fetch(`/api/service-issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: draftStatus[issue.id] || issue.status,
          resolutionNotes: draftNotes[issue.id] ?? issue.resolution_notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update issue');

      toast.success('Issue report updated.');
      setExpandedId(null);
      fetchIssues();
    } catch (err: any) {
      toast.error(err.message || 'Error updating issue');
    } finally {
      setSavingId(null);
    }
  };

  const counts = {
    all: issues.length,
    open: issues.filter((i) => i.status === 'open').length,
    investigating: issues.filter((i) => i.status === 'investigating').length,
    resolved: issues.filter((i) => i.status === 'resolved').length,
    escalated: issues.filter((i) => i.status === 'escalated').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Reported Issues</span>
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'open', 'investigating', 'resolved', 'escalated'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase transition cursor-pointer border ${
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s} {s !== 'all' ? `(${(counts as any)[s]})` : `(${counts.all})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading issue reports...
        </div>
      ) : issues.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs text-slate-500 text-xs">
          No vendor issues reported {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'for this society'} yet.
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const isExpanded = expandedId === issue.id;
            return (
              <div
                key={issue.id}
                className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleExpand(issue)}
                  className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left cursor-pointer hover:bg-slate-50/60 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          STATUS_BADGE_CLASSES[issue.status] || STATUS_BADGE_CLASSES.open
                        }`}
                      >
                        {issue.status}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 uppercase">{issue.category}</span>
                      {issue.booking?.campaign?.title && (
                        <span className="text-xs text-slate-400">&bull; {issue.booking.campaign.title}</span>
                      )}
                      {issue.provider?.company_name && (
                        <span className="text-xs font-semibold text-blue-700">&bull; {issue.provider.company_name}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 font-medium truncate max-w-xl">{issue.description}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>
                        Reported by {issue.user_profile?.name || 'Resident'}
                        {issue.booking?.flat_number ? ` (Unit ${issue.booking.flat_number})` : ''}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-4 pt-0 space-y-3 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 mt-3">
                        Update Status
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setDraftStatus((prev) => ({ ...prev, [issue.id]: opt.value }))
                            }
                            className={`py-2 rounded-xl text-xs font-bold text-center transition cursor-pointer border ${
                              (draftStatus[issue.id] || issue.status) === opt.value
                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Resolution Note (visible to the resident)
                      </label>
                      <textarea
                        value={draftNotes[issue.id] ?? ''}
                        onChange={(e) =>
                          setDraftNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="e.g. Vendor has been contacted and will redo the job on Saturday."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSave(issue)}
                      disabled={savingId === issue.id}
                      className="w-full min-h-[40px] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingId === issue.id ? 'Saving...' : 'Save Update'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
