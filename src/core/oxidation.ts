/**
 * Asignacion de numeros de oxidacion.
 *
 * Lo importante aqui no es el numero: es POR QUE. Cada asignacion vuelve
 * etiquetada con la regla que la produjo, para que el modo profesor pueda
 * decir "el oxigeno es -2 por la regla 6, salvo en peroxidos" en lugar de
 * mostrar un numero magico.
 *
 * Prioridad de reglas (convencion estandar de quimica general):
 *   R1  Elemento libre ........................ 0
 *   R2  Ion monoatomico ....................... carga del ion
 *   R3  Fluor ................................. siempre -1
 *   R4  Metales del grupo 1 / 2 ............... +1 / +2
 *   R5  Hidrogeno ............................. +1, o -1 en hidruros metalicos
 *   R6  Oxigeno ............................... -2, con excepciones
 *   R7  Halogenos ............................. -1 salvo con O o halogeno mas
 *                                               electronegativo
 *   R8  Suma = carga total .................... resuelve el elemento restante
 */

import type { Composition, Element, Result } from './types.js';
import { err, ok } from './types.js';
import { getElement } from '../data/elements.js';
import { parseFormula } from './formula/parse.js';
import { METALLIC_CATEGORIES } from './types.js';

export interface OxidationAssignment {
  readonly symbol: string;
  readonly count: number;
  /** Estado de oxidacion. Puede ser fraccionario (Fe₃O₄ -> +8/3). */
  readonly state: number;
  /** Identificador de la regla: 'R1'..'R8'. */
  readonly rule: string;
  /** Explicacion legible de por que se asigno ese valor. */
  readonly reason: string;
  /** true si el valor es fraccionario, es decir, un promedio. */
  readonly isAverage: boolean;
}

export interface OxidationResult {
  readonly assignments: readonly OxidationAssignment[];
  /** Comprobacion final: suma(estado * cantidad) === carga. */
  readonly sum: number;
  readonly charge: number;
  readonly consistent: boolean;
  /** Texto del balance: "2(+3) + 3(-2) = 0". */
  readonly balanceText: string;
  readonly notes: readonly string[];
}

const GROUP1 = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr']);
const GROUP2 = new Set(['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra']);
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I', 'At']);

/** Peroxidos conocidos donde el oxigeno vale -1 en vez de -2. */
const PEROXIDES = new Set(['H2O2', 'Na2O2', 'K2O2', 'BaO2', 'CaO2', 'Li2O2', 'MgO2', 'SrO2', 'ZnO2']);
/** Superoxidos donde el oxigeno vale -1/2. */
const SUPEROXIDES = new Set(['KO2', 'RbO2', 'CsO2', 'NaO2']);

function isMetallic(el: Element): boolean {
  return METALLIC_CATEGORIES.has(el.category);
}

/**
 * Calcula los estados de oxidacion de una especie.
 *
 * @param composition  atomos por elemento
 * @param charge       carga neta de la especie (0 para neutras)
 * @param formulaHint  formula original, usada para detectar peroxidos y
 *                     superoxidos que la composicion sola no distingue
 */
