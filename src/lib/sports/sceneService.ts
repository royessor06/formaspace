import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../firestoreErrors';
import { logAndAssertUpdatePayload } from '../payloadDiagnostics';
import type { ProjectDoc } from '../../types/models';
import type { SceneElement, SceneUnits } from './types';

function clampNumber(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const mod = ((Math.round(deg) % 360) + 360) % 360;
  return mod;
}

export function sanitizeSceneElements(elements: SceneElement[]): SceneElement[] {
  return elements.slice(0, 200).map((el) => ({
    id: (el.id || 'el').slice(0, 64),
    type: el.type,
    x: Number(clampNumber(el.x, -5000, 5000, 0).toFixed(3)),
    y: Number(clampNumber(el.y, -5000, 5000, 0).toFixed(3)),
    width: Number(clampNumber(el.width, 0.1, 1000, 1).toFixed(3)),
    height: Number(clampNumber(el.height, 0.1, 1000, 1).toFixed(3)),
    rotation: normalizeRotation(el.rotation),
    shape: el.shape === 'circle' ? 'circle' : 'rect',
    materialId: el.materialId ? String(el.materialId).slice(0, 128) : null,
    materialName: String(el.materialName ?? '').slice(0, 120),
    unitPrice: Number(clampNumber(el.unitPrice, 0, 10000000, 0).toFixed(2)),
    quantityFactor: Number(clampNumber(el.quantityFactor, 0, 100000, 1).toFixed(3)),
    label: String(el.label ?? '').slice(0, 120),
  }));
}

export async function fetchProjectSceneDoc(projectId: string): Promise<ProjectDoc | null> {
  const path = `projects/${projectId}`;
  try {
    const snap = await getDoc(doc(db, 'projects', projectId));
    if (!snap.exists()) return null;
    const projectData = snap.data() as ProjectDoc;
    console.log(`[Firestore Diagnostic][fetchProjectSceneDoc] projects/${projectId}`, {
      ownerType: projectData.ownerType,
      ownerId: projectData.ownerId,
      module: projectData.module,
      createdBy: projectData.createdBy,
    });
    return projectData;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveProjectScene(
  projectId: string,
  scene: {
    version: 1;
    units: SceneUnits;
    gridSize: number;
    elements: SceneElement[];
  }
): Promise<void> {
  const path = `projects/${projectId}`;
  const sanitizedElements = sanitizeSceneElements(scene.elements);
  const gridSize = Number(clampNumber(scene.gridSize, 0.1, 10, 1).toFixed(2));

  const fullPayload: Record<string, unknown> = {
    scene: {
      version: 1,
      units: scene.units === 'imperial' ? 'imperial' : 'metric',
      gridSize,
      elements: sanitizedElements,
      updatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  };

  logAndAssertUpdatePayload('saveProjectScene', projectId, 'scene', fullPayload);

  try {
    await updateDoc(doc(db, 'projects', projectId), fullPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
