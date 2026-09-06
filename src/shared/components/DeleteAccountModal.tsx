'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [confirmInput, setConfirmInput] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmInput.trim() !== 'DELETE') {
      toast.error('Please type DELETE to confirm account deletion.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_text: confirmInput.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to request account deletion.');
        setLoading(false);
        return;
      }

      toast.success('Account scheduled for deletion in 30 days.');
      onClose();
      router.push('/account-deleted');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[#18191D] text-white p-6 sm:p-8 space-y-6 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-red-500">
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif-display tracking-tight text-white">Delete Your Account?</h2>
            <p className="text-xs text-zinc-400">30-day grace period applies before permanent deletion.</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-zinc-300 leading-relaxed bg-red-500/5 p-4 rounded-2xl border border-red-500/15">
          <p className="font-semibold text-red-400">Important Information:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-300">
            <li>You will have <strong>30 days</strong> to restore your account before data is permanently purged.</li>
            <li>After 30 days, your saved activity and uploaded files will be permanently deleted.</li>
            <li>Remaining credit balances will be forfeited upon permanent deletion.</li>
            <li>Financial transaction records are retained in anonymized form for accounting compliance.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 block">
            Why are you leaving? <span className="text-zinc-500 font-normal">(Optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Tell us how we can improve ${APP_NAME}...`}
            className="w-full h-20 rounded-xl border border-white/10 bg-black/30 p-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 block">
            To confirm deletion, type <span className="text-red-400 font-mono font-bold">DELETE</span> below:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Type DELETE"
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500 tracking-wider"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || confirmInput.trim() !== 'DELETE'}
            className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-red-500"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Confirm Account Deletion</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
