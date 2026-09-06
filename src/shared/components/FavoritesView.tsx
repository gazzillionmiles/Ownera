'use client';

import React from 'react';
import { Bookmark } from 'lucide-react';
import { ThemeMode } from '@/src/types/saas';

interface FavoritesViewProps {
  theme?: ThemeMode;
}

export const FavoritesView: React.FC<FavoritesViewProps> = () => {
  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <Bookmark className="w-6 h-6 text-[#2CB7A5]" />
        <h1 className="text-3xl font-bold tracking-tight">Saved Items</h1>
      </div>
      <div className="text-center py-16 text-zinc-500 border border-dashed border-white/10 rounded-2xl text-xs">
        No saved items yet.
      </div>
    </div>
  );
};
