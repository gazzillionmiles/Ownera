'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Home,
  MapPin,
  Users,
  Check,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Layers,
  Sparkles,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';
import { PropertyType } from '@/src/types/ownera';

const PROPERTY_TYPES: { id: PropertyType; label: string; desc: string }[] = [
  { id: 'flat', label: 'Flat', desc: 'Standalone building / residential flat' },
  { id: 'apartment', label: 'Apartment', desc: 'Gated apartment complex unit' },
  { id: 'tenement', label: 'Tenement', desc: 'Community tenement unit' },
  { id: 'row_house', label: 'Row House', desc: 'Townhouse / row house unit' },
  { id: 'bungalow', label: 'Bungalow', desc: 'Independent villa or bungalow' },
  { id: 'villa', label: 'Villa', desc: 'Community luxury villa' },
  { id: 'shop', label: 'Shop', desc: 'Commercial retail or society shop' },
  { id: 'other', label: 'Other', desc: 'Residential or other unit' },
];

interface SocietyPreview {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  city: string;
  state?: string | null;
  total_homes: number;
}

export default function JoinSocietyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const token = resolvedParams.token;

  const { uiUser, loading: authLoading, updateProfile, refreshProfile } = useAuth();

  const [validationState, setValidationState] = useState<'loading' | 'valid' | 'invalid' | 'inactive' | 'error'>('loading');
  const [society, setSociety] = useState<SocietyPreview | null>(null);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  // Form State
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [unitNumber, setUnitNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  // 1. Validate Token on Mount
  useEffect(() => {
    let isMounted = true;

    async function validateToken() {
      if (!token) {
        setValidationState('invalid');
        return;
      }

      try {
        setValidationState('loading');
        const res = await fetch(`/api/societies/invite-link/validate?token=${encodeURIComponent(token.trim())}`);
        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;

        if (res.status === 404 || data.reason === 'not_found') {
          setValidationState('invalid');
          return;
        }

        if (res.status === 410 || data.reason === 'inactive') {
          setValidationState('inactive');
          return;
        }

        if (!res.ok || !data.valid || !data.society) {
          setValidationState('error');
          return;
        }

        setSociety(data.society);
        setValidationState('valid');
      } catch (err) {
        console.error('[JoinPage] Token validation error:', err);
        if (isMounted) setValidationState('error');
      }
    }

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Pre-fill user contact info when user profile loads
  useEffect(() => {
    if (uiUser.isLoggedIn) {
      if (uiUser.name && uiUser.name !== 'User' && uiUser.name !== 'Guest User') {
        setName((prev) => prev || uiUser.name);
      }
      if (uiUser.phone) {
        setPhone((prev) => prev || uiUser.phone || '');
      }
      if (uiUser.unitNumber) {
        setUnitNumber((prev) => prev || uiUser.unitNumber || '');
      }
      if (uiUser.propertyType) {
        setPropertyType((prev) => (uiUser.propertyType as PropertyType) || prev);
      }
    }
  }, [uiUser.isLoggedIn, uiUser.name, uiUser.phone, uiUser.unitNumber, uiUser.propertyType]);

  // 3. Check if authenticated user is already a member of this society
  useEffect(() => {
    if (uiUser.isLoggedIn && society?.id) {
      if (uiUser.primarySocietyId === society.id) {
        setIsAlreadyMember(true);
        return;
      }

      fetch('/api/societies')
        .then((res) => res.json())
        .then((data) => {
          if (data.societies && Array.isArray(data.societies)) {
            const isMember = data.societies.some((s: any) => s.id === society.id);
            if (isMember) {
              setIsAlreadyMember(true);
            }
          }
        })
        .catch(() => {});
    }
  }, [uiUser.isLoggedIn, uiUser.primarySocietyId, society?.id]);

  // 4. Handle Join Submission
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitNumber.trim()) {
      toast.error('Please enter your unit or flat number');
      return;
    }

    setJoining(true);
    try {
      // Update profile contact details if provided
      if (name.trim() || phone.trim()) {
        await updateProfile({
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          unit_number: unitNumber.trim(),
          property_type: propertyType,
        });
      }

      const res = await fetch('/api/societies/invite-link/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          unitNumber: unitNumber.trim(),
          propertyType,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join society. Please try again.');
      }

      await refreshProfile();
      setJoinSuccess(true);
      toast.success(data.message || `Welcome to ${society?.name}!`);

      // Redirect directly to society dashboard
      const targetSlug = data.society?.slug || society?.slug;
      if (targetSlug) {
        setTimeout(() => {
          window.location.href = `/s/${targetSlug}`;
        }, 800);
      } else {
        router.replace('/home');
      }
    } catch (err: any) {
      console.error('[JoinPage] Join error:', err);
      toast.error(err.message || 'An unexpected error occurred while joining');
    } finally {
      setJoining(false);
    }
  };

  // State: Loading
  if (validationState === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center text-[#2CB7A5] mb-4 shadow-xl">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">Verifying Community Invitation</h2>
        <p className="text-xs text-zinc-400">Loading society details...</p>
      </div>
    );
  }

  // State: Invalid Token (404)
  if (validationState === 'invalid') {
    return (
      <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">This invite link is invalid</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This link may be incorrect, mistyped, or is no longer available on {APP_NAME}.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex w-full py-3.5 rounded-2xl bg-zinc-900 border border-white/10 text-white font-semibold text-xs items-center justify-center hover:bg-zinc-800 transition"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State: Inactive / Rotated Token (410)
  if (validationState === 'inactive') {
    return (
      <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-amber-500/20 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">This invite link is no longer active</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The Society Secretary has rotated or deactivated this invitation link for security. Please request the latest active invite link from your society committee.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex w-full py-3.5 rounded-2xl bg-zinc-900 border border-white/10 text-white font-semibold text-xs items-center justify-center hover:bg-zinc-800 transition"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State: Unexpected Error
  if (validationState === 'error' || !society) {
    return (
      <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-white">Unable to verify invite link</h1>
            <p className="text-xs text-zinc-400">
              There was a connection issue while contacting the server. Please check your network and try again.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // State: Already a Member of this Society
  if (isAlreadyMember) {
    return (
      <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-[#2CB7A5]/30 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 flex items-center justify-center text-[#2CB7A5] mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold">
              <Check className="w-3.5 h-3.5" /> Already a Member
            </div>
            <h1 className="text-2xl font-extrabold text-white">You are already a member of {society.name}</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your resident membership is active. You can view live group service campaigns, schedules, and bulk pricing immediately.
            </p>
          </div>

          <Link
            href={`/s/${society.slug}`}
            className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg"
          >
            <span>Go to Society Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // State: Logged-Out User (Invite Preview + Auth Redirection)
  if (!uiUser.isLoggedIn) {
    const nextDestination = `/join/${encodeURIComponent(token.trim())}`;
    const loginUrl = `/login?next=${encodeURIComponent(nextDestination)}`;
    const signupUrl = `/signup?next=${encodeURIComponent(nextDestination)}`;

    return (
      <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#2CB7A5]/30">
        <div className="max-w-md mx-auto w-full pt-8 pb-12 space-y-6">
          {/* Header Badge */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2CB7A5]/10 border border-[#2CB7A5]/25 text-[#2CB7A5] text-xs font-semibold uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5" /> Community Invitation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              You&apos;re Invited to Join
            </h1>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Unlock group buying power, discounted community service camps, and trusted home vendors.
            </p>
          </div>

          {/* Society Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl space-y-6">
            <div className="space-y-3 pb-5 border-b border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2CB7A5] to-emerald-400 flex items-center justify-center text-zinc-950 font-bold shadow-md">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{society.name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#2CB7A5]" />
                    {society.city}{society.state ? `, ${society.state}` : ''}
                  </span>
                  {society.total_homes > 0 && (
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      {society.total_homes} Households
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 text-xs text-zinc-300 space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2CB7A5]" /> Exclusive Resident Access
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Sign in or create an account to verify your property unit and join this community.
                </p>
              </div>

              <Link
                href={loginUrl}
                className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg min-h-[46px]"
              >
                <span>Continue to Join</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="text-center pt-2">
                <Link
                  href={signupUrl}
                  className="text-xs text-zinc-400 hover:text-white transition underline underline-offset-4"
                >
                  New to {APP_NAME}? Create an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State: Authenticated User — Show Unit & Property Setup Form
  return (
    <div className="min-h-screen bg-[#121316] text-[#FAF8F5] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#2CB7A5]/30">
      <div className="max-w-lg mx-auto w-full pt-6 pb-12 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold uppercase tracking-wider mb-1">
            <Building2 className="w-3.5 h-3.5" /> Joining Community
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {society.name}
          </h1>
          <p className="text-xs text-zinc-400">
            {society.city}{society.state ? `, ${society.state}` : ''} • Complete your property details to enter
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleJoinSubmit} className="p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl space-y-6">
          {/* Step 1: Property Type */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              1. Select Property Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROPERTY_TYPES.map((pt) => {
                const isSelected = propertyType === pt.id;
                return (
                  <button
                    type="button"
                    key={pt.id}
                    onClick={() => setPropertyType(pt.id)}
                    className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between min-h-[64px] ${
                      isSelected
                        ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-white font-bold shadow-sm'
                        : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{pt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#2CB7A5]" />}
                    </div>
                    <span className="text-[10px] text-zinc-500 line-clamp-1">{pt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Unit / House Number */}
          <div className="space-y-2.5 pt-2 border-t border-white/5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              2. Your House / Flat / Unit Number
            </label>
            <div className="relative">
              <Home className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                type="text"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. Flat A-402 or Villa 12"
                required
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs sm:text-sm focus:outline-none focus:border-[#2CB7A5] tracking-wide"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Used to route group services and technician appointments directly to your home.
            </p>
          </div>

          {/* Step 3: Contact Confirmation */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              3. Resident Contact
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                  Your Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amit Sharma"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                  Phone (for service updates)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={joining || joinSuccess}
            className="w-full py-4 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 min-h-[48px]"
          >
            {joining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : joinSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Joined! Redirecting...</span>
              </>
            ) : (
              <>
                <span>Join {society.name}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Cancel and return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
