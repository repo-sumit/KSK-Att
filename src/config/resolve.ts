/**
 * Configuration resolution (PRD §5.1–5.2). State instance is the floor; district
 * and institute layers may only override keys the state has opened. The result
 * is resolved once per session and handed to every screen.
 */
import type { AppConfiguration, ConfigKeyPath, ConfigLayer, StateConfiguration } from './types';

type PlainObject = Record<string, unknown>;

const isPlainObject = (v: unknown): v is PlainObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep merge where arrays and primitives replace, objects merge. */
function merge<T>(base: T, layer: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(layer)) return (layer === undefined ? base : layer) as T;
  const out: PlainObject = { ...base };
  for (const [key, value] of Object.entries(layer)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? merge(out[key], value) : value;
  }
  return out as T;
}

/** Keeps only the parts of `layer` whose dotted path is (or sits under) an allowed key. */
export function restrictLayer(layer: ConfigLayer, allowed: readonly ConfigKeyPath[], prefix = ''): ConfigLayer {
  const out: PlainObject = {};
  for (const [key, value] of Object.entries(layer as PlainObject)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (allowed.some((a) => a === path || path.startsWith(`${a}.`))) {
      out[key] = value;
    } else if (isPlainObject(value) && allowed.some((a) => a.startsWith(`${path}.`))) {
      const nested = restrictLayer(value as ConfigLayer, allowed, path);
      if (Object.keys(nested).length) out[key] = nested;
    }
  }
  return out as ConfigLayer;
}

export interface ResolveInput {
  readonly state: StateConfiguration;
  readonly district?: string;
  readonly instituteId?: string;
  /**
   * Presenter overrides from the demo panel. Applied last and unrestricted; only
   * the demo composition root passes this (never production code paths).
   */
  readonly demoOverrides?: ConfigLayer;
}

export function resolveConfiguration(input: ResolveInput): AppConfiguration {
  const { state } = input;
  let config = state.base;
  const district = input.district ? state.districtLayers?.[input.district] : undefined;
  if (district) config = merge(config, restrictLayer(district, state.overridableKeys));
  const institute = input.instituteId ? state.instituteLayers?.[input.instituteId] : undefined;
  if (institute) config = merge(config, restrictLayer(institute, state.overridableKeys));
  if (input.demoOverrides) config = merge(config, input.demoOverrides);
  return normalize(config);
}

/** Present and absent are always part of the status set (PRD §9.3). */
function normalize(config: AppConfiguration): AppConfiguration {
  const statusSet = [...new Set(['present', 'absent', ...config.marking.statusSet] as const)];
  return { ...config, marking: { ...config.marking, statusSet } };
}

export { merge as mergeConfigLayer };
