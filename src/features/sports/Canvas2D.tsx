import { useEffect, useMemo, useRef, useState } from 'react';
import { formatLength } from '../../lib/sports/calculations';
import type {
  Point2D,
  SceneElement,
  SceneElementType,
  SceneUnits,
} from '../../lib/sports/types';

export const BASE_PIXELS_PER_METER = 18;

type ResizeCorner = 'nw' | 'ne' | 'se' | 'sw';

type DragState =
  | {
      mode: 'pan';
      startClientX: number;
      startClientY: number;
      startPan: Point2D;
    }
  | {
      mode: 'move';
      elementId: string;
      startWorld: Point2D;
      origX: number;
      origY: number;
      baselineElements: SceneElement[];
    }
  | {
      mode: 'resize';
      elementId: string;
      corner: ResizeCorner;
      origElement: SceneElement;
      baselineElements: SceneElement[];
    }
  | {
      mode: 'rotate';
      elementId: string;
      centerWorld: Point2D;
      baselineElements: SceneElement[];
    };

interface Canvas2DProps {
  elements: SceneElement[];
  selectedId: string | null;
  units: SceneUnits;
  gridSize: number;
  snap: boolean;
  zoom: number;
  pan: Point2D;
  onSelectElement: (id: string | null) => void;
  onChangePan: (pan: Point2D) => void;
  onChangeZoom: (zoom: number) => void;
  onLiveElementsChange: (nextElements: SceneElement[]) => void;
  onCommitElements: (baseline: SceneElement[], final: SceneElement[]) => void;
  onViewportSizeChange?: (size: { width: number; height: number }) => void;
}

const LAYER_ORDER: Record<SceneElementType, number> = {
  safety_zone: 0,
  playing_surface: 1,
  custom: 2,
  net: 3,
  goal: 4,
  hoop: 5,
  post: 6,
};

function getElementStyle(type: SceneElementType) {
  switch (type) {
    case 'playing_surface':
      return {
        fill: '#e2e8f0',
        fillOpacity: 0.72,
        stroke: '#334155',
      };
    case 'safety_zone':
      return {
        fill: '#fef3c7',
        fillOpacity: 0.45,
        stroke: '#d97706',
      };
    case 'hoop':
      return {
        fill: '#dbeafe',
        fillOpacity: 0.9,
        stroke: '#1d4ed8',
      };
    case 'goal':
      return {
        fill: '#dcfce7',
        fillOpacity: 0.9,
        stroke: '#15803d',
      };
    case 'post':
      return {
        fill: '#334155',
        fillOpacity: 0.95,
        stroke: '#0f172a',
      };
    case 'net':
      return {
        fill: '#f1f5f9',
        fillOpacity: 0.9,
        stroke: '#475569',
      };
    case 'custom':
      return {
        fill: '#f1f5f9',
        fillOpacity: 0.7,
        stroke: '#64748b',
      };
  }
}

