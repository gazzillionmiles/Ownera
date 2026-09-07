'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/src/shared/components/ProtectedRoute';
import {
  Building2,
  Home,
  ArrowRight,
  Loader2,
  Check,
  User,
  Phone,
  Layers,
  PlusCircle,
  KeyRound,
  ShieldCheck,
  MapPin,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';
import { PropertyType } from '@/src/types/ownera';
import { StateCityPicker } from '@/src/shared/components/StateCityPicker';

const PROPERTY_TYPES: { id: PropertyType; label: string; desc: string }[] = [
  { id: 'flat', label: 'Flat', desc: 'Residential block / standalone building flat' },
  { id: 'apartment', label: 'Apartment', desc: 'Multi-storey gated apartment complex' },
  { id: 'tenement', label: 'Tenement', desc: 'Individual community tenement unit' },
  { id: 'row_house', label: 'Row House', desc: 'Gated community row house / townhouse' },
  { id: 'bungalow', label: 'Bungalow', desc: 'Independent villa or private bungalow' },
  { id: 'villa', label: 'Villa', desc: 'Independent luxury community villa' },
  { id: 'shop', label: 'Shop / Commercial', desc: 'Commercial retail or society shop' },
  { id: 'other', label: 'Other', desc: 'Residential / commercial other unit' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { updateProfile, refreshProfile, uiUser, signOut } = useAuth();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState<string>(uiUser.name || '');
  const [phone, setPhone] = useState<string>(uiUser.phone || '');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [unitNumber, setUnitNumber] = useState<string>(uiUser.unitNumber || '');
  
  // Create Society Fields
  const [societyName, setSocietyName] = useState<string>('');
  const [customInviteCode, setCustomInviteCode] = useState<string>('');
  const [state, setState] = useState<string>('Karnataka');
  const [city, setCity] = useState<string>('Bengaluru');
  const [totalHomes, setTotalHomes] = useState<number>(100);

  // Join Society Fields
  const [inviteCode, setInviteCode] = useState<string>('');
  const [invitationToken, setInvitationToken] = useState<string>('');
  const [hasToken, setHasToken] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);

  // Auto-redirect if user already has an active society membership
  React.useEffect(() => {
    async function checkExistingSocieties() {
      try {
        if (uiUser.activeRole === 'provider') {
          const provRes = await fetch('/api/providers?self=true');
          const provData = await provRes.json().catch(() => ({}));
          if (provData?.provider) {
            router.replace('/partner');
            return;
          }
        }

        const res = await fetch('/api/societies');
        if (res.ok) {
          const data = await res.json();
          if (data.societies && data.societies.length > 0) {
            await refreshProfile();
            const targetSoc = data.societies.find((s: any) => s.id === uiUser.primarySocietyId) || data.societies[0];
            router.replace(`/s/${targetSoc.slug}`);
          }
        }
      } catch (err) {
        console.error('[OnboardingPage] Check societies error:', err);
      }
    }

    if (uiUser.isLoggedIn) {
      checkExistingSocieties();
    }
  }, [uiUser.isLoggedIn, uiUser.primarySocietyId, refreshProfile]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!unitNumber.trim()) {
      toast.error('Please enter your house/flat/unit number');
      return;
    }

    setSaving(true);
    try {
      // 1. Update Profile fields
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        property_type: propertyType,
        unit_number: unitNumber.trim(),
      });

      if (mode === 'create') {
        const cleanSocName = societyName.trim();
        if (!cleanSocName) {
          toast.error('Please enter a society name');
          setSaving(false);
          return;
        }

        const cleanCode = customInviteCode.trim().toUpperCase() || undefined;

        const createRes = await fetch('/api/societies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanSocName,
            inviteCode: cleanCode,
            flatNumber: unitNumber.trim(),
            propertyType,
            city: city.trim() || 'Bengaluru',
            totalHomes: Number(totalHomes) || 100,
          }),
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error || 'Failed to create society');
        }

        await refreshProfile();
        toast.success(`Society "${createData.society?.name}" created! You are registered as Secretary.`);
        window.location.href = `/s/${createData.society?.slug}`;
        return;
      } else {
        // Mode === 'join'
        const codeToUse = (hasToken && invitationToken.trim() ? invitationToken.trim() : inviteCode.trim());
        if (!codeToUse) {
          toast.error('Please enter an invite code or token');
          setSaving(false);
          return;
        }

        const payload: any = {
          inviteCode: codeToUse,
          invitationToken: codeToUse,
          flatNumber: unitNumber.trim(),
          unitNumber: unitNumber.trim(),
          propertyType,
        };

        const joinRes = await fetch('/api/societies/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const joinData = await joinRes.json();
        if (!joinRes.ok) {
          throw new Error(joinData.error || 'Failed to join society');
        }

        await refreshProfile();
        toast.success(joinData.message || `Welcome to ${joinData.society?.name}!`);
        window.location.href = `/s/${joinData.society?.slug}`;
        return;
      }
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast.error(err.message || 'An error occurred during onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#121316] text-white flex flex-col justify-between p-4 sm:p-6">
        <div className="max-w-xl mx-auto w-full pt-8 pb-12 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold uppercase tracking-wider mb-2">
              <Layers className="w-3.5 h-3.5" /> Welcome to {APP_NAME}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Set Up Your Property &amp; Community
            </h1>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Create your society to unlock group bulk discounts and collective services, or join an existing community.
            </p>
          </div>

          <form onSubmit={handleComplete} className="p-6 sm:p-8 rounded-3xl bg-[#18191D] border border-white/10 shadow-2xl space-y-6">
            {/* Mode Selector Tabs */}
            <div className="p-1.5 rounded-2xl bg-zinc-900/90 border border-white/10 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  mode === 'create'
                    ? 'bg-[#2CB7A5] text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Society (Secretary)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  mode === 'join'
                    ? 'bg-[#2CB7A5] text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Join Existing Society</span>
              </button>
            </div>

            {/* Step 1: Property Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                1. Select Property Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROPERTY_TYPES.map((pt) => {
                  const isSelected = propertyType === pt.id;
                  return (
                    <button
                      type="button"
                      key={pt.id}
                      onClick={() => setPropertyType(pt.id)}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
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

            {/* Step 2: Society Details */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  2. {mode === 'create' ? 'Society Setup & Secretary Details' : 'Society & Unit Details'}
                </label>
                {mode === 'create' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2CB7A5] bg-[#2CB7A5]/10 px-2 py-0.5 rounded-md">
                    <ShieldCheck className="w-3 h-3" /> Secretary Role Assigned
                  </span>
                )}
              </div>

              {mode === 'create' ? (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                        Society / Community Name
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                        <input
                          type="text"
                          value={societyName}
                          onChange={(e) => setSocietyName(e.target.value)}
                          placeholder="e.g. Palm Meadows"
                          required
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                        Custom Society Invite Code
                      </label>
                      <input
                        type="text"
                        value={customInviteCode}
                        onChange={(e) => setCustomInviteCode(e.target.value.toUpperCase())}
                        placeholder="e.g. PALM2026"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono uppercase text-xs focus:outline-none focus:border-[#2CB7A5]"
                      />
                    </div>
                  </div>

                  {/* State and City Selector with Search & Lazy Loading */}
                  <StateCityPicker
                    selectedCity={city}
                    selectedState={state}
                    onCityChange={(c, s) => {
                      setCity(c);
                      if (s) setState(s);
                    }}
                    onStateChange={(s) => setState(s)}
                    required
                  />

                  <div>
                    <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                      Estimated Total Homes / Units
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <input
                        type="number"
                        value={totalHomes}
                        onChange={(e) => setTotalHomes(Number(e.target.value))}
                        min={5}
                        max={10000}
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                      Your House / Flat / Unit Number (Secretary)
                    </label>
                    <div className="relative">
                      <Home className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <input
                        type="text"
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        placeholder="e.g. Flat A-101 or Villa 12"
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {!hasToken ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-zinc-300 font-medium">
                          Society Invite Code
                        </label>
                        <button
                          type="button"
                          onClick={() => setHasToken(true)}
                          className="text-[11px] text-[#2CB7A5] hover:underline"
                        >
                          Have Secretary/Committee Token?
                        </button>
                      </div>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="e.g. PALM2026 or SOC1234"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono uppercase text-xs focus:outline-none focus:border-[#2CB7A5]"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Enter the short code provided by your society secretary (e.g. PALM2026). Do not enter your email verification link.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-zinc-300 font-medium">
                          Invitation Token
                        </label>
                        <button
                          type="button"
                          onClick={() => setHasToken(false)}
                          className="text-[11px] text-zinc-400 hover:underline"
                        >
                          Use Invite Code instead
                        </button>
                      </div>
                      <input
                        type="text"
                        value={invitationToken}
                        onChange={(e) => setInvitationToken(e.target.value)}
                        placeholder="inv_res_..."
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-xs focus:outline-none focus:border-[#2CB7A5]"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Direct role invitation token provided by your committee (starts with inv_).
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                      Your House / Flat / Unit Number
                    </label>
                    <div className="relative">
                      <Home className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <input
                        type="text"
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        placeholder="e.g. Flat A-402 or Villa 12"
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Resident Contact Details */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                3. Resident Contact
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Amit Sharma"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-300 font-medium block mb-1">
                    Phone Number (for service updates)
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

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'create' ? 'Create Society & Enter Dashboard' : 'Join Society & Enter Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace('/login');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition underline underline-offset-4"
            >
              Need to sign in with a different account? Sign Out
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
