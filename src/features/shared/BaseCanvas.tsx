import { useEffect, useRef, useState } from 'react';
import { formatLength } from '../../lib/sports/calculations';
import type { Point2D, SceneUnits } from '../../lib/sports/types';

export const BASE_PIXELS_PER_METER = 18;

export type ResizeCorner = 'nw' | 'ne' | 'se' | 'sw';

export interface BaseCanvasElementBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface BaseCanvasProps<T extends BaseCanvasElementBox> {
  elements: T[];
  renderElement: (
    el: T,
    ctx: {
      isSelected: boolean;
      zoom: number;
      ppm: number;
      labelFontSizeMeters: number;
      sublabelFontSizeMeters: number;
    }
  ) => React.ReactNode;
  renderBackdrop?: (ctx: {
    minX: number;
    minY: number;
    viewWidth: number;
    viewHeight: number;
    zoom: number;
    ppm: number;
    labelFontSizeMeters: number;
    sublabelFontSizeMeters: number;
  }) => React.ReactNode;
  renderOverlay?: (ctx: {
    zoom: number;
    ppm: number;
    labelFontSizeMeters: number;
    sublabelFontSizeMeters: number;
  }) => React.ReactNode;
  onPointerDown?: (
    e: React.PointerEvent<SVGSVGElement>,
    world: Point2D,
    helpers: {
      spacePressed: boolean;
      clientToWorld: (clientX: number, clientY: number) => Point2D;
    }
  ) => void;
  onPointerMove?: (e: PointerEvent, world: Point2D) => void;
  onPointerUp?: (e: PointerEvent, world: Point2D) => void;
  zoom: number;
  pan: Point2D;
  gridSize: number;
  snap: boolean;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: Point2D) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showSelectionHandles?: boolean;
  onElementPointerDown?: (
    e: React.PointerEvent<SVGGElement>,
    el: T,
    world: Point2D,
    helpers: { spacePressed: boolean }
  ) => void;
  onResizeHandlePointerDown?: (
    e: React.PointerEvent<SVGRectElement>,
    corner: ResizeCorner,
    el: T,
    helpers: { spacePressed: boolean }
  ) => void;
  onRotateHandlePointerDown?: (
    e: React.PointerEvent<SVGCircleElement>,
    el: T,
    helpers: { spacePressed: boolean }
  ) => void;
  onViewportSizeChange?: (size: { width: number; height: number }) => void;
  units?: SceneUnits;
  ariaLabel?: string;
  cursorClassName?: string;
  statusExtra?: string;
}

