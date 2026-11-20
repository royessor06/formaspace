import { useCallback, useRef, useState } from 'react';
import type { SceneElement } from '../../lib/sports/types';

const MAX_HISTORY = 50;

function cloneElements(elements: SceneElement[]): SceneElement[] {
  return elements.map((el) => ({ ...el }));
}

export function useUndoRedo(initialElements: SceneElement[] = []) {
  const [past, setPast] = useState<SceneElement[][]>([]);
  const [present, setPresent] = useState<SceneElement[]>(() =>
    cloneElements(initialElements)
  );
  const [future, setFuture] = useState<SceneElement[][]>([]);

  const presentRef = useRef<SceneElement[]>(present);
  presentRef.current = present;

  const pushSnapshot = useCallback((nextElements: SceneElement[]) => {
    const snapshot = cloneElements(presentRef.current);
    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snapshot]);
    setPresent(cloneElements(nextElements));
    setFuture([]);
  }, []);

  const replacePresent = useCallback((nextElements: SceneElement[]) => {
    setPresent(cloneElements(nextElements));
  }, []);

  const commitFromBaseline = useCallback(
    (baselineElements: SceneElement[], finalElements: SceneElement[]) => {
      const changed =
        JSON.stringify(baselineElements) !== JSON.stringify(finalElements);
      if (!changed) return;
      setPast((prev) => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        cloneElements(baselineElements),
      ]);
      setPresent(cloneElements(finalElements));
      setFuture([]);
    },
    []
  );

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const current = cloneElements(presentRef.current);
      setFuture((prevFuture) => [current, ...prevFuture.slice(0, MAX_HISTORY - 1)]);
      setPresent(cloneElements(previous));
      return prevPast.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const current = cloneElements(presentRef.current);
      setPast((prevPast) => [...prevPast.slice(-(MAX_HISTORY - 1)), current]);
      setPresent(cloneElements(next));
      return prevFuture.slice(1);
    });
  }, []);

  const resetHistory = useCallback((elements: SceneElement[]) => {
    setPast([]);
    setPresent(cloneElements(elements));
    setFuture([]);
  }, []);

  return {
    present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pushSnapshot,
    replacePresent,
    commitFromBaseline,
    undo,
    redo,
    resetHistory,
  };
}
