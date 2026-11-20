import { useCallback, useEffect, useRef, useState } from 'react';
import { saveProjectScene } from '../../lib/sports/sceneService';
import type { SceneElement, SceneUnits } from '../../lib/sports/types';

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const lastSavedSignatureRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const currentPayload = {
    version: 1 as const,
    units,
    gridSize,
    elements,
  };
  const currentSignature = JSON.stringify(currentPayload);

  const markHydratedBaseline = useCallback(
    (baseline: { version: 1; units: SceneUnits; gridSize: number; elements: SceneElement[] }) => {
      lastSavedSignatureRef.current = JSON.stringify(baseline);
      setSaveStatus('saved');
    },
    []
  );

  const flushSave = useCallback(async () => {
    if (!hydrated) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (currentSignature === lastSavedSignatureRef.current) {
      setSaveStatus('saved');
      return;
    }
    inFlightRef.current = true;
    setSaveStatus('saving');
    try {
      await saveProjectScene(projectId, currentPayload);
      lastSavedSignatureRef.current = currentSignature;
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      onErrorRef.current(error);
    } finally {
      inFlightRef.current = false;
    }
  }, [hydrated, projectId, currentSignature, currentPayload]);

  useEffect(() => {
    if (!hydrated) return;
    if (currentSignature === lastSavedSignatureRef.current) {
      if (!inFlightRef.current) {
        setSaveStatus('saved');
      }
      return;
    }

    setSaveStatus('unsaved');
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void (async () => {
        inFlightRef.current = true;
        setSaveStatus('saving');
        try {
          await saveProjectScene(projectId, currentPayload);
          lastSavedSignatureRef.current = currentSignature;
          setSaveStatus('saved');
        } catch (error) {
          setSaveStatus('error');
          onErrorRef.current(error);
        } finally {
          inFlightRef.current = false;
        }
      })();
    }, 800);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hydrated, projectId, currentSignature]);

  return {
    saveStatus,
    hasUnsavedChanges: saveStatus === 'unsaved' || saveStatus === 'saving',
    markHydratedBaseline,
    flushSave,
  };
}
