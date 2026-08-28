/**
 * Dimensional quantities and unit conversion.
 *
 * CHEMIA stores every physical quantity internally in a single canonical unit
 * per dimension (SI-derived, chosen for chemical convenience: L for volume,
 * mol/L for concentration, g/mol for molar mass). Conversion happens only at
 * the presentation boundary. Engines never see a "value in mL".
 */

import { T0_CELSIUS, ATM } from './constants.js';

export type Dimension =
  | 'amount' | 'mass' | 'volume' | 'concentration' | 'temperature' | 'pressure'
  | 'energy' | 'time' | 'length' | 'area' | 'molarMass' | 'density'
  | 'potential' | 'current' | 'charge' | 'conductivity' | 'power'
  | 'frequency' | 'wavenumber' | 'dimensionless' | 'flow' | 'heatCapacity'
  | 'molarEnergy' | 'molarEntropy' | 'viscosity' | 'absorbance';

/** Canonical (storage) unit for each dimension. */
export const CANONICAL: Record<Dimension, string> = {
  amount: 'mol',
  mass: 'g',
  volume: 'L',
  concentration: 'mol/L',
  temperature: 'K',
  pressure: 'Pa',
  energy: 'J',
  time: 's',
  length: 'm',
  area: 'm²',
  molarMass: 'g/mol',
  density: 'g/mL',
  potential: 'V',
  current: 'A',
  charge: 'C',
  conductivity: 'S/m',
  power: 'W',
  frequency: 'Hz',
  wavenumber: 'cm⁻¹',
  dimensionless: '',
  flow: 'L/min',
  heatCapacity: 'J/K',
  molarEnergy: 'J/mol',
  molarEntropy: 'J/(mol·K)',
  viscosity: 'Pa·s',
  absorbance: 'AU',
};

interface UnitDef {
  dim: Dimension;
  /** value_canonical = value_unit * factor + offset */
  factor: number;
  offset?: number;
  label: string;
}

const U = (dim: Dimension, factor: number, label: string, offset = 0): UnitDef =>
  ({ dim, factor, label, offset });

/**
 * Unit registry. Keys are the canonical spellings accepted by `convert`.
 * Aliases are resolved through ALIASES below.
 */
export const UNITS: Record<string, UnitDef> = {
  // amount
  'mol': U('amount', 1, 'mol'),
  'mmol': U('amount', 1e-3, 'mmol'),
  'umol': U('amount', 1e-6, 'µmol'),
  'nmol': U('amount', 1e-9, 'nmol'),

  // mass
  'kg': U('mass', 1e3, 'kg'),
  'g': U('mass', 1, 'g'),
  'mg': U('mass', 1e-3, 'mg'),
  'ug': U('mass', 1e-6, 'µg'),
  'ng': U('mass', 1e-9, 'ng'),
  't': U('mass', 1e6, 't'),

  // volume
  'L': U('volume', 1, 'L'),
  'mL': U('volume', 1e-3, 'mL'),
  'uL': U('volume', 1e-6, 'µL'),
  'm3': U('volume', 1e3, 'm³'),
  'cm3': U('volume', 1e-3, 'cm³'),

  // concentration
  'mol/L': U('concentration', 1, 'mol·L⁻¹'),
  'mmol/L': U('concentration', 1e-3, 'mmol·L⁻¹'),
  'umol/L': U('concentration', 1e-6, 'µmol·L⁻¹'),
  'nmol/L': U('concentration', 1e-9, 'nmol·L⁻¹'),

  // temperature (affine)
  'K': U('temperature', 1, 'K'),
  'degC': U('temperature', 1, '°C', T0_CELSIUS),
  'degF': U('temperature', 5 / 9, '°F', T0_CELSIUS - (32 * 5) / 9),

  // pressure
  'Pa': U('pressure', 1, 'Pa'),
  'kPa': U('pressure', 1e3, 'kPa'),
  'MPa': U('pressure', 1e6, 'MPa'),
  'bar': U('pressure', 1e5, 'bar'),
  'mbar': U('pressure', 1e2, 'mbar'),
  'atm': U('pressure', ATM, 'atm'),
  'mmHg': U('pressure', ATM / 760, 'mmHg'),
  'torr': U('pressure', ATM / 760, 'Torr'),
  'psi': U('pressure', 6894.757293168, 'psi'),

  // energy
  'J': U('energy', 1, 'J'),
  'kJ': U('energy', 1e3, 'kJ'),
  'cal': U('energy', 4.184, 'cal'),
  'kcal': U('energy', 4184, 'kcal'),
  'eV': U('energy', 1.602176634e-19, 'eV'),

  // molar energy
  'J/mol': U('molarEnergy', 1, 'J·mol⁻¹'),
  'kJ/mol': U('molarEnergy', 1e3, 'kJ·mol⁻¹'),
  'kcal/mol': U('molarEnergy', 4184, 'kcal·mol⁻¹'),

  // molar entropy
  'J/(mol·K)': U('molarEntropy', 1, 'J·mol⁻¹·K⁻¹'),
  'cal/(mol·K)': U('molarEntropy', 4.184, 'cal·mol⁻¹·K⁻¹'),

  // time
  's': U('time', 1, 's'),
  'ms': U('time', 1e-3, 'ms'),
  'us': U('time', 1e-6, 'µs'),
  'min': U('time', 60, 'min'),
  'h': U('time', 3600, 'h'),
  'd': U('time', 86400, 'd'),
  'a': U('time', 31557600, 'a'),

  // length
  'm': U('length', 1, 'm'),
  'cm': U('length', 1e-2, 'cm'),
  'mm': U('length', 1e-3, 'mm'),
  'um': U('length', 1e-6, 'µm'),
  'nm': U('length', 1e-9, 'nm'),
  'pm': U('length', 1e-12, 'pm'),
  'A': U('length', 1e-10, 'Å'),

  // molar mass
  'g/mol': U('molarMass', 1, 'g·mol⁻¹'),

  // density
  'g/mL': U('density', 1, 'g·mL⁻¹'),
  'kg/m3': U('density', 1e-3, 'kg·m⁻³'),
  'g/L': U('density', 1e-3, 'g·L⁻¹'),

  // electrical
  'V': U('potential', 1, 'V'),
  'mV': U('potential', 1e-3, 'mV'),
  'A_current': U('current', 1, 'A'),
  'mA': U('current', 1e-3, 'mA'),
  'uA': U('current', 1e-6, 'µA'),
  'C': U('charge', 1, 'C'),
  'S/m': U('conductivity', 1, 'S·m⁻¹'),
  'uS/cm': U('conductivity', 1e-4, 'µS·cm⁻¹'),
  'mS/cm': U('conductivity', 1e-1, 'mS·cm⁻¹'),

  // power
  'W': U('power', 1, 'W'),
  'kW': U('power', 1e3, 'kW'),

  // spectroscopy
  'Hz': U('frequency', 1, 'Hz'),
  'MHz': U('frequency', 1e6, 'MHz'),
  'cm-1': U('wavenumber', 1, 'cm⁻¹'),
  'AU': U('absorbance', 1, 'AU'),

  // flow
  'L/min': U('flow', 1, 'L·min⁻¹'),
  'mL/min': U('flow', 1e-3, 'mL·min⁻¹'),
  'm3/h': U('flow', 1000 / 60, 'm³·h⁻¹'),

  // misc
  '': U('dimensionless', 1, ''),
  'J/K': U('heatCapacity', 1, 'J·K⁻¹'),
  'Pa·s': U('viscosity', 1, 'Pa·s'),
  'cP': U('viscosity', 1e-3, 'cP'),
};

