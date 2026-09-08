'use client';

import React from 'react';
import { LoginView } from '@/src/shared/components/LoginView';
import { Footer } from '@/src/shared/components/Footer';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121316] text-[#1C1C1C] dark:text-white relative overflow-hidden">
      <div className="relative z-10 flex-1 flex items-center justify-center py-12">
        <React.Suspense fallback={null}>
          <LoginView theme="dark" />
        </React.Suspense>
      </div>
      <Footer theme="dark" />
    </div>
  );
}
