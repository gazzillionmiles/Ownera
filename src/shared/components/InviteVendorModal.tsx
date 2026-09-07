'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Briefcase,
  Phone,
  Share2,
  Copy,
  Check,
  Building2,
  ExternalLink,
  Plus,
  Loader2,
  Users,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCampaign, Provider } from '@/src/types/ownera';

interface InviteVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: ServiceCampaign | null;
  onSuccess: () => void;
}

export const InviteVendorModal: React.FC<InviteVendorModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [option, setOption] = useState<'existing_provider' | 'custom_vendor'>('existing_provider');
  const [existingProviders, setExistingProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');

  // Custom vendor inputs
  const [businessName, setBusinessName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorWhatsapp, setVendorWhatsapp] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<{
    inviteUrl: string;
    whatsappShareUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoadingProviders(true);
      fetch('/api/providers')
        .then((res) => res.json())
        .then((data) => {
          if (data.providers) {
            setExistingProviders(data.providers);
            if (data.providers.length > 0) {
              setSelectedProviderId(data.providers[0].id);
            }
          }
        })
        .catch((err) => console.error('Error fetching providers:', err))
        .finally(() => setLoadingProviders(false));
    }
  }, [isOpen]);

  if (!isOpen || !campaign || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${campaign.id}/invite-vendor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          option,
          providerId: option === 'existing_provider' ? selectedProviderId : undefined,
          businessName: option === 'custom_vendor' ? businessName.trim() : undefined,
          phone: option === 'custom_vendor' ? vendorPhone.trim() : undefined,
          whatsappNumber: option === 'custom_vendor' ? (vendorWhatsapp.trim() || vendorPhone.trim()) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch invitation');

      toast.success(data.message || 'Vendor invited!');
      if (data.inviteUrl) {
        setGeneratedInvite({
          inviteUrl: data.inviteUrl,
          whatsappShareUrl: data.whatsappShareUrl,
        });
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error inviting vendor');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[80vh] md:max-h-[75vh] overflow-y-auto">
        <button
          onClick={() => {
            onClose();
            setGeneratedInvite(null);
          }}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center p-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold mb-1">
            <Briefcase className="w-3 h-3 text-blue-600" />
            <span>Invite Service Provider</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Invite Vendors to Quote
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Campaign: {campaign.title}
          </p>
        </div>

        {generatedInvite ? (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in">
            <div className="text-xs font-extrabold text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>Invitation Link Created for {businessName}!</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-800 break-all select-all font-semibold">
              {generatedInvite.inviteUrl}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Send this link to the vendor on WhatsApp or SMS. They can view campaign requirements and submit their discounted unit price and crew size in seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {generatedInvite.whatsappShareUrl && (
                <a
                  href={generatedInvite.whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Send WhatsApp Message</span>
                </a>
              )}

              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedInvite.inviteUrl);
                  setCopied(true);
                  toast.success('Quote link copied!');
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={() => {
                onSuccess();
                onClose();
                setGeneratedInvite(null);
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer transition"
            >
              Done &amp; Return
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Option Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setOption('existing_provider')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  option === 'existing_provider'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Listed Providers
              </button>
              <button
                type="button"
                onClick={() => setOption('custom_vendor')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  option === 'custom_vendor'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Invite Local Vendor
              </button>
            </div>

            {option === 'existing_provider' ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Select Provider
                </label>

                {loadingProviders ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading providers...</div>
                ) : existingProviders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                    No listed providers found. Try inviting a local vendor with their phone number instead.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {existingProviders.map((p) => {
                      const isSelected = selectedProviderId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProviderId(p.id)}
                          className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-slate-900 ring-2 ring-blue-600/20'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-extrabold text-slate-900">{p.company_name}</div>
                            <div className="text-[11px] text-slate-500">Contact: {p.contact_person} • {p.phone}</div>
                          </div>
                          {p.rating && p.rating > 0 ? (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {p.rating}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vendor Business / Company Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Ramesh AC Care"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={vendorPhone}
                      onChange={(e) => setVendorPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={vendorWhatsapp}
                      onChange={(e) => setVendorWhatsapp(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Dispatch Quote Invitation</span>
                  <ExternalLink className="w-3.5 h-3.5" />
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
