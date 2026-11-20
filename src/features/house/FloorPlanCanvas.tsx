import { useMemo, useRef, useState } from 'react';
import {
  formatArea,
  formatLength,
  isRectangularRoom,
  projectPointOnWall,
  roomArea,
  roomBounds,
  roomCentroid,
  wallLength,
} from '../../lib/house/calculations';
import { generateHouseId } from '../../lib/house/presets';
import type {
  Floor,
  HouseSelection,
  HouseSite,
  HouseToolMode,
  Opening,
  Point2D,
  Room,
  SceneUnits,
  Wall,
} from '../../lib/house/types';
import {
  BASE_PIXELS_PER_METER,
  BaseCanvas,
  type BaseCanvasElementBox,
  type ResizeCorner,
} from '../shared/BaseCanvas';

export { BASE_PIXELS_PER_METER };

interface CanvasFloorItem extends BaseCanvasElementBox {
  kind: 'room' | 'wall' | 'opening';
  room?: Room;
  wall?: Wall;
  opening?: Opening;
}

type DragState =
  | {
      mode: 'move_room';
      roomId: string;
      startWorld: Point2D;
      origPolygon: Point2D[];
      baselineFloor: Floor;
    }
  | {
      mode: 'resize_room';
      roomId: string;
      corner: ResizeCorner;
      origBounds: { x: number; y: number; width: number; height: number };
      baselineFloor: Floor;
    }
  | {
      mode: 'move_opening';
      openingId: string;
      wall: Wall;
      openingWidth: number;
      baselineFloor: Floor;
    }
  | {
      mode: 'draw_wall';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

interface FloorPlanCanvasProps {
  floor: Floor;
  site: HouseSite;
  selection: HouseSelection;
  toolMode: HouseToolMode;
  units: SceneUnits;
  gridSize: number;
  snap: boolean;
  zoom: number;
  pan: Point2D;
  onSelect: (selection: HouseSelection) => void;
  onChangeToolMode: (mode: HouseToolMode) => void;
  onChangePan: (pan: Point2D) => void;
  onChangeZoom: (zoom: number) => void;
  onLiveFloorChange: (nextFloor: Floor) => void;
  onCommitFloor: (baseline: Floor, finalFloor: Floor) => void;
  onViewportSizeChange?: (size: { width: number; height: number }) => void;
}

function cloneFloor(floor: Floor): Floor {
  return {
    ...floor,
    walls: floor.walls.map((w) => ({ ...w })),
    rooms: floor.rooms.map((r) => ({
      ...r,
      polygon: r.polygon.map((p) => ({ ...p })),
    })),
    openings: floor.openings.map((o) => ({ ...o })),
  };
}

export function FloorPlanCanvas({
  floor,
  site,
  selection,
  toolMode,
  units,
  gridSize,
  snap,
  zoom,
  pan,
  onSelect,
  onChangeToolMode,
  onChangePan,
  onChangeZoom,
  onLiveFloorChange,
  onCommitFloor,
  onViewportSizeChange,
}: FloorPlanCanvasProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const floorRef = useRef(floor);
  floorRef.current = floor;

  const snapValue = (val: number): number => {
    if (!snap || gridSize <= 0) return Number(val.toFixed(3));
    return Number((Math.round(val / gridSize) * gridSize).toFixed(3));
  };

  const wallsById = useMemo(() => {
    const map = new Map<string, Wall>();
    for (const w of floor.walls) {
      map.set(w.id, w);
    }
    return map;
  }, [floor.walls]);

  const canvasItems = useMemo<CanvasFloorItem[]>(() => {
    const roomItems: CanvasFloorItem[] = floor.rooms.map((room) => {
      const bounds = roomBounds(room);
      return {
        id: room.id,
        kind: 'room',
        x: bounds.x,
        y: bounds.y,
        width: Math.max(0.2, bounds.width),
        height: Math.max(0.2, bounds.height),
        rotation: 0,
        room,
      };
    });

    const wallItems: CanvasFloorItem[] = floor.walls.map((wall) => {
      const minX = Math.min(wall.x1, wall.x2);
      const minY = Math.min(wall.y1, wall.y2);
      const w = Math.max(0.2, Math.abs(wall.x2 - wall.x1));
      const h = Math.max(0.2, Math.abs(wall.y2 - wall.y1));
      return {
        id: wall.id,
        kind: 'wall',
        x: minX,
        y: minY,
        width: w,
        height: h,
        rotation: 0,
        wall,
      };
    });

    const openingItems: CanvasFloorItem[] = [];
    for (const opening of floor.openings) {
      const wall = wallsById.get(opening.wallId);
      if (!wall) continue;
      const len = wallLength(wall);
      if (len < 1e-4) continue;
      const ux = (wall.x2 - wall.x1) / len;
      const uy = (wall.y2 - wall.y1) / len;
      const centerDist = Math.min(len, Math.max(0, opening.offset + opening.width / 2));
      const cx = wall.x1 + ux * centerDist;
      const cy = wall.y1 + uy * centerDist;
      const thick = Math.max(0.16, wall.thickness + 0.04);
      openingItems.push({
        id: opening.id,
        kind: 'opening',
        x: cx - opening.width / 2,
        y: cy - thick / 2,
        width: opening.width,
        height: thick,
        rotation: (Math.atan2(uy, ux) * 180) / Math.PI,
        opening,
        wall,
      });
    }

    return [...roomItems, ...wallItems, ...openingItems];
  }, [floor.rooms, floor.walls, floor.openings, wallsById]);

  const selectedRoom =
    selection?.kind === 'room'
      ? floor.rooms.find((r) => r.id === selection.id) ?? null
      : null;

  const showRoomResizeHandles =
    toolMode === 'select' &&
    Boolean(selectedRoom && isRectangularRoom(selectedRoom));

  const placeOpeningOnWall = (
    wall: Wall,
    world: Point2D,
    kind: 'door' | 'window'
  ) => {
    const len = wallLength(wall);
    if (len < 0.3) return;
    const defaultWidth = kind === 'door' ? Math.min(0.9, len) : Math.min(1.2, len);
    const defaultHeight = kind === 'door' ? 2.1 : 1.2;
    const proj = projectPointOnWall(wall, world);
    const rawOffset = proj.offset - defaultWidth / 2;
    const maxOffset = Math.max(0, len - defaultWidth);
    const clampedOffset = Number(
      Math.max(0, Math.min(maxOffset, snap ? snapValue(rawOffset) : rawOffset)).toFixed(3)
    );

    const created: Opening = {
      id: generateHouseId('op'),
      wallId: wall.id,
      type: kind,
      offset: clampedOffset,
      width: Number(defaultWidth.toFixed(3)),
      height: defaultHeight,
    };

    const baseline = cloneFloor(floorRef.current);
    const nextFloor: Floor = {
      ...baseline,
      openings: [...baseline.openings, created],
    };
    onCommitFloor(baseline, nextFloor);
    onSelect({ kind: 'opening', id: created.id });
    onChangeToolMode('select');
  };

  const handlePointerMove = (_e: PointerEvent, world: Point2D) => {
    if (!dragState) return;

    if (dragState.mode === 'draw_wall') {
      const nextX2 = snapValue(world.x);
      const nextY2 = snapValue(world.y);
      setDragState({
        ...dragState,
        x2: nextX2,
        y2: nextY2,
      });
      return;
    }

    if (dragState.mode === 'move_room') {
      const rawDx = world.x - dragState.startWorld.x;
      const rawDy = world.y - dragState.startWorld.y;
      const origFirst = dragState.origPolygon[0];
      const dx = origFirst
        ? snapValue(origFirst.x + rawDx) - origFirst.x
        : Number(rawDx.toFixed(3));
      const dy = origFirst
        ? snapValue(origFirst.y + rawDy) - origFirst.y
        : Number(rawDy.toFixed(3));

      onLiveFloorChange({
        ...floorRef.current,
        rooms: floorRef.current.rooms.map((r) =>
          r.id === dragState.roomId
            ? {
                ...r,
                polygon: dragState.origPolygon.map((pt) => ({
                  x: Number((pt.x + dx).toFixed(3)),
                  y: Number((pt.y + dy).toFixed(3)),
                })),
              }
            : r
        ),
      });
      return;
    }

    if (dragState.mode === 'resize_room') {
      const orig = dragState.origBounds;
      let left = orig.x;
      let right = orig.x + orig.width;
      let top = orig.y;
      let bottom = orig.y + orig.height;
      const minDim = 0.5;

      const wx = snap ? snapValue(world.x) : Number(world.x.toFixed(3));
      const wy = snap ? snapValue(world.y) : Number(world.y.toFixed(3));

      if (dragState.corner === 'nw' || dragState.corner === 'sw') {
        left = Math.min(right - minDim, wx);
      } else {
        right = Math.max(left + minDim, wx);
      }

      if (dragState.corner === 'nw' || dragState.corner === 'ne') {
        top = Math.min(bottom - minDim, wy);
      } else {
        bottom = Math.max(top + minDim, wy);
      }

      const nextPoly: Point2D[] = [
        { x: Number(left.toFixed(3)), y: Number(top.toFixed(3)) },
        { x: Number(right.toFixed(3)), y: Number(top.toFixed(3)) },
        { x: Number(right.toFixed(3)), y: Number(bottom.toFixed(3)) },
        { x: Number(left.toFixed(3)), y: Number(bottom.toFixed(3)) },
      ];

      onLiveFloorChange({
        ...floorRef.current,
        rooms: floorRef.current.rooms.map((r) =>
          r.id === dragState.roomId ? { ...r, polygon: nextPoly } : r
        ),
      });
      return;
    }

    if (dragState.mode === 'move_opening') {
      const proj = projectPointOnWall(dragState.wall, world);
      const maxOffset = Math.max(0, proj.length - dragState.openingWidth);
      const rawOffset = proj.offset - dragState.openingWidth / 2;
      const snapped = snap ? snapValue(rawOffset) : rawOffset;
      const nextOffset = Number(Math.max(0, Math.min(maxOffset, snapped)).toFixed(3));

      onLiveFloorChange({
        ...floorRef.current,
        openings: floorRef.current.openings.map((op) =>
          op.id === dragState.openingId ? { ...op, offset: nextOffset } : op
        ),
      });
    }
  };

  const handlePointerUp = () => {
    if (!dragState) return;

    if (dragState.mode === 'draw_wall') {
      const len = Math.hypot(dragState.x2 - dragState.x1, dragState.y2 - dragState.y1);
      if (len >= 0.2) {
        const createdWall: Wall = {
          id: generateHouseId('wl'),
          x1: dragState.x1,
          y1: dragState.y1,
          x2: dragState.x2,
          y2: dragState.y2,
          thickness: 0.2,
        };
        const baseline = cloneFloor(floorRef.current);
        const nextFloor: Floor = {
          ...baseline,
          walls: [...baseline.walls, createdWall],
        };
        onCommitFloor(baseline, nextFloor);
        onSelect({ kind: 'wall', id: createdWall.id });
      }
      setDragState(null);
      return;
    }

    onCommitFloor(dragState.baselineFloor, floorRef.current);
    setDragState(null);
  };

  const cursorClass =
    toolMode === 'draw_wall'
      ? 'cursor-crosshair'
      : toolMode === 'add_door' || toolMode === 'add_window'
      ? 'cursor-copy'
      : 'cursor-default';

  const selectedIdForBase =
    selection && selection.kind !== 'site' ? selection.id : null;

  return (
    <BaseCanvas
      elements={canvasItems}
      selectedId={selectedIdForBase}
      onSelect={(id) => {
        if (id === null && toolMode === 'select') {
          onSelect(null);
        }
      }}
      showSelectionHandles={showRoomResizeHandles}
      units={units}
      gridSize={gridSize}
      snap={snap}
      zoom={zoom}
      pan={pan}
      onZoomChange={onChangeZoom}
      onPanChange={onChangePan}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onViewportSizeChange={onViewportSizeChange}
      ariaLabel="2D House Floor Plan Canvas"
      cursorClassName={cursorClass}
      statusExtra={`${floor.name} · Site ${formatLength(site.width, units)} × ${formatLength(
        site.depth,
        units
      )}`}
      onPointerDown={(e, world, { spacePressed }) => {
        if (e.button !== 0 || spacePressed) return;

        if (toolMode === 'draw_wall') {
          e.preventDefault();
          const sx = snapValue(world.x);
          const sy = snapValue(world.y);
          setDragState({
            mode: 'draw_wall',
            x1: sx,
            y1: sy,
            x2: sx,
            y2: sy,
          });
          return;
        }

        if (toolMode === 'add_door' || toolMode === 'add_window') {
          e.preventDefault();
          // Find closest wall within 0.75m
          let nearestWall: Wall | null = null;
          let minDist = 0.75;
          for (const w of floorRef.current.walls) {
            const proj = projectPointOnWall(w, world);
            if (proj.distance <= minDist) {
              minDist = proj.distance;
              nearestWall = w;
            }
          }
          if (nearestWall) {
            placeOpeningOnWall(
              nearestWall,
              world,
              toolMode === 'add_door' ? 'door' : 'window'
            );
          }
        }
      }}
      onElementPointerDown={(e, item, world, { spacePressed }) => {
        if (e.button !== 0 || spacePressed) return;

        if (toolMode === 'draw_wall') {
          return; // Let SVG onPointerDown start wall drawing
        }

        if (toolMode === 'add_door' || toolMode === 'add_window') {
          e.stopPropagation();
          if (item.kind === 'wall' && item.wall) {
            placeOpeningOnWall(
              item.wall,
              world,
              toolMode === 'add_door' ? 'door' : 'window'
            );
          }
          return;
        }

        e.stopPropagation();

        if (item.kind === 'room' && item.room) {
          onSelect({ kind: 'room', id: item.room.id });
          setDragState({
            mode: 'move_room',
            roomId: item.room.id,
            startWorld: world,
            origPolygon: item.room.polygon.map((p) => ({ ...p })),
            baselineFloor: cloneFloor(floorRef.current),
          });
        } else if (item.kind === 'wall' && item.wall) {
          onSelect({ kind: 'wall', id: item.wall.id });
        } else if (item.kind === 'opening' && item.opening && item.wall) {
          onSelect({ kind: 'opening', id: item.opening.id });
          setDragState({
            mode: 'move_opening',
            openingId: item.opening.id,
            wall: { ...item.wall },
            openingWidth: item.opening.width,
            baselineFloor: cloneFloor(floorRef.current),
          });
        }
      }}
      onResizeHandlePointerDown={(e, corner, item, { spacePressed }) => {
        if (e.button !== 0 || spacePressed) return;
        if (item.kind !== 'room' || !item.room) return;
        const bounds = roomBounds(item.room);
        setDragState({
          mode: 'resize_room',
          roomId: item.room.id,
          corner,
          origBounds: bounds,
          baselineFloor: cloneFloor(floorRef.current),
        });
      }}
      renderBackdrop={({ sublabelFontSizeMeters }) => {
        const isSiteSelected = selection?.kind === 'site';
        return (
          <g>
            <rect
              x={0}
              y={0}
              width={site.width}
              height={site.depth}
              fill="#ffffff"
              fillOpacity={0.75}
              stroke={isSiteSelected ? '#2563eb' : '#94a3b8'}
              strokeWidth={isSiteSelected ? 2 : 1.25}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              className={toolMode === 'select' ? 'cursor-pointer' : undefined}
              onPointerDown={(e) => {
                if (toolMode !== 'select' || e.button !== 0) return;
                e.stopPropagation();
                onSelect({ kind: 'site' });
              }}
            />
            <text
              x={0}
              y={-sublabelFontSizeMeters * 0.6}
              fill={isSiteSelected ? '#1d4ed8' : '#64748b'}
              fontSize={sublabelFontSizeMeters}
              fontFamily="JetBrains Mono, monospace"
              className={toolMode === 'select' ? 'cursor-pointer' : undefined}
              onPointerDown={(e) => {
                if (toolMode !== 'select' || e.button !== 0) return;
                e.stopPropagation();
                onSelect({ kind: 'site' });
              }}
            >
              Site {formatLength(site.width, units)} × {formatLength(site.depth, units)}
            </text>
          </g>
        );
      }}
      renderElement={(item, { isSelected, labelFontSizeMeters, sublabelFontSizeMeters }) => {
        if (item.kind === 'room' && item.room) {
          const room = item.room;
          const ptsString = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
          const centroid = roomCentroid(room);
          const area = roomArea(room);
          const bounds = roomBounds(room);

          return (
            <g className={toolMode === 'select' ? 'cursor-move' : undefined}>
              <polygon
                points={ptsString}
                fill="#eff6ff"
                fillOpacity={0.78}
                stroke={isSelected ? '#2563eb' : '#64748b'}
                strokeWidth={isSelected ? 2 : 1.25}
                vectorEffect="non-scaling-stroke"
              />
              {bounds.width > 1.2 && bounds.height > 1 && (
                <g pointerEvents="none">
                  <text
                    x={centroid.x}
                    y={centroid.y - sublabelFontSizeMeters * 0.35}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f172a"
                    fontSize={labelFontSizeMeters}
                    fontWeight={600}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {room.name}
                  </text>
                  <text
                    x={centroid.x}
                    y={centroid.y + labelFontSizeMeters * 0.9}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#475569"
                    fontSize={sublabelFontSizeMeters}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {formatArea(area, units)}
                  </text>
                </g>
              )}
            </g>
          );
        }

        if (item.kind === 'wall' && item.wall) {
          const wall = item.wall;
          const len = wallLength(wall);
          const mx = (wall.x1 + wall.x2) / 2;
          const my = (wall.y1 + wall.y2) / 2;

          return (
            <g
              className={
                toolMode === 'add_door' || toolMode === 'add_window'
                  ? 'cursor-copy'
                  : 'cursor-pointer'
              }
            >
              {/* Invisible wider hit target for reliable clicking */}
              <line
                x1={wall.x1}
                y1={wall.y1}
                x2={wall.x2}
                y2={wall.y2}
                stroke="transparent"
                strokeWidth={Math.max(wall.thickness, 0.5)}
                strokeLinecap="round"
              />
              <line
                x1={wall.x1}
                y1={wall.y1}
                x2={wall.x2}
                y2={wall.y2}
                stroke={isSelected ? '#2563eb' : '#1e293b'}
                strokeWidth={wall.thickness}
                strokeLinecap="square"
              />
              {isSelected && (
                <text
                  x={mx}
                  y={my - Math.max(wall.thickness, 0.3) - sublabelFontSizeMeters * 0.3}
                  textAnchor="middle"
                  fill="#1d4ed8"
                  fontSize={sublabelFontSizeMeters}
                  fontWeight={600}
                  fontFamily="JetBrains Mono, monospace"
                  pointerEvents="none"
                >
                  {formatLength(len, units)}
                </text>
              )}
            </g>
          );
        }

        if (item.kind === 'opening' && item.opening && item.wall) {
          const op = item.opening;
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          const isDoor = op.type === 'door';

          return (
            <g
              transform={`rotate(${item.rotation ?? 0} ${cx} ${cy})`}
              className={toolMode === 'select' ? 'cursor-grab' : undefined}
            >
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={isDoor ? '#fef3c7' : '#e0f2fe'}
                stroke={isSelected ? '#2563eb' : isDoor ? '#b45309' : '#0284c7'}
                strokeWidth={isSelected ? 2.2 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
              {isDoor ? (
                <path
                  d={`M ${item.x} ${item.y} A ${item.width} ${item.width} 0 0 1 ${
                    item.x + item.width
                  } ${item.y - item.width}`}
                  fill="none"
                  stroke={isSelected ? '#2563eb' : '#d97706'}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ) : (
                <line
                  x1={item.x}
                  y1={cy}
                  x2={item.x + item.width}
                  y2={cy}
                  stroke={isSelected ? '#2563eb' : '#0369a1'}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        }

        return null;
      }}
      renderOverlay={({ sublabelFontSizeMeters }) => {
        if (dragState?.mode !== 'draw_wall') return null;
        const len = Math.hypot(dragState.x2 - dragState.x1, dragState.y2 - dragState.y1);
        const mx = (dragState.x1 + dragState.x2) / 2;
        const my = (dragState.y1 + dragState.y2) / 2;
        return (
          <g pointerEvents="none">
            <line
              x1={dragState.x1}
              y1={dragState.y1}
              x2={dragState.x2}
              y2={dragState.y2}
              stroke="#2563eb"
              strokeWidth={0.2}
              strokeLinecap="square"
              opacity={0.75}
            />
            <circle cx={dragState.x1} cy={dragState.y1} r={0.12} fill="#2563eb" />
            <circle cx={dragState.x2} cy={dragState.y2} r={0.12} fill="#2563eb" />
            {len > 0.05 && (
              <text
                x={mx}
                y={my - 0.35}
                textAnchor="middle"
                fill="#1d4ed8"
                fontSize={sublabelFontSizeMeters}
                fontWeight={600}
                fontFamily="JetBrains Mono, monospace"
              >
                {formatLength(len, units)}
              </text>
            )}
          </g>
        );
      }}
    />
  );
}