export function BaseCanvas<T extends BaseCanvasElementBox>({
  elements,
  renderElement,
  renderBackdrop,
  renderOverlay,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  zoom,
  pan,
  gridSize,
  snap,
  onZoomChange,
  onPanChange,
  selectedId,
  onSelect,
  showSelectionHandles = true,
  onElementPointerDown,
  onResizeHandlePointerDown,
  onRotateHandlePointerDown,
  onViewportSizeChange,
  units = 'metric',
  ariaLabel = '2D Design Canvas',
  cursorClassName,
  statusExtra,
}: BaseCanvasProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [viewportPx, setViewportPx] = useState({ width: 900, height: 600 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [panDrag, setPanDrag] = useState<{
    startClientX: number;
    startClientY: number;
    startPan: Point2D;
  } | null>(null);

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

  const clientToWorldRef = useRef(clientToWorld);
  clientToWorldRef.current = clientToWorld;

  const onPointerMoveRef = useRef(onPointerMove);
  onPointerMoveRef.current = onPointerMove;
  const onPointerUpRef = useRef(onPointerUp);
  onPointerUpRef.current = onPointerUp;
  const onPanChangeRef = useRef(onPanChange);
  onPanChangeRef.current = onPanChange;

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (panDrag) {
        const dxMeters = (e.clientX - panDrag.startClientX) / ppm;
        const dyMeters = (e.clientY - panDrag.startClientY) / ppm;
        onPanChangeRef.current({
          x: Number((panDrag.startPan.x - dxMeters).toFixed(3)),
          y: Number((panDrag.startPan.y - dyMeters).toFixed(3)),
        });
        return;
      }
      if (onPointerMoveRef.current) {
        onPointerMoveRef.current(e, clientToWorldRef.current(e.clientX, e.clientY));
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (panDrag) {
        setPanDrag(null);
        return;
      }
      if (onPointerUpRef.current) {
        onPointerUpRef.current(e, clientToWorldRef.current(e.clientX, e.clientY));
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [panDrag, ppm]);

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  const handleSizeMeters = 9 / ppm;
  const rotateOffsetMeters = 24 / ppm;
  const labelFontSizeMeters = Math.max(0.28, 11 / ppm);
  const sublabelFontSizeMeters = Math.max(0.22, 9.5 / ppm);

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || spacePressed) {
      e.preventDefault();
      setPanDrag({
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
      });
      return;
    }

    const world = clientToWorld(e.clientX, e.clientY);
    onPointerDown?.(e, world, { spacePressed, clientToWorld });

    if (e.button === 0 && e.target === svgRef.current && !e.defaultPrevented) {
      onSelect(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Number(Math.min(4, Math.max(0.5, zoom * factor)).toFixed(2));
    onZoomChange(nextZoom);
  };

  const majorGrid = gridSize * 5;
  const patternIdMinor = 'base-grid-minor';
  const patternIdMajor = 'base-grid-major';

  const resolvedCursor = panDrag
    ? 'cursor-grabbing'
    : spacePressed
    ? 'cursor-grab'
    : cursorClassName || 'cursor-default';

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 bg-slate-50 overflow-hidden select-none ${resolvedCursor}`}
    >
      <svg
        ref={svgRef}
        className="w-full h-full block touch-none"
        viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`}
        onPointerDown={handleSvgPointerDown}
        onWheel={handleWheel}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <pattern
            id={patternIdMinor}
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
            id={patternIdMajor}
            width={majorGrid}
            height={majorGrid}
            patternUnits="userSpaceOnUse"
          >
            <rect width={majorGrid} height={majorGrid} fill={`url(#${patternIdMinor})`} />
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
          fill={`url(#${patternIdMajor})`}
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

        {renderBackdrop?.({
          minX,
          minY,
          viewWidth,
          viewHeight,
          zoom,
          ppm,
          labelFontSizeMeters,
          sublabelFontSizeMeters,
        })}

        {/* Rendered elements */}
        {elements.map((el) => {
          const isSelected = el.id === selectedId;
          return (
            <g
              key={el.id}
              onPointerDown={(e) => {
                if (spacePressed) return;
                const world = clientToWorld(e.clientX, e.clientY);
                onElementPointerDown?.(e, el, world, { spacePressed });
              }}
            >
              {renderElement(el, {
                isSelected,
                zoom,
                ppm,
                labelFontSizeMeters,
                sublabelFontSizeMeters,
              })}
            </g>
          );
        })}

        {renderOverlay?.({
          zoom,
          ppm,
          labelFontSizeMeters,
          sublabelFontSizeMeters,
        })}

        {/* Selection bounding box + 4 corner resize handles + 1 rotation handle */}
        {showSelectionHandles &&
          selectedElement &&
          (() => {
            const el = selectedElement;
            const rotation = el.rotation ?? 0;
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
              <g transform={`rotate(${rotation} ${cx} ${cy})`}>
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

                {onRotateHandlePointerDown && (
                  <>
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
                        onRotateHandlePointerDown(e, el, { spacePressed });
                      }}
                    />
                  </>
                )}

                {onResizeHandlePointerDown &&
                  corners.map((corner) => (
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
                        onResizeHandlePointerDown(e, corner.id, el, { spacePressed });
                      }}
                    />
                  ))}
              </g>
            );
          })()}
      </svg>

      {/* Subtle corner scale / status readout */}
      <div className="pointer-events-none absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-white/90 border border-slate-200 text-[11px] font-mono text-slate-600 tabular-nums">
        Grid {formatLength(gridSize, units)} · Snap {snap ? 'On' : 'Off'} · Zoom{' '}
        {Math.round(zoom * 100)}%
        {statusExtra ? ` · ${statusExtra}` : ''}
      </div>
    </div>
  );
}
