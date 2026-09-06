'use client';

import React from 'react';
import { LoginView } from '@/src/shared/components/LoginView';
import { Footer } from '@/src/shared/components/Footer';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#141414] text-white relative overflow-hidden">
      <div className="relative z-10 flex-1 flex items-center justify-center py-12">
        <React.Suspense fallback={null}>
          <LoginView theme="dark" initialMode="forgot" />
        </React.Suspense>
      </div>
      <Footer theme="dark" />
    </div>
  );
}
