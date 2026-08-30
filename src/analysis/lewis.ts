/**
 * LEWIS ENGINE (§11, §12, §13, §14).
 *
 * DERIVA la estructura de Lewis a partir de la formula. No la dibuja desde una
 * conectividad ya conocida: la construye.
 *
 * ALGORITMO (el de cualquier libro de quimica general)
 *   1. Contar electrones de valencia totales, ajustando por la carga.
 *   2. Elegir el atomo central: el menos electronegativo, nunca el hidrogeno.
 *   3. Unir todos los terminales al central con enlaces simples.
 *   4. Repartir los electrones sobrantes como pares libres, empezando por los
 *      terminales, hasta completar sus octetos (dueto para el H).
 *   5. Lo que quede, al atomo central.
 *   6. Si al central le falta octeto, formar enlaces multiples trayendo pares
 *      libres de los terminales.
 *   7. Calcular cargas formales.
 *   8. Comparar alternativas y quedarse con la de cargas mas pequenas.
 *
 * LIMITES DECLARADOS (§58, §59)
 * El modelo de Lewis es una SIMPLIFICACION: reparte electrones en pares
 * localizados sobre un esqueleto fijo. No describe orbitales moleculares ni
 * densidad electronica real. Ademas, este algoritmo asume una topologia
 * central-terminal, que cubre la inmensa mayoria de las especies que se
 * estudian pero NO las cadenas ni los ciclos. Cuando la formula no encaja en
 * ese supuesto, el motor lo dice en lugar de producir una estructura falsa.
 */

import { getElement } from '../data/elements.js';
import { parseFormula } from '../core/formula/parse.js';
import { lewisValenceElectrons } from './electronic.js';
import type { Composition } from '../core/types.js';

export interface LewisAtom {
  /** Identidad estable, para el §55 y el futuro Reaction Engine. */
  readonly id: string;
  readonly symbol: string;
  /** Indice dentro de la estructura. */
  readonly index: number;
  readonly isCentral: boolean;
  readonly valenceElectrons: number;
  /** Pares libres sobre este atomo. */
  readonly lonePairs: number;
  /** Suma de ordenes de enlace: enlaces sigma + pi que salen del atomo. */
  readonly bondOrderSum: number;
  /** Electrones que "ve" el atomo: 2×pares libres + 2×orden de enlace. */
  readonly electronCount: number;
  readonly formalCharge: number;
  readonly octetStatus: 'complete' | 'deficient' | 'expanded' | 'duet' | 'n/a';
}

export interface LewisBond {
  readonly a: number;
  readonly b: number;
  readonly order: 1 | 2 | 3;
}

export interface LewisStructure {
  readonly atoms: readonly LewisAtom[];
  readonly bonds: readonly LewisBond[];
  readonly totalValenceElectrons: number;
  readonly charge: number;
  /** Suma de |cargas formales|: menor es mejor. */
  readonly formalChargeSpread: number;
  /** Indice del atomo central, o −1. */
  readonly centralIndex: number;
  readonly notes: readonly string[];
}

export interface LewisResult {
  /** La estructura preferida. */
  readonly best: LewisStructure;
  /**
   * TODAS las estructuras validas que se encontraron, de mejor a peor.
   *
   * No se recortan: el motor de resonancia necesita el conjunto completo de
   * las que empatan con la mejor, y ese numero depende de la especie (tres
   * para el nitrato, dos para el ozono, seis para el sulfato).
   */
  readonly alternatives: readonly LewisStructure[];
  /** Pasos del razonamiento, para mostrar. */
  readonly steps: readonly { readonly n: number; readonly text: string; readonly math?: string }[];
  readonly warnings: readonly string[];
}

/** Elementos que se contentan con menos de un octeto. */
const ELECTRON_DEFICIENT = new Set(['H', 'He', 'Li', 'Be', 'B']);
/** Objetivo de electrones para los deficientes conocidos. */
const DEFICIENT_TARGET: Record<string, number> = { H: 2, He: 2, Li: 2, Be: 4, B: 6 };

