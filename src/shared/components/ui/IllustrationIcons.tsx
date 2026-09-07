import React from 'react';

export const AcUnitGraphic: React.FC<{ className?: string }> = ({ className = 'w-48 h-28' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Soft cool airflow breeze waves */}
      <svg className="absolute -left-6 bottom-1 w-28 h-20 opacity-40 pointer-events-none" viewBox="0 0 100 60" fill="none">
        <path d="M90 10 Q 50 30 10 50" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 6" />
        <path d="M85 20 Q 55 35 15 55" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
        <path d="M95 5 Q 60 25 25 45" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Main AC indoor split unit */}
      <div className="relative z-10 w-full max-w-[190px] h-[78px] bg-gradient-to-b from-slate-100 via-white to-slate-200 rounded-lg shadow-md border border-slate-200/80 p-2 flex flex-col justify-between">
        {/* Top intake grille */}
        <div className="flex gap-1 justify-center opacity-60">
          <div className="w-8 h-[2px] bg-slate-300 rounded-full" />
          <div className="w-12 h-[2px] bg-slate-300 rounded-full" />
          <div className="w-8 h-[2px] bg-slate-300 rounded-full" />
        </div>

        {/* Brand logo & LED display */}
        <div className="flex justify-between items-center px-2">
          <span className="text-[7px] font-bold tracking-widest text-slate-400 uppercase">INVERTER</span>
          <div className="flex items-center gap-1 bg-sky-950/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-emerald-400 font-semibold shadow-inner">
            <span>24°</span>
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Bottom air swing louver flap */}
        <div className="w-full h-3 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-b border-t border-slate-300/80 shadow-xs flex items-center justify-end px-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
        </div>
      </div>

      {/* Green foliage leaves accent in the corner */}
      <div className="absolute right-0 bottom-0 pointer-events-none opacity-80">
        <svg width="42" height="38" viewBox="0 0 42 38" fill="none">
          <path d="M12 36 C 14 20 28 14 38 12 C 34 26 22 34 12 36 Z" fill="#22c55e" opacity="0.85" />
          <path d="M22 38 C 24 26 34 22 42 20 C 38 30 30 36 22 38 Z" fill="#15803d" />
          <path d="M0 38 C 4 28 16 26 24 26 C 18 34 10 38 0 38 Z" fill="#4ade80" opacity="0.75" />
        </svg>
      </div>
    </div>
  );
};

export const CarWashGraphic: React.FC<{ className?: string }> = ({ className = 'w-14 h-10' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 80 50" fill="none" className="w-full h-full drop-shadow-xs">
        {/* Car body */}
        <path
          d="M10 34 L18 20 C20 16 26 14 36 14 L50 14 C58 14 64 18 68 22 L74 28 C77 30 78 33 78 36 L78 38 C78 40 76 42 74 42 L10 42 C6 42 4 40 4 38 L4 36 C4 34 7 34 10 34 Z"
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        {/* Car windows */}
        <path d="M22 20 L35 17 L35 28 L14 28 Z" fill="#38bdf8" fillOpacity="0.4" stroke="#94a3b8" strokeWidth="1" />
        <path d="M38 17 L52 17 C57 17 62 20 65 24 L68 28 L38 28 Z" fill="#38bdf8" fillOpacity="0.4" stroke="#94a3b8" strokeWidth="1" />
        {/* Wheels */}
        <circle cx="20" cy="40" r="7" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <circle cx="20" cy="40" r="3" fill="#94a3b8" />
        <circle cx="62" cy="40" r="7" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <circle cx="62" cy="40" r="3" fill="#94a3b8" />
        {/* Water foam bubbles */}
        <circle cx="30" cy="10" r="3" fill="#60a5fa" fillOpacity="0.7" />
        <circle cx="45" cy="8" r="4" fill="#38bdf8" fillOpacity="0.7" />
        <circle cx="56" cy="11" r="2.5" fill="#93c5fd" fillOpacity="0.8" />
      </svg>
    </div>
  );
};

export const CleaningSuppliesGraphic: React.FC<{ className?: string }> = ({ className = 'w-14 h-10' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 60 50" fill="none" className="w-full h-full drop-shadow-xs">
        {/* Bucket */}
        <path d="M12 18 L16 44 C16.5 46 18.5 48 21 48 L39 48 C41.5 48 43.5 46 44 44 L48 18 Z" fill="#f97316" />
        {/* Spray bottle */}
        <rect x="34" y="8" width="10" height="24" rx="2" fill="#0284c7" />
        <rect x="37" y="3" width="4" height="6" fill="#e0f2fe" />
        <path d="M33 5 L39 2 L45 2 L42 5 Z" fill="#0369a1" />
        {/* Duster / Mop stick */}
        <line x1="22" y1="2" x2="26" y2="28" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
        <circle cx="22" cy="3" r="5" fill="#facc15" />
        {/* Foam bubbles */}
        <circle cx="28" cy="18" r="3.5" fill="#bae6fd" />
        <circle cx="21" cy="20" r="4" fill="#e0f2fe" />
      </svg>
    </div>
  );
};
