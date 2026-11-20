import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'error' | 'success' | 'info';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 5500);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const isError = toast.variant === 'error';
          const isSuccess = toast.variant === 'success';
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border bg-white shadow-sm transition-all duration-150 ${
                isError
                  ? 'border-red-200'
                  : isSuccess
                  ? 'border-emerald-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isError ? (
                  <AlertCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{toast.title}</p>
                {toast.message && (
                  <p className="mt-0.5 text-xs text-slate-600 leading-relaxed break-words">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
