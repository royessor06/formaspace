import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Armchair,
  Check,
  CheckCircle2,
  Home,
  Pencil,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { formatTimestamp, getModuleLabel } from '../lib/formatters';
import { BLUEPRINT_CONSTRAINTS, type ProjectDoc, type ProjectModule } from '../types/models';

interface ProjectCardProps {
  project: ProjectDoc;
  canDelete: boolean;
  onOpen: (project: ProjectDoc) => void;
  onRename: (projectId: string, newName: string) => Promise<void>;
  onToggleArchive: (project: ProjectDoc) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
}

function ModuleIcon({ module }: { module: ProjectModule }) {
  switch (module) {
    case 'sports':
      return <Trophy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />;
    case 'house':
      return <Home className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />;
    case 'furniture':
      return <Armchair className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />;
  }
}

export function ProjectCard({
  project,
  canDelete,
  onOpen,
  onRename,
  onToggleArchive,
  onDelete,
}: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const isArchived = project.status === 'archived';

  const handleSaveRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === project.name) {
      setDraftName(project.name);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onRename(project.projectId, trimmed);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveToggle = async () => {
    setBusy(true);
    try {
      await onToggleArchive(project);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await onDelete(project.projectId);
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between transition-colors hover:border-slate-300">
      <div>
        {/* Unboxed typographic metadata row (zero-pill discipline) */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
            <ModuleIcon module={project.module} />
            <span className="font-medium text-slate-700">
              {getModuleLabel(project.module)}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                isArchived ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {isArchived ? (
                <Archive className="w-3 h-3" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              )}
              <span>{isArchived ? 'Archived' : 'Active'}</span>
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
            {formatTimestamp(project.createdAt)}
          </span>
        </div>

        {/* Title or inline rename input */}
        <div className="mt-3">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveRename();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={BLUEPRINT_CONSTRAINTS.project.nameMax}
                autoFocus
                disabled={busy}
                aria-label="Project name"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm font-medium text-slate-900 bg-slate-50 border border-blue-500 rounded-lg focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || draftName.trim().length === 0}
                aria-label="Save project name"
                className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraftName(project.name);
                  setEditing(false);
                }}
                aria-label="Cancel rename"
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(project)}
              className="text-left group w-full focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
            >
              <h3 className="font-display text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                {project.name}
              </h3>
            </button>
          )}
        </div>

        <p className="mt-1.5 text-xs text-slate-500">
          {project.ownerType === 'org' ? 'Organization container' : 'Personal container'}
        </p>
      </div>

      {/* Footer actions */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
        {confirmingDelete ? (
          <div className="w-full flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-red-700">Delete permanently?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingDelete(false)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmDelete()}
                className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onOpen(project)}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 rounded px-1 py-0.5"
            >
              {project.module === 'sports' ? 'Open editor' : 'Open container'}
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraftName(project.name);
                  setEditing(true);
                }}
                title="Rename project"
                aria-label={`Rename ${project.name}`}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleArchiveToggle()}
                title={isArchived ? 'Restore project' : 'Archive project'}
                aria-label={isArchived ? `Restore ${project.name}` : `Archive ${project.name}`}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {isArchived ? (
                  <ArchiveRestore className="w-3.5 h-3.5" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
              </button>

              {canDelete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                  title="Delete project"
                  aria-label={`Delete ${project.name}`}
                  className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
