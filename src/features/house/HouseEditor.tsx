import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
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
import { db } from '../../firebase';
import { getFriendlyErrorMessage, handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import {
  createDefaultRoom,
  createInitialFloorPlan,
  createNextFloor,
  DEFAULT_HOUSE_PRICES,
} from '../../lib/house/presets';
import type {
  Floor,
  FloorPlan,
  HouseSelection,
  HouseSite,
  HouseToolMode,
  HouseUnitPrices,
  Opening,
  Point2D,
  Room,
  SceneUnits,
  Wall,
} from '../../lib/house/types';
import { useToast } from '../../components/ToastProvider';
import type { ProjectDoc } from '../../types/models';
import { useDebouncedFirestoreSave } from '../shared/useDebouncedFirestoreSave';
import { BASE_PIXELS_PER_METER, FloorPlanCanvas } from './FloorPlanCanvas';
import { FloorTabs } from './FloorTabs';
import { RoomPalette } from './RoomPalette';
import { RoomPropertiesPanel } from './RoomPropertiesPanel';

type FloorPlanSnapshot = Omit<FloorPlan, 'updatedAt'>;

const MAX_UNDO_HISTORY = 50;

interface HouseEditorProps {
  project: ProjectDoc;
  onRenameProject: (projectId: string, newName: string) => Promise<void>;
  onRequestExit: () => void;
  onUnsavedStateChange?: (state: {
    hasUnsavedChanges: boolean;
    flushSave: () => Promise<void>;
  }) => void;
}

function clonePlan(plan: FloorPlanSnapshot): FloorPlanSnapshot {
  return {
    version: 1,
    units: plan.units,
    gridSize: plan.gridSize,
    site: { ...plan.site },
    floors: plan.floors.map((fl) => ({
      ...fl,
      walls: fl.walls.map((w) => ({ ...w })),
      rooms: fl.rooms.map((r) => ({
        ...r,
        polygon: r.polygon.map((p) => ({ ...p })),
      })),
      openings: fl.openings.map((o) => ({ ...o })),
    })),
  };
}

export function HouseEditor({
  project,
  onRenameProject,
  onRequestExit,
  onUnsavedStateChange,
}: HouseEditorProps) {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [plan, setPlan] = useState<FloorPlanSnapshot>(() => createInitialFloorPlan());
  const [activeFloorId, setActiveFloorId] = useState<string>(
    () => plan.floors[0].id
  );
  const [selection, setSelection] = useState<HouseSelection>(null);
  const [toolMode, setToolMode] = useState<HouseToolMode>('select');
  const [prices, setPrices] = useState<HouseUnitPrices>(DEFAULT_HOUSE_PRICES);

  const [snap, setSnap] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point2D>({ x: 5, y: 5 });
  const [viewportPx, setViewportPx] = useState({ width: 900, height: 600 });

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  // In-memory undo/redo stack (max 50, cleared on unmount)
  const pastRef = useRef<FloorPlanSnapshot[]>([]);
  const futureRef = useRef<FloorPlanSnapshot[]>([]);
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  const syncHistoryFlags = useCallback(() => {
    setHistoryMeta({
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  const pushPlanSnapshot = useCallback(
    (nextPlan: FloorPlanSnapshot) => {
      pastRef.current = [...pastRef.current.slice(-(MAX_UNDO_HISTORY - 1)), clonePlan(plan)];
      futureRef.current = [];
      setPlan(nextPlan);
      syncHistoryFlags();
    },
    [plan, syncHistoryFlags]
  );

  const commitPlanFromBaseline = useCallback(
    (baselinePlan: FloorPlanSnapshot, finalPlan: FloorPlanSnapshot) => {
      if (JSON.stringify(baselinePlan) === JSON.stringify(finalPlan)) return;
      pastRef.current = [
        ...pastRef.current.slice(-(MAX_UNDO_HISTORY - 1)),
        clonePlan(baselinePlan),
      ];
      futureRef.current = [];
      setPlan(finalPlan);
      syncHistoryFlags();
    },
    [syncHistoryFlags]
  );

  const planRef = useRef(plan);
  planRef.current = plan;

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [clonePlan(planRef.current), ...futureRef.current].slice(
      0,
      MAX_UNDO_HISTORY
    );
    setPlan(prev);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-(MAX_UNDO_HISTORY - 1)), clonePlan(planRef.current)];
    setPlan(next);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  // Clear undo/redo stack on unmount
  useEffect(() => {
    return () => {
      pastRef.current = [];
      futureRef.current = [];
    };
  }, []);

  const handleAutosaveError = useCallback(
    (error: unknown) => {
      showToast({
        variant: 'error',
        title: 'Floor plan save failed',
        message: getFriendlyErrorMessage(error),
      });
    },
    [showToast]
  );

  const {
    status: rawSaveStatus,
    hasUnsavedChanges,
    hasError,
    markBaseline,
    flushSave,
  } = useDebouncedFirestoreSave(project.projectId, 'floorPlan', plan, 800, {
    enabled: hydrated,
    onError: handleAutosaveError,
  });

  const saveStatus = hasError ? 'error' : rawSaveStatus;

  useEffect(() => {
    onUnsavedStateChange?.({ hasUnsavedChanges, flushSave });
  }, [hasUnsavedChanges, flushSave, onUnsavedStateChange]);

  useEffect(() => {
    if (!editingName) {
      setDraftName(project.name);
    }
  }, [project.name, editingName]);

  const computeFitView = useCallback(
    (targetPlan: FloorPlanSnapshot, vp: { width: number; height: number }) => {
      const spanW = Math.max(6, targetPlan.site.width + 6);
      const spanH = Math.max(6, targetPlan.site.depth + 6);
      const fitZoomX = vp.width / (spanW * BASE_PIXELS_PER_METER);
      const fitZoomY = vp.height / (spanH * BASE_PIXELS_PER_METER);
      const nextZoom = Number(
        Math.min(4, Math.max(0.5, Math.min(fitZoomX, fitZoomY))).toFixed(2)
      );
      return {
        pan: {
          x: Number((targetPlan.site.width / 2).toFixed(2)),
          y: Number((targetPlan.site.depth / 2).toFixed(2)),
        },
        zoom: nextZoom,
      };
    },
    []
  );

  const viewportPxRef = useRef(viewportPx);
  viewportPxRef.current = viewportPx;

  // Hydrate floorPlan from Firestore on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHydrated(false);
    setSelection(null);
    setToolMode('select');
    pastRef.current = [];
    futureRef.current = [];
    syncHistoryFlags();

    void (async () => {
      try {
        const snapDoc = await getDoc(doc(db, 'projects', project.projectId));
        if (cancelled) return;

        const data = snapDoc.exists() ? (snapDoc.data() as ProjectDoc) : null;
        if (data) {
          console.log(`[Firestore Diagnostic][HouseEditor] projects/${project.projectId}`, {
            ownerType: data.ownerType,
            ownerId: data.ownerId,
            module: data.module,
            createdBy: data.createdBy,
          });
        }
        const existingFp = data?.floorPlan;

        const hydratedPlan: FloorPlanSnapshot =
          existingFp && Array.isArray(existingFp.floors) && existingFp.floors.length > 0
            ? {
                version: 1,
                units: existingFp.units ?? 'metric',
                gridSize: existingFp.gridSize ?? 1,
                site: {
                  width: existingFp.site?.width ?? 10,
                  depth: existingFp.site?.depth ?? 10,
                },
                floors: existingFp.floors.map((fl, idx) => ({
                  id: String(fl.id || `flr_${idx}`).slice(0, 128),
                  name: String(fl.name || `Floor ${idx}`).trim().slice(0, 120) || `Floor ${idx}`,
                  level: Number.isFinite(fl.level) ? Math.round(fl.level) : idx,
                  walls: Array.isArray(fl.walls)
                    ? fl.walls.slice(0, 500).map((w) => ({
                        id: String(w.id || 'wl').slice(0, 128),
                        x1: Number.isFinite(w.x1) ? w.x1 : 0,
                        y1: Number.isFinite(w.y1) ? w.y1 : 0,
                        x2: Number.isFinite(w.x2) ? w.x2 : 1,
                        y2: Number.isFinite(w.y2) ? w.y2 : 0,
                        thickness:
                          Number.isFinite(w.thickness) && w.thickness > 0
                            ? Math.min(5, w.thickness)
                            : 0.2,
                      }))
                    : [],
                  rooms: Array.isArray(fl.rooms)
                    ? fl.rooms.slice(0, 200).map((r, rIdx) => ({
                        id: String(r.id || `rm_${rIdx}`).slice(0, 128),
                        name:
                          String(r.name || `Room ${rIdx + 1}`).trim().slice(0, 120) ||
                          `Room ${rIdx + 1}`,
                        floorId: String(r.floorId || fl.id || `flr_${idx}`).slice(0, 128),
                        polygon:
                          Array.isArray(r.polygon) && r.polygon.length >= 3
                            ? r.polygon.slice(0, 100).map((pt) => ({
                                x: Number.isFinite(pt.x) ? pt.x : 0,
                                y: Number.isFinite(pt.y) ? pt.y : 0,
                              }))
                            : [
                                { x: 0, y: 0 },
                                { x: 4, y: 0 },
                                { x: 4, y: 5 },
                                { x: 0, y: 5 },
                              ],
                      }))
                    : [],
                  openings: Array.isArray(fl.openings)
                    ? fl.openings.slice(0, 500).map((op) => ({
                        id: String(op.id || 'op').slice(0, 128),
                        wallId: String(op.wallId || '').slice(0, 128),
                        type: op.type === 'window' ? ('window' as const) : ('door' as const),
                        offset:
                          Number.isFinite(op.offset) && op.offset >= 0
                            ? Math.min(10000, op.offset)
                            : 0,
                        width:
                          Number.isFinite(op.width) && op.width > 0
                            ? Math.min(1000, op.width)
                            : 0.9,
                        height:
                          Number.isFinite(op.height) && op.height > 0
                            ? Math.min(20, op.height)
                            : 2.1,
                      }))
                    : [],
                })),
              }
            : createInitialFloorPlan();

        setPlan(hydratedPlan);
        setActiveFloorId(hydratedPlan.floors[0].id);

        if (existingFp && Array.isArray(existingFp.floors) && existingFp.floors.length > 0) {
          markBaseline(hydratedPlan);
        } else {
          markBaseline(null);
        }

        const fitted = computeFitView(hydratedPlan, viewportPxRef.current);
        setPan(fitted.pan);
        setZoom(fitted.zoom);
        setHydrated(true);
      } catch (error) {
        if (!cancelled) {
          try {
            handleFirestoreError(
              error,
              OperationType.GET,
              `projects/${project.projectId}`
            );
          } catch (wrapped) {
            showToast({
              variant: 'error',
              title: 'Could not load floor plan',
              message: getFriendlyErrorMessage(wrapped),
            });
          }
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
  }, [project.projectId, computeFitView, markBaseline, showToast, syncHistoryFlags]);

  const activeFloor = useMemo(() => {
    return plan.floors.find((f) => f.id === activeFloorId) ?? plan.floors[0];
  }, [plan.floors, activeFloorId]);

  // Warn before closing tab if unsaved changes remain
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

  // Keyboard shortcuts
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const activeFloorRef = useRef(activeFloor);
  activeFloorRef.current = activeFloor;

  const updateActiveFloor = useCallback(
    (updater: (floor: Floor) => Floor) => {
      const curr = planRef.current;
      const targetId = activeFloorRef.current.id;
      const nextPlan: FloorPlanSnapshot = {
        ...curr,
        floors: curr.floors.map((f) => (f.id === targetId ? updater(f) : f)),
      };
      pushPlanSnapshot(nextPlan);
    },
    [pushPlanSnapshot]
  );

  const handleDeleteSelection = useCallback(
    (sel: HouseSelection) => {
      if (!sel || sel.kind === 'site') return;
      if (sel.kind === 'room') {
        updateActiveFloor((f) => ({
          ...f,
          rooms: f.rooms.filter((r) => r.id !== sel.id),
        }));
      } else if (sel.kind === 'wall') {
        updateActiveFloor((f) => ({
          ...f,
          walls: f.walls.filter((w) => w.id !== sel.id),
          openings: f.openings.filter((o) => o.wallId !== sel.id),
        }));
      } else if (sel.kind === 'opening') {
        updateActiveFloor((f) => ({
          ...f,
          openings: f.openings.filter((o) => o.id !== sel.id),
        }));
      }
      setSelection(null);
    },
    [updateActiveFloor]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setToolMode('select');
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

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current) {
        if (selectionRef.current.kind !== 'site') {
          e.preventDefault();
          handleDeleteSelection(selectionRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleDeleteSelection]);

  const handleAddRoom = () => {
    const nextRoom = createDefaultRoom(
      plan.site.width / 2,
      plan.site.depth / 2,
      activeFloor.id,
      activeFloor.rooms.length + 1
    );
    if (snap && plan.gridSize > 0) {
      const g = plan.gridSize;
      nextRoom.polygon = nextRoom.polygon.map((pt) => ({
        x: Number((Math.round(pt.x / g) * g).toFixed(3)),
        y: Number((Math.round(pt.y / g) * g).toFixed(3)),
      }));
    }
    updateActiveFloor((f) => ({
      ...f,
      rooms: [...f.rooms, nextRoom],
    }));
    setSelection({ kind: 'room', id: nextRoom.id });
    setToolMode('select');
  };

  const handleAddFloor = () => {
    const created = createNextFloor(plan.floors);
    pushPlanSnapshot({
      ...plan,
      floors: [...plan.floors, created],
    });
    setActiveFloorId(created.id);
    setSelection(null);
  };

  const handleDeleteFloor = (floorId: string) => {
    if (plan.floors.length <= 1) return;
    const remaining = plan.floors.filter((f) => f.id !== floorId);
    pushPlanSnapshot({
      ...plan,
      floors: remaining,
    });
    if (activeFloorId === floorId) {
      setActiveFloorId(remaining[0].id);
      setSelection(null);
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
      // handled upstream
    }
  };

  const handleExportJson = () => {
    const payload = {
      version: plan.version,
      units: plan.units,
      gridSize: plan.gridSize,
      site: plan.site,
      floors: plan.floors,
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
        .replace(/^-|-$/g, '') || 'house-floor-plan';
    link.href = url;
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFit = () => {
    const fitted = computeFitView(plan, viewportPx);
    setPan(fitted.pan);
    setZoom(fitted.zoom);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-slate-700 animate-spin" />
          <p className="text-sm text-slate-600">Loading floor plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Top editor toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
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
              <span className="font-display text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                {project.name}
              </span>
              <Pencil
                className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0"
                aria-hidden="true"
              />
            </button>
          )}

          <FloorTabs
            floors={plan.floors}
            activeFloorId={activeFloor.id}
            onSelectFloor={(id) => {
              setActiveFloorId(id);
              setSelection(null);
            }}
            onAddFloor={handleAddFloor}
            onDeleteFloor={handleDeleteFloor}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo */}
          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              disabled={!historyMeta.canUndo}
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
              disabled={!historyMeta.canRedo}
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
              title="Fit to site"
              aria-label="Fit to site"
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
                onClick={() => setPlan((p) => ({ ...p, units: unitOption }))}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  plan.units === unitOption
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
        <RoomPalette
          toolMode={toolMode}
          onChangeToolMode={setToolMode}
          onAddRoom={handleAddRoom}
          onSelectSite={() => {
            setToolMode('select');
            setSelection({ kind: 'site' });
          }}
          isSiteSelected={selection?.kind === 'site'}
        />

        <div className="flex-1 min-h-[380px] flex flex-col">
          <FloorPlanCanvas
            floor={activeFloor}
            site={plan.site}
            selection={selection}
            toolMode={toolMode}
            units={plan.units}
            gridSize={plan.gridSize}
            snap={snap}
            zoom={zoom}
            pan={pan}
            onSelect={setSelection}
            onChangeToolMode={setToolMode}
            onChangePan={setPan}
            onChangeZoom={setZoom}
            onViewportSizeChange={setViewportPx}
            onLiveFloorChange={(nextFloor) => {
              setPlan((curr) => ({
                ...curr,
                floors: curr.floors.map((f) =>
                  f.id === activeFloor.id ? nextFloor : f
                ),
              }));
            }}
            onCommitFloor={(baselineFloor, finalFloor) => {
              const curr = planRef.current;
              const baselinePlan: FloorPlanSnapshot = {
                ...curr,
                floors: curr.floors.map((f) =>
                  f.id === activeFloor.id ? baselineFloor : f
                ),
              };
              const finalPlan: FloorPlanSnapshot = {
                ...curr,
                floors: curr.floors.map((f) =>
                  f.id === activeFloor.id ? finalFloor : f
                ),
              };
              commitPlanFromBaseline(baselinePlan, finalPlan);
            }}
          />
        </div>

        <RoomPropertiesPanel
          floorPlan={plan}
          activeFloor={activeFloor}
          selection={selection}
          units={plan.units}
          gridSize={plan.gridSize}
          prices={prices}
          onChangePrices={setPrices}
          onChangeGridSize={(next) =>
            pushPlanSnapshot({ ...plan, gridSize: next })
          }
          onUpdateSite={(site: HouseSite) =>
            pushPlanSnapshot({ ...plan, site })
          }
          onUpdateRoom={(roomId: string, patch: Partial<Room>) =>
            updateActiveFloor((f) => ({
              ...f,
              rooms: f.rooms.map((r) => {
                if (r.id !== roomId) return r;
                const next = { ...r, ...patch };
                if (!Array.isArray(next.polygon) || next.polygon.length < 3) {
                  next.polygon = r.polygon;
                }
                return next;
              }),
            }))
          }
          onDeleteRoom={(roomId) =>
            handleDeleteSelection({ kind: 'room', id: roomId })
          }
          onUpdateWall={(wallId: string, patch: Partial<Wall>) =>
            updateActiveFloor((f) => ({
              ...f,
              walls: f.walls.map((w) => {
                if (w.id !== wallId) return w;
                const next = { ...w, ...patch };
                if (!Number.isFinite(next.thickness) || next.thickness <= 0) {
                  next.thickness = w.thickness > 0 ? w.thickness : 0.2;
                }
                return next;
              }),
            }))
          }
          onDeleteWall={(wallId) =>
            handleDeleteSelection({ kind: 'wall', id: wallId })
          }
          onUpdateOpening={(openingId: string, patch: Partial<Opening>) =>
            updateActiveFloor((f) => ({
              ...f,
              openings: f.openings.map((o) => {
                if (o.id !== openingId) return o;
                const next = { ...o, ...patch };
                if (!Number.isFinite(next.height) || next.height <= 0) {
                  next.height = o.height > 0 ? o.height : 2.1;
                }
                return next;
              }),
            }))
          }
          onDeleteOpening={(openingId) =>
            handleDeleteSelection({ kind: 'opening', id: openingId })
          }
          onSelect={setSelection}
        />
      </div>
    </div>
  );
}
