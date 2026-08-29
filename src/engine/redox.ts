/**
 * Analisis redox (§17).
 *
 * Dada una ecuacion balanceada, determina:
 *   - si es realmente una redox (algun elemento cambia de estado de oxidacion)
 *   - que especie se oxida y cual se reduce
 *   - cual es el agente oxidante y cual el reductor (que NO es lo mismo)
 *   - cuantos electrones se transfieren en total
 *   - las dos semirreacciones
 *
 * El punto didactico que mas se confunde: la especie que SE OXIDA es el
 * AGENTE REDUCTOR, porque al oxidarse reduce a la otra. El sistema lo dice
 * explicitamente en cada analisis.
 */

import type { ChemicalEquation } from '../core/types.js';
import { assignOxidationStates, discreteIonCharge } from '../core/oxidation.js';
import { fmt } from '../core/oxidation.js';
import { parseFormula } from '../core/formula/parse.js';
import { formatPlainUnicode } from '../core/formula/render.js';

export interface OxidationChange {
  readonly element: string;
  readonly fromFormula: string;
  readonly toFormula: string;
  readonly fromState: number;
  readonly toState: number;
  /** Electrones por atomo; positivo = perdidos (oxidacion). */
  readonly electronsPerAtom: number;
  readonly direction: 'oxidation' | 'reduction';
  /** Numero de atomos afectados segun los coeficientes. */
  readonly atomCount: number;
  /** Electrones totales movidos por esta especie en la ecuacion. */
  readonly totalElectrons: number;
}

export interface HalfReaction {
  readonly kind: 'oxidation' | 'reduction';
  /** Texto legible: "Zn → Zn²⁺ + 2e⁻". */
  readonly text: string;
  readonly electrons: number;
}

export interface RedoxAnalysis {
  readonly isRedox: boolean;
  readonly changes: readonly OxidationChange[];
  /** Especie que se oxida = agente REDUCTOR. */
  readonly oxidizedSpecies: string | null;
  /** Especie que se reduce = agente OXIDANTE. */
  readonly reducedSpecies: string | null;
  readonly reducingAgent: string | null;
  readonly oxidizingAgent: string | null;
  readonly electronsTransferred: number | null;
  readonly halfReactions: readonly HalfReaction[];
  /** ¿Un mismo elemento se oxida y se reduce a la vez? */
  readonly isDisproportionation: boolean;
  readonly explanation: string;
}

interface StateMap {
  /** estado de oxidacion por elemento en esta especie */
  readonly states: Map<string, number>;
  readonly coefficient: number;
  readonly formula: string;
}

function statesOf(formula: string, coefficient: number): StateMap | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  const ox = assignOxidationStates(parsed.value.composition, parsed.value.charge, formula);
  if (!ox.ok) return null;
  const states = new Map<string, number>();
  for (const a of ox.value.assignments) states.set(a.symbol, a.state);
  return { states, coefficient, formula };
}

/** Atomos del elemento en la especie, contando el coeficiente. */
function atomsOf(formula: string, element: string, coefficient: number): number {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return 0;
  return (parsed.value.composition.get(element) ?? 0) * coefficient;
}

