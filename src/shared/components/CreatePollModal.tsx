'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Home,
  Building2,
  Sparkles,
  Calendar,
  Layers,
  Loader2,
  Check,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCatalogItem, Society, PollScope } from '@/src/types/ownera';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSociety: Society | null;
  services: ServiceCatalogItem[];
  onSuccess: () => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  activeSociety,
  services,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [scope, setScope] = useState<PollScope>('society');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [isCustomService, setIsCustomService] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [targetPropertyUnit, setTargetPropertyUnit] = useState('');
  const [title, setTitle] = useState('AC Servicing Camp');
  const [pollQuestion, setPollQuestion] = useState('Who wants AC servicing this Sunday?');
  const [description, setDescription] = useState('Collective society booking camp. Vote to unlock group discounts.');
  const [pollOptions, setPollOptions] = useState<string[]>(['Yes', 'No']);
  const [customOptionInput, setCustomOptionInput] = useState('');
  const [eventDate, setEventDate] = useState(() => {
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
    return nextSunday.toISOString().split('T')[0];
  });
  const [pollDeadlineDays, setPollDeadlineDays] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      const firstServ = services[0];
      setSelectedServiceId(firstServ.id);
      if (!isCustomService) {
        setTitle(`${firstServ.name} ${scope === 'society' ? 'Camp' : 'for my home'}`);
        setPollQuestion(scope === 'society' ? `Who wants ${firstServ.name.toLowerCase()} this Sunday?` : `I need ${firstServ.name.toLowerCase()} for my house`);
      }
    }
  }, [services, selectedServiceId, isCustomService, scope]);

  if (!isOpen || !mounted) return null;

  const handleScopeChange = (newScope: PollScope) => {
    setScope(newScope);
    if (newScope === 'my_house') {
      setTitle('AC Repair / Service for my home');
      setPollQuestion('I need service for my house this week');
      setPollOptions(['Yes, need service']);
    } else {
      setTitle('AC Servicing Camp');
      setPollQuestion('Who wants AC servicing this Sunday?');
      setPollOptions(['Yes', 'No']);
    }
  };

  const handleServiceSelect = (serv: ServiceCatalogItem) => {
    setSelectedServiceId(serv.id);
    setIsCustomService(false);
    if (scope === 'society') {
      setTitle(`${serv.name} Camp`);
      setPollQuestion(`Who wants ${serv.name.toLowerCase()} this Sunday?`);
    } else {
      setTitle(`${serv.name} for my home`);
      setPollQuestion(`I need ${serv.name.toLowerCase()} for my house`);
    }
  };

  const handleAddOption = () => {
    if (!customOptionInput.trim()) return;
    if (pollOptions.includes(customOptionInput.trim())) {
      toast.error('Option already added');
      return;
    }
    setPollOptions([...pollOptions, customOptionInput.trim()]);
    setCustomOptionInput('');
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length <= 1) {
      toast.error('At least one option is required');
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const handlePresetOptions = (preset: 'yes_no' | 'service_types' | 'weekend_days') => {
    if (preset === 'yes_no') {
      setPollOptions(['Yes', 'No']);
    } else if (preset === 'service_types') {
      setPollOptions(['Basic Service', 'Premium Deep Clean', 'Repair / Inspection']);
    } else if (preset === 'weekend_days') {
      setPollOptions(['Saturday Morning', 'Sunday Morning', 'Sunday Afternoon']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSociety?.id) {
      toast.error('Please join or select a society first');
      return;
    }

    if (isCustomService && !customServiceName.trim()) {
      toast.error('Please enter the custom service name');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          societyId: activeSociety.id,
          scope,
          targetPropertyUnit: targetPropertyUnit.trim() || undefined,
          serviceId: isCustomService ? null : (selectedServiceId || null),
          isCustomService,
          customServiceName: isCustomService ? customServiceName.trim() : null,
          title: isCustomService ? `${customServiceName.trim()} ${scope === 'society' ? 'Camp' : 'Request'}` : title,
          description: description.trim() || undefined,
          pollQuestion: pollQuestion.trim() || 'Who wants this service?',
          pollOptions: pollOptions.length > 0 ? pollOptions : ['Yes', 'No'],
          pollDeadlineDays,
          eventDate,
          minimumCustomers: scope === 'my_house' ? 1 : 10,
          targetCustomers: scope === 'my_house' ? 1 : 30,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create poll');
      }

      toast.success(data.message || 'Poll created successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error creating poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Create Service Poll &amp; Campaign
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Start a Demand Poll in {activeSociety?.name || 'Your Society'}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Collect resident demand or post a request for your home to invite top provider quotes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              1. Choose Scope
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleScopeChange('society')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                  scope === 'society'
                    ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-white shadow-sm'
                    : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="p-2 rounded-xl bg-zinc-800 text-[#2CB7A5] shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Society-Wide Camp</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Visible to all neighbors. Secretary signs off for bulk vendor outreach.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange('my_house')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                  scope === 'my_house'
                    ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-white shadow-sm'
                    : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="p-2 rounded-xl bg-zinc-800 text-amber-400 shrink-0 mt-0.5">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">My House Only</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Individual request for your unit. Instant vendor invite without secretary gating.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Service Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              2. Select Service
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {services.map((s) => {
                const isSelected = !isCustomService && selectedServiceId === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => handleServiceSelect(s)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-white font-bold'
                        : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{s.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">~₹{s.base_price_estimate}</div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsCustomService(true);
                  setTitle('Custom Service Request');
                  setPollQuestion('Who wants this service?');
                }}
                className={`p-2.5 rounded-xl border text-left transition ${
                  isCustomService
                    ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-white font-bold'
                    : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <div className="text-xs font-semibold text-[#2CB7A5] flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Custom
                </div>
                <div className="text-[10px] text-zinc-500">Other service</div>
              </button>
            </div>

            {isCustomService && (
              <div className="pt-1">
                <input
                  type="text"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="e.g. Balcony Pigeon Netting or Curtain Cleaning"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#2CB7A5]/40 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                />
              </div>
            )}
          </div>

          {/* 3. Poll Question & Configurable Options */}
          <div className="space-y-3 p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
            <div className="text-xs font-bold text-white flex items-center justify-between">
              <span>3. Poll Question &amp; Options</span>
              <div className="flex gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => handlePresetOptions('yes_no')}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Yes/No
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetOptions('service_types')}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Tiers
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetOptions('weekend_days')}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Days
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Poll Question</label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-zinc-800 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1.5">Configured Vote Choices</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pollOptions.map((opt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800 border border-white/10 text-xs text-white"
                  >
                    <span>{opt}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customOptionInput}
                  onChange={(e) => setCustomOptionInput(e.target.value)}
                  placeholder="Add custom choice (e.g. Deep Clean)..."
                  className="flex-1 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-800 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 border border-white/10 text-xs font-semibold hover:bg-zinc-700 text-zinc-200"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* 4. Scheduling & Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Target Service Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Poll Duration (Days)
              </label>
              <select
                value={pollDeadlineDays}
                onChange={(e) => setPollDeadlineDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
              >
                <option value={3}>3 Days</option>
                <option value={5}>5 Days (Recommended)</option>
                <option value={7}>7 Days</option>
                <option value={10}>10 Days</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Publish Poll &amp; Open Demand Voting</span>
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
