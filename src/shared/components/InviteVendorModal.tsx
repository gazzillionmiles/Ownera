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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#18191D] p-6 sm:p-8 shadow-2xl space-y-6">
        <button
          onClick={() => {
            onClose();
            setGeneratedInvite(null);
          }}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CB7A5]/10 text-[#2CB7A5] text-xs font-semibold mb-2">
            <Briefcase className="w-3.5 h-3.5" /> Invite Service Provider
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Invite Vendors to Quote on &ldquo;{campaign.title}&rdquo;
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Providers only see campaigns they are invited to. Choose an option below.
          </p>
        </div>

        {generatedInvite ? (
          <div className="p-5 rounded-2xl bg-zinc-900/90 border border-[#2CB7A5]/30 space-y-4 animate-in fade-in">
            <div className="text-xs font-bold text-[#2CB7A5] flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Invitation Link Created for {businessName}!</span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-white/10 font-mono text-xs text-zinc-300 break-all select-all">
              {generatedInvite.inviteUrl}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Send this link to the vendor on WhatsApp or SMS. They can view campaign details and submit their price and crew capacity in seconds.
            </p>

            <div className="flex gap-2 pt-1">
              {generatedInvite.whatsappShareUrl && (
                <a
                  href={generatedInvite.whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
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
                className="px-5 py-3 rounded-xl bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#2CB7A5]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={() => {
                onSuccess();
                onClose();
                setGeneratedInvite(null);
              }}
              className="w-full py-2.5 rounded-xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Option Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-900 border border-white/5">
              <button
                type="button"
                onClick={() => setOption('existing_provider')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  option === 'existing_provider'
                    ? 'bg-[#2CB7A5] text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Listed Providers
              </button>
              <button
                type="button"
                onClick={() => setOption('custom_vendor')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                  option === 'custom_vendor'
                    ? 'bg-[#2CB7A5] text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                + Invite Local Vendor
              </button>
            </div>

            {option === 'existing_provider' ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-300">
                  Select Verified Provider
                </label>

                {loadingProviders ? (
                  <div className="py-6 text-center text-xs text-zinc-500">Loading providers...</div>
                ) : existingProviders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-400">
                    No listed providers found. Try inviting a local vendor instead.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {existingProviders.map((p) => {
                      const isSelected = selectedProviderId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProviderId(p.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'border-[#2CB7A5] bg-[#2CB7A5]/10 text-white'
                              : 'border-white/5 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <div>
                            <div className="font-bold">{p.company_name}</div>
                            <div className="text-[11px] text-zinc-400">Contact: {p.contact_person} • {p.phone}</div>
                          </div>
                          <span className="text-xs font-bold text-amber-400 font-mono">
                            ★ {p.rating}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Vendor Business / Company Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Ramesh AC Care"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={vendorPhone}
                      onChange={(e) => setVendorPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      WhatsApp Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={vendorWhatsapp}
                      onChange={(e) => setVendorWhatsapp(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs focus:outline-none focus:border-[#2CB7A5]"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-[#2CB7A5] text-zinc-950 font-bold text-xs uppercase tracking-wider hover:bg-[#25A08F] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
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
