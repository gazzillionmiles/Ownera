'use client';

import React from 'react';
import { GenerationProvider } from '@/providers/GenerationProvider';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <GenerationProvider>{children}</GenerationProvider>;
}
