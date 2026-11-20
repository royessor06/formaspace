import { Trash2 } from 'lucide-react';
import {
  elementArea,
  elementCost,
  elementPerimeter,
  formatArea,
  formatLength,
  isSurfaceElementType,
  materialQuantity,
} from '../../lib/sports/calculations';
import type {
  SceneElement,
  SceneElementShape,
  SceneUnits,
} from '../../lib/sports/types';
import { PropertiesField } from '../shared/PropertiesField';

interface PropertiesPanelProps {
  selectedElement: SceneElement | null;
  units: SceneUnits;
  gridSize: number;
  onChangeGridSize: (nextGridSize: number) => void;
  onUpdateElement: (id: string, patch: Partial<SceneElement>) => void;
  onDeleteElement: (id: string) => void;
}

export function PropertiesPanel({
  selectedElement,
  units,
  gridSize,
  onChangeGridSize,
  onUpdateElement,
  onDeleteElement,
}: PropertiesPanelProps) {
  if (!selectedElement) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h2 className="font-display text-xs font-semibold text-slate-900">
            Scene properties
          </h2>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Select any element on the canvas to edit dimensions, rotation, and pricing.
          </p>
        </div>

        <div>
          <label
            htmlFor="grid-size-select"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Grid interval (stored in meters)
          </label>
          <select
            id="grid-size-select"
            value={gridSize}
            onChange={(e) => onChangeGridSize(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          >
            <option value={0.5}>0.5 m ({formatLength(0.5, 'imperial')})</option>
            <option value={1}>1.0 m ({formatLength(1, 'imperial')})</option>
            <option value={2}>2.0 m ({formatLength(2, 'imperial')})</option>
            <option value={5}>5.0 m ({formatLength(5, 'imperial')})</option>
          </select>
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
          <p>
            <span className="font-medium text-slate-700">Pan:</span> Space + drag or middle-mouse
          </p>
          <p>
            <span className="font-medium text-slate-700">Zoom:</span> Mouse wheel or toolbar
          </p>
          <p>
            <span className="font-medium text-slate-700">Delete:</span> Backspace / Delete key
          </p>
          <p>
            <span className="font-medium text-slate-700">Undo / Redo:</span> Ctrl/Cmd+Z, Shift+Z
          </p>
        </div>
      </div>
    );
  }

  const isSurface = isSurfaceElementType(selectedElement.type);
  const canToggleShape =
    selectedElement.type === 'playing_surface' ||
    selectedElement.type === 'safety_zone';

  const handleRotationChange = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const normalized = ((Math.round(parsed) % 360) + 360) % 360;
    onUpdateElement(selectedElement.id, { rotation: normalized });
  };

  const areaSqM = elementArea(selectedElement);
  const perimM = elementPerimeter(selectedElement);
  const qty = materialQuantity(selectedElement);
  const cost = elementCost(selectedElement);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xs font-semibold text-slate-900">
          Element properties
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          {selectedElement.type}
        </span>
      </div>

      <PropertiesField
        id="prop-label"
        label="Label"
        type="text"
        value={selectedElement.label}
        maxLength={120}
        onChange={(value) => onUpdateElement(selectedElement.id, { label: value })}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <PropertiesField
          id="prop-width"
          label={selectedElement.shape === 'circle' ? 'Diameter' : 'Width'}
          type="length"
          meters={selectedElement.width}
          units={units}
          minMeters={0.1}
          onMetersChange={(nextMeters) =>
            onUpdateElement(
              selectedElement.id,
              selectedElement.shape === 'circle'
                ? { width: nextMeters, height: nextMeters }
                : { width: nextMeters }
            )
          }
        />
        <PropertiesField
          id="prop-height"
          label="Height"
          type="length"
          meters={selectedElement.height}
          units={units}
          minMeters={0.1}
          disabled={selectedElement.shape === 'circle'}
          onMetersChange={(nextMeters) =>
            onUpdateElement(selectedElement.id, { height: nextMeters })
          }
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="prop-rotation"
            className="text-xs font-medium text-slate-700"
          >
            Rotation (deg)
          </label>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            0–359°
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="prop-rotation"
            type="number"
            min={0}
            max={359}
            value={selectedElement.rotation}
            onChange={(e) => handleRotationChange(e.target.value)}
            className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
          <input
            type="range"
            min={0}
            max={359}
            value={selectedElement.rotation}
            aria-label="Rotation slider"
            onChange={(e) => handleRotationChange(e.target.value)}
            className="flex-1 accent-slate-900"
          />
        </div>
      </div>

      {canToggleShape && (
        <div>
          <span className="block text-xs font-medium text-slate-700 mb-1">
            Shape
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            {(['rect', 'circle'] as SceneElementShape[]).map((shapeOption) => (
              <button
                key={shapeOption}
                type="button"
                onClick={() =>
                  onUpdateElement(
                    selectedElement.id,
                    shapeOption === 'circle'
                      ? { shape: 'circle', height: selectedElement.width }
                      : { shape: 'rect' }
                  )
                }
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedElement.shape === shapeOption
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {shapeOption === 'rect' ? 'Rectangle' : 'Circle'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 space-y-3">
        <PropertiesField
          id="prop-material"
          label="Material name"
          type="text"
          maxLength={120}
          value={selectedElement.materialName}
          onChange={(value) =>
            onUpdateElement(selectedElement.id, { materialName: value })
          }
        />

        <div className="grid grid-cols-2 gap-2.5">
          <PropertiesField
            id="prop-unit-price"
            label={`Price (${isSurface ? 'per m²' : 'per unit'})`}
            type="number"
            min={0}
            step="0.5"
            value={selectedElement.unitPrice}
            onChange={(raw) => {
              const parsed = Number(raw);
              if (!Number.isFinite(parsed) || parsed < 0) return;
              onUpdateElement(selectedElement.id, { unitPrice: parsed });
            }}
          />
          <PropertiesField
            id="prop-qty-factor"
            label={isSurface ? 'Qty factor' : 'Unit count'}
            type="number"
            min={0}
            step={isSurface ? '0.1' : '1'}
            value={selectedElement.quantityFactor}
            onChange={(raw) => {
              const parsed = Number(raw);
              if (!Number.isFinite(parsed) || parsed < 0) return;
              onUpdateElement(selectedElement.id, { quantityFactor: parsed });
            }}
          />
        </div>
      </div>

      <dl className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[11px] text-slate-500">Area</dt>
          <dd className="font-mono text-slate-800 tabular-nums">
            {formatArea(areaSqM, units)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Perimeter</dt>
          <dd className="font-mono text-slate-800 tabular-nums">
            {formatLength(perimM, units)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Billable qty</dt>
          <dd className="font-mono text-slate-800 tabular-nums">
            {isSurface ? `${qty.toFixed(2)} m²` : `${qty.toFixed(0)} unit`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Est. cost</dt>
          <dd className="font-mono font-semibold text-slate-900 tabular-nums">
            ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </dd>
        </div>
      </dl>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => onDeleteElement(selectedElement.id)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Delete element</span>
        </button>
      </div>
    </div>
  );
}