/**
 * ¿Puede este atomo expandir el octeto?
 * Solo a partir del periodo 3, donde hay orbitales d energeticamente
 * accesibles. Es la explicacion clasica; la moderna invoca enlaces
 * deslocalizados de tres centros, pero el criterio practico coincide.
 */
function canExpandOctet(symbol: string): boolean {
  const element = getElement(symbol);
  return element !== undefined && element.period >= 3;
}

function targetElectrons(symbol: string): number {
  return DEFICIENT_TARGET[symbol] ?? 8;
}

/**
 * Elige el atomo central.
 *
 * Criterio estandar: el MENOS electronegativo, porque es el que mejor tolera
 * compartir con varios vecinos. El hidrogeno queda excluido siempre: solo
 * forma un enlace, asi que no puede ser central. El carbono gana casi
 * siempre cuando esta presente.
 */
function pickCentral(symbols: readonly string[]): number {
  const candidates = symbols
    .map((symbol, index) => ({ symbol, index }))
    .filter((c) => c.symbol !== 'H');

  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0]!.index;

  // El carbono es central por convencion cuando aparece.
  const carbon = candidates.find((c) => c.symbol === 'C');
  if (carbon) return carbon.index;

  let best = candidates[0]!;
  let bestEn = getElement(best.symbol)?.electronegativity ?? 99;
  for (const c of candidates.slice(1)) {
    const en = getElement(c.symbol)?.electronegativity ?? 99;
    if (en < bestEn) {
      best = c;
      bestEn = en;
    }
  }
  return best.index;
}

/** Carga formal = V − N − B, con B = numero de enlaces (pares compartidos). */
function formalCharge(valence: number, lonePairs: number, bondOrderSum: number): number {
  return valence - lonePairs * 2 - bondOrderSum;
}

function octetStatus(symbol: string, electrons: number): LewisAtom['octetStatus'] {
  if (symbol === 'H' || symbol === 'He') return electrons === 2 ? 'duet' : 'n/a';
  const target = targetElectrons(symbol);
  if (electrons === target && target === 8) return 'complete';
  if (electrons === target) return 'deficient'; // B con 6, Be con 4: estable pero sin octeto
  if (electrons > 8) return 'expanded';
  if (electrons < 8) return 'deficient';
  return 'complete';
}

/**
 * Construye una estructura concreta dados los ordenes de enlace.
 * Reparte los electrones restantes como pares libres.
 */
