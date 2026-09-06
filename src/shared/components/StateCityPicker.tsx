'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, ChevronDown, Check, Loader2, X, Building, Globe } from 'lucide-react';

export interface StateItem {
  name: string;
  state_code: string;
  cities_count: number;
}

export interface CityItem {
  name: string;
  state: string;
}

interface StateCityPickerProps {
  selectedCity: string;
  selectedState?: string;
  onCityChange: (city: string, state?: string) => void;
  onStateChange?: (state: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const StateCityPicker: React.FC<StateCityPickerProps> = ({
  selectedCity,
  selectedState = 'Karnataka',
  onCityChange,
  onStateChange,
  required = false,
  disabled = false,
  className = '',
}) => {
  const [currentState, setCurrentState] = useState<string>(selectedState || 'Karnataka');
  const [currentCity, setCurrentCity] = useState<string>(selectedCity || 'Bengaluru');

  // State Dropdown
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [states, setStates] = useState<StateItem[]>([]);
  const [stateTotal, setStateTotal] = useState(0);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateLoadingMore, setStateLoadingMore] = useState(false);
  const [stateHasMore, setStateHasMore] = useState(false);

  // City Dropdown
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<CityItem[]>([]);
  const [cityTotal, setCityTotal] = useState(0);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityLoadingMore, setCityLoadingMore] = useState(false);
  const [cityHasMore, setCityHasMore] = useState(false);

  // Pagination Refs for rock-solid concurrency & avoiding closure staleness
  const statePageRef = useRef(1);
  const stateHasMoreRef = useRef(false);
  const stateLoadingRef = useRef(false);
  const stateSearchRef = useRef('');

  const cityPageRef = useRef(1);
  const cityHasMoreRef = useRef(false);
  const cityLoadingRef = useRef(false);
  const citySearchRef = useRef('');
  const currentStateRef = useRef(currentState);

  // Keep refs in sync
  useEffect(() => {
    stateSearchRef.current = stateSearch;
  }, [stateSearch]);

  useEffect(() => {
    citySearchRef.current = citySearch;
  }, [citySearch]);

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  // UI Container Refs
  const stateContainerRef = useRef<HTMLDivElement>(null);
  const cityContainerRef = useRef<HTMLDivElement>(null);
  const stateScrollRef = useRef<HTMLDivElement>(null);
  const cityScrollRef = useRef<HTMLDivElement>(null);
  const stateSentinelRef = useRef<HTMLDivElement>(null);
  const citySentinelRef = useRef<HTMLDivElement>(null);
  const searchStateInputRef = useRef<HTMLInputElement>(null);
  const searchCityInputRef = useRef<HTMLInputElement>(null);

  // Sync with prop changes
  useEffect(() => {
    if (selectedCity && selectedCity !== currentCity) {
      setCurrentCity(selectedCity);
    }
  }, [selectedCity, currentCity]);

