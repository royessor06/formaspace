import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getFriendlyErrorMessage } from '../lib/firestoreErrors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Uncaught application error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const friendlyMessage = getFriendlyErrorMessage(this.state.error);
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold text-slate-900">
                  Something went wrong
                </h1>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {friendlyMessage}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                Reload workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
