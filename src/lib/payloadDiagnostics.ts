import { FieldValue, Timestamp } from 'firebase/firestore';

export interface PayloadCheckResult {
  check: number;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

export function isServerTimestampSentinel(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof FieldValue) {
    const methodName = (val as unknown as { _methodName?: unknown })._methodName;
    if (typeof methodName === 'string') {
      return methodName === 'serverTimestamp';
    }
    return true;
  }
  return (
    '_methodName' in val &&
    (val as { _methodName?: unknown })._methodName === 'serverTimestamp'
  );
}

export function payloadJsonReplacer(_key: string, value: unknown): unknown {
  if (isServerTimestampSentinel(value)) {
    return 'SERVER_TIMESTAMP';
  }
  if (value instanceof Timestamp) {
    return `Timestamp(${value.toDate().toISOString()})`;
  }
  if (value instanceof Date) {
    return `Date(${value.toISOString()})`;
  }
  return value;
}

export function classifyFieldValue(value: unknown): string {
  if (isServerTimestampSentinel(value)) return 'serverTimestamp() sentinel';
  if (value instanceof Timestamp) return 'Timestamp';
  if (value instanceof Date) return 'Date';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

export function describeFieldTypes(
  obj: unknown,
  prefix = ''
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== 'object' || isServerTimestampSentinel(obj) || obj instanceof Date || obj instanceof Timestamp) {
    if (prefix) out[prefix] = classifyFieldValue(obj);
    return out;
  }

  if (Array.isArray(obj)) {
    out[prefix || 'root'] = `array(${obj.length})`;
    if (obj.length > 0) {
      Object.assign(out, describeFieldTypes(obj[0], `${prefix}[0]`));
    }
    return out;
  }

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out[path] = classifyFieldValue(v);
    if (
      v &&
      typeof v === 'object' &&
      !isServerTimestampSentinel(v) &&
      !(v instanceof Date) &&
      !(v instanceof Timestamp)
    ) {
      if (Array.isArray(v)) {
        if (v.length > 0) {
          Object.assign(out, describeFieldTypes(v[0], `${path}[0]`));
        }
      } else {
        Object.assign(out, describeFieldTypes(v, path));
      }
    }
  }
  return out;
}