export function analyzeRedox(equation: ChemicalEquation): RedoxAnalysis {
  const reactantStates = equation.reactants
    .map((t) => statesOf(t.formula, t.coefficient))
    .filter((x): x is StateMap => x !== null);
  const productStates = equation.products
    .map((t) => statesOf(t.formula, t.coefficient))
    .filter((x): x is StateMap => x !== null);

  if (reactantStates.length === 0 || productStates.length === 0) {
    return notRedox('No se han podido asignar los estados de oxidacion de todas las especies.');
  }

  const elements = new Set<string>();
  for (const s of [...reactantStates, ...productStates]) for (const e of s.states.keys()) elements.add(e);

  const changes: OxidationChange[] = [];

  for (const element of elements) {
    const before = reactantStates.filter((s) => s.states.has(element));
    const after = productStates.filter((s) => s.states.has(element));
    if (before.length === 0 || after.length === 0) continue;

    for (const b of before) {
      const fromState = b.states.get(element)!;
      for (const a of after) {
        const toState = a.states.get(element)!;
        if (Math.abs(fromState - toState) < 1e-9) continue;

        const atomCount = Math.min(
          atomsOf(b.formula, element, b.coefficient),
          atomsOf(a.formula, element, a.coefficient),
        );
        const electronsPerAtom = fromState - toState; // >0 -> gana e- (reduccion)
        changes.push({
          element,
          fromFormula: b.formula,
          toFormula: a.formula,
          fromState,
          toState,
          electronsPerAtom: Math.abs(electronsPerAtom),
          direction: toState > fromState ? 'oxidation' : 'reduction',
          atomCount,
          totalElectrons: Math.abs(electronsPerAtom) * atomCount,
        });
      }
    }
  }

  if (changes.length === 0) {
    return notRedox(
      'Ningun elemento cambia de estado de oxidacion: no hay transferencia de electrones, luego NO es una reaccion redox. ' +
        'Es el caso de las neutralizaciones y de las precipitaciones, donde los iones simplemente se reagrupan.',
    );
  }

  const oxidations = changes.filter((c) => c.direction === 'oxidation');
  const reductions = changes.filter((c) => c.direction === 'reduction');

  // Se toma el cambio de mayor magnitud como el representativo de cada sentido.
  const mainOx = oxidations.sort((a, b) => b.totalElectrons - a.totalElectrons)[0] ?? null;
  const mainRed = reductions.sort((a, b) => b.totalElectrons - a.totalElectrons)[0] ?? null;

  const isDisproportionation =
    mainOx !== null && mainRed !== null && mainOx.element === mainRed.element && mainOx.fromFormula === mainRed.fromFormula;

  // En una redox balanceada, los electrones cedidos igualan a los captados.
  const electronsLost = oxidations.reduce((a, c) => a + c.totalElectrons, 0);
  const electronsGained = reductions.reduce((a, c) => a + c.totalElectrons, 0);
  const electronsTransferred = Math.min(electronsLost, electronsGained) || null;

  const halfReactions: HalfReaction[] = [];
  if (mainOx) {
    const from = speciesLabel(mainOx.fromFormula, mainOx.element);
    const to = speciesLabel(mainOx.toFormula, mainOx.element);
    halfReactions.push({
      kind: 'oxidation',
      text: `${from} → ${to} + ${mainOx.electronsPerAtom}e⁻`,
      electrons: mainOx.electronsPerAtom,
    });
  }
  if (mainRed) {
    const from = speciesLabel(mainRed.fromFormula, mainRed.element);
    const to = speciesLabel(mainRed.toFormula, mainRed.element);
    halfReactions.push({
      kind: 'reduction',
      text: `${from} + ${mainRed.electronsPerAtom}e⁻ → ${to}`,
      electrons: mainRed.electronsPerAtom,
    });
  }

  const parts: string[] = [];

  if (isDisproportionation) {
    parts.push(
      `DESPROPORCION: el ${mainOx!.element} de ${formatPlainUnicode(mainOx!.fromFormula)} se oxida Y se reduce a la vez. ` +
        `Parte pasa de ${fmt(mainOx!.fromState)} a ${fmt(mainOx!.toState)} y parte de ${fmt(mainRed!.fromState)} a ${fmt(mainRed!.toState)}. ` +
        'La misma sustancia actua de oxidante y de reductor.',
    );
  } else {
    if (mainOx) {
      parts.push(
        `${formatPlainUnicode(mainOx.fromFormula)} SE OXIDA: el ${mainOx.element} pasa de ${fmt(mainOx.fromState)} a ${fmt(mainOx.toState)}, ` +
          `cediendo ${mainOx.electronsPerAtom} electron${mainOx.electronsPerAtom === 1 ? '' : 'es'} por atomo. ` +
          `Al ceder electrones, es el AGENTE REDUCTOR: reduce a la otra especie.`,
      );
    }
    if (mainRed) {
      parts.push(
        `${formatPlainUnicode(mainRed.fromFormula)} SE REDUCE: el ${mainRed.element} pasa de ${fmt(mainRed.fromState)} a ${fmt(mainRed.toState)}, ` +
          `captando ${mainRed.electronsPerAtom} electron${mainRed.electronsPerAtom === 1 ? '' : 'es'} por atomo. ` +
          `Al captar electrones, es el AGENTE OXIDANTE.`,
      );
    }
  }

  if (electronsTransferred !== null) {
    parts.push(
      `En la ecuacion balanceada se transfieren ${electronsTransferred} electrones en total: ` +
        'los electrones cedidos y los captados deben coincidir exactamente, y esa igualdad es lo que fija los coeficientes.',
    );
  }

  return {
    isRedox: true,
    changes,
    oxidizedSpecies: mainOx?.fromFormula ?? null,
    reducedSpecies: mainRed?.fromFormula ?? null,
    // El que se oxida ES el reductor. Esta inversion es la confusion mas
    // habitual del tema, asi que el modelo la nombra explicitamente.
    reducingAgent: mainOx?.fromFormula ?? null,
    oxidizingAgent: mainRed?.fromFormula ?? null,
    electronsTransferred,
    halfReactions,
    isDisproportionation,
    explanation: parts.join(' '),
  };
}

