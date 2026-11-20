import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  Magnet,
  Maximize2,
  Pencil,
  Redo2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '../../lib/firestoreErrors';
import {
  createDefaultElement,
  createInitialScene,
} from '../../lib/sports/presets';
import { fetchProjectSceneDoc } from '../../lib/sports/sceneService';
import type {
  Point2D,
  SceneElement,
  SceneElementType,
  SceneUnits,
} from '../../lib/sports/types';
import { useToast } from '../../components/ToastProvider';
import type { ProjectDoc } from '../../types/models';
import { BASE_PIXELS_PER_METER, Canvas2D } from './Canvas2D';
import { CostSummary } from './CostSummary';
import { ElementPalette } from './ElementPalette';
import { PropertiesPanel } from './PropertiesPanel';
import { useSceneAutosave } from './useSceneAutosave';
import { useUndoRedo } from './useUndoRedo';

interface SportsEditorProps {
  project: ProjectDoc;
  onRenameProject: (projectId: string, newName: string) => Promise<void>;
  onRequestExit: () => void;
  onUnsavedStateChange?: (state: {
    hasUnsavedChanges: boolean;
    flushSave: () => Promise<void>;
  }) => void;
}

export function SportsEditor({
  project,
  onRenameProject,
  onRequestExit,
  onUnsavedStateChange,
}: SportsEditorProps) {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [units, setUnits] = useState<SceneUnits>('metric');
  const [gridSize, setGridSize] = useState<number>(1);
  const [snap, setSnap] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point2D>({ x: 14, y: 8 });
  const [viewportPx, setViewportPx] = useState({ width: 900, height: 600 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  const {
    present: elements,
    canUndo,
    canRedo,
    pushSnapshot,
    replacePresent,
    commitFromBaseline,
    undo,
    redo,
    resetHistory,
  } = useUndoRedo([]);

  const handleAutosaveError = useCallback(
    (error: unknown) => {
      showToast({
        variant: 'error',
        title: 'Scene save failed',
        message: getFriendlyErrorMessage(error),
      });
    },
    [showToast]
  );

  const { saveStatus, hasUnsavedChanges, markHydratedBaseline, flushSave } =
    useSceneAutosave({
      projectId: project.projectId,
      hydrated,
      units,
      gridSize,
      elements,
      onError: handleAutosaveError,
    });

  useEffect(() => {
    onUnsavedStateChange?.({ hasUnsavedChanges, flushSave });
  }, [hasUnsavedChanges, flushSave, onUnsavedStateChange]);

  // Keep draft name synced if project updates externally
  useEffect(() => {
    if (!editingName) {
      setDraftName(project.name);
    }
  }, [project.name, editingName]);

  const computeFitView = useCallback(
    (els: SceneElement[], vp: { width: number; height: number }) => {
      if (els.length === 0) {
        return { pan: { x: 10, y: 6 }, zoom: 1 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of els) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
      const spanW = Math.max(4, maxX - minX + 6);
      const spanH = Math.max(4, maxY - minY + 6);
      const fitZoomX = vp.width / (spanW * BASE_PIXELS_PER_METER);
      const fitZoomY = vp.height / (spanH * BASE_PIXELS_PER_METER);
      const nextZoom = Number(
        Math.min(4, Math.max(0.5, Math.min(fitZoomX, fitZoomY))).toFixed(2)
      );
      return {
        pan: {
          x: Number(((minX + maxX) / 2).toFixed(2)),
          y: Number(((minY + maxY) / 2).toFixed(2)),
        },
        zoom: nextZoom,
      };
    },
    []
  );

  const viewportPxRef = useRef(viewportPx);
  viewportPxRef.current = viewportPx;

  // Hydrate scene from Firestore on mount or project change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHydrated(false);
    setSelectedId(null);

    void (async () => {
      try {
        const docData = await fetchProjectSceneDoc(project.projectId);
        if (cancelled) return;

        const existingScene = docData?.scene;
        const initialScene = existingScene
          ? {
              version: 1 as const,
              units: existingScene.units ?? 'metric',
              gridSize: existingScene.gridSize ?? 1,
              elements: Array.isArray(existingScene.elements)
                ? existingScene.elements
                : [],
            }
          : createInitialScene(docData?.sport ?? project.sport ?? 'custom');

        setUnits(initialScene.units);
        setGridSize(initialScene.gridSize);
        resetHistory(initialScene.elements);

        if (existingScene) {
          markHydratedBaseline(initialScene);
        } else {
          // Missing scene on legacy doc -> mark dirty so autosave persists preset
          markHydratedBaseline({
            version: 1,
            units: initialScene.units,
            gridSize: initialScene.gridSize,
            elements: [],
          });
        }

        const fitted = computeFitView(initialScene.elements, viewportPxRef.current);
        setPan(fitted.pan);
        setZoom(fitted.zoom);
        setHydrated(true);
      } catch (error) {
        if (!cancelled) {
          showToast({
            variant: 'error',
            title: 'Could not load sports scene',
            message: getFriendlyErrorMessage(error),
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.projectId, resetHistory, markHydratedBaseline, computeFitView, showToast]);

  // Warn browser unload if unsaved changes remain
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts: Delete, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        e.preventDefault();
        const idToRemove = selectedIdRef.current;
        pushSnapshot(elementsRef.current.filter((el) => el.id !== idToRemove));
        setSelectedId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, pushSnapshot]);

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId]
  );

  const handleAddElement = (type: SceneElementType) => {
    const created = createDefaultElement(type, pan.x, pan.y);
    if (snap && gridSize > 0) {
      created.x = Number((Math.round(created.x / gridSize) * gridSize).toFixed(3));
      created.y = Number((Math.round(created.y / gridSize) * gridSize).toFixed(3));
    }
    pushSnapshot([...elements, created]);
    setSelectedId(created.id);
  };

  const handleUpdateElement = (id: string, patch: Partial<SceneElement>) => {
    pushSnapshot(
      elements.map((el) => (el.id === id ? { ...el, ...patch } : el))
    );
  };

  const handleDeleteElement = (id: string) => {
    pushSnapshot(elements.filter((el) => el.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === project.name) {
      setDraftName(project.name);
      setEditingName(false);
      return;
    }
    try {
      await onRenameProject(project.projectId, trimmed);
      setEditingName(false);
    } catch {
      // toast handled upstream
    }
  };

  const handleExportJson = () => {
    const payload = {
      version: 1,
      elements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName =
      project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sports-scene';
    link.href = url;
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFit = () => {
    const fitted = computeFitView(elements, viewportPx);
    setPan(fitted.pan);
    setZoom(fitted.zoom);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-slate-700 animate-spin" />
          <p className="text-sm text-slate-600">Loading sports scene...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Top editor toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back + editable project name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onRequestExit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Projects</span>
          </button>

          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveName();
              }}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={120}
                autoFocus
                aria-label="Project name"
                className="px-2.5 py-1 text-sm font-semibold text-slate-900 bg-slate-50 border border-blue-500 rounded-md focus:outline-none w-48"
              />
              <button
                type="submit"
                aria-label="Save name"
                className="p-1 rounded bg-slate-900 text-white hover:bg-slate-800"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Cancel rename"
                onClick={() => {
                  setDraftName(project.name);
                  setEditingName(false);
                }}
                className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(project.name);
                setEditingName(true);
              }}
              className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 min-w-0"
              title="Rename project"
            >
              <span className="font-display text-sm font-semibold text-slate-900 truncate max-w-[200px]">
                {project.name}
              </span>
              <Pencil
                className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {/* Center/Right: Undo/Redo, Zoom/Fit, Snap, Units, Save status, Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo */}
          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              title="Undo (Ctrl/Cmd+Z)"
              aria-label="Undo"
              className="p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              aria-label="Redo"
              className="p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom + Fit */}
          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Number(Math.max(0.5, z / 1.2).toFixed(2)))
              }
              title="Zoom out"
              aria-label="Zoom out"
              className="p-1.5 text-slate-700 hover:bg-slate-50"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-slate-700 tabular-nums whitespace-nowrap">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Number(Math.min(4, z * 1.2).toFixed(2)))
              }
              title="Zoom in"
              aria-label="Zoom in"
              className="p-1.5 text-slate-700 hover:bg-slate-50"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              type="button"
              onClick={handleFit}
              title="Fit to elements"
              aria-label="Fit to scene"
              className="px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fit</span>
            </button>
          </div>

          {/* Snap toggle */}
          <button
            type="button"
            onClick={() => setSnap((s) => !s)}
            aria-pressed={snap}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              snap
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Snap: {snap ? 'On' : 'Off'}</span>
          </button>

          {/* Units toggle */}
          <div
            role="group"
            aria-label="Display units"
            className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg"
          >
            {(['metric', 'imperial'] as SceneUnits[]).map((unitOption) => (
              <button
                key={unitOption}
                type="button"
                onClick={() => setUnits(unitOption)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  units === unitOption
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {unitOption === 'metric' ? 'Metric (m)' : 'Imperial (ft)'}
              </button>
            ))}
          </div>

          {/* Save status */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
              saveStatus === 'saved'
                ? 'text-emerald-700'
                : saveStatus === 'saving'
                ? 'text-slate-600'
                : saveStatus === 'error'
                ? 'text-red-700'
                : 'text-amber-700'
            }`}
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : saveStatus === 'saved' ? (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : null}
            <span>
              {saveStatus === 'saved'
                ? 'Saved'
                : saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'error'
                ? 'Save failed'
                : 'Unsaved changes'}
            </span>
          </span>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Three-column editor workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <ElementPalette onAddElement={handleAddElement} />

        <div className="flex-1 min-h-[380px] flex flex-col">
          <Canvas2D
            elements={elements}
            selectedId={selectedId}
            units={units}
            gridSize={gridSize}
            snap={snap}
            zoom={zoom}
            pan={pan}
            onSelectElement={setSelectedId}
            onChangePan={setPan}
            onChangeZoom={setZoom}
            onLiveElementsChange={replacePresent}
            onCommitElements={commitFromBaseline}
            onViewportSizeChange={setViewportPx}
          />
        </div>

        <aside
          aria-label="Properties and cost summary"
          className="w-full lg:w-[280px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between overflow-y-auto"
        >
          <PropertiesPanel
            selectedElement={selectedElement}
            units={units}
            gridSize={gridSize}
            onChangeGridSize={(next) => setGridSize(next)}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
          />

          <CostSummary
            elements={elements}
            units={units}
            selectedId={selectedId}
            onSelectElement={setSelectedId}
          />
        </aside>
      </div>
    </div>
  );
}
