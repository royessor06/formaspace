import type {
  Point2D,
  SceneElement,
  SceneElementType,
  SceneUnits,
} from './types';

export const METERS_TO_FEET = 3.280839895013123;

export function isSurfaceElementType(type: SceneElementType): boolean {
  return type === 'playing_surface' || type === 'safety_zone' || type === 'custom';
}

export function polygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function rectArea(w: number, h: number): number {
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

export function circleArea(diameter: number): number {
  if (diameter <= 0) return 0;
  const r = diameter / 2;
  return Math.PI * r * r;
}

export function elementArea(el: SceneElement): number {
  if (el.shape === 'circle') {
    return circleArea(el.width);
  }
  return rectArea(el.width, el.height);
}

export function elementPerimeter(el: SceneElement): number {
  if (el.shape === 'circle') {
    if (el.width <= 0) return 0;
    return Math.PI * el.width;
  }
  if (el.width <= 0 || el.height <= 0) return 0;
  return 2 * (el.width + el.height);
}

export function materialQuantity(el: SceneElement): number {
  const factor = Number.isFinite(el.quantityFactor) ? Math.max(0, el.quantityFactor) : 0;
  if (isSurfaceElementType(el.type)) {
    return elementArea(el) * factor;
  }
  return factor;
}

export function elementCost(el: SceneElement): number {
  const price = Number.isFinite(el.unitPrice) ? Math.max(0, el.unitPrice) : 0;
  return materialQuantity(el) * price;
}

export function projectTotal(elements: SceneElement[]): number {
  return elements.reduce((acc, el) => acc + elementCost(el), 0);
}

export function convertLength(meters: number, units: SceneUnits): number {
  if (units === 'imperial') {
    return meters * METERS_TO_FEET;
  }
  return meters;
}

export function toMeters(value: number, units: SceneUnits): number {
  if (units === 'imperial') {
    return value / METERS_TO_FEET;
  }
  return value;
}

export function formatLength(meters: number, units: SceneUnits): string {
  const converted = convertLength(meters, units);
  return `${converted.toFixed(2)} ${units === 'imperial' ? 'ft' : 'm'}`;
}

export function formatArea(squareMeters: number, units: SceneUnits): string {
  if (units === 'imperial') {
    const sqFt = squareMeters * METERS_TO_FEET * METERS_TO_FEET;
    return `${sqFt.toFixed(2)} ft²`;
  }
  return `${squareMeters.toFixed(2)} m²`;
}
