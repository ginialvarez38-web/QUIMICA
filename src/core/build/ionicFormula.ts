/**
 * Generador de formulas ionicas (§5, §7).
 *
 * El brief es explicito: "No simplemente mostrar el resultado". Asi que esta
 * funcion no devuelve "Al2O3", devuelve la DERIVACION completa:
 *
 *   1. Al actua como Al³⁺, O actua como O²⁻
 *   2. La formula debe ser electricamente neutra
 *   3. mcm(3, 2) = 6  ->  hacen falta 6 cargas positivas y 6 negativas
 *   4. 6 / 3 = 2 aluminios ;  6 / 2 = 3 oxigenos
 *   5. Comprobacion: 2(+3) + 3(-2) = +6 - 6 = 0  ✓
 *   6. Formula: Al₂O₃
 *
 * Ese paso 5 es literalmente el que pide el brief.
 */

import type { Composition, Ion, Result } from '../types.js';
import { err, ok } from '../types.js';
import { toSubscript } from '../formula/render.js';

export interface DerivationStep {
  readonly n: number;
  readonly title: string;
  readonly detail: string;
  /** Expresion matematica destacada, si el paso tiene una. */
  readonly math?: string;
}

export interface BuiltFormula {
  readonly formula: string;
  /** Formula con subindices Unicode, lista para mostrar. */
  readonly display: string;
  readonly composition: Composition;
  readonly cationCount: number;
  readonly anionCount: number;
  readonly cation: Ion;
  readonly anion: Ion;
  /** Los pasos que el estudiante debe ver. */
  readonly derivation: readonly DerivationStep[];
  /** "2(+3) + 3(-2) = 0" */
  readonly neutralityCheck: string;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

/** Formatea una carga: 3 -> "3+", -2 -> "2-". */
function chargeLabel(charge: number): string {
  const m = Math.abs(charge);
  return `${m > 1 ? m : ''}${charge > 0 ? '+' : '-'}`;
}

/**
 * ¿Necesita parentesis este ion al llevar subindice?
 * Solo los poliatomicos: Ca(OH)₂ si, CaCl₂ no.
 */
function needsParentheses(ion: Ion, count: number): boolean {
  if (count <= 1) return false;
  // Poliatomico = mas de un atomo en total.
  let atoms = 0;
  for (const n of ion.composition.values()) atoms += n;
  return atoms > 1;
}

function writeIonPart(ion: Ion, count: number): string {
  if (count === 0) return '';
  const sub = count > 1 ? String(count) : '';
  if (needsParentheses(ion, count)) return `(${ion.formula})${sub}`;
  return `${ion.formula}${sub}`;
}

function writeDisplayPart(ion: Ion, count: number): string {
  if (count === 0) return '';
  const sub = count > 1 ? toSubscript(count) : '';
  const body = ion.formula.replace(/(\d+)/g, (_m, d: string) => toSubscript(Number(d)));
  if (needsParentheses(ion, count)) return `(${body})${sub}`;
  return `${body}${sub}`;
}

/**
 * Combina un cation y un anion en el compuesto neutro de formula minima.
 */
export function buildIonicFormula(cation: Ion, anion: Ion): Result<BuiltFormula> {
  if (cation.charge <= 0) return err(`${cation.formula} no es un cation (carga ${cation.charge}).`);
  if (anion.charge >= 0) return err(`${anion.formula} no es un anion (carga ${anion.charge}).`);

  const pos = cation.charge;
  const neg = Math.abs(anion.charge);

  // Metodo del minimo comun multiplo. Equivale al "criss-cross" pero sin
  // producir subindices no simplificados: el criss-cross ingenuo da Ca2O2
  // para Ca²⁺ + O²⁻, que es incorrecto como formula empirica.
  const total = lcm(pos, neg);
  const cationCount = total / pos;
  const anionCount = total / neg;

  const formula = writeIonPart(cation, cationCount) + writeIonPart(anion, anionCount);
  const display = writeDisplayPart(cation, cationCount) + writeDisplayPart(anion, anionCount);

  const composition = new Map<string, number>();
  for (const [sym, n] of cation.composition) {
    composition.set(sym, (composition.get(sym) ?? 0) + n * cationCount);
  }
  for (const [sym, n] of anion.composition) {
    composition.set(sym, (composition.get(sym) ?? 0) + n * anionCount);
  }

  const posTerm = `${cationCount > 1 ? cationCount : ''}(+${pos})`;
  const negTerm = `${anionCount > 1 ? anionCount : ''}(-${neg})`;
  const neutralityCheck = `${posTerm} + ${negTerm} = ${cationCount * pos} - ${anionCount * neg} = 0`;

  const derivation: DerivationStep[] = [
    {
      n: 1,
      title: 'Identificar los iones',
      detail: `${cation.formula}${chargeLabel(cation.charge)} es el cation (${cation.name}) y ${anion.formula}${chargeLabel(anion.charge)} es el anion (${anion.name}).`,
    },
    {
      n: 2,
      title: 'Exigir neutralidad electrica',
      detail:
        'Un compuesto no tiene carga neta. Las cargas positivas aportadas por los cationes deben cancelar exactamente las negativas de los aniones.',
      math: 'carga total = 0',
    },
    {
      n: 3,
      title: 'Igualar la carga total de cada signo',
      detail: `Se busca el menor numero de cargas que ambos iones pueden alcanzar: el minimo comun multiplo de ${pos} y ${neg}.`,
      math: `mcm(${pos}, ${neg}) = ${total}`,
    },
    {
      n: 4,
      title: 'Calcular cuantos iones hacen falta',
      detail: `Se necesitan ${cationCount} ${cation.formula}${chargeLabel(cation.charge)} y ${anionCount} ${anion.formula}${chargeLabel(anion.charge)}.`,
      math: `${total} / ${pos} = ${cationCount}   y   ${total} / ${neg} = ${anionCount}`,
    },
    {
      n: 5,
      title: 'Comprobar el balance de carga',
      detail: 'La suma debe dar exactamente cero. Este es el paso que valida la formula.',
      math: neutralityCheck,
    },
    {
      n: 6,
      title: 'Escribir la formula',
      detail:
        cationCount > 1 || anionCount > 1
          ? `Los subindices son ${cationCount} y ${anionCount}. ${needsParentheses(anion, anionCount) ? `Como ${anion.formula} es un ion poliatomico y lleva subindice, se escribe entre parentesis.` : 'El subindice 1 no se escribe.'}`
          : 'Ambos subindices son 1, luego no se escriben.',
      math: display,
    },
  ];

  return ok({
    formula,
    display,
    composition,
    cationCount,
    anionCount,
    cation,
    anion,
    derivation,
    neutralityCheck,
  });
}

/**
 * Todas las formulas posibles cuando un elemento tiene varios estados de
 * oxidacion. Fe + O da FeO y Fe₂O₃, y ambas son correctas: el sistema debe
 * mostrar las alternativas y no elegir en silencio (§32).
 */
export function buildAllIonicFormulas(
  cations: readonly Ion[],
  anions: readonly Ion[],
): BuiltFormula[] {
  const out: BuiltFormula[] = [];
  for (const c of cations) {
    for (const a of anions) {
      const r = buildIonicFormula(c, a);
      if (r.ok) out.push(r.value);
    }
  }
  return out;
}