/**
 * Como escribir una especie dentro de una semirreaccion.
 *
 * Si el elemento que cambia forma un ion monoatomico discreto, se escribe el
 * ion y se deja fuera al espectador: ZnSO4 se convierte en Zn²⁺. Si no, se
 * escribe la especie completa, porque el elemento no existe suelto: el
 * permanganato se escribe MnO4⁻, no Mn⁷⁺.
 */
function speciesLabel(formula: string, element: string): string {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return formatPlainUnicode(formula);

  const ionCharge = discreteIonCharge(
    parsed.value.composition,
    parsed.value.charge,
    formula,
    element,
  );
  if (ionCharge === null || ionCharge === 0) return formatPlainUnicode(formula);

  const magnitude = Math.abs(ionCharge);
  const digits = magnitude === 1 ? '' : String(magnitude).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
  return `${element}${digits}${ionCharge > 0 ? '⁺' : '⁻'}`;
}

function notRedox(explanation: string): RedoxAnalysis {
  return {
    isRedox: false,
    changes: [],
    oxidizedSpecies: null,
    reducedSpecies: null,
    reducingAgent: null,
    oxidizingAgent: null,
    electronsTransferred: null,
    halfReactions: [],
    isDisproportionation: false,
    explanation,
  };
}

/**
 * MODO IONICO (§16): descompone la formacion de un compuesto ionico en la
 * transferencia electronica que la produce.
 *
 *   Na → Na⁺ + e⁻
 *   Cl + e⁻ → Cl⁻
 *   Na⁺ + Cl⁻ → NaCl
 */
export interface IonicTransfer {
  readonly steps: readonly string[];
  readonly explanation: string;
}

export function ionicTransferSteps(
  cationSymbol: string,
  cationCharge: number,
  anionSymbol: string,
  anionCharge: number,
  compoundFormula: string,
): IonicTransfer {
  const nCation = Math.abs(anionCharge);
  const nAnion = Math.abs(cationCharge);
  const total = nCation * cationCharge;

  const sup = (n: number, sign: '+' | '-'): string => {
    const digits = n === 1 ? '' : String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
    return digits + (sign === '+' ? '⁺' : '⁻');
  };

  const steps = [
    `${cationSymbol} → ${cationSymbol}${sup(cationCharge, '+')} + ${cationCharge}e⁻`,
    `${anionSymbol} + ${Math.abs(anionCharge)}e⁻ → ${anionSymbol}${sup(Math.abs(anionCharge), '-')}`,
    `${nCation > 1 ? nCation + ' ' : ''}${cationSymbol}${sup(cationCharge, '+')} + ${nAnion > 1 ? nAnion + ' ' : ''}${anionSymbol}${sup(Math.abs(anionCharge), '-')} → ${formatPlainUnicode(compoundFormula)}`,
  ];

  return {
    steps,
    explanation:
      `El ${cationSymbol} cede ${cationCharge} electron${cationCharge === 1 ? '' : 'es'} y el ${anionSymbol} capta ${Math.abs(anionCharge)}. ` +
      `Para que no sobren ni falten electrones hacen falta ${nCation} atomo${nCation === 1 ? '' : 's'} de ${cationSymbol} por cada ${nAnion} de ${anionSymbol}: ` +
      `${nCation} × ${cationCharge} = ${total} electrones cedidos y ${nAnion} × ${Math.abs(anionCharge)} = ${total} captados. ` +
      'Los iones resultantes, con cargas opuestas, se atraen electrostaticamente y forman la red cristalina.',
  };
}