function assemble(
  symbols: readonly string[],
  centralIndex: number,
  bondOrders: readonly number[],
  totalValence: number,
  charge: number,
): LewisStructure | null {
  const n = symbols.length;
  const terminals = symbols.map((_, i) => i).filter((i) => i !== centralIndex);

  const bonds: LewisBond[] = terminals.map((t, k) => ({
    a: centralIndex,
    b: t,
    order: bondOrders[k] as 1 | 2 | 3,
  }));

  const bondElectrons = bondOrders.reduce((sum, o) => sum + o * 2, 0);
  let remaining = totalValence - bondElectrons;
  if (remaining < 0) return null;

  const lonePairs = new Array<number>(n).fill(0);

  // Primero los terminales, hasta completar su octeto o dueto.
  for (let k = 0; k < terminals.length; k++) {
    const index = terminals[k]!;
    const symbol = symbols[index]!;
    if (symbol === 'H') continue; // el H nunca lleva pares libres
    const bonded = bondOrders[k]! * 2;
    const needed = Math.max(0, targetElectrons(symbol) - bonded);
    const pairs = Math.min(Math.floor(needed / 2), Math.floor(remaining / 2));
    lonePairs[index] = pairs;
    remaining -= pairs * 2;
  }

  // Lo que sobre, al central.
  if (centralIndex >= 0 && remaining > 0) {
    lonePairs[centralIndex] = Math.floor(remaining / 2);
    remaining -= lonePairs[centralIndex]! * 2;
  }

  // Si aun sobran electrones sueltos, la estructura no cierra.
  if (remaining !== 0) return null;

  const atoms: LewisAtom[] = symbols.map((symbol, index) => {
    const valence = lewisValenceElectrons(getElement(symbol)!);
    const bondOrderSum = bonds
      .filter((b) => b.a === index || b.b === index)
      .reduce((sum, b) => sum + b.order, 0);
    const electronCount = lonePairs[index]! * 2 + bondOrderSum * 2;
    return {
      id: `${symbol}${index + 1}`,
      symbol,
      index,
      isCentral: index === centralIndex,
      valenceElectrons: valence,
      lonePairs: lonePairs[index]!,
      bondOrderSum,
      electronCount,
      formalCharge: formalCharge(valence, lonePairs[index]!, bondOrderSum),
      octetStatus: octetStatus(symbol, electronCount),
    };
  });

  // Comprobacion: la suma de cargas formales DEBE dar la carga de la especie.
  const chargeSum = atoms.reduce((sum, a) => sum + a.formalCharge, 0);
  if (chargeSum !== charge) return null;

  const notes: string[] = [];
  const expanded = atoms.filter((a) => a.octetStatus === 'expanded');
  for (const a of expanded) {
    if (!canExpandOctet(a.symbol)) return null; // periodo 2 no expande: invalida
    notes.push(
      `${a.symbol} rodeado de ${a.electronCount} electrones: OCTETO EXPANDIDO. ` +
        `Es posible porque esta en el periodo ${getElement(a.symbol)!.period} y dispone de orbitales d accesibles.`,
    );
  }
  const deficient = atoms.filter((a) => a.octetStatus === 'deficient' && a.symbol !== 'H');
  for (const a of deficient) {
    if (ELECTRON_DEFICIENT.has(a.symbol)) {
      notes.push(
        `${a.symbol} se queda con ${a.electronCount} electrones. Es una EXCEPCION conocida: ` +
          'los elementos del principio del periodo 2 son estables sin octeto completo.',
      );
    }
  }

  return {
    atoms,
    bonds,
    totalValenceElectrons: totalValence,
    charge,
    formalChargeSpread: atoms.reduce((sum, a) => sum + Math.abs(a.formalCharge), 0),
    centralIndex,
    notes,
  };
}

/**
 * Puntua una estructura para elegir la preferida.
 *
 * Criterios, en orden de peso:
 *   1. Cargas formales lo mas pequenas posible (el dominante).
 *   2. La carga negativa sobre el atomo MAS electronegativo.
 *   3. Evitar cargas del mismo signo en atomos adyacentes.
 *   4. A igualdad, menos enlaces multiples de los necesarios.
 *
 * Menor puntuacion es mejor.
 */
export function structureScore(structure: LewisStructure): number {
  let value = structure.formalChargeSpread * 10;

  for (const atom of structure.atoms) {
    if (atom.formalCharge < 0) {
      const en = getElement(atom.symbol)?.electronegativity ?? 0;
      // Premia colocar la carga negativa sobre lo mas electronegativo.
      value -= en * 2;
    }
    if (atom.formalCharge > 0) {
      const en = getElement(atom.symbol)?.electronegativity ?? 0;
      value += en * 2;
    }
  }

  // Penaliza octetos incompletos que no sean excepciones aceptadas.
  for (const atom of structure.atoms) {
    if (atom.octetStatus === 'deficient' && !ELECTRON_DEFICIENT.has(atom.symbol)) value += 25;
  }

  return value;
}

/**
 * Deriva la estructura de Lewis de una formula.
 *
 * Devuelve null cuando la especie no encaja en el modelo central-terminal:
 * es preferible declararlo a inventar una conectividad.
 */
