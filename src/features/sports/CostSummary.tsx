import {
  elementArea,
  elementCost,
  formatArea,
  isSurfaceElementType,
  materialQuantity,
  projectTotal,
} from '../../lib/sports/calculations';
import type { SceneElement, SceneUnits } from '../../lib/sports/types';

interface CostSummaryProps {
  elements: SceneElement[];
  units: SceneUnits;
  selectedId: string | null;
  onSelectElement: (id: string) => void;
}

export function CostSummary({
  elements,
  units,
  selectedId,
  onSelectElement,
}: CostSummaryProps) {
  const total = projectTotal(elements);

  return (
    <section className="border-t border-slate-200 bg-slate-50/60 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold text-slate-900">
          Cost summary
        </h3>
        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {elements.length === 0 ? (
        <div className="px-4 py-5 text-xs text-slate-500">
          Add elements to calculate area and material cost estimates.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-200/70">
          {elements.map((el) => {
            const isSurface = isSurfaceElementType(el.type);
            const qty = materialQuantity(el);
            const cost = elementCost(el);
            const isSelected = el.id === selectedId;

            return (
              <button
                key={el.id}
                type="button"
                onClick={() => onSelectElement(el.id)}
                className={`w-full px-4 py-2.5 text-left flex items-start justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-blue-50/70' : 'hover:bg-white'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">
                    {el.label || el.type}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
                    {isSurface
                      ? `${formatArea(elementArea(el), units)} × ${el.quantityFactor}`
                      : `${qty.toFixed(0)} unit`}
                    {' · $'}
                    {el.unitPrice.toFixed(2)}
                  </p>
                </div>
                <span className="font-mono text-xs font-medium text-slate-800 tabular-nums shrink-0">
                  ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
