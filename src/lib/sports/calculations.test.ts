import { describe, expect, it } from 'vitest';
import {
  circleArea,
  convertLength,
  elementArea,
  elementCost,
  elementPerimeter,
  formatLength,
  materialQuantity,
  polygonArea,
  projectTotal,
  rectArea,
} from './calculations';
import type { SceneElement } from './types';

function makeSurface(overrides: Partial<SceneElement> = {}): SceneElement {
  return {
    id: 'surf_1',
    type: 'playing_surface',
    x: 0,
    y: 0,
    width: 10,
    height: 20,
    rotation: 0,
    shape: 'rect',
    materialId: null,
    materialName: 'Acrylic Coating',
    unitPrice: 15,
    quantityFactor: 1,
    label: 'Court',
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<SceneElement> = {}): SceneElement {
  return {
    id: 'equip_1',
    type: 'hoop',
    x: 0,
    y: 0,
    width: 1.6,
    height: 1.8,
    rotation: 0,
    shape: 'rect',
    materialId: null,
    materialName: 'Basketball Hoop',
    unitPrice: 1200,
    quantityFactor: 1,
    label: 'Hoop',
    ...overrides,
  };
}

describe('sports ground calculations', () => {
  it('computes area of a 10x20 rectangle as 200', () => {
    expect(rectArea(10, 20)).toBe(200);
    expect(elementArea(makeSurface({ width: 10, height: 20, shape: 'rect' }))).toBe(200);
  });

  it('computes area of a circle with diameter 10 as ~78.54', () => {
    expect(circleArea(10)).toBeCloseTo(78.5398, 2);
    expect(
      elementArea(makeSurface({ width: 10, height: 10, shape: 'circle' }))
    ).toBeCloseTo(78.54, 2);
  });

  it('computes polygon area via shoelace formula', () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 20 },
        { x: 0, y: 20 },
      ])
    ).toBe(200);
  });

  it('computes perimeter for rectangles and circles', () => {
    expect(elementPerimeter(makeSurface({ width: 10, height: 20, shape: 'rect' }))).toBe(60);
    expect(
      elementPerimeter(makeSurface({ width: 10, height: 10, shape: 'circle' }))
    ).toBeCloseTo(31.4159, 3);
  });

  it('computes surface material quantity and cost accurately', () => {
    const surface = makeSurface({ width: 10, height: 20, unitPrice: 15, quantityFactor: 1 });
    expect(materialQuantity(surface)).toBe(200);
    expect(elementCost(surface)).toBe(3000);

    const fractionalSurface = makeSurface({
      width: 10,
      height: 20,
      unitPrice: 1.5,
      quantityFactor: 1,
    });
    expect(elementCost(fractionalSurface)).toBe(300);
  });

  it('computes projectTotal across surfaces and equipment', () => {
    const elements: SceneElement[] = [
      makeSurface({ width: 10, height: 20, unitPrice: 15, quantityFactor: 1 }), // 3000
      makeEquipment({ id: 'h1', unitPrice: 1200, quantityFactor: 1 }), // 1200
      makeEquipment({ id: 'h2', unitPrice: 800, quantityFactor: 2 }), // 1600
    ];
    expect(projectTotal(elements)).toBe(5800);
  });

  it('converts meters to imperial feet and formats lengths', () => {
    expect(convertLength(1, 'imperial')).toBeCloseTo(3.28084, 4);
    expect(convertLength(12.5, 'metric')).toBe(12.5);
    expect(formatLength(12.5, 'metric')).toBe('12.50 m');
    expect(formatLength(1, 'imperial')).toBe('3.28 ft');
  });
});
