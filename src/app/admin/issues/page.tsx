'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Bug, AlertCircle, CheckCircle2, Clock, XCircle, Loader2, Save, ExternalLink, ShieldAlert, ArrowLeft, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface IssueReportItem {
  id: string;
  user_id: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  description: string;
  page_url: string | null;
  user_agent: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'wont_fix';
  admin_note: string | null;
  created_at: string;
}

export default function AdminIssuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [reports, setReports] = useState<IssueReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchReports = React.useCallback(async (status: string) => {
    setLoadingData(true);
    try {
      const url = `/api/admin/issues?status=${status}`;
      const res = await fetch(url);
      if (res.status === 403 || res.status === 401) {
        setIsAdmin(false);
        setLoadingData(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load issues');

      const data = await res.json();
      const items: IssueReportItem[] = data.items || [];
      setReports(items);

      // Initialize note edit buffers
      const initialNotes: Record<string, string> = {};
      items.forEach((item) => {
        initialNotes[item.id] = item.admin_note || '';
      });
      setNoteValues(initialNotes);
    } catch {
      toast.error('Failed to load issue reports');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetch('/api/admin/bootstrap')
          .then((res) => res.json())
          .then((data) => {
            if (data?.is_admin) {
              setIsAdmin(true);
              fetchReports('all');
            } else {
              setIsAdmin(false);
              setLoadingData(false);
            }
          })
          .catch(() => {
            setIsAdmin(false);
            setLoadingData(false);
          });
      } else {
        setIsAdmin(false);
        setLoadingData(false);
      }
    }
  }, [user, authLoading, fetchReports]);

  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    fetchReports(newStatus);
  };

  const handleStatusUpdate = async (issueId: string, newStatus: string) => {
    setActionLoadingId(issueId);
    try {
      const res = await fetch(`/api/admin/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setReports((prev) =>
        prev.map((item) =>
          item.id === issueId ? { ...item, status: newStatus as any } : item
        )
      );
      toast.success(`Issue status changed to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveNote = async (issueId: string) => {
    setActionLoadingId(issueId);
    const noteText = noteValues[issueId] || '';
    try {
      const res = await fetch(`/api/admin/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: noteText.trim() || null }),
      });

      if (!res.ok) throw new Error('Failed to save note');

      setReports((prev) =>
        prev.map((item) =>
          item.id === issueId ? { ...item, admin_note: noteText.trim() || null } : item
        )
      );
      setEditingNoteId(null);
      toast.success('Admin note saved');
    } catch {
      toast.error('Failed to save admin note');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#121316] text-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#2CB7A5]" />
        <p className="text-xs text-muted-foreground">Authenticating administrator access...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-[#121316] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1C1D22] border border-red-500/30 rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-red-300">403 Forbidden</h1>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              This internal admin route (<code className="text-red-300">/admin/issues</code>) is strictly restricted to designated administrator accounts.
            </p>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2CB7A5] text-[#121316] font-semibold text-xs hover:bg-[#2CB7A5]/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const counts = {
    total: reports.length,
    open: reports.filter((r) => r.status === 'open').length,
    reviewing: reports.filter((r) => r.status === 'reviewing').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    wont_fix: reports.filter((r) => r.status === 'wont_fix').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30"><AlertCircle className="w-3 h-3" /> Open</span>;
      case 'reviewing':
        return <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30"><Clock className="w-3 h-3" /> Reviewing</span>;
      case 'resolved':
        return <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
      case 'wont_fix':
        return <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-gray-500/15 text-gray-400 font-semibold border border-gray-500/30"><XCircle className="w-3 h-3" /> Won&apos;t Fix</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#121316] text-white p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2CB7A5]/15 text-[#2CB7A5]">
              <Bug className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Review user bug reports, app feedback, and manage system status.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 bg-[#1C1D22] p-1.5 rounded-2xl border border-white/10 shrink-0">
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Admin Panel</span>
          </Link>
          <div className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2CB7A5] text-[#121316] shadow-sm flex items-center gap-2">
            <Bug className="w-3.5 h-3.5" /> Issue Reports
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-[#1C1D22] border border-white/10 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Total Reports</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#1C1D22] border border-amber-500/20 space-y-1">
          <div className="text-xs font-medium text-amber-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Open</div>
          <div className="text-2xl font-bold text-amber-200">{counts.open}</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#1C1D22] border border-blue-500/20 space-y-1">
          <div className="text-xs font-medium text-blue-300 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Reviewing</div>
          <div className="text-2xl font-bold text-blue-200">{counts.reviewing}</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#1C1D22] border border-emerald-500/20 space-y-1">
          <div className="text-xs font-medium text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Resolved</div>
          <div className="text-2xl font-bold text-emerald-200">{counts.resolved}</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#1C1D22] border border-gray-500/20 space-y-1">
          <div className="text-xs font-medium text-gray-400 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Won&apos;t Fix</div>
          <div className="text-2xl font-bold text-gray-300">{counts.wont_fix}</div>
        </div>
      </div>

      {/* Filters & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-[#1C1D22] p-1 rounded-2xl border border-white/10 text-xs">
          {[
            { key: 'all', label: 'All Statuses' },
            { key: 'open', label: 'Open' },
            { key: 'reviewing', label: 'Reviewing' },
            { key: 'resolved', label: 'Resolved' },
            { key: 'wont_fix', label: "Won't Fix" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
                statusFilter === f.key
                  ? 'bg-[#2CB7A5] text-[#121316]'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchReports(statusFilter)}
          disabled={loadingData}
          className="px-3.5 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} /> Refresh List
        </button>
      </div>

      {/* Issues List */}
      {loadingData ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2CB7A5]" />
          <p className="text-xs text-muted-foreground">Loading issue reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 text-muted-foreground space-y-2">
          <Bug className="w-10 h-10 mx-auto opacity-30 text-[#2CB7A5]" />
          <div className="font-semibold text-white">No issue reports found</div>
          <p className="text-xs">No user bug reports match the selected status filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-5 rounded-3xl bg-[#1C1D22] border border-white/10 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-white">{report.user.name || 'User'}</span>
                    <span className="text-muted-foreground">({report.user.email})</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Submitted: {new Date(report.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(report.status)}

                  {/* Status Change Dropdown */}
                  <select
                    value={report.status}
                    disabled={actionLoadingId === report.id}
                    onChange={(e) => handleStatusUpdate(report.id, e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-medium focus:outline-none focus:border-[#2CB7A5] cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                    <option value="wont_fix">Won&apos;t Fix</option>
                  </select>
                </div>
              </div>

              {/* Description Body */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Issue Description</div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed p-3.5 rounded-2xl bg-black/30 border border-white/5">
                  {report.description}
                </p>
              </div>

              {/* Context Info: Page URL & User Agent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-semibold text-muted-foreground">Page URL:</span>{' '}
                  {report.page_url ? (
                    <a
                      href={report.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2CB7A5] hover:underline inline-flex items-center gap-1 break-all"
                    >
                      {report.page_url} <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground/60">Not captured</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">User Agent:</span>{' '}
                  <span className="text-muted-foreground/80 break-all">{report.user_agent || 'Not captured'}</span>
                </div>
              </div>

              {/* Admin Note Section */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Admin Tracking Note</span>
                  {editingNoteId !== report.id && (
                    <button
                      onClick={() => setEditingNoteId(report.id)}
                      className="text-xs text-[#2CB7A5] hover:underline font-semibold"
                    >
                      {report.admin_note ? 'Edit Note' : '+ Add Note'}
                    </button>
                  )}
                </div>

                {editingNoteId === report.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteValues[report.id] || ''}
                      onChange={(e) =>
                        setNoteValues((prev) => ({ ...prev, [report.id]: e.target.value }))
                      }
                      placeholder="Enter internal admin tracking note..."
                      rows={2}
                      className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs focus:outline-none focus:border-[#2CB7A5] resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveNote(report.id)}
                        disabled={actionLoadingId === report.id}
                        className="px-3.5 py-1.5 rounded-lg bg-[#2CB7A5] text-[#121316] font-semibold text-xs flex items-center gap-1.5 hover:bg-[#2CB7A5]/90 transition-colors disabled:opacity-50"
                      >
                        {actionLoadingId === report.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save Note
                      </button>
                    </div>
                  </div>
                ) : (
                  report.admin_note && (
                    <div className="p-2.5 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 text-xs text-[#2CB7A5]">
                      <span className="font-semibold">Admin Note:</span> {report.admin_note}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