export function deriveLewis(formula: string): LewisResult | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;

  const composition: Composition = parsed.value.composition;
  const charge = parsed.value.charge;

  // Lista plana de atomos.
  const symbols: string[] = [];
  for (const [symbol, count] of composition) {
    for (let i = 0; i < count; i++) symbols.push(symbol);
  }
  if (symbols.length === 0) return null;

  const steps: { n: number; text: string; math?: string }[] = [];
  const warnings: string[] = [];

  // --- 1. Electrones de valencia totales ----------------------------------
  let totalValence = 0;
  const contributions: string[] = [];
  for (const [symbol, count] of composition) {
    const element = getElement(symbol);
    if (!element) return null;
    const valence = lewisValenceElectrons(element);
    totalValence += valence * count;
    contributions.push(`${count}×${symbol}(${valence})`);
  }
  // Un anion GANA electrones, un cation los PIERDE: se resta la carga.
  totalValence -= charge;

  steps.push({
    n: 1,
    text:
      'Se suman los electrones de valencia de todos los atomos y se corrige por la carga: ' +
      'un anion ha ganado electrones y un cation los ha perdido.',
    math: `${contributions.join(' + ')}${charge !== 0 ? ` ${charge > 0 ? '−' : '+'} ${Math.abs(charge)}` : ''} = ${totalValence} e⁻`,
  });

  // --- Caso trivial: un solo atomo ----------------------------------------
  if (symbols.length === 1) {
    const symbol = symbols[0]!;
    const valence = lewisValenceElectrons(getElement(symbol)!);
    const lonePairs = Math.floor(totalValence / 2);
    const atom: LewisAtom = {
      id: `${symbol}1`,
      symbol,
      index: 0,
      isCentral: true,
      valenceElectrons: valence,
      lonePairs,
      bondOrderSum: 0,
      electronCount: lonePairs * 2,
      formalCharge: valence - lonePairs * 2,
      octetStatus: octetStatus(symbol, lonePairs * 2),
    };
    const structure: LewisStructure = {
      atoms: [atom],
      bonds: [],
      totalValenceElectrons: totalValence,
      charge,
      formalChargeSpread: Math.abs(atom.formalCharge),
      centralIndex: 0,
      notes: [],
    };
    steps.push({ n: 2, text: 'Con un solo atomo no hay enlaces: todos los electrones son pares libres.' });
    return { best: structure, alternatives: [structure], steps, warnings };
  }

  // --- 2. Atomo central ---------------------------------------------------
  const centralIndex = pickCentral(symbols);
  if (centralIndex < 0) {
    // Solo hidrogenos: H2 y poco mas.
    if (symbols.every((s) => s === 'H') && symbols.length === 2) {
      const atoms: LewisAtom[] = symbols.map((symbol, index) => ({
        id: `${symbol}${index + 1}`,
        symbol,
        index,
        isCentral: false,
        valenceElectrons: 1,
        lonePairs: 0,
        bondOrderSum: 1,
        electronCount: 2,
        formalCharge: 0,
        octetStatus: 'duet' as const,
      }));
      const structure: LewisStructure = {
        atoms,
        bonds: [{ a: 0, b: 1, order: 1 }],
        totalValenceElectrons: totalValence,
        charge,
        formalChargeSpread: 0,
        centralIndex: -1,
        notes: ['Dos hidrogenos comparten su unico par: cada uno alcanza el dueto.'],
      };
      steps.push({ n: 2, text: 'Molecula diatomica de hidrogeno: un solo enlace simple.' });
      return { best: structure, alternatives: [structure], steps, warnings };
    }
    return null;
  }

  const centralSymbol = symbols[centralIndex]!;
  const terminalCount = symbols.length - 1;

  steps.push({
    n: 2,
    text:
      `El atomo central es ${centralSymbol}: es el menos electronegativo de los presentes ` +
      '(el hidrogeno nunca puede ser central, porque solo forma un enlace).',
  });

  // Un esqueleto central-terminal exige que el central pueda con todos.
  if (terminalCount > 6) {
    warnings.push(
      `${terminalCount} atomos terminales alrededor de un solo centro exceden lo que este modelo ` +
        'sabe describir. La estructura mostrada puede no corresponder a la real.',
    );
  }

  steps.push({
    n: 3,
    text: `Se une cada uno de los ${terminalCount} atomos terminales al central con un enlace simple.`,
    math: `${terminalCount} enlaces × 2 e⁻ = ${terminalCount * 2} e⁻ usados`,
  });

  // --- 3-6. Se prueban repartos de enlaces multiples -----------------------
  // Se exploran todas las combinaciones de ordenes 1..3 por enlace y se
  // conservan las que cierran. Con hasta 6 terminales son 3⁶ = 729 casos:
  // barato y exhaustivo, mejor que una heuristica que se deje casos fuera.
  const candidates: LewisStructure[] = [];
  const maxOrder = 3;
  const combos = Math.pow(maxOrder, terminalCount);

  for (let mask = 0; mask < combos; mask++) {
    const orders: number[] = [];
    let rest = mask;
    for (let i = 0; i < terminalCount; i++) {
      orders.push((rest % maxOrder) + 1);
      rest = Math.floor(rest / maxOrder);
    }
    // El hidrogeno solo admite enlace simple.
    const terminals = symbols.map((_, i) => i).filter((i) => i !== centralIndex);
    const valid = orders.every((o, k) => !(symbols[terminals[k]!] === 'H' && o > 1));
    if (!valid) continue;

    const structure = assemble(symbols, centralIndex, orders, totalValence, charge);
    if (structure) candidates.push(structure);
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => structureScore(a) - structureScore(b));
  const best = candidates[0]!;

  const bondElectrons = best.bonds.reduce((sum, b) => sum + b.order * 2, 0);
  steps.push({
    n: 4,
    text:
      'Los electrones que sobran se reparten como pares libres, primero sobre los atomos terminales ' +
      'hasta completar su octeto, y el resto sobre el central.',
    math: `${totalValence} − ${bondElectrons} (enlaces) = ${totalValence - bondElectrons} e⁻ en pares libres`,
  });

  const multiple = best.bonds.filter((b) => b.order > 1);
  if (multiple.length > 0) {
    steps.push({
      n: 5,
      text:
        `Al atomo central le faltaba octeto, asi que ${multiple.length} par${multiple.length === 1 ? '' : 'es'} libre${multiple.length === 1 ? '' : 's'} ` +
        `de los terminales pasa${multiple.length === 1 ? '' : 'n'} a formar enlace${multiple.length === 1 ? '' : 's'} multiple${multiple.length === 1 ? '' : 's'}.`,
      math: multiple
        .map((b) => `${symbols[b.a]}${b.order === 2 ? '=' : '≡'}${symbols[b.b]}`)
        .join(', '),
    });
  }

  steps.push({
    n: multiple.length > 0 ? 6 : 5,
    text:
      'Se calcula la carga formal de cada atomo. Entre las estructuras posibles se prefiere la que ' +
      'reparte cargas mas pequenas y coloca la negativa sobre el atomo mas electronegativo.',
    math: 'CF = V − pares libres×2 − numero de enlaces',
  });

  return {
    best,
    alternatives: candidates,
    steps,
    warnings,
  };
}

