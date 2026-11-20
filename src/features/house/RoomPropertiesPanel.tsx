import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import {
  floorLivingArea,
  formatArea,
  formatLength,
  isRectangularRoom,
  openingArea,
  projectTotal,
  roomArea,
  roomBounds,
  totalLivingArea,
  wallArea,
  wallLength,
} from '../../lib/house/calculations';
import type {
  Floor,
  FloorPlan,
  HouseSelection,
  HouseSite,
  HouseUnitPrices,
  Opening,
  OpeningType,
  Room,
  SceneUnits,
  Wall,
} from '../../lib/house/types';
import { PropertiesField } from '../shared/PropertiesField';

interface RoomPropertiesPanelProps {
  floorPlan: Omit<FloorPlan, 'updatedAt'>;
  activeFloor: Floor;
  selection: HouseSelection;
  units: SceneUnits;
  gridSize: number;
  prices: HouseUnitPrices;
  onChangePrices: (prices: HouseUnitPrices) => void;
  onChangeGridSize: (next: number) => void;
  onUpdateSite: (site: HouseSite) => void;
  onUpdateRoom: (roomId: string, patch: Partial<Room>) => void;
  onDeleteRoom: (roomId: string) => void;
  onUpdateWall: (wallId: string, patch: Partial<Wall>) => void;
  onDeleteWall: (wallId: string) => void;
  onUpdateOpening: (openingId: string, patch: Partial<Opening>) => void;
  onDeleteOpening: (openingId: string) => void;
  onSelect: (selection: HouseSelection) => void;
}

