'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Building2, X, ArrowRight, Loader2, Key, PlusCircle, ShieldCheck, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PropertyType } from '@/src/types/ownera';
import { StateCityPicker } from '@/src/shared/components/StateCityPicker';

interface JoinSocietyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (society: any) => void;
  initialTab?: 'join' | 'create';
}

export const JoinSocietyModal: React.FC<JoinSocietyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'join',
}) => {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'join' | 'create'>(initialTab);

  // Join state
  const [inviteCode, setInviteCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [hasToken, setHasToken] = useState(false);

  // Create state
  const [societyName, setSocietyName] = useState('');
  const [customInviteCode, setCustomInviteCode] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [createFlatNumber, setCreateFlatNumber] = useState('');
  const [state, setState] = useState('Karnataka');
  const [city, setCity] = useState('Bengaluru');
  const [totalHomes, setTotalHomes] = useState(100);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasToken && !inviteCode.trim()) {
      toast.error('Please fill in society invite code');
      return;
    }
    if (!flatNumber.trim()) {
      toast.error('Please enter your flat or unit number');
      return;
    }

    setLoading(true);
    try {
      const codeToUse = (hasToken && invitationToken.trim() ? invitationToken.trim() : inviteCode.trim());
      const payload: any = {
        inviteCode: codeToUse,
        invitationToken: codeToUse,
        flatNumber: flatNumber.trim(),
        unitNumber: flatNumber.trim(),
      };

      const res = await fetch('/api/societies/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join society');
      }

      toast.success(data.message || `Joined ${data.society?.name}!`);
      onSuccess(data.society);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to join society');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!societyName.trim()) {
      toast.error('Please enter the society name');
      return;
    }
    if (!createFlatNumber.trim()) {
      toast.error('Please enter your unit/flat number');
      return;
    }

    setLoading(true);
    try {
      const cleanCode = customInviteCode.trim().toUpperCase() || undefined;

      const res = await fetch('/api/societies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: societyName.trim(),
          inviteCode: cleanCode,
          flatNumber: createFlatNumber.trim(),
          propertyType,
          city: city.trim() || 'Bengaluru',
          totalHomes: Number(totalHomes) || 100,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create society');
      }

      toast.success(`Society "${data.society?.name}" created! You are registered as Secretary.`);
      onSuccess(data.society);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create society');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-2">
            <Building2 className="w-3.5 h-3.5" /> Society Hub
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {tab === 'join' ? 'Join Your Residential Society' : 'Create a New Society'}
          </h2>
          <p className="text-xs text-zinc-400">
            {tab === 'join'
              ? 'Enter your society invite code to browse live camps and group pricing.'
              : 'Create your residential community and become the Society Secretary.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="p-1 rounded-xl bg-zinc-900 border border-white/10 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 px-3 rounded-lg font-bold text-xs transition ${
              tab === 'join'
                ? 'bg-[#2CB7A5] text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Join Society
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              tab === 'create'
                ? 'bg-[#2CB7A5] text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Society</span>
          </button>
        </div>

        {tab === 'join' ? (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            {!hasToken ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Society Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PALM2026 or SOC1234"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono uppercase tracking-wider text-sm focus:outline-none focus:border-[#2CB7A5]"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Short code provided by your society secretary (e.g. PALM2026). Not an email verification token.
                </p>
                <div className="flex items-center justify-end mt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setHasToken(true)}
                    className="text-[#2CB7A5] hover:underline flex items-center gap-1 font-medium"
                  >
                    <Key className="w-3 h-3" /> Have Token?
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Invitation Token (Secretary / Committee)
                </label>
                <input
                  type="text"
                  value={invitationToken}
                  onChange={(e) => setInvitationToken(e.target.value)}
                  placeholder="inv_sec_..."
                  required
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono text-xs focus:outline-none focus:border-[#2CB7A5]"
                />
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-zinc-500">Issued by authorized Secretary/Admin</span>
                  <button
                    type="button"
                    onClick={() => setHasToken(false)}
                    className="text-zinc-400 hover:underline"
                  >
                    Use Society Code instead
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Your Flat / Unit Number
              </label>
              <input
                type="text"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="e.g. Tower B - 402"
                required
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-zinc-900 text-white text-sm focus:outline-none focus:border-[#2CB7A5]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Join Society &amp; Unlock Bulk Deals</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            <div className="p-2.5 rounded-xl bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center gap-2 text-xs text-[#2CB7A5]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>You will automatically become the <strong>Secretary</strong> of this society.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Society Name
              </label>
              <input
                type="text"
                value={societyName}
                onChange={(e) => setSocietyName(e.target.value)}
                placeholder="e.g. Palm Meadows"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Invite Code (Optional)
              </label>
              <input
                type="text"
                value={customInviteCode}
                onChange={(e) => setCustomInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. PALM2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white font-mono uppercase text-xs focus:outline-none focus:border-[#2CB7A5]"
              />
            </div>

            {/* State & City with Search & Lazy Loading */}
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Total Homes
                </label>
                <input
                  type="number"
                  value={totalHomes}
                  onChange={(e) => setTotalHomes(Number(e.target.value))}
                  min={5}
                  max={10000}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Your Unit / Flat #
                </label>
                <input
                  type="text"
                  value={createFlatNumber}
                  onChange={(e) => setCreateFlatNumber(e.target.value)}
                  placeholder="e.g. A-101"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Society as Secretary</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
