import { useState, type FormEvent } from 'react';
import { Building2, X } from 'lucide-react';
import { BLUEPRINT_CONSTRAINTS } from '../types/models';

interface OrganizationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function OrganizationModal({ open, onClose, onCreate }: OrganizationModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < BLUEPRINT_CONSTRAINTS.organization.nameMin) {
      setValidationError('Organization name is required.');
      return;
    }
    if (trimmed.length > BLUEPRINT_CONSTRAINTS.organization.nameMax) {
      setValidationError(
        `Organization name cannot exceed ${BLUEPRINT_CONSTRAINTS.organization.nameMax} characters.`
      );
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setName('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-org-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-700" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="create-org-title"
                className="font-display text-base font-semibold text-slate-900"
              >
                Create organization
              </h2>
              <p className="text-xs text-slate-500">
                You will be assigned as the organization owner.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="org-name-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Organization name
            </label>
            <input
              id="org-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError(null);
              }}
              maxLength={BLUEPRINT_CONSTRAINTS.organization.nameMax}
              placeholder="e.g., Northwind Architecture"
              autoFocus
              disabled={submitting}
              className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {validationError && (
              <p className="mt-1.5 text-xs text-red-600">{validationError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || name.trim().length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? 'Creating...' : 'Create organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
