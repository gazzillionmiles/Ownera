'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Building2, X, ArrowRight, Loader2, PlusCircle, ShieldCheck, MapPin, Users, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { PropertyType } from '@/src/types/ownera';
import { StateCityPicker } from '@/src/shared/components/StateCityPicker';
import { invalidateSocietiesCache } from '@/src/shared/lib/api';

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

  // Create state
  const [societyName, setSocietyName] = useState('');
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
      const res = await fetch('/api/societies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: societyName.trim(),
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
      invalidateSocietiesCache();
      onSuccess(data.society);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create society');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[80vh] md:max-h-[75vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold mb-1">
            <Building2 className="w-3 h-3 text-blue-600" /> Society Hub
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            {tab === 'join' ? 'Join Your Residential Society' : 'Create a New Society'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {tab === 'join'
              ? 'Joining happens through a link your society secretary shares with you.'
              : 'Create your residential community and become the Society Secretary.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="p-1 rounded-2xl bg-slate-100 border border-slate-200/60 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer ${
              tab === 'join'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Join Society
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              tab === 'create'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Society</span>
          </button>
        </div>

        {tab === 'join' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-blue-900">
                  Ask your society secretary for an invite link
                </p>
                <p className="text-[11px] text-blue-700/80 leading-relaxed">
                  Societies are joined through a link shared by the secretary
                  or a committee member — there&apos;s no code to type in.
                  Open the link they sent you, sign in or create an account,
                  and you&apos;ll be added as a resident right away.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Don&apos;t have a link yet? Ask your secretary to send one, or{' '}
              <button
                type="button"
                onClick={() => setTab('create')}
                className="text-blue-600 hover:underline font-bold cursor-pointer"
              >
                create a new society
              </button>{' '}
              instead.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You will automatically become the <strong>Secretary</strong> of this society.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Society Name
              </label>
              <input
                type="text"
                value={societyName}
                onChange={(e) => setSocietyName(e.target.value)}
                placeholder="e.g. Palm Meadows"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Homes
                </label>
                <input
                  type="number"
                  value={totalHomes}
                  onChange={(e) => setTotalHomes(Number(e.target.value))}
                  min={5}
                  max={10000}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Unit / Flat #
                </label>
                <input
                  type="text"
                  value={createFlatNumber}
                  onChange={(e) => setCreateFlatNumber(e.target.value)}
                  placeholder="e.g. A-101"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 disabled:opacity-50 mt-2 cursor-pointer"
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