/**
 * Por que NO se ha podido derivar la estructura (§32, §58).
 *
 * `deriveLewis` devuelve null cuando la especie queda fuera del modelo. Un
 * null a secas obligaria a la interfaz a decir "error", que no es cierto ni es
 * util: el motor sabe perfectamente por que no puede, y decirlo ensena mas que
 * dibujar una estructura inventada.
 */
export function diagnoseLewis(formula: string): string | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return `No se ha podido interpretar la formula "${formula}".`;
  if (deriveLewis(formula)) return null;

  const composition = parsed.value.composition;
  const symbols: string[] = [];
  for (const [symbol, count] of composition) {
    if (!getElement(symbol)) return `El elemento ${symbol} no esta en la base de datos.`;
    for (let i = 0; i < count; i++) symbols.push(symbol);
  }

  let totalValence = -parsed.value.charge;
  for (const [symbol, count] of composition) {
    totalValence += lewisValenceElectrons(getElement(symbol)!) * count;
  }

  if (totalValence % 2 !== 0) {
    return (
      `Esta especie tiene ${totalValence} electrones de valencia, un numero IMPAR: es un radical ` +
      'libre. El modelo de Lewis reparte los electrones en PARES, asi que no puede describirla ' +
      'sin dejar un electron desapareado que la notacion no sabe dibujar. Hacen falta orbitales ' +
      'moleculares. (NO, NO2 y O2⁻ estan en este caso.)'
    );
  }

  const heavy = symbols.filter((s) => s !== 'H');
  if (heavy.length > 1 && heavy.filter((s) => s === 'C').length > 1) {
    return (
      'La especie tiene mas de un carbono. Con varios atomos capaces de ser centro, la ' +
      'conectividad ya no se deduce de la formula: C2H6O puede ser etanol (C–C–O) o dimetil eter ' +
      '(C–O–C), y ambas son formulas legitimas. Este motor solo construye esqueletos de un centro ' +
      'con terminales alrededor, y prefiere decirlo antes que elegir una conectividad al azar.'
    );
  }

  if (symbols.length - 1 > 6) {
    return (
      `Alrededor de un solo atomo central caben hasta 6 terminales, y esta formula pide ` +
      `${symbols.length - 1}. La especie tiene una estructura que este modelo no describe.`
    );
  }

  return (
    'No existe ningun reparto de electrones que cierre a la vez el recuento de valencia, la carga ' +
    'de la especie y las reglas del octeto sobre un esqueleto central-terminal. La especie tiene ' +
    'una estructura que este modelo no sabe construir.'
  );
}

