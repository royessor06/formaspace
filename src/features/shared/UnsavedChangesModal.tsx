import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
}

export function UnsavedChangesModal({
  open,
  title = 'Unsaved changes',
  description = 'Your recent edits have not finished saving to Firestore yet.',
  onStay,
  onDiscard,
  onSaveAndLeave,
}: UnsavedChangesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-nav-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-700" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="unsaved-nav-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            Stay in editor
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 whitespace-nowrap"
          >
            Discard &amp; leave
          </button>
          <button
            type="button"
            onClick={onSaveAndLeave}
            className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            Save &amp; leave
          </button>
        </div>
      </div>
    </div>
  );
}
