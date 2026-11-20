import { Layers, Plus, Trash2 } from 'lucide-react';
import type { Floor } from '../../lib/house/types';

interface FloorTabsProps {
  floors: Floor[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  onAddFloor: () => void;
  onDeleteFloor?: (floorId: string) => void;
}

export function FloorTabs({
  floors,
  activeFloorId,
  onSelectFloor,
  onAddFloor,
  onDeleteFloor,
}: FloorTabsProps) {
  const sortedFloors = [...floors].sort((a, b) => a.level - b.level);

  return (
    <div
      role="tablist"
      aria-label="Building floors"
      className="inline-flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg overflow-x-auto max-w-full"
    >
      <span className="px-1.5 text-slate-400 shrink-0" aria-hidden="true">
        <Layers className="w-3.5 h-3.5" />
      </span>
      {sortedFloors.map((floor) => {
        const isActive = floor.id === activeFloorId;
        return (
          <div key={floor.id} className="inline-flex items-center shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectFloor(floor.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {floor.name}
            </button>
            {isActive && sortedFloors.length > 1 && onDeleteFloor && (
              <button
                type="button"
                onClick={() => onDeleteFloor(floor.id)}
                title={`Remove ${floor.name}`}
                aria-label={`Remove ${floor.name}`}
                className="ml-0.5 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAddFloor}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-white rounded-md transition-colors whitespace-nowrap shrink-0"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        <span>Add floor</span>
      </button>
    </div>
  );
}