const ALIASES: Record<string, string> = {
  'M': 'mol/L', 'mM': 'mmol/L', 'uM': 'umol/L', 'µM': 'umol/L', 'nM': 'nmol/L',
  'µL': 'uL', 'µg': 'ug', 'µmol': 'umol', 'µm': 'um', 'µS/cm': 'uS/cm', 'µA': 'mA',
  '°C': 'degC', 'C_temp': 'degC', '°F': 'degF',
  'l': 'L', 'ml': 'mL', 'litre': 'L',
  'Å': 'A', 'angstrom': 'A',
  'Torr': 'torr',
  'kg/m³': 'kg/m3', 'm³': 'm3', 'cm³': 'cm3',
  'cm⁻¹': 'cm-1',
  'amp': 'A_current',
  'year': 'a', 'yr': 'a',
};

export function resolveUnit(u: string): UnitDef {
  const key = ALIASES[u] ?? u;
  const def = UNITS[key];
  if (!def) throw new Error(`Unknown unit: "${u}"`);
  return def;
}

/** Human-readable label for a unit key (with proper typographic symbols). */
export function unitLabel(u: string): string {
  try { return resolveUnit(u).label; } catch { return u; }
}

/** Convert a value between two units of the same dimension. */
export function convert(value: number, from: string, to: string): number {
  const a = resolveUnit(from);
  const b = resolveUnit(to);
  if (a.dim !== b.dim) {
    throw new Error(`Cannot convert ${a.dim} (${from}) to ${b.dim} (${to})`);
  }
  const canonical = value * a.factor + (a.offset ?? 0);
  return (canonical - (b.offset ?? 0)) / b.factor;
}

/** Convert a value expressed in `from` into the canonical unit of its dimension. */
export function toCanonical(value: number, from: string): number {
  const a = resolveUnit(from);
  return value * a.factor + (a.offset ?? 0);
}

/** Convert a canonical-unit value into `to`. */
export function fromCanonical(value: number, to: string): number {
  const b = resolveUnit(to);
  return (value - (b.offset ?? 0)) / b.factor;
}

/** Units that share a dimension — used to populate unit pickers. */
export function unitsFor(dim: Dimension): string[] {
  return Object.entries(UNITS).filter(([, d]) => d.dim === dim).map(([k]) => k);
}

// ---------------------------------------------------------------------------
// Convenience temperature helpers (used pervasively by the chemistry engines)
// ---------------------------------------------------------------------------

export const celsiusToKelvin = (c: number): number => c + T0_CELSIUS;
export const kelvinToCelsius = (k: number): number => k - T0_CELSIUS;

/**
 * A quantity carrying its own unit. Used at module boundaries where the unit
 * is part of the data (instrument outputs, lesson parameters, process tags).
 */
export interface Quantity {
  readonly value: number;
  readonly unit: string;
}

export const q = (value: number, unit: string): Quantity => ({ value, unit });

export function qConvert(quantity: Quantity, to: string): Quantity {
  return { value: convert(quantity.value, quantity.unit, to), unit: to };
}

export function qCanonical(quantity: Quantity): number {
  return toCanonical(quantity.value, quantity.unit);
}