// ---------------------------------------------------------------------------
// Validacion de una estructura construida por el usuario (§12)
// ---------------------------------------------------------------------------

export interface LewisValidation {
  readonly valid: boolean;
  readonly problems: readonly { readonly where: string; readonly issue: string; readonly fix: string }[];
  readonly summary: string;
}

/**
 * Comprueba una estructura y dice EXACTAMENTE donde esta el problema.
 * Un «incorrecto» sin diagnostico no ensena nada.
 */
export function validateLewis(structure: LewisStructure, expectedCharge: number): LewisValidation {
  const problems: { where: string; issue: string; fix: string }[] = [];

  // Recuento de electrones.
  const used =
    structure.bonds.reduce((sum, b) => sum + b.order * 2, 0) +
    structure.atoms.reduce((sum, a) => sum + a.lonePairs * 2, 0);

  if (used !== structure.totalValenceElectrons) {
    problems.push({
      where: 'Recuento global',
      issue: `Se han colocado ${used} electrones, pero hay ${structure.totalValenceElectrons} de valencia.`,
      fix: used > structure.totalValenceElectrons
        ? `Sobran ${used - structure.totalValenceElectrons}: quita pares libres o reduce el orden de algun enlace.`
        : `Faltan ${structure.totalValenceElectrons - used}: anade pares libres.`,
    });
  }

  // Carga.
  const chargeSum = structure.atoms.reduce((sum, a) => sum + a.formalCharge, 0);
  if (chargeSum !== expectedCharge) {
    problems.push({
      where: 'Carga total',
      issue: `Las cargas formales suman ${chargeSum}, pero la especie tiene carga ${expectedCharge}.`,
      fix: 'Revisa el recuento de electrones de valencia y el reparto de pares libres.',
    });
  }

  // Octetos.
  for (const atom of structure.atoms) {
    if (atom.symbol === 'H') {
      if (atom.electronCount !== 2) {
        problems.push({
          where: `${atom.id}`,
          issue: `El hidrogeno tiene ${atom.electronCount} electrones; necesita exactamente 2.`,
          fix: 'El hidrogeno forma un solo enlace y no lleva pares libres.',
        });
      }
      continue;
    }

    if (atom.octetStatus === 'expanded' && !canExpandOctet(atom.symbol)) {
      problems.push({
        where: `${atom.id}`,
        issue: `${atom.symbol} tiene ${atom.electronCount} electrones, mas de un octeto, y esta en el periodo 2.`,
        fix: 'Los elementos del periodo 2 NO pueden expandir el octeto: no disponen de orbitales d.',
      });
    }

    if (atom.octetStatus === 'deficient' && !ELECTRON_DEFICIENT.has(atom.symbol)) {
      problems.push({
        where: `${atom.id}`,
        issue: `${atom.symbol} se queda con ${atom.electronCount} electrones, por debajo del octeto.`,
        fix: 'Forma un enlace multiple trayendo un par libre de un atomo vecino.',
      });
    }
  }

  const valid = problems.length === 0;
  return {
    valid,
    problems,
    summary: valid
      ? 'CORRECTA. Se conservan los electrones de valencia, la carga cuadra y los octetos son coherentes.'
      : `NECESITA CORRECCION: ${problems.length} problema${problems.length === 1 ? '' : 's'} detectado${problems.length === 1 ? '' : 's'}.`,
  };
}