export function assignOxidationStates(
  composition: Composition,
  charge = 0,
  formulaHint = '',
): Result<OxidationResult> {
  if (composition.size === 0) return err('Composicion vacia.');

  const notes: string[] = [];
  const elements = new Map<string, Element>();
  for (const symbol of composition.keys()) {
    const el = getElement(symbol);
    if (!el) return err(`Elemento desconocido: "${symbol}".`);
    elements.set(symbol, el);
  }

  // --- R1: elemento libre -------------------------------------------------
  if (composition.size === 1 && charge === 0) {
    const [symbol, count] = [...composition][0]!;
    return ok({
      assignments: [
        {
          symbol,
          count,
          state: 0,
          rule: 'R1',
          reason: 'Elemento libre: un atomo unido solo a atomos identicos no tiene separacion de carga, luego su estado de oxidacion es 0.',
          isAverage: false,
        },
      ],
      sum: 0,
      charge: 0,
      consistent: true,
      balanceText: `${count > 1 ? count : ''}(0) = 0`,
      notes,
    });
  }

  // --- R2: ion monoatomico ------------------------------------------------
  if (composition.size === 1 && charge !== 0) {
    const [symbol, count] = [...composition][0]!;
    const state = charge / count;
    return ok({
      assignments: [
        {
          symbol,
          count,
          state,
          rule: 'R2',
          reason: `Ion monoatomico: el estado de oxidacion es exactamente la carga del ion (${fmt(state)}).`,
          isAverage: false,
        },
      ],
      sum: charge,
      charge,
      consistent: true,
      balanceText: `${count > 1 ? count : ''}(${fmt(state)}) = ${fmt(charge)}`,
      notes,
    });
  }

  const known = new Map<string, { state: number; rule: string; reason: string }>();

  const hasOxygen = composition.has('O');
  const compact = formulaHint.replace(/\s|·.*$/g, '');

  // --- R3: fluor ----------------------------------------------------------
  if (composition.has('F')) {
    known.set('F', {
      state: -1,
      rule: 'R3',
      reason: 'El fluor es el elemento mas electronegativo: en cualquier compuesto su estado de oxidacion es -1.',
    });
  }

  // --- R4: metales alcalinos y alcalinoterreos ----------------------------
  for (const symbol of composition.keys()) {
    if (GROUP1.has(symbol)) {
      known.set(symbol, {
        state: 1,
        rule: 'R4',
        reason: `${elements.get(symbol)!.name} es un metal alcalino (grupo 1): en compuestos actua siempre con +1.`,
      });
    } else if (GROUP2.has(symbol)) {
      known.set(symbol, {
        state: 2,
        rule: 'R4',
        reason: `${elements.get(symbol)!.name} es un metal alcalinoterreo (grupo 2): en compuestos actua siempre con +2.`,
      });
    }
  }

  // --- R6: oxigeno --------------------------------------------------------
  if (hasOxygen) {
    if (composition.has('F')) {
      // OF2, O2F2: el oxigeno es POSITIVO frente al fluor.
      known.set('O', {
        state: 2,
        rule: 'R6',
        reason: 'Excepcion: unido a fluor, el oxigeno cede densidad electronica y su estado de oxidacion es positivo (+2 en OF₂).',
      });
      notes.push('El fluor es mas electronegativo que el oxigeno, luego invierte el signo habitual del oxigeno.');
    } else if (PEROXIDES.has(compact)) {
      known.set('O', {
        state: -1,
        rule: 'R6',
        reason: 'Peroxido: existe un enlace O—O, y cada oxigeno solo capta un electron del resto de la molecula, luego vale -1.',
      });
      notes.push('Se ha reconocido un peroxido (enlace O—O), no un oxido normal.');
    } else if (SUPEROXIDES.has(compact)) {
      known.set('O', {
        state: -0.5,
        rule: 'R6',
        reason: 'Superoxido: el anion O₂⁻ reparte una unica carga negativa entre dos oxigenos, luego el valor medio es -1/2.',
      });
      notes.push('El valor -1/2 es un PROMEDIO: ningun atomo individual tiene media carga.');
    } else {
      known.set('O', {
        state: -2,
        rule: 'R6',
        reason: 'El oxigeno actua con -2 en la inmensa mayoria de sus compuestos (completa su octeto captando dos electrones).',
      });
    }
  }

  // --- R5: hidrogeno ------------------------------------------------------
  if (composition.has('H')) {
    // Hidruro metalico: H unido a un metal y sin no metales que compitan.
    const others = [...composition.keys()].filter((s) => s !== 'H');
    const allMetals =
      others.length > 0 && others.every((s) => isMetallic(elements.get(s)!));
    if (allMetals) {
      known.set('H', {
        state: -1,
        rule: 'R5',
        reason: 'Hidruro metalico: el hidrogeno es mas electronegativo que el metal, luego capta un electron y actua con -1.',
      });
      notes.push('En los hidruros metalicos el hidrogeno es el elemento negativo.');
    } else {
      known.set('H', {
        state: 1,
        rule: 'R5',
        reason: 'El hidrogeno actua con +1 cuando se une a no metales, que son mas electronegativos que el.',
      });
    }
  }

  // --- R7: halogenos distintos del fluor ---------------------------------
  for (const symbol of composition.keys()) {
    if (symbol === 'F' || !HALOGENS.has(symbol)) continue;
    if (known.has(symbol)) continue;
    // Si hay oxigeno o un halogeno mas electronegativo, el halogeno es
    // positivo y su valor lo determina R8; no se fija aqui.
    const competitor =
      hasOxygen ||
      [...composition.keys()].some(
        (s) =>
          s !== symbol &&
          HALOGENS.has(s) &&
          (elements.get(s)!.electronegativity ?? 0) > (elements.get(symbol)!.electronegativity ?? 0),
      );
    if (!competitor) {
      known.set(symbol, {
        state: -1,
        rule: 'R7',
        reason: `${elements.get(symbol)!.name} es un halogeno unido a elementos menos electronegativos: actua con -1.`,
      });
    }
  }

  // --- R8: resolver los elementos restantes -------------------------------
  const unknown = [...composition.keys()].filter((s) => !known.has(s));

  if (unknown.length === 0) {
    return finish(composition, charge, known, notes);
  }

  // Suma aportada por los elementos ya conocidos.
  let knownSum = 0;
  for (const [symbol, info] of known) knownSum += info.state * (composition.get(symbol) ?? 0);

  if (unknown.length === 1) {
    const symbol = unknown[0]!;
    const count = composition.get(symbol)!;
    const state = (charge - knownSum) / count;
    const el = elements.get(symbol)!;
    const isAverage = !Number.isInteger(state);

    let reason =
      `Se despeja de la condicion de que la suma de los estados de oxidacion ` +
      `iguale la carga total (${fmt(charge)}): ${fmt(state)}.`;
    if (isAverage) {
      reason +=
        ' El valor no es entero: se trata de un PROMEDIO, porque los atomos de este elemento no son todos equivalentes en la estructura.';
      notes.push(
        `El estado ${fmt(state)} de ${el.name} es un valor medio. En ${compact || 'este compuesto'} coexisten atomos con estados distintos.`,
      );
    } else if (!el.oxidationStates.includes(state) && el.oxidationStates.length > 0) {
      notes.push(
        `Atencion: ${fmt(state)} no figura entre los estados de oxidacion habituales de ${el.name} (${el.oxidationStates.map((s) => fmt(s)).join(', ')}). Conviene revisar la formula.`,
      );
    }

    known.set(symbol, { state, rule: 'R8', reason, isAverage } as never);
    return finish(composition, charge, known, notes);
  }

  // Varios elementos sin determinar: no se inventa una reparticion. Se dice.
  return err(
    'No se pueden asignar los estados de oxidacion de forma unica.',
    `Quedan ${unknown.length} elementos sin determinar (${unknown.join(', ')}) y una sola ecuacion de balance de carga. ` +
      'Haria falta informacion estructural (conectividad) que este modelo no tiene.',
  );
}

