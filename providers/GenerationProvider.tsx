'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';

export interface TaskResult {
  id?: string;
  status: 'completed' | 'processing' | 'failed';
  data?: unknown;
  generatedAt?: string;
  remainingCredits?: number;
}

interface GenerationContextType {
  activeTaskId: string | null;
  setActiveTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  result: TaskResult | null;
  setResult: React.Dispatch<React.SetStateAction<TaskResult | null>>;
  error: { type: '401' | '429' | '502' | 'generic' | 'offline'; message: string } | null;
  setError: React.Dispatch<React.SetStateAction<{ type: '401' | '429' | '502' | 'generic' | 'offline'; message: string } | null>>;
  resetTaskState: () => void;
}

const GenerationContext = createContext<GenerationContextType | null>(null);

export const GenerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<{ type: '401' | '429' | '502' | 'generic' | 'offline'; message: string } | null>(null);

  const { user } = useAuthContext();

  const resetTaskState = useCallback(() => {
    setActiveTaskId(null);
    setIsProcessing(false);
    setResult(null);
    setError(null);
  }, []);

  // Automatically wipe in-memory context and task state on logout
  useEffect(() => {
    if (!user) {
      resetTaskState();
    }
  }, [user, resetTaskState]);

  const value = useMemo(() => ({
    activeTaskId,
    setActiveTaskId,
    isProcessing,
    setIsProcessing,
    result,
    setResult,
    error,
    setError,
    resetTaskState,
  }), [
    activeTaskId,
    isProcessing,
    result,
    error,
    resetTaskState,
  ]);

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
};

export const useGeneration = () => {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
};
