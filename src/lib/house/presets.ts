import type { Floor, FloorPlan, HouseUnitPrices, Room } from './types';

export const DEFAULT_HOUSE_PRICES: HouseUnitPrices = {
  wallPricePerM2: 120,
  floorPricePerM2: 85,
  doorPrice: 450,
  windowPrice: 380,
};

export function generateHouseId(prefix = 'hs'): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i += 1) {
      token += alphabet[bytes[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < 10; i += 1) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return `${prefix}_${token}`;
}

export function createInitialFloorPlan(): Omit<FloorPlan, 'updatedAt'> {
  return {
    version: 1,
    units: 'metric',
    gridSize: 1,
    site: {
      width: 10,
      depth: 10,
    },
    floors: [
      {
        id: generateHouseId('flr'),
        name: 'Ground floor',
        level: 0,
        walls: [],
        rooms: [],
        openings: [],
      },
    ],
  };
}

export function createNextFloor(existingFloors: Floor[]): Floor {
  const maxLevel =
    existingFloors.length > 0
      ? Math.max(...existingFloors.map((f) => f.level))
      : -1;
  const nextLevel = maxLevel + 1;
  return {
    id: generateHouseId('flr'),
    name: nextLevel === 0 ? 'Ground floor' : `Level ${nextLevel}`,
    level: nextLevel,
    walls: [],
    rooms: [],
    openings: [],
  };
}

export function createDefaultRoom(
  centerX: number,
  centerY: number,
  floorId: string,
  index: number
): Room {
  const width = 4;
  const depth = 5;
  const x = Number((centerX - width / 2).toFixed(3));
  const y = Number((centerY - depth / 2).toFixed(3));
  return {
    id: generateHouseId('rm'),
    name: `Room ${index}`,
    floorId,
    polygon: [
      { x, y },
      { x: Number((x + width).toFixed(3)), y },
      { x: Number((x + width).toFixed(3)), y: Number((y + depth).toFixed(3)) },
      { x, y: Number((y + depth).toFixed(3)) },
    ],
  };
}
