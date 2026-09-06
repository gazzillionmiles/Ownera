'use client';

import React, { useEffect } from 'react';
import { X, ZoomIn, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImagePreviewModalProps {
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageUrl,
  altText = 'Screenshot preview',
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (imageUrl) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
        >
          {/* Top Bar Controls */}
          <div className="w-full flex items-center justify-between pb-3 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <ZoomIn className="w-4 h-4 text-[#2CB7A5]" />
              <span>{altText}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                download="preview.png"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-semibold flex items-center gap-1.5"
                title="Open original in new tab / download"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Open Full Size</span>
              </a>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close image preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl flex items-center justify-center max-h-[80vh]">
            <img
              src={imageUrl}
              alt={altText}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl select-none"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
