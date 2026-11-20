import { Trash2 } from 'lucide-react';
import {
  convertLength,
  elementArea,
  elementCost,
  elementPerimeter,
  formatArea,
  formatLength,
  isSurfaceElementType,
  materialQuantity,
  toMeters,
} from '../../lib/sports/calculations';
import type {
  SceneElement,
  SceneElementShape,
  SceneUnits,
} from '../../lib/sports/types';

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
  const unitSuffix = units === 'imperial' ? 'ft' : 'm';

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

  const displayWidth = Number(
    convertLength(selectedElement.width, units).toFixed(2)
  );
  const displayHeight = Number(
    convertLength(selectedElement.height, units).toFixed(2)
  );

  const handleDimensionChange = (field: 'width' | 'height', rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const meters = Math.min(1000, Math.max(0.1, toMeters(parsed, units)));
    const roundedMeters = Number(meters.toFixed(3));
    if (selectedElement.shape === 'circle') {
      onUpdateElement(selectedElement.id, {
        width: roundedMeters,
        height: roundedMeters,
      });
    } else {
      onUpdateElement(selectedElement.id, { [field]: roundedMeters });
    }
  };

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

      {/* Label */}
      <div>
        <label
          htmlFor="prop-label"
          className="block text-xs font-medium text-slate-700 mb-1"
        >
          Label
        </label>
        <input
          id="prop-label"
          type="text"
          value={selectedElement.label}
          maxLength={120}
          onChange={(e) =>
            onUpdateElement(selectedElement.id, { label: e.target.value })
          }
          className="w-full px-3 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor="prop-width"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            {selectedElement.shape === 'circle' ? `Diameter (${unitSuffix})` : `Width (${unitSuffix})`}
          </label>
          <input
            id="prop-width"
            type="number"
            step="0.1"
            min="0.1"
            value={displayWidth}
            onChange={(e) => handleDimensionChange('width', e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label
            htmlFor="prop-height"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Height ({unitSuffix})
          </label>
          <input
            id="prop-height"
            type="number"
            step="0.1"
            min="0.1"
            disabled={selectedElement.shape === 'circle'}
            value={displayHeight}
            onChange={(e) => handleDimensionChange('height', e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Rotation */}
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

      {/* Shape (only for surfaces / safety zones) */}
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

      {/* Material & Pricing */}
      <div className="pt-3 border-t border-slate-100 space-y-3">
        <div>
          <label
            htmlFor="prop-material"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Material name
          </label>
          <input
            id="prop-material"
            type="text"
            maxLength={120}
            value={selectedElement.materialName}
            onChange={(e) =>
              onUpdateElement(selectedElement.id, {
                materialName: e.target.value,
              })
            }
            className="w-full px-3 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="prop-unit-price"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Price ({isSurface ? 'per m²' : 'per unit'})
            </label>
            <input
              id="prop-unit-price"
              type="number"
              min={0}
              step="0.5"
              value={selectedElement.unitPrice}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (!Number.isFinite(parsed) || parsed < 0) return;
                onUpdateElement(selectedElement.id, { unitPrice: parsed });
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="prop-qty-factor"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              {isSurface ? 'Qty factor' : 'Unit count'}
            </label>
            <input
              id="prop-qty-factor"
              type="number"
              min={0}
              step={isSurface ? '0.1' : '1'}
              value={selectedElement.quantityFactor}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (!Number.isFinite(parsed) || parsed < 0) return;
                onUpdateElement(selectedElement.id, { quantityFactor: parsed });
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Live measurements */}
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
