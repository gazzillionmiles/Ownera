'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Wrench,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Check,
  Ban,
  Shield,
  Loader2,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';
import { AdminVendorIssuesPanel } from '@/src/shared/components/AdminVendorIssuesPanel';

interface SocietyItem {
  id: string;
  name: string;
  slug: string;
  city: string;
  state?: string;
  total_homes: number;
  created_at: string;
  member_count: number;
  total_campaigns_count: number;
  active_campaigns_count: number;
  confirmed_bookings_count: number;
  secretary?: {
    user_id: string;
    flat_number: string;
    role: string;
    status: string;
    user_profile?: {
      name: string;
      email: string;
      phone: string;
    };
  };
}

interface ProviderItem {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  services_offered: string[];
  operating_cities: string[];
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'banned';
  rating: number;
  total_jobs_completed: number;
  bio?: string | null;
  created_at: string;
}

interface ProviderStats {
  total: number;
  pending: number;
  verified: number;
  banned: number;
  rejected: number;
}

interface SocietyDetailModalData {
  id: string;
  name: string;
  slug: string;
  city: string;
  state?: string;
  total_homes: number;
  total_members_count: number;
  total_bookings_count: number;
  created_at: string;
  members: {
    id: string;
    flat_number: string;
    role: string;
    status: string;
    created_at: string;
    profile?: {
      name: string;
      email: string;
      phone: string;
    };
  }[];
  campaigns: {
    id: string;
    title: string;
    status: string;
    event_date: string;
    current_price: number;
    target_customers: number;
    service?: { name: string };
  }[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { uiUser, loading: authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminRole, setAdminRole] = useState<string>('user');
  const [activeTab, setActiveTab] = useState<'societies' | 'vendors' | 'vendor-issues' | 'admins'>('societies');

  // Societies State
  const [societies, setSocieties] = useState<SocietyItem[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(false);
  const [societySearch, setSocietySearch] = useState('');
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null);
  const [societyDetailData, setSocietyDetailData] = useState<SocietyDetailModalData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Providers State
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [providerStats, setProviderStats] = useState<ProviderStats>({ total: 0, pending: 0, verified: 0, banned: 0, rejected: 0 });
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const [providerStatusFilter, setProviderStatusFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Ban confirmation modal state
  const [vendorToBan, setVendorToBan] = useState<ProviderItem | null>(null);

  // 1. Verify Database Administrator Status
  useEffect(() => {
    if (!authLoading) {
      if (uiUser.isLoggedIn) {
        fetch('/api/admin/bootstrap')
          .then((res) => res.json())
          .then((data) => {
            if (data?.is_admin) {
              setIsAdmin(true);
              setAdminRole(data.role || 'platform_admin');
            } else {
              setIsAdmin(false);
            }
          })
          .catch(() => {
            setIsAdmin(false);
          });
      } else {
        setIsAdmin(false);
      }
    }
  }, [uiUser.isLoggedIn, authLoading]);

  // 2. Fetch Societies Data
  const fetchSocieties = useCallback(async () => {
    setLoadingSocieties(true);
    try {
      const res = await fetch('/api/admin/societies');
      if (!res.ok) throw new Error('Failed to fetch societies');
      const data = await res.json();
      setSocieties(data.societies || []);
    } catch (err: any) {
      toast.error(err.message || 'Error loading societies');
    } finally {
      setLoadingSocieties(false);
    }
  }, []);

  // 3. Fetch Providers Data
  const fetchProviders = useCallback(async (status = 'all', search = '') => {
    setLoadingProviders(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/providers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch providers');
      const data = await res.json();
      setProviders(data.providers || []);
      if (data.stats) setProviderStats(data.stats);
    } catch (err: any) {
      toast.error(err.message || 'Error loading vendors');
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchSocieties();
      fetchProviders();
    }
  }, [isAdmin, fetchSocieties, fetchProviders]);

  // 4. Fetch Society Detail when modal opened
  const handleOpenSocietyDetail = async (societyId: string) => {
    setSelectedSocietyId(societyId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/societies/${societyId}`);
      if (!res.ok) throw new Error('Failed to load society details');
      const data = await res.json();
      setSocietyDetailData(data.society);
    } catch (err: any) {
      toast.error(err.message || 'Error fetching society details');
      setSelectedSocietyId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 5. Vendor Moderation Actions (Approve, Reject, Ban, Unban)
  const handleVendorAction = async (providerId: string, action: 'approve' | 'reject' | 'ban' | 'unban') => {
    setActionLoadingId(providerId);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      toast.success(data.message || `Vendor status updated`);
      setVendorToBan(null);
      // Refresh providers list
      fetchProviders(providerStatusFilter, providerSearch);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update vendor');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Societies
  const filteredSocieties = societies.filter((s) => {
    const q = societySearch.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q)
    );
  });

  // Calculate platform totals
  const totalHomesCount = societies.reduce((acc, s) => acc + (s.total_homes || 0), 0);
  const totalMembersCount = societies.reduce((acc, s) => acc + (s.member_count || 0), 0);
  const totalActiveCampaigns = societies.reduce((acc, s) => acc + (s.active_campaigns_count || 0), 0);
  const totalConfirmedBookings = societies.reduce((acc, s) => acc + (s.confirmed_bookings_count || 0), 0);

  // --- Auth / Access Restriction Loading & Fallback ---
  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-xs font-semibold text-slate-500">Verifying administrator authorization...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Access Restricted</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          This portal is restricted to authorized platform administrators configured in the database (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">platform_admins</code> table). Your account lacks administrative privileges.
        </p>
        <Link
          href="/home"
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm inline-flex items-center gap-2"
        >
          <span>Return to Society Hub</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans pb-20">
      {/* Top Admin Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                      {APP_NAME} Admin
                    </span>
                    <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {adminRole}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium hidden sm:block">
                    Database-backed Platform Operations
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (activeTab === 'societies') fetchSocieties();
                  if (activeTab === 'vendors') fetchProviders(providerStatusFilter, providerSearch);
                }}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Refresh current data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <Link
                href="/admin/issues"
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition hidden sm:flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Issue Reports</span>
              </Link>

              <Link
                href="/home"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Back to Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Admin Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => setActiveTab('societies')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'societies'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>All Societies ({societies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
                activeTab === 'vendors'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Vendors &amp; Approvals</span>
              {providerStats.pending > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'vendors' ? 'bg-amber-400 text-slate-950' : 'bg-amber-500 text-white'
                }`}>
                  {providerStats.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('vendor-issues')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
                activeTab === 'vendor-issues'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Vendor Issues</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Admin ID:</span>
            <code className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {uiUser.id.substring(0, 12)}...
            </code>
          </div>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: ALL SOCIETIES DATA */}
        {/* =================================================================== */}
        {activeTab === 'societies' && (
          <div className="space-y-6">
            {/* Top Overview Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
                <div className="text-xs font-bold text-slate-500">Total Societies</div>
                <div className="text-3xl font-black font-mono text-slate-900">{societies.length}</div>
                <div className="text-xs text-slate-400 font-medium">Active on Ownera</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
                <div className="text-xs font-bold text-slate-500">Total Units / Flats</div>
                <div className="text-3xl font-black font-mono text-blue-600">{totalHomesCount}</div>
                <div className="text-xs text-slate-400 font-medium">Covered households</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
                <div className="text-xs font-bold text-slate-500">Registered Members</div>
                <div className="text-3xl font-black font-mono text-emerald-600">{totalMembersCount}</div>
                <div className="text-xs text-slate-400 font-medium">Residents &amp; Leadership</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
                <div className="text-xs font-bold text-slate-500">Active Campaigns</div>
                <div className="text-3xl font-black font-mono text-amber-600">{totalActiveCampaigns}</div>
                <div className="text-xs text-slate-400 font-medium">{totalConfirmedBookings} confirmed bookings</div>
              </div>
            </div>

            {/* Societies Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={societySearch}
                  onChange={(e) => setSocietySearch(e.target.value)}
                  placeholder="Search society name, city, slug..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="text-xs text-slate-500 font-medium self-end sm:self-center">
                Showing <strong className="text-slate-900 font-bold">{filteredSocieties.length}</strong> of {societies.length} societies
              </div>
            </div>

            {/* Societies Data Table */}
            {loadingSocieties ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-500">Loading societies database records...</p>
              </div>
            ) : filteredSocieties.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2 text-slate-500 text-xs">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-800">No societies found matching &ldquo;{societySearch}&rdquo;</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                      <tr>
                        <th className="px-5 py-3.5">Society Name &amp; Slug</th>
                        <th className="px-4 py-3.5">Location</th>
                        <th className="px-4 py-3.5">Units / Members</th>
                        <th className="px-4 py-3.5">Campaigns</th>
                        <th className="px-4 py-3.5">Primary Secretary</th>
                        <th className="px-4 py-3.5">Created</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSocieties.map((soc) => (
                        <tr key={soc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-extrabold text-sm text-slate-900 leading-snug">{soc.name}</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">/s/{soc.slug}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-700 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{soc.city}{soc.state ? `, ${soc.state}` : ''}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-900 font-mono">
                              {soc.member_count} <span className="text-slate-400 font-sans font-normal">/ {soc.total_homes} units</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-700">
                              <span className="text-blue-600 font-bold">{soc.active_campaigns_count} active</span>
                              <span className="text-slate-400 text-[11px]"> ({soc.total_campaigns_count} total)</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {soc.secretary?.user_profile ? (
                              <div>
                                <div className="font-bold text-slate-800">{soc.secretary.user_profile.name}</div>
                                <div className="text-[11px] text-slate-400">{soc.secretary.user_profile.phone || soc.secretary.user_profile.email}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No active secretary</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-slate-400 font-mono text-[11px]">
                            {new Date(soc.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenSocietyDetail(soc.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-200"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: VENDORS & APPROVALS (UNDER REVIEW, VERIFIED, BANNED) */}
        {/* =================================================================== */}
        {activeTab === 'vendors' && (
          <div className="space-y-6">
            {/* Top Vendors Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1">
                <div className="text-xs font-bold text-slate-500">Total Vendors</div>
                <div className="text-3xl font-black font-mono text-slate-900">{providerStats.total}</div>
                <div className="text-xs text-slate-400 font-medium">Registered service providers</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-amber-200 bg-amber-50/40 shadow-sm space-y-1">
                <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Under Review</span>
                </div>
                <div className="text-3xl font-black font-mono text-amber-700">{providerStats.pending}</div>
                <div className="text-xs text-amber-900/70 font-semibold">Awaiting manual approval</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-emerald-200 bg-emerald-50/40 shadow-sm space-y-1">
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified &amp; Active</span>
                </div>
                <div className="text-3xl font-black font-mono text-emerald-700">{providerStats.verified}</div>
                <div className="text-xs text-emerald-900/70 font-semibold">Authorized to bid &amp; service</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-rose-200 bg-rose-50/40 shadow-sm space-y-1">
                <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  <span>Banned Accounts</span>
                </div>
                <div className="text-3xl font-black font-mono text-rose-700">{providerStats.banned}</div>
                <div className="text-xs text-rose-900/70 font-semibold">Suspended from platform</div>
              </div>
            </div>

            {/* Filter Bar & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: `All (${providerStats.total})` },
                  { id: 'pending', label: `Pending (${providerStats.pending})` },
                  { id: 'verified', label: `Verified (${providerStats.verified})` },
                  { id: 'banned', label: `Banned (${providerStats.banned})` },
                  { id: 'rejected', label: `Rejected (${providerStats.rejected})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setProviderStatusFilter(tab.id);
                      fetchProviders(tab.id, providerSearch);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      providerStatusFilter === tab.id
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => {
                    setProviderSearch(e.target.value);
                    fetchProviders(providerStatusFilter, e.target.value);
                  }}
                  placeholder="Search company, contact, phone, city..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Providers List */}
            {loadingProviders ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-500">Loading service providers...</p>
              </div>
            ) : providers.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2 text-slate-500 text-xs">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-800">No vendors found in &ldquo;{providerStatusFilter}&rdquo; status</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {providers.map((p) => {
                  const isPending = p.verification_status === 'pending' || p.verification_status === 'unverified';
                  const isVerified = p.verification_status === 'verified';
                  const isBanned = p.verification_status === 'banned';
                  const isRejected = p.verification_status === 'rejected';

                  return (
                    <div
                      key={p.id}
                      className={`p-6 rounded-2xl border transition-all space-y-4 ${
                        isPending
                          ? 'bg-amber-50/30 border-amber-200 shadow-sm'
                          : isBanned
                          ? 'bg-rose-50/30 border-rose-200 opacity-90'
                          : 'bg-white border-slate-200/80 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full uppercase border shrink-0 ${
                                isVerified
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isPending
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : isBanned
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {p.verification_status}
                            </span>

                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Registered: {new Date(p.created_at).toLocaleDateString()}</span>
                            </span>
                          </div>

                          <h3 className="text-lg font-black text-slate-900 leading-snug">{p.company_name}</h3>
                          <p className="text-xs text-slate-600 font-medium">Contact: <strong>{p.contact_person}</strong></p>
                        </div>

                        {/* Contact details */}
                        <div className="flex flex-col sm:items-end gap-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.phone}</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.email}</span>
                          </span>
                        </div>
                      </div>

                      {/* Bio & Details */}
                      {p.bio && (
                        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {p.bio}
                        </p>
                      )}

                      {/* Services & Cities */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Services Offered</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(p.services_offered || []).map((serv, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-100">
                                {serv}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Operating Cities</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(p.operating_cities || []).map((city, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                                {city}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Moderation Actions Row */}
                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVendorAction(p.id, 'reject')}
                              disabled={actionLoadingId === p.id}
                              className="min-h-[38px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVendorAction(p.id, 'approve')}
                              disabled={actionLoadingId === p.id}
                              className="min-h-[38px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approve &amp; Verify</span>
                            </button>
                          </>
                        )}

                        {isVerified && (
                          <>
                            <span className="text-xs text-emerald-700 font-semibold mr-auto flex items-center gap-1">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Active verified service provider</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setVendorToBan(p)}
                              disabled={actionLoadingId === p.id}
                              className="min-h-[38px] px-4 py-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Ban Vendor</span>
                            </button>
                          </>
                        )}

                        {isBanned && (
                          <>
                            <span className="text-xs text-rose-700 font-semibold mr-auto flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                              <span>Vendor banned &bull; All bidding locked</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleVendorAction(p.id, 'unban')}
                              disabled={actionLoadingId === p.id}
                              className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Unban &amp; Restore</span>
                            </button>
                          </>
                        )}

                        {isRejected && (
                          <button
                            type="button"
                            onClick={() => handleVendorAction(p.id, 'approve')}
                            disabled={actionLoadingId === p.id}
                            className="min-h-[38px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Re-Review &amp; Approve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: VENDOR ISSUES (Platform-wide complaint oversight) */}
        {/* =================================================================== */}
        {activeTab === 'vendor-issues' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Vendor Complaint Oversight</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                All resident-reported issues against service partners, across every society, so you can spot vendors worth de-listing.
              </p>
            </div>
            <AdminVendorIssuesPanel />
          </div>
        )}

        {/* =================================================================== */}
        {/* BAN CONFIRMATION MODAL */}
        {/* =================================================================== */}
        {vendorToBan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Ban className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-900">Ban Vendor User</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Are you sure you want to ban <strong>{vendorToBan.company_name}</strong>?
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium leading-relaxed">
                Banning this provider will immediately block their ability to submit bids, receive society invitations, or manage service schedules.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setVendorToBan(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVendorAction(vendorToBan.id, 'ban')}
                  disabled={actionLoadingId === vendorToBan.id}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>Confirm Ban</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SOCIETY DETAILS MODAL */}
        {/* =================================================================== */}
        {selectedSocietyId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xl space-y-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSocietyId(null);
                  setSocietyDetailData(null);
                }}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              {loadingDetail || !societyDetailData ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">Loading society breakdown...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                        /s/{societyDetailData.slug}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Created {new Date(societyDetailData.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{societyDetailData.name}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {societyDetailData.city}{societyDetailData.state ? `, ${societyDetailData.state}` : ''} &bull; {societyDetailData.total_homes} total units
                    </p>
                  </div>

                  {/* Quick Metrics */}
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div>
                      <div className="text-xl font-black font-mono text-slate-900">{societyDetailData.total_members_count}</div>
                      <div className="text-[11px] font-bold text-slate-500">Members</div>
                    </div>
                    <div>
                      <div className="text-xl font-black font-mono text-blue-600">{societyDetailData.campaigns.length}</div>
                      <div className="text-[11px] font-bold text-slate-500">Campaigns</div>
                    </div>
                    <div>
                      <div className="text-xl font-black font-mono text-emerald-600">{societyDetailData.total_bookings_count}</div>
                      <div className="text-[11px] font-bold text-slate-500">Bookings</div>
                    </div>
                  </div>

                  {/* Registered Members Section */}
                  <div className="space-y-2">
                    <div className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                      Registered Members ({societyDetailData.members.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {societyDetailData.members.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No registered members yet</p>
                      ) : (
                        societyDetailData.members.map((m) => (
                          <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-800">{m.profile?.name || 'Resident'}</div>
                              <div className="text-[11px] text-slate-400 font-medium">
                                Flat {m.flat_number || 'N/A'} &bull; {m.profile?.phone || m.profile?.email || 'No contact'}
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              m.role === 'secretary'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : m.role === 'committee'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {m.role}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Campaigns Section */}
                  <div className="space-y-2">
                    <div className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                      Society Service Drives ({societyDetailData.campaigns.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {societyDetailData.campaigns.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No service drives created yet</p>
                      ) : (
                        societyDetailData.campaigns.map((c) => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-slate-800">{c.title}</div>
                              <div className="text-[11px] text-slate-400">Date: {c.event_date || 'Upcoming'}</div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                              {c.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <Link
                      href={`/s/${societyDetailData.slug}`}
                      target="_blank"
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>Open Society Hub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSocietyId(null);
                        setSocietyDetailData(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