  useEffect(() => {
    if (selectedState && selectedState !== currentState) {
      setCurrentState(selectedState);
    }
  }, [selectedState, currentState]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (stateContainerRef.current && !stateContainerRef.current.contains(target)) {
        setIsStateOpen(false);
      }
      if (cityContainerRef.current && !cityContainerRef.current.contains(target)) {
        setIsCityOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch States
  const fetchStates = useCallback(async (page: number, search: string, isLoadMore: boolean = false) => {
    if (stateLoadingRef.current) return;
    stateLoadingRef.current = true;

    if (isLoadMore) {
      setStateLoadingMore(true);
    } else {
      setStateLoading(true);
    }

    try {
      const params = new URLSearchParams({
        type: 'states',
        country: 'India',
        page: String(page),
        limit: '20',
        search,
      });

      const res = await fetch(`/api/locations?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load states');
      const json = await res.json();

      const newItems = json.data || [];
      setStates((prev) => (isLoadMore ? [...prev, ...newItems] : newItems));
      setStateTotal(json.total || 0);

      const hasMoreBool = Boolean(json.hasMore);
      setStateHasMore(hasMoreBool);
      stateHasMoreRef.current = hasMoreBool;
      statePageRef.current = page;
    } catch (err) {
      console.error('[StateCityPicker] Error fetching states:', err);
    } finally {
      stateLoadingRef.current = false;
      setStateLoading(false);
      setStateLoadingMore(false);
    }
  }, []);

  // Fetch Cities
  const fetchCities = useCallback(async (stateName: string, page: number, search: string, isLoadMore: boolean = false) => {
    if (cityLoadingRef.current) return;
    cityLoadingRef.current = true;

    if (isLoadMore) {
      setCityLoadingMore(true);
    } else {
      setCityLoading(true);
    }

    try {
      const params = new URLSearchParams({
        type: 'cities',
        country: 'India',
        state: stateName,
        page: String(page),
        limit: '25',
        search,
      });

      const res = await fetch(`/api/locations?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load cities');
      const json = await res.json();

      const newItems = json.data || [];
      setCities((prev) => (isLoadMore ? [...prev, ...newItems] : newItems));
      setCityTotal(json.total || 0);

      const hasMoreBool = Boolean(json.hasMore);
      setCityHasMore(hasMoreBool);
      cityHasMoreRef.current = hasMoreBool;
      cityPageRef.current = page;
    } catch (err) {
      console.error('[StateCityPicker] Error fetching cities:', err);
    } finally {
      cityLoadingRef.current = false;
      setCityLoading(false);
      setCityLoadingMore(false);
    }
  }, []);

  // Initial load & search debounce for States
  useEffect(() => {
    if (!isStateOpen) return;

    statePageRef.current = 1;
    stateHasMoreRef.current = false;
    const timer = setTimeout(() => {
      if (stateScrollRef.current) {
        stateScrollRef.current.scrollTop = 0;
      }
      fetchStates(1, stateSearch, false);
    }, 150);

    return () => clearTimeout(timer);
  }, [isStateOpen, stateSearch, fetchStates]);

  // Initial load & search debounce for Cities
  useEffect(() => {
    if (!isCityOpen || !currentState) return;

    cityPageRef.current = 1;
    cityHasMoreRef.current = false;
    const timer = setTimeout(() => {
      if (cityScrollRef.current) {
        cityScrollRef.current.scrollTop = 0;
      }
      fetchCities(currentState, 1, citySearch, false);
    }, 150);

    return () => clearTimeout(timer);
  }, [isCityOpen, currentState, citySearch, fetchCities]);

  // Focus search inputs when dropdown opens
  useEffect(() => {
    if (isStateOpen) {
      setTimeout(() => searchStateInputRef.current?.focus(), 60);
    }
  }, [isStateOpen]);

  useEffect(() => {
    if (isCityOpen) {
      setTimeout(() => searchCityInputRef.current?.focus(), 60);
    }
  }, [isCityOpen]);

  // Reliable IntersectionObserver for Lazy Loading States on Scroll
  useEffect(() => {
    if (!isStateOpen) return;
    const scrollContainer = stateScrollRef.current;
    const sentinel = stateSentinelRef.current;
    if (!scrollContainer || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && stateHasMoreRef.current && !stateLoadingRef.current) {
          fetchStates(statePageRef.current + 1, stateSearchRef.current, true);
        }
      },
      {
        root: scrollContainer,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isStateOpen, states.length, fetchStates]);

  // Reliable IntersectionObserver for Lazy Loading Cities on Scroll
  useEffect(() => {
    if (!isCityOpen) return;
    const scrollContainer = cityScrollRef.current;
    const sentinel = citySentinelRef.current;
    if (!scrollContainer || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && cityHasMoreRef.current && !cityLoadingRef.current) {
          fetchCities(currentStateRef.current, cityPageRef.current + 1, citySearchRef.current, true);
        }
      },
      {
        root: scrollContainer,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isCityOpen, cities.length, fetchCities]);

  // Dual Fallback onScroll handler for States
  const handleStateScroll = () => {
    if (!stateScrollRef.current || stateLoadingRef.current || !stateHasMoreRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = stateScrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      fetchStates(statePageRef.current + 1, stateSearchRef.current, true);
    }
  };

  // Dual Fallback onScroll handler for Cities
  const handleCityScroll = () => {
    if (!cityScrollRef.current || cityLoadingRef.current || !cityHasMoreRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = cityScrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      fetchCities(currentStateRef.current, cityPageRef.current + 1, citySearchRef.current, true);
    }
  };

  const selectState = (stateName: string) => {
    setCurrentState(stateName);
    setIsStateOpen(false);
    setStateSearch('');
    if (onStateChange) onStateChange(stateName);

    // Reset current city and open city selector for that state
    setCurrentCity('');
    onCityChange('', stateName);
    setTimeout(() => setIsCityOpen(true), 100);
  };

  const selectCity = (cityName: string) => {
    setCurrentCity(cityName);
    setIsCityOpen(false);
    setCitySearch('');
    onCityChange(cityName, currentState);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${className}`}>
      {/* 1. STATE SELECTOR */}
      <div className="relative" ref={stateContainerRef}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-zinc-400" />
            <span>State</span>
            {required && <span className="text-red-400">*</span>}
          </label>
          <span className="text-[10px] text-zinc-500 font-medium">India</span>
        </div>

        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsCityOpen(false);
            setIsStateOpen((prev) => !prev);
          }}
          className={`w-full px-3.5 py-3 rounded-2xl border text-left text-xs flex items-center justify-between transition-all shadow-sm ${
            isStateOpen
              ? 'border-[#2CB7A5] bg-[#1e2025] ring-2 ring-[#2CB7A5]/20 shadow-lg'
              : 'border-white/10 bg-zinc-900/90 hover:border-white/20 hover:bg-zinc-900 text-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0 text-zinc-400">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              {currentState ? (
                <span className="font-semibold text-white text-xs">{currentState}</span>
              ) : (
                <span className="text-zinc-500 text-xs">Choose a State...</span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${
              isStateOpen ? 'rotate-180 text-[#2CB7A5]' : ''
            }`}
          />
        </button>

        {/* State Dropdown Popover */}
        {isStateOpen && (
          <div className="absolute left-0 top-full mt-2 w-full sm:min-w-[320px] z-50 rounded-2xl bg-[#18191D] border border-white/15 shadow-2xl p-2.5 space-y-2.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header info */}
            <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400 font-medium border-b border-white/5 pb-1.5">
              <span>Select State / UT</span>
              {stateTotal > 0 && <span className="text-zinc-500 font-mono text-[10px]">{states.length} of {stateTotal}</span>}
            </div>

            {/* Clean Integrated Search Bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl border border-white/10 focus-within:border-[#2CB7A5] focus-within:ring-1 focus-within:ring-[#2CB7A5]/30 transition-all">
              <Search className="w-4 h-4 text-zinc-400 shrink-0 pointer-events-none" />
              <input
                ref={searchStateInputRef}
                type="text"
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                placeholder="Search state..."
                className="w-full bg-transparent text-white text-xs placeholder:text-zinc-500 focus:outline-none"
              />
              {stateSearch && (
                <button
                  type="button"
                  onClick={() => setStateSearch('')}
                  className="p-0.5 rounded text-zinc-400 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fixed Height Scrollable List with Lazy Loading */}
            <div
              ref={stateScrollRef}
              onScroll={handleStateScroll}
              className="h-[260px] overflow-y-auto space-y-1 pr-1 overscroll-contain select-none"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
            >
              {stateLoading && states.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2CB7A5]" />
                  <span>Loading states...</span>
                </div>
              ) : states.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500 text-center px-4">
                  No states found for &quot;{stateSearch}&quot;
                </div>
              ) : (
                <>
                  {states.map((s) => {
                    const isSelected = currentState.toLowerCase() === s.name.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={s.name}
                        onClick={() => selectState(s.name)}
                        className={`w-full px-3 py-2.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#2CB7A5]/15 text-[#2CB7A5] font-semibold border border-[#2CB7A5]/30 shadow-sm'
                            : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white border border-transparent'
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {s.cities_count > 0 && (
                            <span className="text-[10px] text-zinc-400 bg-zinc-800/90 px-2 py-0.5 rounded-full font-mono">
                              {s.cities_count}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0" />}
                        </div>
                      </button>
                    );
                  })}

                  {/* IntersectionObserver Sentinel for smooth infinite scrolling */}
                  <div ref={stateSentinelRef} className="h-2 w-full" />

                  {/* Loading more spinner */}
                  {stateLoadingMore && (
                    <div className="py-2.5 text-center text-[11px] text-zinc-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2CB7A5]" />
                      <span>Loading more states...</span>
                    </div>
                  )}

                  {!stateHasMore && states.length > 0 && (
                    <div className="py-2 text-center text-[10px] text-zinc-600 font-mono">
                      All {stateTotal} states loaded
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. CITY SELECTOR */}
      <div className="relative" ref={cityContainerRef}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#2CB7A5]" />
            <span>City</span>
            {required && <span className="text-red-400">*</span>}
          </label>
          {currentState && (
            <span className="text-[10px] text-[#2CB7A5] font-medium truncate max-w-[130px]">
              in {currentState}
            </span>
          )}
        </div>

        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled || !currentState}
          onClick={() => {
            setIsStateOpen(false);
            setIsCityOpen((prev) => !prev);
          }}
          className={`w-full px-3.5 py-3 rounded-2xl border text-left text-xs flex items-center justify-between transition-all shadow-sm ${
            isCityOpen
              ? 'border-[#2CB7A5] bg-[#1e2025] ring-2 ring-[#2CB7A5]/20 shadow-lg'
              : 'border-white/10 bg-zinc-900/90 hover:border-white/20 hover:bg-zinc-900 text-white'
          } ${disabled || !currentState ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-6 h-6 rounded-lg bg-[#2CB7A5]/10 border border-[#2CB7A5]/20 flex items-center justify-center shrink-0 text-[#2CB7A5]">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              {currentCity ? (
                <span className="font-semibold text-white text-xs">{currentCity}</span>
              ) : (
                <span className="text-zinc-500 text-xs">
                  {currentState ? `Select city in ${currentState}...` : 'Select State first'}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${
              isCityOpen ? 'rotate-180 text-[#2CB7A5]' : ''
            }`}
          />
        </button>

        {/* City Dropdown Popover */}
        {isCityOpen && (
          <div className="absolute left-0 top-full mt-2 w-full sm:min-w-[320px] z-50 rounded-2xl bg-[#18191D] border border-white/15 shadow-2xl p-2.5 space-y-2.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header info */}
            <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400 font-medium border-b border-white/5 pb-1.5">
              <span>Cities in {currentState}</span>
              {cityTotal > 0 && <span className="text-zinc-500 font-mono text-[10px]">{cities.length} of {cityTotal}</span>}
            </div>

            {/* Clean Integrated Search Bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl border border-white/10 focus-within:border-[#2CB7A5] focus-within:ring-1 focus-within:ring-[#2CB7A5]/30 transition-all">
              <Search className="w-4 h-4 text-zinc-400 shrink-0 pointer-events-none" />
              <input
                ref={searchCityInputRef}
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Search city..."
                className="w-full bg-transparent text-white text-xs placeholder:text-zinc-500 focus:outline-none"
              />
              {citySearch && (
                <button
                  type="button"
                  onClick={() => setCitySearch('')}
                  className="p-0.5 rounded text-zinc-400 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fixed Height Scrollable List with Lazy Loading */}
            <div
              ref={cityScrollRef}
              onScroll={handleCityScroll}
              className="h-[260px] overflow-y-auto space-y-1 pr-1 overscroll-contain select-none"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
            >
              {cityLoading && cities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2CB7A5]" />
                  <span>Loading cities in {currentState}...</span>
                </div>
              ) : cities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <p className="text-xs text-zinc-400">
                    No cities found for &quot;{citySearch}&quot;
                  </p>
                  {citySearch.trim().length > 1 && (
                    <button
                      type="button"
                      onClick={() => selectCity(citySearch.trim())}
                      className="px-3.5 py-1.5 rounded-xl bg-[#2CB7A5]/15 border border-[#2CB7A5]/30 text-[#2CB7A5] hover:bg-[#2CB7A5]/25 text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3 h-3" />
                      <span>Use &quot;{citySearch.trim()}&quot;</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {cities.map((c) => {
                    const isSelected = currentCity.toLowerCase() === c.name.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={`${c.state}-${c.name}`}
                        onClick={() => selectCity(c.name)}
                        className={`w-full px-3 py-2.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#2CB7A5]/15 text-[#2CB7A5] font-semibold border border-[#2CB7A5]/30 shadow-sm'
                            : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white border border-transparent'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] text-zinc-500 font-medium">{c.state}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#2CB7A5] shrink-0" />}
                        </div>
                      </button>
                    );
                  })}

                  {/* IntersectionObserver Sentinel for smooth infinite scrolling */}
                  <div ref={citySentinelRef} className="h-2 w-full" />

                  {/* Loading more spinner */}
                  {cityLoadingMore && (
                    <div className="py-2.5 text-center text-[11px] text-zinc-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2CB7A5]" />
                      <span>Loading more cities...</span>
                    </div>
                  )}

                  {!cityHasMore && cities.length > 0 && (
                    <div className="py-2 text-center text-[10px] text-zinc-600 font-mono">
                      All {cityTotal} cities loaded
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
