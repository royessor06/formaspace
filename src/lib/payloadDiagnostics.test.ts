import { serverTimestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  createDefaultRoom,
  createInitialFloorPlan,
  createNextFloor,
  generateHouseId,
} from './house/presets';
import {
  describeFieldTypes,
  payloadJsonReplacer,
  validateProjectUpdatePayload,
} from './payloadDiagnostics';
import { sanitizeSceneElements } from './sports/sceneService';
import { createDefaultElement, createInitialScene } from './sports/presets';

describe('Firestore update payload diagnostics (7 checks)', () => {
  it('validates Sports scene update payload against all 7 checks', () => {
    const initial = createInitialScene('basketball');
    const customEl = createDefaultElement('hoop', 5, 6);
    const elements = sanitizeSceneElements([...initial.elements, customEl]);

    const payload: Record<string, unknown> = {
      scene: {
        version: initial.version,
        units: initial.units,
        gridSize: initial.gridSize,
        elements,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    };

    const json = JSON.stringify(payload, payloadJsonReplacer);
    expect(json).toContain('SERVER_TIMESTAMP');

    const types = describeFieldTypes(payload);
    expect(types.updatedAt).toBe('serverTimestamp() sentinel');
    expect(types['scene.updatedAt']).toBe('serverTimestamp() sentinel');

    const results = validateProjectUpdatePayload('scene', payload);
    for (const r of results) {
      expect(r.status, `Check ${r.check} (${r.name}): ${r.details}`).toBe('PASS');
    }
  });

  it('validates House floorPlan update payload (empty and populated floors) against all 7 checks', () => {
    const emptyPlan = createInitialFloorPlan();
    const emptyPayload: Record<string, unknown> = {
      floorPlan: {
        ...emptyPlan,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    };

    const emptyResults = validateProjectUpdatePayload('floorPlan', emptyPayload);
    for (const r of emptyResults) {
      expect(r.status, `Empty Check ${r.check} (${r.name}): ${r.details}`).toBe('PASS');
    }

    const ground = emptyPlan.floors[0];
    const room = createDefaultRoom(5, 5, ground.id, 1);
    const wall = {
      id: generateHouseId('wl'),
      x1: 1,
      y1: 1,
      x2: 8,
      y2: 1,
      thickness: 0.2,
    };
    const opening = {
      id: generateHouseId('op'),
      wallId: wall.id,
      type: 'door' as const,
      offset: 2,
      width: 0.9,
      height: 2.1,
    };
    const level1 = createNextFloor([ground]);

    const populatedPayload: Record<string, unknown> = {
      floorPlan: {
        ...emptyPlan,
        floors: [
          {
            ...ground,
            walls: [wall],
            rooms: [room],
            openings: [opening],
          },
          level1,
        ],
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    };

    const json = JSON.stringify(populatedPayload, payloadJsonReplacer);
    expect(json).toContain('SERVER_TIMESTAMP');

    const types = describeFieldTypes(populatedPayload);
    expect(types.updatedAt).toBe('serverTimestamp() sentinel');
    expect(types['floorPlan.updatedAt']).toBe('serverTimestamp() sentinel');

    const populatedResults = validateProjectUpdatePayload('floorPlan', populatedPayload);
    for (const r of populatedResults) {
      expect(r.status, `Populated Check ${r.check} (${r.name}): ${r.details}`).toBe('PASS');
    }
  });
});
