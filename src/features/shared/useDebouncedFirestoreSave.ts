import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { logAndAssertUpdatePayload } from '../../lib/payloadDiagnostics';

export type DebouncedSaveStatus = 'saved' | 'saving' | 'idle';

interface UseDebouncedFirestoreSaveOptions {
  enabled?: boolean;
  onError?: (error: unknown) => void;
}

export function useDebouncedFirestoreSave(
  projectId: string,
  field: string,
  data: unknown,
  delayMs = 800,
  options?: UseDebouncedFirestoreSaveOptions
) {
  const enabled = options?.enabled ?? true;
  const [status, setStatus] = useState<DebouncedSaveStatus>('saved');
  const [hasError, setHasError] = useState(false);

  const lastSavedSignatureRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;

  const dataRef = useRef(data);
  dataRef.current = data;

  const currentSignature = JSON.stringify(data);
  const hasUnsavedChanges =
    enabled && (status === 'saving' || currentSignature !== lastSavedSignatureRef.current);

  const markBaseline = useCallback((baseline: unknown) => {
    lastSavedSignatureRef.current = JSON.stringify(baseline);
    setHasError(false);
    setStatus('saved');
  }, []);

  const performWrite = useCallback(
    async (payloadData: unknown, signature: string) => {
      const path = `projects/${projectId}`;
      inFlightRef.current = true;
      setStatus('saving');
      setHasError(false);

      const writePayload =
        payloadData && typeof payloadData === 'object' && !Array.isArray(payloadData)
          ? { ...(payloadData as Record<string, unknown>), updatedAt: serverTimestamp() }
          : payloadData;

      const fullPayload: Record<string, unknown> = {
        [field]: writePayload,
        updatedAt: serverTimestamp(),
      };

      if (field === 'scene' || field === 'floorPlan') {
        logAndAssertUpdatePayload('useDebouncedFirestoreSave', projectId, field, fullPayload);
      }

      try {
        await updateDoc(doc(db, 'projects', projectId), fullPayload);
        lastSavedSignatureRef.current = signature;
        setStatus('saved');
      } catch (error) {
        setHasError(true);
        setStatus('idle');
        try {
          handleFirestoreError(error, OperationType.UPDATE, path);
        } catch (wrappedError) {
          onErrorRef.current?.(wrappedError);
          throw wrappedError;
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [projectId, field]
  );

  const flushSave = useCallback(async () => {
    if (!enabled) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const sig = JSON.stringify(dataRef.current);
    if (sig === lastSavedSignatureRef.current) {
      setStatus('saved');
      return;
    }
    await performWrite(dataRef.current, sig);
  }, [enabled, performWrite]);

  useEffect(() => {
    if (!enabled) return;
    if (currentSignature === lastSavedSignatureRef.current) {
      if (!inFlightRef.current) {
        setStatus('saved');
      }
      return;
    }

    setStatus('idle');
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void performWrite(dataRef.current, currentSignature).catch(() => {
        // Error surfaced via onError callback
      });
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, projectId, field, currentSignature, delayMs, performWrite]);

  return {
    status,
    hasUnsavedChanges,
    hasError,
    markBaseline,
    flushSave,
  };
}
