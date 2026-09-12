'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, TrendingDown, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface AdminVendorIssue {
  id: string;
  society_id: string;
  provider_id: string | null;
  description: string;
  category: string;
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  resolution_notes?: string | null;
  created_at: string;
  society?: { id: string; name: string } | null;
  provider?: { id: string; company_name: string; verification_status: string; rating: number } | null;
  booking?: { flat_number?: string | null } | null;
}

interface TopOffender {
  providerId: string;
  providerName: string;
  total: number;
  unresolved: number;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  open: 'bg-slate-200 text-slate-700',
  investigating: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  escalated: 'bg-rose-200 text-rose-900',
};

export const AdminVendorIssuesPanel: React.FC = () => {
  const [issues, setIssues] = useState<AdminVendorIssue[]>([]);
  const [topOffenders, setTopOffenders] = useState<TopOffender[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, investigating: 0, resolved: 0, escalated: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchIssues = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/admin/vendor-issues?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load vendor issues');
      setIssues(data.issues || []);
      setStats(data.stats || { total: 0, open: 0, investigating: 0, resolved: 0, escalated: 0 });
      setTopOffenders(data.topOffenders || []);
    } catch (err: any) {
      toast.error(err.message || 'Error loading vendor issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues(statusFilter);
  }, [statusFilter, fetchIssues]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {(['total', 'open', 'investigating', 'resolved', 'escalated'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key === 'total' ? 'all' : key)}
            className={`p-4 rounded-2xl border shadow-xs text-left transition cursor-pointer ${
              (key === 'total' && statusFilter === 'all') || statusFilter === key
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200/80 text-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="text-2xl font-black font-mono">{(stats as any)[key]}</div>
            <div className="text-xs font-bold uppercase opacity-80">{key}</div>
          </button>
        ))}
      </div>

      {topOffenders.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>Vendors With the Most Unresolved Complaints</span>
          </h3>
          <div className="space-y-1.5">
            {topOffenders.filter((o) => o.total > 0).map((o) => (
              <div
                key={o.providerId}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <span className="font-bold text-slate-800">{o.providerName}</span>
                <span className="text-slate-500">
                  <strong className="text-rose-600">{o.unresolved}</strong> unresolved / {o.total} total
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading vendor issues...
        </div>
      ) : issues.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs text-slate-500 text-xs">
          No vendor complaints {statusFilter !== 'all' ? `with status "${statusFilter}"` : ''} found.
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    STATUS_BADGE_CLASSES[issue.status] || STATUS_BADGE_CLASSES.open
                  }`}
                >
                  {issue.status}
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">{issue.category}</span>
                {issue.provider?.company_name && (
                  <span className="text-xs font-extrabold text-blue-700">{issue.provider.company_name}</span>
                )}
                {issue.society?.name && (
                  <span className="text-xs text-slate-400">&bull; {issue.society.name}</span>
                )}
              </div>
              <p className="text-sm text-slate-800 font-medium">{issue.description}</p>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                {issue.booking?.flat_number && <span>&bull; Unit {issue.booking.flat_number}</span>}
              </div>
              {issue.resolution_notes && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                  Resolution note: {issue.resolution_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
