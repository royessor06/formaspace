import {
  AppWindow,
  DoorOpen,
  Maximize2,
  MousePointer2,
  PenTool,
  SquarePlus,
} from 'lucide-react';
import type { HouseToolMode } from '../../lib/house/types';

interface RoomPaletteProps {
  toolMode: HouseToolMode;
  onChangeToolMode: (mode: HouseToolMode) => void;
  onAddRoom: () => void;
  onSelectSite: () => void;
  isSiteSelected: boolean;
}

export function RoomPalette({
  toolMode,
  onChangeToolMode,
  onAddRoom,
  onSelectSite,
  isSiteSelected,
}: RoomPaletteProps) {
  const toolButtonClass = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium rounded-lg border transition-colors ${
      active
        ? 'bg-slate-900 text-white border-slate-900'
        : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
    }`;

  return (
    <aside
      aria-label="Floor plan tools"
      className="w-full lg:w-[200px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-3 flex flex-col justify-between gap-4 overflow-y-auto"
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Layout Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => onChangeToolMode('select')}
              aria-pressed={toolMode === 'select'}
              className={toolButtonClass(toolMode === 'select')}
            >
              <MousePointer2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Select / Move</span>
            </button>

            <button
              type="button"
              onClick={onAddRoom}
              className={toolButtonClass(false)}
            >
              <SquarePlus className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="truncate">Add room</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeToolMode(toolMode === 'draw_wall' ? 'select' : 'draw_wall')
              }
              aria-pressed={toolMode === 'draw_wall'}
              className={toolButtonClass(toolMode === 'draw_wall')}
            >
              <PenTool className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Draw wall</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeToolMode(toolMode === 'add_door' ? 'select' : 'add_door')
              }
              aria-pressed={toolMode === 'add_door'}
              className={toolButtonClass(toolMode === 'add_door')}
            >
              <DoorOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Add door</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeToolMode(toolMode === 'add_window' ? 'select' : 'add_window')
              }
              aria-pressed={toolMode === 'add_window'}
              className={toolButtonClass(toolMode === 'add_window')}
            >
              <AppWindow className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Add window</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Plot
          </h2>
          <button
            type="button"
            onClick={onSelectSite}
            aria-pressed={isSiteSelected}
            className={toolButtonClass(isSiteSelected)}
          >
            <Maximize2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Site bounds</span>
          </button>
        </div>
      </div>

      <div className="hidden lg:block pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed space-y-1.5">
        {toolMode === 'draw_wall' ? (
          <p className="text-blue-700 font-medium">
            Click and drag on the canvas to draw a wall segment. Press Esc to finish.
          </p>
        ) : toolMode === 'add_door' ? (
          <p className="text-blue-700 font-medium">
            Click on any wall to place a 0.9m door.
          </p>
        ) : toolMode === 'add_window' ? (
          <p className="text-blue-700 font-medium">
            Click on any wall to place a 1.2m window.
          </p>
        ) : (
          <p>
            Click a room, wall, opening, or site border to edit dimensions.
          </p>
        )}
        <p>Pan with Space+drag or middle mouse. Scroll to zoom.</p>
      </div>
    </aside>
  );
}
