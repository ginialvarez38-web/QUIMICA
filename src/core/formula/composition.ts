/**
 * Operaciones sobre la composicion de una especie: masa molar, aridad,
 * porcentajes en masa y forma canonica.
 */

import type { Arity, Composition, Result } from '../types.js';
import { err, ok } from '../types.js';
import { getElement } from '../../data/elements.js';
import { parseFormula } from './parse.js';

/**
 * Numero de ELEMENTOS DISTINTOS (§6).
 *
 * Este es el error clasico que el brief pide evitar explicitamente: la aridad
 * NO cuenta atomos. NaHCO3 tiene 6 atomos pero 4 elementos distintos
 * (Na, H, C, O), luego es CUATERNARIO. H2SO4 tiene 7 atomos y 3 elementos,
 * luego es TERNARIO.
 */
export function arityOf(composition: Composition): Arity {
  switch (composition.size) {
    case 0:
      return 'unary';
    case 1:
      return 'unary';
    case 2:
      return 'binary';
    case 3:
      return 'ternary';
    case 4:
      return 'quaternary';
    default:
      return 'higher';
  }
}

export const ARITY_LABEL_ES: Record<Arity, string> = {
  unary: 'Sustancia simple (un solo elemento)',
  binary: 'Compuesto binario',
  ternary: 'Compuesto ternario',
  quaternary: 'Compuesto cuaternario',
  higher: 'Compuesto de cinco o mas elementos',
};

/** Numero total de atomos, que NO es lo mismo que la aridad. */
export function atomCount(composition: Composition): number {
  let total = 0;
  for (const n of composition.values()) total += n;
  return total;
}

export interface MolarMassBreakdown {
  readonly total: number;
  readonly perElement: readonly {
    readonly symbol: string;
    readonly count: number;
    readonly atomicMass: number;
    readonly subtotal: number;
    readonly massPercent: number;
  }[];
  /** true si algun elemento aporta una masa nominal (radionucleido). */
  readonly hasNominalMass: boolean;
}

/**
 * Masa molar con desglose. Se devuelve el desglose y no solo el total porque
 * el modo profesor necesita ensenar de donde sale cada sumando:
 *   CaO = 40.078 + 15.999 = 56.077 g/mol
 */
export function molarMass(composition: Composition): Result<MolarMassBreakdown> {
  if (composition.size === 0) return err('Composicion vacia.');

  let total = 0;
  let hasNominalMass = false;
  const rows: { symbol: string; count: number; atomicMass: number; subtotal: number }[] = [];

  for (const [symbol, count] of composition) {
    const el = getElement(symbol);
    if (!el) return err(`Elemento desconocido: "${symbol}".`);
    if (el.massIsNominal) hasNominalMass = true;
    const subtotal = el.atomicMass * count;
    total += subtotal;
    rows.push({ symbol, count, atomicMass: el.atomicMass, subtotal });
  }

  return ok({
    total,
    hasNominalMass,
    perElement: rows.map((r) => ({ ...r, massPercent: (r.subtotal / total) * 100 })),
  });
}

/** Masa molar simple. Devuelve null si algun elemento es desconocido. */
export function molarMassOf(composition: Composition): number | null {
  const r = molarMass(composition);
  return r.ok ? r.value.total : null;
}

/** Masa molar a partir de una cadena de formula. */
export function molarMassOfFormula(formula: string): Result<MolarMassBreakdown> {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return parsed;
  return molarMass(parsed.value.composition);
}

/**
 * Orden de Hill: C primero, H segundo, el resto alfabetico. Si no hay carbono,
 * todo alfabetico. Es el orden estandar para indexar formulas y el que permite
 * reconocer que "OH2" y "H2O" son la misma sustancia.
 */
export function hillOrder(composition: Composition): string[] {
  const symbols = [...composition.keys()];
  const hasCarbon = composition.has('C');
  const rest = symbols.filter((s) => !(hasCarbon && (s === 'C' || s === 'H'))).sort();
  if (!hasCarbon) return symbols.slice().sort();
  const head = ['C'];
  if (composition.has('H')) head.push('H');
  return [...head, ...rest];
}

/**
 * Clave canonica de una composicion, independiente de como se escribio.
 * `Ca(OH)2`, `CaO2H2` y `CaH2O2` producen la misma clave, lo que permite
 * detectar que dos entradas de la biblioteca son la misma sustancia.
 *
 * La carga forma parte de la clave: SO4^2- no es SO4.
 */
export function compositionKey(composition: Composition, charge = 0): string {
  const parts = hillOrder(composition).map((s) => `${s}${composition.get(s) ?? 0}`);
  const body = parts.join('');
  if (charge === 0) return body;
  return `${body}^${charge > 0 ? '+' : '-'}${Math.abs(charge)}`;
}

/** Formula empirica: divide los subindices por su maximo comun divisor. */
export function empiricalFormula(composition: Composition): Composition {
  const counts = [...composition.values()];
  if (counts.length === 0) return new Map();
  let g = counts[0]!;
  for (const c of counts) g = gcdInt(g, c);
  if (g <= 1) return new Map(composition);
  const out = new Map<string, number>();
  for (const [s, n] of composition) out.set(s, n / g);
  return out;
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Multiplica una composicion por un coeficiente estequiometrico. */
export function scaleComposition(composition: Composition, factor: number): Composition {
  const out = new Map<string, number>();
  for (const [s, n] of composition) out.set(s, n * factor);
  return out;
}

/** Union de los simbolos presentes en varias composiciones, en orden estable. */
export function unionSymbols(compositions: readonly Composition[]): string[] {
  const seen = new Set<string>();
  for (const c of compositions) for (const s of c.keys()) seen.add(s);
  return [...seen].sort();
}
