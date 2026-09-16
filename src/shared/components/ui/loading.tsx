'use client';

import React from 'react';
import { Loader2, Sparkles, Building2 } from 'lucide-react';
import { cn } from '@/src/shared/lib/utils';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loading({ className, size = 'md' }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  return <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size], className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'skeleton rounded-xl bg-slate-200/80 dark:bg-slate-800/60',
        className
      )}
    />
  );
}

export function CampaignCardSkeleton() {
  return (
    <div className="p-6 sm:p-7 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121620] shadow-sm space-y-5 animate-pulse">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
        <div className="space-y-2.5 w-full max-w-lg">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4 rounded-xl" />
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-3.5 w-40 rounded-md" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
      </div>

      {/* Quorum Progress Bar Skeleton */}
      <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-4 border border-slate-100 dark:border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>

      {/* Voting Options Skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-44 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>

      {/* Footer Actions Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
        <Skeleton className="h-8 w-44 rounded-xl" />
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Welcome Banner Skeleton */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white shadow-xl relative overflow-hidden">
        <div className="space-y-3 max-w-md">
          <Skeleton className="h-6 w-36 rounded-full bg-white/20" />
          <Skeleton className="h-8 w-64 rounded-xl bg-white/20" />
          <Skeleton className="h-4 w-full rounded-lg bg-white/20" />
        </div>
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2 animate-pulse"
          >
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-xl" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* Active Campaigns Feed Skeleton */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded-xl" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>

        <div className="grid gap-5">
          <CampaignCardSkeleton />
          <CampaignCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function BrandLoadingScreen({
  message = 'Loading your society hub...',
}: {
  message?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-[#0b0f17] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      {/* Animated Brand Glow Icon */}
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/30 via-emerald-500/20 to-blue-600/30 rounded-full blur-xl animate-pulse" />
        <div className="relative w-16 h-16 rounded-3xl bg-white dark:bg-[#141b27] border border-slate-200/80 dark:border-white/10 shadow-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Building2 className="w-8 h-8 stroke-[2.2]" />
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-3 h-3 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Brand Title */}
      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
        Ownera
      </h2>

      {/* Dynamic Status Message */}
      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 max-w-xs mx-auto mb-6">
        {message}
      </p>

      {/* Smooth Shimmering Progress Bar */}
      <div className="w-48 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden relative">
        <div className="h-full bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 rounded-full w-2/3 animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  );
}
