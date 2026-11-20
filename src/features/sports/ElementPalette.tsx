import {
  CircleDot,
  Goal,
  Grid,
  Minus,
  Plus,
  Shield,
  Square,
  Target,
} from 'lucide-react';
import type { SceneElementType } from '../../lib/sports/types';

interface ElementPaletteProps {
  onAddElement: (type: SceneElementType) => void;
}

const PALETTE_ITEMS: {
  type: SceneElementType;
  label: string;
  sublabel: string;
  icon: typeof Square;
}[] = [
  {
    type: 'playing_surface',
    label: 'Playing surface',
    sublabel: 'Area-priced zone',
    icon: Grid,
  },
  {
    type: 'safety_zone',
    label: 'Safety zone',
    sublabel: 'Buffer apron (m²)',
    icon: Shield,
  },
  {
    type: 'hoop',
    label: 'Hoop',
    sublabel: 'Unit equipment',
    icon: Target,
  },
  {
    type: 'goal',
    label: 'Goal',
    sublabel: 'Unit equipment',
    icon: Goal,
  },
  {
    type: 'post',
    label: 'Post',
    sublabel: 'Circular support',
    icon: CircleDot,
  },
  {
    type: 'net',
    label: 'Net',
    sublabel: 'Divider / barrier',
    icon: Minus,
  },
  {
    type: 'custom',
    label: 'Custom rectangle',
    sublabel: 'Flexible surface',
    icon: Square,
  },
];

export function ElementPalette({ onAddElement }: ElementPaletteProps) {
  return (
    <aside
      aria-label="Element palette"
      className="w-full lg:w-[200px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col"
    >
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="font-display text-xs font-semibold text-slate-900">
          Element palette
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Click to place at center
        </p>
      </div>

      <div className="p-2.5 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddElement(item.type)}
              className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left shrink-0 lg:w-full focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className="w-4 h-4 text-slate-500 group-hover:text-slate-900 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 whitespace-nowrap">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-slate-500 hidden lg:block truncate">
                    {item.sublabel}
                  </p>
                </div>
              </div>
              <Plus
                className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 hidden lg:block"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
