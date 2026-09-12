"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141b27] text-center space-y-2 shadow-xs">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Something went wrong
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              An unexpected error occurred while loading this section.
            </p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
