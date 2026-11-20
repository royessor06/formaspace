import { convertLength, toMeters } from '../../lib/sports/calculations';
import type { SceneUnits } from '../../lib/sports/types';

export function useUnitLength(meters: number, units: SceneUnits) {
  const displayValue = Number(convertLength(meters, units).toFixed(2));
  const unitSuffix = units === 'imperial' ? 'ft' : 'm';

  const parseInputToMeters = (
    rawValue: string,
    minMeters = 0.05,
    maxMeters = 1000
  ): number | null => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0 || (parsed === 0 && minMeters > 0)) {
      return null;
    }
    const clamped = Math.min(maxMeters, Math.max(minMeters, toMeters(parsed, units)));
    return Number(clamped.toFixed(3));
  };

  return {
    displayValue,
    unitSuffix,
    parseInputToMeters,
  };
}

interface PropertiesFieldBaseProps {
  id: string;
  label: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

interface PropertiesTextFieldProps extends PropertiesFieldBaseProps {
  type?: 'text';
  value: string;
  maxLength?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

interface PropertiesNumberFieldProps extends PropertiesFieldBaseProps {
  type: 'number';
  value: number;
  min?: number;
  max?: number;
  step?: number | string;
  onChange: (value: string) => void;
}

interface PropertiesLengthFieldProps extends PropertiesFieldBaseProps {
  type: 'length';
  meters: number;
  units: SceneUnits;
  minMeters?: number;
  maxMeters?: number;
  step?: number | string;
  onMetersChange: (nextMeters: number) => void;
}

export type PropertiesFieldProps =
  | PropertiesTextFieldProps
  | PropertiesNumberFieldProps
  | PropertiesLengthFieldProps;

export function PropertiesField(props: PropertiesFieldProps) {
  const unitHook = useUnitLength(
    props.type === 'length' ? props.meters : 0,
    props.type === 'length' ? props.units : 'metric'
  );

  if (props.type === 'length') {
    return (
      <div className={props.className}>
        <label
          htmlFor={props.id}
          className="block text-xs font-medium text-slate-700 mb-1"
        >
          {props.label} ({unitHook.unitSuffix})
        </label>
        <input
          id={props.id}
          type="number"
          step={props.step ?? '0.1'}
          min="0.05"
          disabled={props.disabled}
          readOnly={props.readOnly}
          value={unitHook.displayValue}
          onChange={(e) => {
            const next = unitHook.parseInputToMeters(
              e.target.value,
              props.minMeters ?? 0.05,
              props.maxMeters ?? 1000
            );
            if (next !== null) {
              props.onMetersChange(next);
            }
          }}
          className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-600"
        />
      </div>
    );
  }

  if (props.type === 'number') {
    return (
      <div className={props.className}>
        <label
          htmlFor={props.id}
          className="block text-xs font-medium text-slate-700 mb-1"
        >
          {props.label}
        </label>
        <input
          id={props.id}
          type="number"
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          readOnly={props.readOnly}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-600"
        />
      </div>
    );
  }

  return (
    <div className={props.className}>
      <label
        htmlFor={props.id}
        className="block text-xs font-medium text-slate-700 mb-1"
      >
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        value={props.value}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        disabled={props.disabled}
        readOnly={props.readOnly}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-600"
      />
    </div>
  );
}