function compareExactKeys(actualObj: unknown, expectedKeys: string[]): string | null {
  if (!actualObj || typeof actualObj !== 'object' || Array.isArray(actualObj)) {
    return `Expected object, got ${classifyFieldValue(actualObj)}`;
  }
  const actualKeys = Object.keys(actualObj as Record<string, unknown>);
  const missing = expectedKeys.filter((k) => !actualKeys.includes(k));
  const extra = actualKeys.filter((k) => !expectedKeys.includes(k));
  if (missing.length === 0 && extra.length === 0) return null;
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing=[${missing.join(', ')}]`);
  if (extra.length > 0) parts.push(`extra=[${extra.join(', ')}]`);
  return parts.join('; ');
}

export function validateProjectUpdatePayload(
  field: 'scene' | 'floorPlan',
  payload: Record<string, unknown>
): PayloadCheckResult[] {
  const results: PayloadCheckResult[] = [];

  // 1. Top-level payload keys
  const expectedTopKeys = [field, 'updatedAt'];
  const topDiff = compareExactKeys(payload, expectedTopKeys);
  results.push({
    check: 1,
    name: `Top-level payload keys (${expectedTopKeys.join(', ')})`,
    status: topDiff ? 'FAIL' : 'PASS',
    details: topDiff ?? `Exact keys: [${Object.keys(payload).join(', ')}]`,
  });

  // 2. updatedAt is serverTimestamp() sentinel
  const topUpdatedAtOk = isServerTimestampSentinel(payload.updatedAt);
  const nestedObj = payload[field] as Record<string, unknown> | undefined;
  const nestedUpdatedAtOk =
    nestedObj && typeof nestedObj === 'object'
      ? isServerTimestampSentinel(nestedObj.updatedAt)
      : false;
  results.push({
    check: 2,
    name: 'updatedAt is serverTimestamp() sentinel',
    status: topUpdatedAtOk && nestedUpdatedAtOk ? 'PASS' : 'FAIL',
    details: `payload.updatedAt=${classifyFieldValue(
      payload.updatedAt
    )}, payload.${field}.updatedAt=${classifyFieldValue(nestedObj?.updatedAt)}`,
  });

  // 3. Sports: scene exact keys
  if (field === 'scene') {
    const sceneDiff = compareExactKeys(payload.scene, [
      'version',
      'units',
      'gridSize',
      'elements',
      'updatedAt',
    ]);
    results.push({
      check: 3,
      name: 'Sports scene exact keys { version, units, gridSize, elements, updatedAt }',
      status: sceneDiff ? 'FAIL' : 'PASS',
      details: sceneDiff ?? 'All 5 expected keys present with no extras',
    });

    // 4. Sports: each element exact 13 keys & materialId null or string
    const expectedElementKeys = [
      'id',
      'type',
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'shape',
      'materialId',
      'materialName',
      'unitPrice',
      'quantityFactor',
      'label',
    ];
    const sceneMap = payload.scene as Record<string, unknown> | undefined;
    const elements = Array.isArray(sceneMap?.elements) ? sceneMap.elements : null;
    if (!elements) {
      results.push({
        check: 4,
        name: 'Sports elements exact 13 keys & materialId valid',
        status: 'FAIL',
        details: `scene.elements is ${classifyFieldValue(sceneMap?.elements)}`,
      });
    } else {
      let failureDetail: string | null = null;
      for (let i = 0; i < elements.length; i += 1) {
        const el = elements[i] as Record<string, unknown>;
        const keyDiff = compareExactKeys(el, expectedElementKeys);
        if (keyDiff) {
          failureDetail = `elements[${i}]: ${keyDiff}`;
          break;
        }
        if (el.materialId !== null && typeof el.materialId !== 'string') {
          failureDetail = `elements[${i}].materialId=${String(
            el.materialId
          )} (${classifyFieldValue(el.materialId)})`;
          break;
        }
      }
      results.push({
        check: 4,
        name: 'Sports elements exact 13 keys & materialId valid',
        status: failureDetail ? 'FAIL' : 'PASS',
        details:
          failureDetail ??
          `Verified ${elements.length} element(s) with exact 13 keys and valid materialId`,
      });
    }
  } else {
    results.push({
      check: 3,
      name: 'Sports scene exact keys (N/A for house)',
      status: 'PASS',
      details: 'Skipped (module is house)',
    });
    results.push({
      check: 4,
      name: 'Sports elements exact 13 keys (N/A for house)',
      status: 'PASS',
      details: 'Skipped (module is house)',
    });
  }

  // 5. House: floorPlan exact keys
  if (field === 'floorPlan') {
    const fpDiff = compareExactKeys(payload.floorPlan, [
      'version',
      'units',
      'gridSize',
      'site',
      'floors',
      'updatedAt',
    ]);
    results.push({
      check: 5,
      name: 'House floorPlan exact keys { version, units, gridSize, site, floors, updatedAt }',
      status: fpDiff ? 'FAIL' : 'PASS',
      details: fpDiff ?? 'All 6 expected keys present with no extras',
    });

    // 6. House: each floor exact keys + array fields
    const fpMap = payload.floorPlan as Record<string, unknown> | undefined;
    const floors = Array.isArray(fpMap?.floors) ? fpMap.floors : null;
    if (!floors || floors.length === 0) {
      results.push({
        check: 6,
        name: 'House floors exact keys & walls/rooms/openings arrays',
        status: 'FAIL',
        details: `floorPlan.floors is ${classifyFieldValue(fpMap?.floors)}`,
      });
      results.push({
        check: 7,
        name: 'House walls, rooms, and openings exact keys & polygon size 3..100',
        status: 'FAIL',
        details: 'No floors to inspect',
      });
    } else {
      let floorFailure: string | null = null;
      let entityFailure: string | null = null;

      for (let fIdx = 0; fIdx < floors.length; fIdx += 1) {
        const fl = floors[fIdx] as Record<string, unknown>;
        const flDiff = compareExactKeys(fl, [
          'id',
          'name',
          'level',
          'walls',
          'rooms',
          'openings',
        ]);
        if (flDiff) {
          floorFailure = `floors[${fIdx}]: ${flDiff}`;
          break;
        }
        if (
          !Array.isArray(fl.walls) ||
          !Array.isArray(fl.rooms) ||
          !Array.isArray(fl.openings)
        ) {
          floorFailure = `floors[${fIdx}] arrays: walls=${classifyFieldValue(
            fl.walls
          )}, rooms=${classifyFieldValue(fl.rooms)}, openings=${classifyFieldValue(
            fl.openings
          )}`;
          break;
        }

        for (let wIdx = 0; wIdx < fl.walls.length; wIdx += 1) {
          const wDiff = compareExactKeys(fl.walls[wIdx], [
            'id',
            'x1',
            'y1',
            'x2',
            'y2',
            'thickness',
          ]);
          if (wDiff) {
            entityFailure = `floors[${fIdx}].walls[${wIdx}]: ${wDiff}`;
            break;
          }
        }
        if (entityFailure) break;

        for (let rIdx = 0; rIdx < fl.rooms.length; rIdx += 1) {
          const rm = fl.rooms[rIdx] as Record<string, unknown>;
          const rDiff = compareExactKeys(rm, ['id', 'name', 'polygon', 'floorId']);
          if (rDiff) {
            entityFailure = `floors[${fIdx}].rooms[${rIdx}]: ${rDiff}`;
            break;
          }
          if (
            !Array.isArray(rm.polygon) ||
            rm.polygon.length < 3 ||
            rm.polygon.length > 100
          ) {
            entityFailure = `floors[${fIdx}].rooms[${rIdx}].polygon invalid: ${classifyFieldValue(
              rm.polygon
            )}`;
            break;
          }
        }
        if (entityFailure) break;

        for (let oIdx = 0; oIdx < fl.openings.length; oIdx += 1) {
          const oDiff = compareExactKeys(fl.openings[oIdx], [
            'id',
            'wallId',
            'type',
            'offset',
            'width',
            'height',
          ]);
          if (oDiff) {
            entityFailure = `floors[${fIdx}].openings[${oIdx}]: ${oDiff}`;
            break;
          }
        }
        if (entityFailure) break;
      }

      results.push({
        check: 6,
        name: 'House floors exact keys & walls/rooms/openings arrays',
        status: floorFailure ? 'FAIL' : 'PASS',
        details: floorFailure ?? `Verified ${floors.length} floor(s)`,
      });

      results.push({
        check: 7,
        name: 'House walls, rooms, and openings exact keys & polygon size 3..100',
        status: entityFailure ? 'FAIL' : 'PASS',
        details: entityFailure ?? `Verified all walls, rooms, and openings across ${floors.length} floor(s)`,
      });
    }
  } else {
    results.push({
      check: 5,
      name: 'House floorPlan exact keys (N/A for sports)',
      status: 'PASS',
      details: 'Skipped (module is sports)',
    });
    results.push({
      check: 6,
      name: 'House floors exact keys (N/A for sports)',
      status: 'PASS',
      details: 'Skipped (module is sports)',
    });
    results.push({
      check: 7,
      name: 'House walls/rooms/openings exact keys (N/A for sports)',
      status: 'PASS',
      details: 'Skipped (module is sports)',
    });
  }

  return results;
}

export function logAndAssertUpdatePayload(
  source: string,
  projectId: string,
  field: 'scene' | 'floorPlan',
  fullPayload: Record<string, unknown>
): PayloadCheckResult[] {
  const serialized = JSON.stringify(fullPayload, payloadJsonReplacer, 2);
  const fieldTypes = describeFieldTypes(fullPayload);
  const checks = validateProjectUpdatePayload(field, fullPayload);

  console.log(`[Firestore Diagnostic][${source}] update projects/${projectId}`, {
    payloadJson: serialized,
    fieldTypes,
    checks,
  });

  if (import.meta.env?.DEV) {
    const failed = checks.filter((c) => c.status === 'FAIL');
    if (failed.length > 0) {
      console.error(
        `[Firestore Diagnostic][${source}] Dev assertion failed for projects/${projectId}:`,
        failed
      );
    }
  }

  return checks;
}