export function RoomPropertiesPanel({
  floorPlan,
  activeFloor,
  selection,
  units,
  gridSize,
  prices,
  onChangePrices,
  onChangeGridSize,
  onUpdateSite,
  onUpdateRoom,
  onDeleteRoom,
  onUpdateWall,
  onDeleteWall,
  onUpdateOpening,
  onDeleteOpening,
  onSelect,
}: RoomPropertiesPanelProps) {
  const [showRates, setShowRates] = useState(false);

  const selectedRoom =
    selection?.kind === 'room'
      ? activeFloor.rooms.find((r) => r.id === selection.id) ?? null
      : null;

  const selectedWall =
    selection?.kind === 'wall'
      ? activeFloor.walls.find((w) => w.id === selection.id) ?? null
      : null;

  const selectedOpening =
    selection?.kind === 'opening'
      ? activeFloor.openings.find((o) => o.id === selection.id) ?? null
      : null;

  const parentWallForOpening = selectedOpening
    ? activeFloor.walls.find((w) => w.id === selectedOpening.wallId) ?? null
    : null;

  const activeArea = floorLivingArea(activeFloor);
  const allFloorsArea = totalLivingArea(floorPlan);
  const doorCount = floorPlan.floors.reduce(
    (sum, fl) => sum + fl.openings.filter((o) => o.type === 'door').length,
    0
  );
  const windowCount = floorPlan.floors.reduce(
    (sum, fl) => sum + fl.openings.filter((o) => o.type === 'window').length,
    0
  );
  const totalEstimatedCost = projectTotal(floorPlan, prices);

  return (
    <aside
      aria-label="Floor plan properties and summary"
      className="w-full lg:w-[280px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between overflow-y-auto"
    >
      <div className="p-4 space-y-5">
        {/* Global grid size */}
        <div>
          <label
            htmlFor="house-grid-size"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
          >
            Canvas Grid
          </label>
          <select
            id="house-grid-size"
            value={gridSize}
            onChange={(e) => onChangeGridSize(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          >
            <option value={0.25}>0.25 m fine grid</option>
            <option value={0.5}>0.5 m grid</option>
            <option value={1}>1.0 m grid</option>
            <option value={2}>2.0 m coarse grid</option>
          </select>
        </div>

        {/* Selection Inspector */}
        {selectedRoom ? (
          <div className="pt-4 border-t border-slate-100 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Room Properties
              </span>
              <button
                type="button"
                onClick={() => onDeleteRoom(selectedRoom.id)}
                aria-label="Delete selected room"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>

            <PropertiesField
              id="room-name"
              label="Room name"
              value={selectedRoom.name}
              maxLength={120}
              onChange={(val) =>
                onUpdateRoom(selectedRoom.id, {
                  name: val.slice(0, 120) || 'Room',
                })
              }
            />

            {isRectangularRoom(selectedRoom) &&
              (() => {
                const b = roomBounds(selectedRoom);
                return (
                  <div className="grid grid-cols-2 gap-2.5">
                    <PropertiesField
                      id="room-width"
                      type="length"
                      label="Width"
                      meters={b.width}
                      units={units}
                      minMeters={0.5}
                      maxMeters={500}
                      onMetersChange={(nextW) => {
                        onUpdateRoom(selectedRoom.id, {
                          polygon: [
                            { x: b.x, y: b.y },
                            { x: Number((b.x + nextW).toFixed(3)), y: b.y },
                            {
                              x: Number((b.x + nextW).toFixed(3)),
                              y: Number((b.y + b.height).toFixed(3)),
                            },
                            { x: b.x, y: Number((b.y + b.height).toFixed(3)) },
                          ],
                        });
                      }}
                    />
                    <PropertiesField
                      id="room-depth"
                      type="length"
                      label="Depth"
                      meters={b.height}
                      units={units}
                      minMeters={0.5}
                      maxMeters={500}
                      onMetersChange={(nextH) => {
                        onUpdateRoom(selectedRoom.id, {
                          polygon: [
                            { x: b.x, y: b.y },
                            { x: Number((b.x + b.width).toFixed(3)), y: b.y },
                            {
                              x: Number((b.x + b.width).toFixed(3)),
                              y: Number((b.y + nextH).toFixed(3)),
                            },
                            { x: b.x, y: Number((b.y + nextH).toFixed(3)) },
                          ],
                        });
                      }}
                    />
                  </div>
                );
              })()}

            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vertices</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {selectedRoom.polygon.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Room area</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatArea(roomArea(selectedRoom), units)}
                </span>
              </div>
            </div>
          </div>
        ) : selectedWall ? (
          <div className="pt-4 border-t border-slate-100 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Wall Properties
              </span>
              <button
                type="button"
                onClick={() => onDeleteWall(selectedWall.id)}
                aria-label="Delete selected wall"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>

            <PropertiesField
              id="wall-thickness"
              type="length"
              label="Thickness"
              meters={selectedWall.thickness}
              units={units}
              minMeters={0.05}
              maxMeters={2}
              step="0.05"
              onMetersChange={(nextThick) =>
                onUpdateWall(selectedWall.id, { thickness: nextThick })
              }
            />

            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Wall length</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatLength(wallLength(selectedWall), units)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Surface (2.5m H)</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {formatArea(wallArea(selectedWall), units)}
                </span>
              </div>
            </div>
          </div>
        ) : selectedOpening ? (
          <div className="pt-4 border-t border-slate-100 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Opening Properties
              </span>
              <button
                type="button"
                onClick={() => onDeleteOpening(selectedOpening.id)}
                aria-label="Delete selected opening"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1">
                Opening type
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['door', 'window'] as OpeningType[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      onUpdateOpening(selectedOpening.id, { type: kind })
                    }
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selectedOpening.type === kind
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {kind === 'door' ? 'Door' : 'Window'}
                  </button>
                ))}
              </div>
            </div>

            <PropertiesField
              id="opening-offset"
              type="length"
              label="Offset from start"
              meters={selectedOpening.offset}
              units={units}
              minMeters={0}
              maxMeters={
                parentWallForOpening
                  ? Math.max(
                      0.1,
                      wallLength(parentWallForOpening) - selectedOpening.width
                    )
                  : 1000
              }
              onMetersChange={(nextOffset) =>
                onUpdateOpening(selectedOpening.id, { offset: nextOffset })
              }
            />

            <div className="grid grid-cols-2 gap-2.5">
              <PropertiesField
                id="opening-width"
                type="length"
                label="Width"
                meters={selectedOpening.width}
                units={units}
                minMeters={0.3}
                maxMeters={
                  parentWallForOpening
                    ? Math.max(0.4, wallLength(parentWallForOpening))
                    : 50
                }
                onMetersChange={(nextWidth) =>
                  onUpdateOpening(selectedOpening.id, { width: nextWidth })
                }
              />
              <PropertiesField
                id="opening-height"
                type="length"
                label="Height"
                meters={selectedOpening.height}
                units={units}
                minMeters={0.3}
                maxMeters={10}
                onMetersChange={(nextHeight) =>
                  onUpdateOpening(selectedOpening.id, { height: nextHeight })
                }
              />
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-500">Opening area</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatArea(openingArea(selectedOpening), units)}
              </span>
            </div>
          </div>
        ) : selection?.kind === 'site' ? (
          <div className="pt-4 border-t border-slate-100 space-y-3.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Site Dimensions
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <PropertiesField
                id="site-width"
                type="length"
                label="Site width"
                meters={floorPlan.site.width}
                units={units}
                minMeters={1}
                maxMeters={1000}
                onMetersChange={(nextW) =>
                  onUpdateSite({ ...floorPlan.site, width: nextW })
                }
              />
              <PropertiesField
                id="site-depth"
                type="length"
                label="Site depth"
                meters={floorPlan.site.depth}
                units={units}
                minMeters={1}
                maxMeters={1000}
                onMetersChange={(nextD) =>
                  onUpdateSite({ ...floorPlan.site, depth: nextD })
                }
              />
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-500">Plot area</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatArea(floorPlan.site.width * floorPlan.site.depth, units)}
              </span>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <p className="text-xs text-slate-500 leading-relaxed">
              Select a room, wall, opening, or the site boundary to inspect and edit its measurements.
            </p>
            <button
              type="button"
              onClick={() => onSelect({ kind: 'site' })}
              className="w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Edit site bounds ({formatLength(floorPlan.site.width, units)} ×{' '}
              {formatLength(floorPlan.site.depth, units)})
            </button>
          </div>
        )}
      </div>

      {/* Floor & Building Summary */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Area & Cost Summary
          </h3>
          <button
            type="button"
            onClick={() => setShowRates((s) => !s)}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
          >
            {showRates ? (
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            )}
            <span>Rates</span>
          </button>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{activeFloor.name} area</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">
              {formatArea(activeArea, units)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Total living area</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatArea(allFloorsArea, units)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Counts (this floor)</span>
            <span className="font-mono tabular-nums">
              {activeFloor.rooms.length}R · {activeFloor.walls.length}W ·{' '}
              {doorCount}D/{windowCount}Win
            </span>
          </div>
        </div>

        {showRates && (
          <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2">
            <PropertiesField
              id="rate-wall"
              type="number"
              label="Wall €/m²"
              value={prices.wallPricePerM2}
              min={0}
              step="5"
              onChange={(val) => {
                const num = Number(val);
                if (Number.isFinite(num) && num >= 0) {
                  onChangePrices({ ...prices, wallPricePerM2: num });
                }
              }}
            />
            <PropertiesField
              id="rate-floor"
              type="number"
              label="Floor €/m²"
              value={prices.floorPricePerM2}
              min={0}
              step="5"
              onChange={(val) => {
                const num = Number(val);
                if (Number.isFinite(num) && num >= 0) {
                  onChangePrices({ ...prices, floorPricePerM2: num });
                }
              }}
            />
            <PropertiesField
              id="rate-door"
              type="number"
              label="Door €/unit"
              value={prices.doorPrice}
              min={0}
              step="10"
              onChange={(val) => {
                const num = Number(val);
                if (Number.isFinite(num) && num >= 0) {
                  onChangePrices({ ...prices, doorPrice: num });
                }
              }}
            />
            <PropertiesField
              id="rate-window"
              type="number"
              label="Window €/unit"
              value={prices.windowPrice}
              min={0}
              step="10"
              onChange={(val) => {
                const num = Number(val);
                if (Number.isFinite(num) && num >= 0) {
                  onChangePrices({ ...prices, windowPrice: num });
                }
              }}
            />
          </div>
        )}

        <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">Estimated total</span>
          <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
            €{totalEstimatedCost.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </aside>
  );
}
