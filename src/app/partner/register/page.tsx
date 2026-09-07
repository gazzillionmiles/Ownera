'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Wrench,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/src/constants';
import { SERVICE_CATEGORIES } from '@/src/constants/serviceCategories';
import { StateCityPicker } from '@/src/shared/components/StateCityPicker';

// Validation helper regex
const PHONE_REGEX = /^(\+91|0)?[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PartnerRegisterPage() {
  const router = useRouter();
  const { uiUser, user, signUpWithEmail, refreshProfile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  // Step 1: Business Identity
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState(uiUser.name || '');
  const [phone, setPhone] = useState(uiUser.phone || '');
  const [email, setEmail] = useState(uiUser.email || '');
  const [password, setPassword] = useState('');

  // Step 2: Service Categories & Custom Services
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'AC Maintenance & Repair',
    'Cleaning & Pest Control',
  ]);
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  // Step 3: Operating City & Operational Capacity
  const [state, setState] = useState('Karnataka');
  const [city, setCity] = useState('Bengaluru');
  const [crewSize, setCrewSize] = useState<number>(5);
  const [dailyCapacity, setDailyCapacity] = useState<number>(25);
  const [yearsExperience, setYearsExperience] = useState<number>(3);
  const [bio, setBio] = useState(
    'Professional verified team with commercial-grade equipment and standardized service checklists.'
  );

  // Field validation and touched states
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill from authenticated user
  useEffect(() => {
    if (uiUser.name && !contactPerson) setContactPerson(uiUser.name);
    if (uiUser.email && !email) setEmail(uiUser.email);
    if (uiUser.phone && !phone) setPhone(uiUser.phone);
  }, [uiUser, contactPerson, email, phone]);

  // Validation rules
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const isPhoneValid = PHONE_REGEX.test(cleanPhone);
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isCompanyValid = companyName.trim().length >= 2;
  const isContactValid = contactPerson.trim().length >= 2;
  const isPasswordValid = Boolean(user) || password.length >= 6;
  const totalSelectedServices = [...selectedCategories, ...customServices];

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const toggleCategory = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      if (selectedCategories.length === 1 && customServices.length === 0) {
        toast.error('Select at least one service category or custom service');
        return;
      }
      setSelectedCategories(selectedCategories.filter((c) => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  const handleAddCustomService = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;

    if (trimmed.length < 2 || trimmed.length > 50) {
      toast.error('Custom service name must be between 2 and 50 characters');
      return;
    }

    if (
      customServices.some((s) => s.toLowerCase() === trimmed.toLowerCase()) ||
      selectedCategories.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      toast.error('This service is already in your offerings');
      return;
    }

    setCustomServices([...customServices, trimmed]);
    setCustomInput('');
    toast.success(`Added "${trimmed}" to your services`);
  };

  const handleRemoveCustomService = (serviceToRemove: string) => {
    setCustomServices(customServices.filter((s) => s !== serviceToRemove));
  };

  const validateStep1 = () => {
    setTouched({
      companyName: true,
      contactPerson: true,
      phone: true,
      email: true,
      password: true,
    });

    if (!isCompanyValid) {
      toast.error('Please enter a valid company name (at least 2 characters)');
      return false;
    }
    if (!isContactValid) {
      toast.error('Please enter the contact person name');
      return false;
    }
    if (!isPhoneValid) {
      toast.error('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)');
      return false;
    }
    if (!isEmailValid) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!isPasswordValid) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (totalSelectedServices.length === 0) {
      toast.error('Please select at least one standard category or add a custom service');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    setTouched((prev) => ({ ...prev, city: true, crewSize: true }));
    if (!city.trim()) {
      toast.error('Please select your primary operating city');
      return false;
    }
    if (crewSize < 1) {
      toast.error('Field crew size must be at least 1 technician');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as any);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setSubmitting(true);

    try {
      // 1. If user is not authenticated yet, create account
      if (!user) {
        const { error: signUpError } = await signUpWithEmail(email.trim(), password);
        if (signUpError) {
          throw new Error(signUpError.message || 'Failed to create partner account');
        }
      }

      // Format normalized 10-digit phone
      const normalizedPhone = cleanPhone.slice(-10);

      // 2. Register Provider Profile
      const fullBio = `${bio.trim()} • Crew Size: ${crewSize} Technicians • Daily Capacity: ${dailyCapacity} Flats • ${yearsExperience}+ Years in Business.`;

      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          phone: normalizedPhone,
          email: email.trim().toLowerCase(),
          servicesOffered: totalSelectedServices,
          operatingCities: [city.trim()],
          bio: fullBio,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register service provider');
      }

      await refreshProfile();
      toast.success(`Welcome to ${APP_NAME}! Your business profile is registered.`);
      router.push('/partner');
    } catch (err: any) {
      console.error('[PartnerRegister] Error:', err);
      toast.error(err.message || 'Registration failed. Please check your fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-sm shadow-sm">
              O
            </div>
            <div className="leading-tight">
              <span className="font-black text-base text-slate-900 tracking-tight">
                {APP_NAME.toLowerCase()}
              </span>
              <span className="text-[10px] text-blue-600 font-bold block">
                Service Partner Portal
              </span>
            </div>
          </Link>

          <Link
            href="/login?next=/partner"
            className="text-xs font-bold text-slate-600 hover:text-blue-600 transition"
          >
            Already a partner? <span className="text-blue-600 underline">Sign In</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Progress Stepper */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              <span>Service Partner Onboarding</span>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Step {step} of 4
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {step === 1 && 'Tell us about your business'}
            {step === 2 && 'Which services does your crew offer?'}
            {step === 3 && 'Operating region & crew capacity'}
            {step === 4 && 'Review & confirm partner registration'}
          </h1>

          {/* Stepper bar */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-blue-600' : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
          {/* STEP 1: BUSINESS IDENTITY */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Business Identity &amp; Contact Details
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Residential society management and residents will see this company name on quotation bids.
                </p>
              </div>

              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Firm Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={() => handleBlur('companyName')}
                    placeholder="e.g. CoolCare Solutions Pvt Ltd"
                    required
                    className={`w-full px-4 py-3 rounded-xl border text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 ${
                      touched.companyName && !isCompanyValid
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                        : 'border-slate-200 bg-slate-50 focus:ring-blue-500 focus:bg-white'
                    }`}
                  />
                  {touched.companyName && !isCompanyValid && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Company name must be at least 2 characters</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact Person */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Primary Contact Person <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      onBlur={() => handleBlur('contactPerson')}
                      placeholder="e.g. Ramesh Kumar"
                      required
                      className={`w-full px-4 py-2.5 rounded-xl border text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 ${
                        touched.contactPerson && !isContactValid
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:ring-blue-500 focus:bg-white'
                      }`}
                    />
                    {touched.contactPerson && !isContactValid && (
                      <p className="text-rose-600 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Contact person name is required</span>
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Business Phone (10 Digits) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => handleBlur('phone')}
                      placeholder="e.g. 9876543210"
                      required
                      className={`w-full px-4 py-2.5 rounded-xl border text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 ${
                        touched.phone && !isPhoneValid
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:ring-blue-500 focus:bg-white'
                      }`}
                    />
                    {touched.phone && !isPhoneValid ? (
                      <p className="text-rose-600 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Enter a valid 10-digit mobile number</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">Used for WhatsApp campaign invites</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="e.g. contact@coolcare.in"
                    required
                    className={`w-full px-4 py-2.5 rounded-xl border text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 ${
                      touched.email && !isEmailValid
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                        : 'border-slate-200 bg-slate-50 focus:ring-blue-500 focus:bg-white'
                    }`}
                  />
                  {touched.email && !isEmailValid && (
                    <p className="text-rose-600 text-[11px] font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Enter a valid business email address</span>
                    </p>
                  )}
                </div>

                {/* Password if logged out */}
                {!user && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => handleBlur('password')}
                      placeholder="Minimum 6 characters"
                      required
                      className={`w-full px-4 py-2.5 rounded-xl border text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 ${
                        touched.password && !isPasswordValid
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:ring-blue-500 focus:bg-white'
                      }`}
                    />
                    {touched.password && !isPasswordValid ? (
                      <p className="text-rose-600 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Password must be at least 6 characters</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-1">
                        You will use this password to sign into your vendor dashboard.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-sm shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Services</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SERVICE CATEGORIES & CUSTOM OPTION */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Select Your Service Offerings
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Select standard categories or add custom services your team specializes in.
                </p>
              </div>

              {/* Standard Categories Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Standard Categories (12 Options)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SERVICE_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.name);

                    return (
                      <div
                        key={cat.id}
                        onClick={() => toggleCategory(cat.name)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-600/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="font-extrabold text-sm text-slate-900 leading-snug">
                            {cat.name}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                            {cat.description}
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {cat.examples.slice(0, 3).map((ex, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600"
                              >
                                {ex}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Services Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Add Custom Services or Specializations
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Offer niche services not covered above? Add custom service tags (e.g. Balcony Bird Netting, Solar Panel Cleaning, EV Charger Wiring).
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomService();
                      }
                    }}
                    placeholder="Type custom service name and click Add..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomService}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Custom Services Chips */}
                {customServices.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {customServices.map((cs) => (
                      <span
                        key={cs}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold"
                      >
                        <span>{cs}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomService(cs)}
                          className="hover:text-rose-600 transition cursor-pointer"
                          aria-label={`Remove ${cs}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-sm shadow-md shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Capacity</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REGION & CAPACITY */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Operating Location &amp; Crew Capacity
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Societies need to know your technician crew size so their residents can pick non-conflicting time slots on service days.
                </p>
              </div>

              <div className="space-y-4">
                {/* State & City Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Operating City &amp; Region <span className="text-rose-500">*</span>
                  </label>
                  <StateCityPicker
                    selectedCity={city}
                    selectedState={state}
                    onCityChange={(c, s) => {
                      setCity(c);
                      if (s) setState(s);
                    }}
                    onStateChange={(s) => setState(s)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Field Technicians Crew <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={crewSize}
                      onChange={(e) => setCrewSize(Math.max(1, Number(e.target.value)))}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Available for a single society drive</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daily Max Capacity (Flats) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={dailyCapacity}
                      onChange={(e) => setDailyCapacity(Math.max(1, Number(e.target.value)))}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Units serviced in 1 day</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(Math.max(0, Number(e.target.value)))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Industry track record</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company Bio / Overview
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your equipment, background checks, warranty policies, and commercial references..."
                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-sm shadow-md shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Review &amp; Confirm</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {step === 4 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Confirm Partner Registration
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Review your business profile before finalizing your partner registration.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Company Name</span>
                    <span className="text-base font-black text-slate-900">{companyName}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Primary Contact</span>
                    <span className="text-sm font-extrabold text-slate-800">{contactPerson} • {phone}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Operating City</span>
                    <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{city}, {state}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Crew Size</span>
                    <span className="font-extrabold text-blue-600 text-xs sm:text-sm">{crewSize} Technicians</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Daily Capacity</span>
                    <span className="font-extrabold text-emerald-600 text-xs sm:text-sm">{dailyCapacity} Flats / Day</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px] mb-1.5">
                    Service Categories &amp; Offerings ({totalSelectedServices.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {totalSelectedServices.map((c, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-800 font-bold rounded-lg text-xs"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-slate-400 font-bold block uppercase text-[10px] mb-1">Company Bio</span>
                  <p className="text-slate-600 font-medium bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                    {bio}
                  </p>
                </div>
              </div>

              {/* Terms note */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  By registering, you agree to fulfill society bulk service contracts according to standardized checklists, adhere to scheduled arrival windows, and collect settlement directly from residents.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering Partner...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Partner Registration</span>
                      <Check className="w-4 h-4 stroke-[3]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
