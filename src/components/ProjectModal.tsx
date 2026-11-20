import { useState, type FormEvent } from 'react';
import {
  Archive,
  ArchiveRestore,
  Armchair,
  FolderPlus,
  Home,
  Info,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { formatTimestamp, getModuleLabel } from '../lib/formatters';
import { SPORT_PRESET_LIST } from '../lib/sports/presets';
import type { SportPresetId } from '../lib/sports/types';
import {
  BLUEPRINT_CONSTRAINTS,
  type ProjectDoc,
  type ProjectModule,
} from '../types/models';

interface CreateProjectModalProps {
  open: boolean;
  workspaceName: string;
  onClose: () => void;
  onCreate: (
    name: string,
    module: ProjectModule,
    sport?: SportPresetId
  ) => Promise<void>;
}

const MODULE_OPTIONS: {
  id: ProjectModule;
  label: string;
  description: string;
  icon: typeof Trophy;
}[] = [
  {
    id: 'sports',
    label: 'Sports',
    description: 'Athletic equipment, court, or training container',
    icon: Trophy,
  },
  {
    id: 'house',
    label: 'House',
    description: 'Residential floorplan or room layout container',
    icon: Home,
  },
  {
    id: 'furniture',
    label: 'Furniture',
    description: 'Custom cabinetry, seating, or joinery container',
    icon: Armchair,
  },
];

export function CreateProjectModal({
  open,
  workspaceName,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [module, setModule] = useState<ProjectModule>('sports');
  const [sport, setSport] = useState<SportPresetId>('basketball');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < BLUEPRINT_CONSTRAINTS.project.nameMin) {
      setValidationError('Project name is required.');
      return;
    }
    if (trimmed.length > BLUEPRINT_CONSTRAINTS.project.nameMax) {
      setValidationError(
        `Project name cannot exceed ${BLUEPRINT_CONSTRAINTS.project.nameMax} characters.`
      );
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    try {
      await onCreate(trimmed, module, module === 'sports' ? sport : undefined);
      setName('');
      setModule('sports');
      setSport('basketball');
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
      aria-labelledby="create-project-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <FolderPlus className="w-4 h-4 text-slate-700" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="create-project-title"
                className="font-display text-base font-semibold text-slate-900"
              >
                New project container
              </h2>
              <p className="text-xs text-slate-500">
                Scoped to <span className="font-medium text-slate-700">{workspaceName}</span>
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

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="project-name-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Project name
            </label>
            <input
              id="project-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError(null);
              }}
              maxLength={BLUEPRINT_CONSTRAINTS.project.nameMax}
              placeholder="e.g., West Pavilion Lounge"
              autoFocus
              disabled={submitting}
              className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            {validationError && (
              <p className="mt-1.5 text-xs text-red-600">{validationError}</p>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">
              Module type
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {MODULE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = module === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => setModule(option.id)}
                    className={`p-3 rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      selected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        selected ? 'text-slate-900' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {option.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 leading-snug">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {module === 'sports' && (
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Sport preset
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SPORT_PRESET_LIST.map((preset) => {
                  const selected = sport === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => setSport(preset.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                        selected
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-900">
                        {preset.label}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                        {preset.defaultDimensionsLabel}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              {submitting ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProjectDetailModalProps {
  project: ProjectDoc | null;
  workspaceName: string;
  canDelete: boolean;
  onClose: () => void;
  onToggleArchive: (project: ProjectDoc) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
}

export function ProjectDetailModal({
  project,
  workspaceName,
  canDelete,
  onClose,
  onToggleArchive,
  onDelete,
}: ProjectDetailModalProps) {
  const [busy, setBusy] = useState(false);

  if (!project) return null;

  const isArchived = project.status === 'archived';

  const handleToggleArchive = async () => {
    setBusy(true);
    try {
      await onToggleArchive(project);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await onDelete(project.projectId);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {getModuleLabel(project.module)} Module ·{' '}
              <span className={isArchived ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                {isArchived ? 'Archived' : 'Active'}
              </span>
            </p>
            <h2
              id="project-detail-title"
              className="mt-1 font-display text-lg font-semibold text-slate-900 truncate"
            >
              {project.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 py-4 border-y border-slate-100 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Workspace</dt>
            <dd className="mt-0.5 font-medium text-slate-900 truncate">{workspaceName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Created</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-700 tabular-nums">
              {formatTimestamp(project.createdAt)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Container ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-700 break-all">
              {project.projectId}
            </dd>
          </div>
        </dl>

        <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-slate-600 leading-relaxed">
            This project is currently a workspace container. The{' '}
            <span className="font-medium text-slate-800">
              {getModuleLabel(project.module)}
            </span>{' '}
            module editor is not enabled in this phase.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {canDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete project</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleArchive()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              {isArchived ? (
                <>
                  <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Archive</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
