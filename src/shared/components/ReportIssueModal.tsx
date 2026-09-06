'use client';

import React, { useState } from 'react';
import { X, Bug, Loader2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose }) => {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (description.trim().length < 10) {
      toast.error('Description must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          page_url: pageUrl,
          user_agent: userAgent,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to submit report. Please try again.');
        return;
      }

      toast.success("Thanks, we'll look into it!");
      setDescription('');
      onClose();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-6 space-y-5 shadow-2xl relative"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#2CB7A5]/15 text-[#2CB7A5]">
                <Bug className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base leading-none text-white">Report an Issue</h3>
                <p className="text-xs text-zinc-400 mt-1">Help us improve by sharing feedback or bugs</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white">
                Issue Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened or what isn't working as expected (min 10 characters)..."
                rows={4}
                maxLength={1000}
                required
                className="w-full p-3.5 rounded-2xl bg-black/20 border border-white/10 text-xs text-white focus:outline-none focus:border-[#2CB7A5] transition-colors resize-none placeholder:text-zinc-500"
              />
              <div className="flex justify-between items-center text-[10px] text-zinc-500 px-1">
                <span>Auto-captures current page URL &amp; browser info</span>
                <span>{description.length}/1000</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || description.trim().length < 10}
                className="flex-1 py-2.5 rounded-xl bg-[#2CB7A5] text-[#121316] font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[#2CB7A5]/90 active:scale-95 transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Report
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
