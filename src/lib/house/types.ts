import type { Timestamp } from 'firebase/firestore';
import type { Point2D, SceneUnits } from '../sports/types';

export type { Point2D, SceneUnits };

export interface HouseSite {
  width: number; // meters
  depth: number; // meters
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number; // meters, default 0.2
}

export interface Room {
  id: string;
  name: string;
  polygon: Point2D[]; // closed polygon in meters
  floorId: string;
}

export type OpeningType = 'door' | 'window';

export interface Opening {
  id: string;
  wallId: string;
  type: OpeningType;
  offset: number; // distance from wall start along the wall (meters)
  width: number; // meters
  height: number; // meters
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
}

export interface FloorPlan {
  version: 1;
  units: SceneUnits;
  gridSize: number;
  site: HouseSite;
  floors: Floor[];
  updatedAt?: Timestamp;
}

export type HouseToolMode = 'select' | 'draw_wall' | 'add_door' | 'add_window';

export type HouseSelection =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'site' }
  | null;

export interface HouseUnitPrices {
  wallPricePerM2: number;
  floorPricePerM2: number;
  doorPrice: number;
  windowPrice: number;
}
