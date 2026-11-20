import { describe, expect, it } from 'vitest';
import {
  floorCost,
  floorLivingArea,
  openingArea,
  openingCost,
  projectTotal,
  roomArea,
  totalLivingArea,
  wallArea,
  wallCost,
  wallLength,
} from './calculations';
import type { Floor, FloorPlan, HouseUnitPrices, Opening, Room, Wall } from './types';

describe('House calculations', () => {
  it('computes 4x5 room area = 20 m²', () => {
    const room: Room = {
      id: 'rm_1',
      name: 'Living Room',
      floorId: 'flr_0',
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 5 },
        { x: 0, y: 5 },
      ],
    };
    expect(roomArea(room)).toBe(20);
  });

  it('computes wall (0,0)-(10,0) length = 10 m and area with default 2.5 m height', () => {
    const wall: Wall = {
      id: 'wl_1',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 0,
      thickness: 0.2,
    };
    expect(wallLength(wall)).toBe(10);
    expect(wallArea(wall)).toBe(25);
    expect(wallArea(wall, 3)).toBe(30);
  });

  it('computes opening 0.9x2.1 area = 1.89 m²', () => {
    const door: Opening = {
      id: 'op_1',
      wallId: 'wl_1',
      type: 'door',
      offset: 2,
      width: 0.9,
      height: 2.1,
    };
    expect(openingArea(door)).toBeCloseTo(1.89, 5);
  });

  it('computes floorLivingArea and totalLivingArea across multiple floors', () => {
    const groundFloor: Floor = {
      id: 'flr_0',
      name: 'Ground floor',
      level: 0,
      walls: [],
      openings: [],
      rooms: [
        {
          id: 'rm_1',
          name: 'Living',
          floorId: 'flr_0',
          polygon: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 5 },
            { x: 0, y: 5 },
          ],
        },
        {
          id: 'rm_2',
          name: 'Kitchen',
          floorId: 'flr_0',
          polygon: [
            { x: 4, y: 0 },
            { x: 7, y: 0 },
            { x: 7, y: 4 },
            { x: 4, y: 4 },
          ],
        },
      ],
    };

    const upperFloor: Floor = {
      id: 'flr_1',
      name: 'Level 1',
      level: 1,
      walls: [],
      openings: [],
      rooms: [
        {
          id: 'rm_3',
          name: 'Bedroom',
          floorId: 'flr_1',
          polygon: [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 6 },
            { x: 0, y: 6 },
          ],
        },
      ],
    };

    const plan: Pick<FloorPlan, 'floors'> = {
      floors: [groundFloor, upperFloor],
    };

    expect(floorLivingArea(groundFloor)).toBe(32);
    expect(floorLivingArea(upperFloor)).toBe(18);
    expect(totalLivingArea(plan)).toBe(50);
  });

  it('computes wallCost, floorCost, openingCost, and projectTotal accurately', () => {
    const wall: Wall = {
      id: 'wl_1',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 0,
      thickness: 0.2,
    };
    const door: Opening = {
      id: 'op_1',
      wallId: 'wl_1',
      type: 'door',
      offset: 1,
      width: 0.9,
      height: 2.1,
    };
    const windowOp: Opening = {
      id: 'op_2',
      wallId: 'wl_1',
      type: 'window',
      offset: 5,
      width: 1.2,
      height: 1.2,
    };
    const floor: Floor = {
      id: 'flr_0',
      name: 'Ground floor',
      level: 0,
      walls: [wall],
      openings: [door, windowOp],
      rooms: [
        {
          id: 'rm_1',
          name: 'Room 1',
          floorId: 'flr_0',
          polygon: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 5 },
            { x: 0, y: 5 },
          ],
        },
      ],
    };

    const prices: HouseUnitPrices = {
      wallPricePerM2: 100,
      floorPricePerM2: 50,
      doorPrice: 400,
      windowPrice: 300,
    };

    // Wall: 10m * 2.5m * 100 = 2500
    expect(wallCost(wall, prices.wallPricePerM2)).toBe(2500);
    // Floor: 20m² * 50 = 1000
    expect(floorCost(floor, prices.floorPricePerM2)).toBe(1000);
    // Openings: 400 + 300 = 700
    expect(openingCost(door, prices.doorPrice)).toBe(400);
    expect(openingCost(windowOp, prices.windowPrice)).toBe(300);
    // Total: 2500 + 1000 + 700 = 4200
    expect(projectTotal({ floors: [floor] }, prices)).toBe(4200);
  });
});
