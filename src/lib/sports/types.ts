import type { Timestamp } from 'firebase/firestore';

export type SportPresetId =
  | 'basketball'
  | 'football'
  | 'volleyball'
  | 'tennis'
  | 'handball'
  | 'custom';

export type SceneUnits = 'metric' | 'imperial';

export type SceneElementType =
  | 'playing_surface'
  | 'safety_zone'
  | 'hoop'
  | 'goal'
  | 'post'
  | 'net'
  | 'custom';

export type SceneElementShape = 'rect' | 'circle';

export interface SceneElement {
  id: string;
  type: SceneElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: SceneElementShape;
  materialId: string | null;
  materialName: string;
  unitPrice: number;
  quantityFactor: number;
  label: string;
}

export interface SportsScene {
  version: 1;
  units: SceneUnits;
  gridSize: number;
  elements: SceneElement[];
  updatedAt?: Timestamp;
}

export interface Point2D {
  x: number;
  y: number;
}
