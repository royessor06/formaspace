import { useMemo, useRef, useState } from 'react';
import { formatLength } from '../../lib/sports/calculations';
import type {
  Point2D,
  SceneElement,
  SceneElementType,
  SceneUnits,
} from '../../lib/sports/types';
import {
  BASE_PIXELS_PER_METER,
  BaseCanvas,
  type ResizeCorner,
} from '../shared/BaseCanvas';

export { BASE_PIXELS_PER_METER };

type DragState =
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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const snapValue = (val: number): number => {
    if (!snap || gridSize <= 0) return Number(val.toFixed(3));
    return Number((Math.round(val / gridSize) * gridSize).toFixed(3));
  };

  const sortedElements = useMemo(() => {
    return [...elements].sort(
      (a, b) => (LAYER_ORDER[a.type] ?? 10) - (LAYER_ORDER[b.type] ?? 10)
    );
  }, [elements]);

  const handlePointerMove = (e: PointerEvent, world: Point2D) => {
    if (!dragState) return;

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
    if (!dragState) return;
    onCommitElements(dragState.baselineElements, elementsRef.current);
    setDragState(null);
  };

  return (
    <BaseCanvas
      elements={sortedElements}
      selectedId={selectedId}
      onSelect={onSelectElement}
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
      ariaLabel="2D Sports Ground Canvas"
      onElementPointerDown={(e, el, world, { spacePressed }) => {
        if (e.button !== 0 || spacePressed) return;
        e.stopPropagation();
        onSelectElement(el.id);
        setDragState({
          mode: 'move',
          elementId: el.id,
          startWorld: world,
          origX: el.x,
          origY: el.y,
          baselineElements: elements.map((item) => ({ ...item })),
        });
      }}
      onResizeHandlePointerDown={(e, corner, el, { spacePressed }) => {
        if (e.button !== 0 || spacePressed) return;
        setDragState({
          mode: 'resize',
          elementId: el.id,
          corner,
          origElement: { ...el },
          baselineElements: elements.map((item) => ({ ...item })),
        });
      }}
      onRotateHandlePointerDown={(e, el, { spacePressed }) => {
        if (e.button !== 0 || spacePressed) return;
        setDragState({
          mode: 'rotate',
          elementId: el.id,
          centerWorld: { x: el.x + el.width / 2, y: el.y + el.height / 2 },
          baselineElements: elements.map((item) => ({ ...item })),
        });
      }}
      renderElement={(el, { isSelected, labelFontSizeMeters, sublabelFontSizeMeters }) => {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const style = getElementStyle(el.type);
        const isSurface =
          el.type === 'playing_surface' ||
          el.type === 'safety_zone' ||
          el.type === 'custom';

        return (
          <g
            transform={`rotate(${el.rotation} ${cx} ${cy})`}
            className="cursor-move"
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
      }}
    />
  );
}
