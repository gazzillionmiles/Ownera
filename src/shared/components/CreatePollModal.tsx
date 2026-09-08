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
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCatalogItem, Society, PollScope } from '@/src/types/ownera';
import { SERVICE_CATEGORIES, STANDARDIZED_SERVICES_CATALOG } from '@/src/constants/serviceCategories';

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Filter out any legacy chimney, mattress, or sofa services
  const baseCatalog: ServiceCatalogItem[] = (
    services && services.length > 0 ? services : STANDARDIZED_SERVICES_CATALOG
  ).filter((s) => {
    const n = s.name.toLowerCase();
    const sl = (s.slug || '').toLowerCase();
    return !n.includes('chimney') && !n.includes('mattress') && !n.includes('sofa') &&
           !sl.includes('chimney') && !sl.includes('mattress') && !sl.includes('sofa');
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string>(baseCatalog[0]?.id || '');
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
    if (!selectedServiceId && baseCatalog.length > 0) {
      const firstServ = baseCatalog[0];
      setSelectedServiceId(firstServ.id);
      if (!isCustomService) {
        setTitle(`${firstServ.name} ${scope === 'society' ? 'Camp' : 'for my home'}`);
        setPollQuestion(scope === 'society' ? `Who wants ${firstServ.name.toLowerCase()} this Sunday?` : `I need ${firstServ.name.toLowerCase()} for my house`);
      }
    }
  }, [baseCatalog, selectedServiceId, isCustomService, scope]);

  if (!isOpen || !mounted) return null;

  const filteredServices = selectedCategoryId === 'all'
    ? baseCatalog
    : baseCatalog.filter((s) => {
        const cat = SERVICE_CATEGORIES.find((c) => c.id === selectedCategoryId);
        return cat && (s.category?.toLowerCase() === cat.name.toLowerCase() || s.name.toLowerCase().includes(cat.name.toLowerCase().split(' ')[0]));
      });

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121620] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[80vh] md:max-h-[75vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition flex items-center justify-center p-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[11px] font-bold mb-1 border border-transparent dark:border-blue-500/20">
            <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Create Service Poll &amp; Campaign</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Propose Service in {activeSociety?.name || 'Society'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
            Collect resident demand to unlock group vendor discounts across standard service categories.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Scope Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
              1. Choose Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleScopeChange('society')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  scope === 'society'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-600/15 text-slate-900 dark:text-white shadow-sm ring-2 ring-blue-600/20 dark:ring-blue-500/30'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-transparent text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Society-Wide Camp</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                    Visible to all neighbors. Quorum gathered before inviting vendor quotes.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange('my_house')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  scope === 'my_house'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-600/15 text-slate-900 dark:text-white shadow-sm ring-2 ring-blue-600/20 dark:ring-blue-500/30'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-transparent text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Personal Request</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                    Individual request for your flat/unit with direct vendor invites.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Category Filter & Service Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                2. Select Service Category
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                12 Standard Categories
              </span>
            </div>

            {/* Category horizontal scroll pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/[0.12]'
                }`}
              >
                All Services
              </button>
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/[0.12]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Service options grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredServices.map((s) => {
                const isSelected = !isCustomService && selectedServiceId === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => handleServiceSelect(s)}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-600/15 text-blue-900 dark:text-white font-bold shadow-2xs ring-2 ring-blue-600/20 dark:ring-blue-500/30'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                     <div className="text-xs font-extrabold truncate text-slate-900 dark:text-white">{s.name}</div>
                     <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5">{s.category}</div>
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
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  isCustomService
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-600/15 text-blue-900 dark:text-white font-bold shadow-2xs'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Custom
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500">Other community requirement</div>
              </button>
            </div>

            {isCustomService && (
              <div className="pt-1">
                <input
                  type="text"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="e.g. Balcony Mosquito Netting or Anti-Termite Treatment"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181f2e] font-semibold"
                />
              </div>
            )}
          </div>

          {/* 3. Campaign Title & Question */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Campaign Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181f2e]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Poll Question for Society
              </label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181f2e]"
              />
            </div>
          </div>

          {/* 4. Event Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Proposed Service Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181f2e]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Poll Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={pollDeadlineDays}
                onChange={(e) => setPollDeadlineDays(parseInt(e.target.value, 10) || 5)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181f2e]"
              />
            </div>
          </div>

          {/* 5. Voting Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Poll Options
              </label>
              <div className="flex gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handlePresetOptions('yes_no')}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-bold"
                >
                  Yes / No
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetOptions('weekend_days')}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-bold"
                >
                  Days
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white">
                    {opt}
                  </div>
                  {pollOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customOptionInput}
                onChange={(e) => setCustomOptionInput(e.target.value)}
                placeholder="Add custom option..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181f2e]"
              />
              <button
                type="button"
                onClick={handleAddOption}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] text-slate-700 dark:text-zinc-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-300 text-white font-black text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting proposal...</span>
                </>
              ) : (
                <span>Publish Poll to Society</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
