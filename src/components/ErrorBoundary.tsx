import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          displayDetail = `${parsed.error} (${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'database'})`;
        }
      } catch {
        // Keep original message
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] p-6 text-[#161A16] dark:bg-[#0F120F] dark:text-[#F2F1EC]">
          <div className="w-full max-w-lg rounded-2xl border border-[#E3DFD6] bg-white p-8 dark:border-[#242924] dark:bg-[#161A16]">
            <div className="flex items-center gap-3 text-[#B91C1C] dark:text-[#FCA5A5]">
              <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-xl font-semibold">
                Unable to complete request
              </h1>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#4E544E] dark:text-[#A5ACA5]">
              {displayDetail}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1B4332] px-5 text-sm font-semibold text-white hover:bg-[#143627] dark:bg-[#2D6A4F]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