export function Canvas2D({
  elements,
  selectedId,
  units,
  gridSize,
  snap,
  zoom,
  pan,
  onSelectElement,
  onChangePan,
  onChangeZoom,
  onLiveElementsChange,
  onCommitElements,
  onViewportSizeChange,
}: Canvas2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [viewportPx, setViewportPx] = useState({ width: 900, height: 600 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.round(entry.contentRect.width));
        const h = Math.max(200, Math.round(entry.contentRect.height));
        setViewportPx({ width: w, height: h });
        onViewportSizeChange?.({ width: w, height: h });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onViewportSizeChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          setSpacePressed(true);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const ppm = BASE_PIXELS_PER_METER * zoom;
  const viewWidth = viewportPx.width / ppm;
  const viewHeight = viewportPx.height / ppm;
  const minX = pan.x - viewWidth / 2;
  const minY = pan.y - viewHeight / 2;

  const clientToWorld = (clientX: number, clientY: number): Point2D => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: minX + ((clientX - rect.left) / rect.width) * viewWidth,
      y: minY + ((clientY - rect.top) / rect.height) * viewHeight,
    };
  };

  const snapValue = (val: number): number => {
    if (!snap || gridSize <= 0) return Number(val.toFixed(3));
    return Number((Math.round(val / gridSize) * gridSize).toFixed(3));
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (dragState.mode === 'pan') {
        const dxMeters = (e.clientX - dragState.startClientX) / ppm;
        const dyMeters = (e.clientY - dragState.startClientY) / ppm;
        onChangePan({
          x: Number((dragState.startPan.x - dxMeters).toFixed(3)),
          y: Number((dragState.startPan.y - dyMeters).toFixed(3)),
        });
        return;
      }

      const world = clientToWorld(e.clientX, e.clientY);

      if (dragState.mode === 'move') {
        const dx = world.x - dragState.startWorld.x;
        const dy = world.y - dragState.startWorld.y;
        const nextX = snapValue(dragState.origX + dx);
        const nextY = snapValue(dragState.origY + dy);

        onLiveElementsChange(
          elementsRef.current.map((el) =>
            el.id === dragState.elementId ? { ...el, x: nextX, y: nextY } : el
          )
        );
        return;
      }

      if (dragState.mode === 'rotate') {
        const angleRad = Math.atan2(
          world.y - dragState.centerWorld.y,
          world.x - dragState.centerWorld.x
        );
        let deg = ((angleRad * 180) / Math.PI + 90 + 360) % 360;
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        }
        const normalized = ((Math.round(deg) % 360) + 360) % 360;
        onLiveElementsChange(
          elementsRef.current.map((el) =>
            el.id === dragState.elementId ? { ...el, rotation: normalized } : el
          )
        );
        return;
      }

      if (dragState.mode === 'resize') {
        const orig = dragState.origElement;
        const rad = (orig.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const origCx = orig.x + orig.width / 2;
        const origCy = orig.y + orig.height / 2;

        // Pointer in original element's unrotated local coordinates
        const dxW = world.x - origCx;
        const dyW = world.y - origCy;
        const lx = dxW * cos + dyW * sin;
        const ly = -dxW * sin + dyW * cos;

        let left = -orig.width / 2;
        let right = orig.width / 2;
        let top = -orig.height / 2;
        let bottom = orig.height / 2;

        const minDim = 0.2;

        if (dragState.corner === 'nw' || dragState.corner === 'sw') {
          const snappedLeft = snap ? snapValue(lx) : lx;
          left = Math.min(right - minDim, snappedLeft);
        } else {
          const snappedRight = snap ? snapValue(lx) : lx;
          right = Math.max(left + minDim, snappedRight);
        }

        if (dragState.corner === 'nw' || dragState.corner === 'ne') {
          const snappedTop = snap ? snapValue(ly) : ly;
          top = Math.min(bottom - minDim, snappedTop);
        } else {
          const snappedBottom = snap ? snapValue(ly) : ly;
          bottom = Math.max(top + minDim, snappedBottom);
        }

        let newW = Number(Math.min(1000, Math.max(minDim, right - left)).toFixed(3));
        let newH = Number(Math.min(1000, Math.max(minDim, bottom - top)).toFixed(3));

        if (orig.shape === 'circle') {
          const diameter = Math.max(newW, newH);
          newW = diameter;
          newH = diameter;
          if (dragState.corner === 'nw' || dragState.corner === 'sw') {
            left = right - diameter;
          } else {
            right = left + diameter;
          }
          if (dragState.corner === 'nw' || dragState.corner === 'ne') {
            top = bottom - diameter;
          } else {
            bottom = top + diameter;
          }
        }

        const localCenterX = (left + right) / 2;
        const localCenterY = (top + bottom) / 2;
        const newCx = origCx + (localCenterX * cos - localCenterY * sin);
        const newCy = origCy + (localCenterX * sin + localCenterY * cos);

        const nextX = Number((newCx - newW / 2).toFixed(3));
        const nextY = Number((newCy - newH / 2).toFixed(3));

        onLiveElementsChange(
          elementsRef.current.map((el) =>
            el.id === dragState.elementId
              ? { ...el, x: nextX, y: nextY, width: newW, height: newH }
              : el
          )
        );
      }
    };

    const handlePointerUp = () => {
      if (
        dragState.mode === 'move' ||
        dragState.mode === 'resize' ||
        dragState.mode === 'rotate'
      ) {
        onCommitElements(dragState.baselineElements, elementsRef.current);
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, ppm, snap, gridSize, onChangePan, onLiveElementsChange, onCommitElements]);

  const sortedElements = useMemo(() => {
    return [...elements].sort(
      (a, b) => (LAYER_ORDER[a.type] ?? 10) - (LAYER_ORDER[b.type] ?? 10)
    );
  }, [elements]);

  const selectedElement = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId]
  );

  const handleSizeMeters = 9 / ppm;
  const rotateOffsetMeters = 24 / ppm;
  const labelFontSizeMeters = Math.max(0.35, 11 / ppm);
  const sublabelFontSizeMeters = Math.max(0.28, 9.5 / ppm);

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || spacePressed) {
      e.preventDefault();
      setDragState({
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
      });
      return;
    }

    if (e.button === 0 && e.target === svgRef.current) {
      onSelectElement(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Number(Math.min(4, Math.max(0.5, zoom * factor)).toFixed(2));
    onChangeZoom(nextZoom);
  };

  const majorGrid = gridSize * 5;

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 bg-slate-50 overflow-hidden select-none ${
        dragState?.mode === 'pan'
          ? 'cursor-grabbing'
          : spacePressed
          ? 'cursor-grab'
          : 'cursor-default'
      }`}
    >
      <svg
        ref={svgRef}
        className="w-full h-full block touch-none"
        viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`}
        onPointerDown={handleSvgPointerDown}
        onWheel={handleWheel}
        role="img"
        aria-label="2D Sports Ground Canvas"
      >
        <defs>
          <pattern
            id="sports-grid-minor"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
          <pattern
            id="sports-grid-major"
            width={majorGrid}
            height={majorGrid}
            patternUnits="userSpaceOnUse"
          >
            <rect width={majorGrid} height={majorGrid} fill="url(#sports-grid-minor)" />
            <path
              d={`M ${majorGrid} 0 L 0 0 0 ${majorGrid}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>

        {/* Infinite grid backdrop */}
        <rect
          x={minX - viewWidth}
          y={minY - viewHeight}
          width={viewWidth * 3}
          height={viewHeight * 3}
          fill="url(#sports-grid-major)"
          pointerEvents="none"
        />

        {/* Origin axes marker */}
        <g pointerEvents="none" opacity={0.45}>
          <line
            x1={-1}
            y1={0}
            x2={1}
            y2={0}
            stroke="#64748b"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            y1={-1}
            x2={0}
            y2={1}
            stroke="#64748b"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Scene elements */}
        {sortedElements.map((el) => {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          const style = getElementStyle(el.type);
          const isSelected = el.id === selectedId;
          const isSurface =
            el.type === 'playing_surface' ||
            el.type === 'safety_zone' ||
            el.type === 'custom';

          return (
            <g
              key={el.id}
              transform={`rotate(${el.rotation} ${cx} ${cy})`}
              className="cursor-move"
              onPointerDown={(e) => {
                if (e.button !== 0 || spacePressed) return;
                e.stopPropagation();
                onSelectElement(el.id);
                const world = clientToWorld(e.clientX, e.clientY);
                setDragState({
                  mode: 'move',
                  elementId: el.id,
                  startWorld: world,
                  origX: el.x,
                  origY: el.y,
                  baselineElements: elements.map((item) => ({ ...item })),
                });
              }}
            >
              {el.shape === 'circle' ? (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={el.width / 2}
                  ry={el.width / 2}
                  fill={style.fill}
                  fillOpacity={style.fillOpacity}
                  stroke={isSelected ? '#2563eb' : style.stroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray={el.type === 'safety_zone' ? '6 4' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  fill={style.fill}
                  fillOpacity={style.fillOpacity}
                  stroke={isSelected ? '#2563eb' : style.stroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray={el.type === 'safety_zone' ? '6 4' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Equipment visual detail */}
              {el.type === 'hoop' && (
                <g pointerEvents="none">
                  <line
                    x1={el.x + el.width * 0.25}
                    y1={el.y + el.height * 0.15}
                    x2={el.x + el.width * 0.25}
                    y2={el.y + el.height * 0.85}
                    stroke="#1e40af"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={el.x + el.width * 0.62}
                    cy={cy}
                    r={Math.min(el.width, el.height) * 0.24}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth={1.75}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}

              {el.type === 'goal' && (
                <g pointerEvents="none">
                  <path
                    d={`M ${el.x + el.width} ${el.y} L ${el.x} ${el.y} L ${el.x} ${
                      el.y + el.height
                    } L ${el.x + el.width} ${el.y + el.height}`}
                    fill="none"
                    stroke="#15803d"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}

              {el.type === 'net' && (
                <line
                  x1={cx}
                  y1={el.y}
                  x2={cx}
                  y2={el.y + el.height}
                  stroke="#334155"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}

              {/* Labels */}
              {isSurface && el.width > 2 && el.height > 1.5 && (
                <g pointerEvents="none">
                  <text
                    x={cx}
                    y={cy - sublabelFontSizeMeters * 0.35}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f172a"
                    fontSize={labelFontSizeMeters}
                    fontWeight={600}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {el.label}
                  </text>
                  <text
                    x={cx}
                    y={cy + labelFontSizeMeters * 0.95}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#475569"
                    fontSize={sublabelFontSizeMeters}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {el.shape === 'circle'
                      ? `Ø ${formatLength(el.width, units)}`
                      : `${formatLength(el.width, units)} × ${formatLength(
                          el.height,
                          units
                        )}`}
                  </text>
                </g>
              )}

              {!isSurface && (
                <text
                  x={cx}
                  y={el.y - sublabelFontSizeMeters * 0.5}
                  textAnchor="middle"
                  fill="#1e293b"
                  fontSize={sublabelFontSizeMeters}
                  fontWeight={500}
                  fontFamily="DM Sans, sans-serif"
                  pointerEvents="none"
                >
                  {el.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Selection handles (4 corners + 1 rotation handle above) */}
        {selectedElement && (() => {
          const el = selectedElement;
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          const halfHandle = handleSizeMeters / 2;
          const corners: { id: ResizeCorner; x: number; y: number; cursor: string }[] = [
            { id: 'nw', x: el.x, y: el.y, cursor: 'nwse-resize' },
            { id: 'ne', x: el.x + el.width, y: el.y, cursor: 'nesw-resize' },
            { id: 'se', x: el.x + el.width, y: el.y + el.height, cursor: 'nwse-resize' },
            { id: 'sw', x: el.x, y: el.y + el.height, cursor: 'nesw-resize' },
          ];

          return (
            <g transform={`rotate(${el.rotation} ${cx} ${cy})`}>
              {/* Selection bounding box */}
              <rect
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                fill="none"
                stroke="#2563eb"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />

              {/* Rotation stem + knob */}
              <line
                x1={cx}
                y1={el.y}
                x2={cx}
                y2={el.y - rotateOffsetMeters}
                stroke="#2563eb"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
              <circle
                cx={cx}
                cy={el.y - rotateOffsetMeters}
                r={halfHandle * 1.15}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                className="cursor-grab"
                onPointerDown={(e) => {
                  if (e.button !== 0 || spacePressed) return;
                  e.stopPropagation();
                  setDragState({
                    mode: 'rotate',
                    elementId: el.id,
                    centerWorld: { x: cx, y: cy },
                    baselineElements: elements.map((item) => ({ ...item })),
                  });
                }}
              />

              {/* 4 corner resize handles */}
              {corners.map((corner) => (
                <rect
                  key={corner.id}
                  x={corner.x - halfHandle}
                  y={corner.y - halfHandle}
                  width={handleSizeMeters}
                  height={handleSizeMeters}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: corner.cursor }}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || spacePressed) return;
                    e.stopPropagation();
                    setDragState({
                      mode: 'resize',
                      elementId: el.id,
                      corner: corner.id,
                      origElement: { ...el },
                      baselineElements: elements.map((item) => ({ ...item })),
                    });
                  }}
                />
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Subtle corner scale / status readout */}
      <div className="pointer-events-none absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-white/90 border border-slate-200 text-[11px] font-mono text-slate-600 tabular-nums">
        Grid {formatLength(gridSize, units)} · Zoom {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
