import {
  convertLength,
  formatArea,
  formatLength,
  polygonArea,
  toMeters,
} from '../sports/calculations';
import type {
  Floor,
  FloorPlan,
  HouseUnitPrices,
  Opening,
  Point2D,
  Room,
  Wall,
} from './types';

export { convertLength, formatArea, formatLength, polygonArea, toMeters };

export const DEFAULT_WALL_HEIGHT_METERS = 2.5;

export function wallLength(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

export function wallArea(
  wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>,
  height = DEFAULT_WALL_HEIGHT_METERS
): number {
  if (height <= 0) return 0;
  return wallLength(wall) * height;
}

export function roomArea(room: Pick<Room, 'polygon'>): number {
  return polygonArea(room.polygon);
}

export function roomBounds(room: Pick<Room, 'polygon'>): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (room.polygon.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of room.polygon) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function isRectangularRoom(room: Pick<Room, 'polygon'>): boolean {
  if (room.polygon.length !== 4) return false;
  const xs = Array.from(new Set(room.polygon.map((p) => Number(p.x.toFixed(4)))));
  const ys = Array.from(new Set(room.polygon.map((p) => Number(p.y.toFixed(4)))));
  return xs.length === 2 && ys.length === 2;
}

export function roomCentroid(room: Pick<Room, 'polygon'>): Point2D {
  const pts = room.polygon;
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length < 3) {
    const sum = pts.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const cross = curr.x * next.y - next.x * curr.y;
    signedArea += cross;
    cx += (curr.x + next.x) * cross;
    cy += (curr.y + next.y) * cross;
  }

  if (Math.abs(signedArea) < 1e-6) {
    const bounds = roomBounds(room);
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }

  const factor = 1 / (3 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

export function floorLivingArea(floor: Pick<Floor, 'rooms'>): number {
  return floor.rooms.reduce((sum, room) => sum + roomArea(room), 0);
}

export function totalLivingArea(floorPlan: Pick<FloorPlan, 'floors'>): number {
  return floorPlan.floors.reduce((sum, floor) => sum + floorLivingArea(floor), 0);
}

export function openingArea(opening: Pick<Opening, 'width' | 'height'>): number {
  if (opening.width <= 0 || opening.height <= 0) return 0;
  return opening.width * opening.height;
}

export function wallCost(
  wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>,
  unitPricePerM2: number,
  height = DEFAULT_WALL_HEIGHT_METERS
): number {
  if (!Number.isFinite(unitPricePerM2) || unitPricePerM2 <= 0) return 0;
  return wallArea(wall, height) * unitPricePerM2;
}

export function floorCost(
  floor: Pick<Floor, 'rooms'>,
  unitPricePerM2: number
): number {
  if (!Number.isFinite(unitPricePerM2) || unitPricePerM2 <= 0) return 0;
  return floorLivingArea(floor) * unitPricePerM2;
}

export function openingCost(opening: Opening, unitPrice: number): number {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 0;
  return opening.width > 0 ? unitPrice : 0;
}

export function projectTotal(
  floorPlan: Pick<FloorPlan, 'floors'>,
  prices: HouseUnitPrices
): number {
  return floorPlan.floors.reduce((total, floor) => {
    const wallsSum = floor.walls.reduce(
      (sum, wall) => sum + wallCost(wall, prices.wallPricePerM2),
      0
    );
    const floorAreaSum = floorCost(floor, prices.floorPricePerM2);
    const openingsSum = floor.openings.reduce((sum, op) => {
      const unitPrice = op.type === 'door' ? prices.doorPrice : prices.windowPrice;
      return sum + openingCost(op, unitPrice);
    }, 0);
    return total + wallsSum + floorAreaSum + openingsSum;
  }, 0);
}

export function projectPointOnWall(
  wall: Wall,
  pt: Point2D
): {
  offset: number;
  distance: number;
  pointOnWall: Point2D;
  length: number;
} {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lenSq = dx * dx + dy * dy;
  const len = Math.sqrt(lenSq);
  if (len < 1e-6) {
    return {
      offset: 0,
      distance: Math.hypot(pt.x - wall.x1, pt.y - wall.y1),
      pointOnWall: { x: wall.x1, y: wall.y1 },
      length: 0,
    };
  }
  const tRaw = ((pt.x - wall.x1) * dx + (pt.y - wall.y1) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, tRaw));
  const projX = wall.x1 + t * dx;
  const projY = wall.y1 + t * dy;
  return {
    offset: t * len,
    distance: Math.hypot(pt.x - projX, pt.y - projY),
    pointOnWall: { x: projX, y: projY },
    length: len,
  };
}
