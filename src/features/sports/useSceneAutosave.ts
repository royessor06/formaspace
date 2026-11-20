import { useCallback, useMemo } from 'react';
import { sanitizeSceneElements } from '../../lib/sports/sceneService';
import type { SceneElement, SceneUnits } from '../../lib/sports/types';
import { useDebouncedFirestoreSave } from '../shared/useDebouncedFirestoreSave';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface UseSceneAutosaveOptions {
  projectId: string;
  hydrated: boolean;
  units: SceneUnits;
  gridSize: number;
  elements: SceneElement[];
  onError: (error: unknown) => void;
}

export function useSceneAutosave({
  projectId,
  hydrated,
  units,
  gridSize,
  elements,
  onError,
}: UseSceneAutosaveOptions) {
  const sanitizedPayload = useMemo(() => {
    const safeGrid = Number.isFinite(gridSize)
      ? Number(Math.min(10, Math.max(0.1, gridSize)).toFixed(2))
      : 1;
    return {
      version: 1 as const,
      units: units === 'imperial' ? ('imperial' as const) : ('metric' as const),
      gridSize: safeGrid,
      elements: sanitizeSceneElements(elements),
    };
  }, [units, gridSize, elements]);

  const { status, hasUnsavedChanges, hasError, markBaseline, flushSave } =
    useDebouncedFirestoreSave(projectId, 'scene', sanitizedPayload, 800, {
      enabled: hydrated,
      onError,
    });

  const markHydratedBaseline = useCallback(
    (baseline: {
      version: 1;
      units: SceneUnits;
      gridSize: number;
      elements: SceneElement[];
    }) => {
      markBaseline({
        version: 1 as const,
        units: baseline.units === 'imperial' ? 'imperial' : 'metric',
        gridSize: Number(Math.min(10, Math.max(0.1, baseline.gridSize)).toFixed(2)),
        elements: sanitizeSceneElements(baseline.elements),
      });
    },
    [markBaseline]
  );

  const saveStatus: SaveStatus = hasError
    ? 'error'
    : status === 'saving'
    ? 'saving'
    : hasUnsavedChanges
    ? 'unsaved'
    : 'saved';

  return {
    saveStatus,
    hasUnsavedChanges,
    markHydratedBaseline,
    flushSave,
  };
}