/** Desarrollo del calculo de carga formal de un atomo, para mostrar (§13). */
export function formalChargeWorkings(atom: LewisAtom): { formula: string; substituted: string; result: number } {
  return {
    formula: 'CF = electrones de valencia − electrones no enlazantes − ½(electrones enlazantes)',
    substituted: `CF(${atom.id}) = ${atom.valenceElectrons} − ${atom.lonePairs * 2} − ½(${atom.bondOrderSum * 2}) = ${atom.formalCharge >= 0 ? '+' : ''}${atom.formalCharge}`,
    result: atom.formalCharge,
  };
}

const BOND_GLYPH: Record<number, string> = { 1: '—', 2: '=', 3: '≡' };

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
};

/** Marca la carga formal como superindice: "O⁻", "N⁺". */
function withFormalCharge(atom: LewisAtom): string {
  if (atom.formalCharge === 0) return atom.symbol;
  const sign = atom.formalCharge > 0 ? '+' : '-';
  const magnitude = Math.abs(atom.formalCharge);
  const digits = magnitude === 1 ? '' : String(magnitude);
  return atom.symbol + [...digits, sign].map((c) => SUPERSCRIPT[c] ?? c).join('');
}

/**
 * La estructura en una linea: "O=C=O", "H—O—H", "N(=O)(—O⁻)(—O⁻)".
 *
 * Con uno o dos terminales se escribe en linea, que es como se lee; con mas,
 * en notacion condensada con los sustituyentes entre parentesis, porque una
 * cadena lineal daria a entender una conectividad que no es la que hay.
 */
export function lewisLine(structure: LewisStructure): string {
  const { atoms, bonds, centralIndex } = structure;
  if (bonds.length === 0) return atoms.map(withFormalCharge).join(' ');

  const glyph = (order: number): string => BOND_GLYPH[order] ?? '—';

  // Diatomica o esqueleto sin centro definido.
  if (bonds.length === 1) {
    const bond = bonds[0]!;
    return `${withFormalCharge(atoms[bond.a]!)}${glyph(bond.order)}${withFormalCharge(atoms[bond.b]!)}`;
  }

  const central = atoms[centralIndex];
  if (!central) return atoms.map(withFormalCharge).join(' ');

  const branches = bonds.map((b) => ({
    order: b.order,
    atom: atoms[b.a === centralIndex ? b.b : b.a]!,
  }));

  // Dos terminales: se escribe en linea, T—C—T.
  if (branches.length === 2) {
    const [left, right] = branches as [(typeof branches)[number], (typeof branches)[number]];
    return (
      `${withFormalCharge(left.atom)}${glyph(left.order)}` +
      `${withFormalCharge(central)}` +
      `${glyph(right.order)}${withFormalCharge(right.atom)}`
    );
  }

  return (
    withFormalCharge(central) +
    branches.map((b) => `(${glyph(b.order)}${withFormalCharge(b.atom)})`).join('')
  );
}