function finish(
  composition: Composition,
  charge: number,
  known: Map<string, { state: number; rule: string; reason: string; isAverage?: boolean }>,
  notes: string[],
): Result<OxidationResult> {
  const assignments: OxidationAssignment[] = [];
  let sum = 0;
  const terms: string[] = [];

  for (const [symbol, count] of composition) {
    const info = known.get(symbol);
    if (!info) return err(`No se pudo asignar el estado de oxidacion de ${symbol}.`);
    sum += info.state * count;
    assignments.push({
      symbol,
      count,
      state: info.state,
      rule: info.rule,
      reason: info.reason,
      isAverage: info.isAverage ?? !Number.isInteger(info.state),
    });
    terms.push(`${count > 1 ? count : ''}(${fmt(info.state, true)})`);
  }

  const consistent = Math.abs(sum - charge) < 1e-9;
  if (!consistent) {
    notes.push(
      `Inconsistencia: la suma de los estados de oxidacion (${fmt(sum)}) no coincide con la carga de la especie (${fmt(charge)}).`,
    );
  }

  return ok({
    assignments,
    sum,
    charge,
    consistent,
    balanceText: `${terms.join(' + ')} = ${fmt(charge)}`,
    notes,
  });
}

/** Formatea un estado de oxidacion: 3 -> "+3", -2 -> "-2", -0.5 -> "-1/2". */
export function fmt(n: number, withSign = true): string {
  if (Number.isInteger(n)) {
    if (n === 0) return '0';
    return withSign && n > 0 ? `+${n}` : String(n);
  }
  // Fraccion exacta con denominador pequeno, como +8/3 en Fe₃O₄.
  for (let d = 2; d <= 12; d++) {
    const num = n * d;
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      const sign = n < 0 ? '-' : withSign ? '+' : '';
      return `${sign}${Math.abs(Math.round(num))}/${d}`;
    }
  }
  return n.toFixed(3);
}

/** Version de conveniencia que parte de una cadena de formula. */
export function oxidationStatesOfFormula(formula: string): Result<OxidationResult> {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return parsed;
  return assignOxidationStates(parsed.value.composition, parsed.value.charge, formula);
}
