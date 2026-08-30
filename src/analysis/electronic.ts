/**
 * ELECTRONIC STRUCTURE ENGINE (§6, §7, §8, §9).
 *
 * Configuracion electronica, diagrama de orbitales con casillas, numeros
 * cuanticos e ionizacion.
 *
 * MODELO Y SUS LIMITES (§59)
 * Todo lo de este modulo es el MODELO ORBITAL APROXIMADO que se ensena en
 * quimica general: orbitales hidrogenoides llenados por la regla de Madelung,
 * con Pauli y Hund. No es la solucion de la ecuacion de Schrodinger para un
 * atomo polielectronico, que no tiene forma cerrada. Los hallazgos que salen
 * de aqui se marcan como 'theoretical' o 'educational', nunca como
 * 'experimental', salvo las configuraciones anomalas, que SI son un hecho
 * medido y por eso viven en una tabla.
 */

import { getElement } from '../data/elements.js';
import type { Element } from '../core/types.js';

export type Subshell = 's' | 'p' | 'd' | 'f';

/** Capacidad de cada subcapa: 2(2l+1). */
export const SUBSHELL_CAPACITY: Record<Subshell, number> = { s: 2, p: 6, d: 10, f: 14 };

/** Numero de orbitales degenerados: 2l+1. */
export const SUBSHELL_ORBITALS: Record<Subshell, number> = { s: 1, p: 3, d: 5, f: 7 };

/** Numero cuantico azimutal l. */
export const SUBSHELL_L: Record<Subshell, number> = { s: 0, p: 1, d: 2, f: 3 };

/**
 * Orden de llenado de Madelung: menor n+l primero; a igualdad, menor n.
 *
 * Es una REGLA MNEMOTECNICA que reproduce el orden energetico observado en
 * los atomos neutros del estado fundamental. No es una ley: falla en unos
 * veinte elementos (ver ANOMALOUS) y deja de aplicarse en los cationes.
 */
const AUFBAU: readonly { n: number; subshell: Subshell }[] = [
  { n: 1, subshell: 's' },
  { n: 2, subshell: 's' }, { n: 2, subshell: 'p' },
  { n: 3, subshell: 's' }, { n: 3, subshell: 'p' },
  { n: 4, subshell: 's' }, { n: 3, subshell: 'd' }, { n: 4, subshell: 'p' },
  { n: 5, subshell: 's' }, { n: 4, subshell: 'd' }, { n: 5, subshell: 'p' },
  { n: 6, subshell: 's' }, { n: 4, subshell: 'f' }, { n: 5, subshell: 'd' }, { n: 6, subshell: 'p' },
  { n: 7, subshell: 's' }, { n: 5, subshell: 'f' }, { n: 6, subshell: 'd' }, { n: 7, subshell: 'p' },
];

/**
 * Configuraciones que NO siguen a Madelung.
 *
 * Son hechos experimentales, no correcciones cosmeticas: el cromo real es
 * [Ar] 3d⁵ 4s¹ y no [Ar] 3d⁴ 4s², porque la subcapa d semillena y el menor
 * apareamiento compensan la promocion. Como no se derivan de la regla, se
 * declaran.
 */
const ANOMALOUS: Record<number, readonly [number, Subshell, number][]> = {
  24: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 5], [4, 's', 1]],
  29: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 1]],
  41: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 4], [5, 's', 1]],
  42: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 5], [5, 's', 1]],
  44: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 7], [5, 's', 1]],
  45: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 8], [5, 's', 1]],
  46: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 10]],
  47: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 10], [5, 's', 1]],
  78: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 10], [5, 's', 2], [5, 'p', 6], [4, 'f', 14], [5, 'd', 9], [6, 's', 1]],
  79: [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [3, 'd', 10], [4, 's', 2], [4, 'p', 6], [4, 'd', 10], [5, 's', 2], [5, 'p', 6], [4, 'f', 14], [5, 'd', 10], [6, 's', 1]],
};

const ANOMALY_REASON: Record<number, string> = {
  24: 'Una subcapa d SEMILLENA (3d⁵) es especialmente estable, asi que un electron del 4s promociona al 3d.',
  29: 'Una subcapa d LLENA (3d¹⁰) es especialmente estable, asi que un electron del 4s promociona al 3d.',
  41: 'Los orbitales 4d y 5s tienen energias muy proximas; el reparto real minimiza el apareamiento.',
  42: 'Subcapa d semillena (4d⁵), como en el cromo.',
  44: 'Las energias de 4d y 5s son casi iguales en este elemento.',
  45: 'Las energias de 4d y 5s son casi iguales en este elemento.',
  46: 'Caso extremo: el paladio deja VACIO el 5s y completa el 4d¹⁰.',
  47: 'Subcapa d llena (4d¹⁰), como en el cobre.',
  78: 'Competencia entre 5d y 6s en los metales pesados.',
  79: 'Subcapa d llena (5d¹⁰), como en el cobre y la plata.',
};

export interface Orbital {
  /** Numero cuantico principal. */
  readonly n: number;
  readonly subshell: Subshell;
  /** Numero cuantico azimutal. */
  readonly l: number;
  /** Numero cuantico magnetico: −l … +l. */
  readonly ml: number;
  /** Electrones en ESTE orbital: 0, 1 o 2. */
  readonly electrons: number;
  /** Espines presentes; con 2 electrones son opuestos por Pauli. */
  readonly spins: readonly ('up' | 'down')[];
}

export interface SubshellOccupancy {
  readonly n: number;
  readonly subshell: Subshell;
  readonly electrons: number;
  readonly capacity: number;
  /** Los 2l+1 orbitales degenerados, ya repartidos segun Hund. */
  readonly orbitals: readonly Orbital[];
  /** Etiqueta "3d⁵". */
  readonly label: string;
  /** ¿Es la capa de valencia? */
  readonly isValence: boolean;
}

export interface ElectronConfiguration {
  readonly symbol: string;
  readonly Z: number;
  readonly charge: number;
  /** Electrones totales = Z − carga. */
  readonly electrons: number;
  readonly subshells: readonly SubshellOccupancy[];
  /** "1s² 2s² 2p⁴". */
  readonly full: string;
  /** "[He] 2s² 2p⁴". */
  readonly condensed: string;
  /** Gas noble usado en la forma abreviada. */
  readonly core: string | null;
  /** Numero cuantico principal mas alto ocupado. */
  readonly valenceShell: number;
  /** Electrones de la capa de valencia. */
  readonly valenceElectrons: number;
  /** Electrones desapareados: determina el comportamiento magnetico. */
  readonly unpairedElectrons: number;
  /** Paramagnetico si hay desapareados; diamagnetico si no. */
  readonly magnetism: 'paramagnetico' | 'diamagnetico';
  /** true si la configuracion no sigue la regla de Madelung. */
  readonly isAnomalous: boolean;
  readonly anomalyReason: string | null;
  /** ¿Tiene configuracion de gas noble? */
  readonly isNobleGasLike: boolean;
  readonly notes: readonly string[];
}

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const sup = (n: number): string =>
  String(n).split('').map((d) => SUPERSCRIPT[Number(d)] ?? d).join('');

const NOBLE_GASES: readonly [number, string][] = [
  [86, 'Rn'], [54, 'Xe'], [36, 'Kr'], [18, 'Ar'], [10, 'Ne'], [2, 'He'],
];

/**
 * Reparte `count` electrones entre los orbitales degenerados de una subcapa
 * aplicando la REGLA DE HUND: primero uno en cada orbital con el mismo espin,
 * y solo despues se aparean.
 *
 * El motivo fisico es doble: dos electrones en orbitales distintos se repelen
 * menos que en el mismo, y los espines paralelos reducen aun mas la energia
 * por el termino de intercambio.
 */
function fillSubshell(n: number, subshell: Subshell, count: number): Orbital[] {
  const orbitalCount = SUBSHELL_ORBITALS[subshell];
  const l = SUBSHELL_L[subshell];

  // ml va de −l a +l. El orden de llenado dentro de la subcapa es
  // convencional: lo que importa es cuantos quedan desapareados.
  const orbitals: { ml: number; spins: ('up' | 'down')[] }[] = [];
  for (let i = 0; i < orbitalCount; i++) orbitals.push({ ml: i - l, spins: [] });

  // Primera pasada: uno por orbital, espin arriba (Hund).
  let remaining = count;
  for (let i = 0; i < orbitalCount && remaining > 0; i++) {
    orbitals[i]!.spins.push('up');
    remaining--;
  }
  // Segunda pasada: se aparean con espin opuesto (Pauli).
  for (let i = 0; i < orbitalCount && remaining > 0; i++) {
    orbitals[i]!.spins.push('down');
    remaining--;
  }

  return orbitals.map((o) => ({
    n,
    subshell,
    l,
    ml: o.ml,
    electrons: o.spins.length,
    spins: o.spins,
  }));
}

/**
 * Orden de RETIRADA de electrones al formar un cation.
 *
 * NO es el inverso del orden de llenado, y este es uno de los errores mas
 * extendidos. El hierro se llena 4s antes que 3d, pero al ionizarse pierde
 * primero los 4s: Fe²⁺ es [Ar] 3d⁶, no [Ar] 3d⁴ 4s². La razon es que, una vez
 * ocupados los d, el apantallamiento cambia y el 4s pasa a estar por encima
 * en energia. La regla practica es: se quita del n MAS ALTO primero.
 */
function removalOrder(subshells: SubshellOccupancy[]): SubshellOccupancy[] {
  return [...subshells].sort((a, b) => {
    if (a.n !== b.n) return b.n - a.n;
    return SUBSHELL_L[b.subshell] - SUBSHELL_L[a.subshell];
  });
}

/**
 * Configuracion electronica de un atomo o ion.
 *
 * @param symbol simbolo del elemento
 * @param charge carga: 0 atomo neutro, >0 cation, <0 anion
 */
export function configureAtom(symbol: string, charge = 0): ElectronConfiguration | null {
  const element = getElement(symbol);
  if (!element) return null;

  const electrons = element.Z - charge;
  if (electrons < 0) return null;

  const notes: string[] = [];
  let isAnomalous = false;
  let anomalyReason: string | null = null;

  // Se parte de la configuracion del ATOMO NEUTRO, anomalias incluidas, y
  // despues se quitan o anaden electrones. Hacerlo al reves —aplicar Madelung
  // directamente al recuento del ion— daria Fe²⁺ = [Ar] 3d⁴ 4s², que es falso.
  const neutral: { n: number; subshell: Subshell; electrons: number }[] = [];
  const anomaly = ANOMALOUS[element.Z];

  if (anomaly) {
    isAnomalous = true;
    anomalyReason = ANOMALY_REASON[element.Z] ?? null;
    for (const [n, subshell, count] of anomaly) neutral.push({ n, subshell, electrons: count });
  } else {
    let left = element.Z;
    for (const level of AUFBAU) {
      if (left <= 0) break;
      const capacity = SUBSHELL_CAPACITY[level.subshell];
      const take = Math.min(left, capacity);
      neutral.push({ n: level.n, subshell: level.subshell, electrons: take });
      left -= take;
    }
  }

  // --- Ajuste por carga ---------------------------------------------------
  let working = neutral.map((s) => ({ ...s }));

  if (charge > 0) {
    let toRemove = charge;
    const order = removalOrder(
      working.map((s) => ({
        n: s.n,
        subshell: s.subshell,
        electrons: s.electrons,
        capacity: SUBSHELL_CAPACITY[s.subshell],
        orbitals: [],
        label: '',
        isValence: false,
      })),
    );
    for (const target of order) {
      if (toRemove <= 0) break;
      const entry = working.find((s) => s.n === target.n && s.subshell === target.subshell);
      if (!entry) continue;
      const take = Math.min(entry.electrons, toRemove);
      entry.electrons -= take;
      toRemove -= take;
    }
    working = working.filter((s) => s.electrons > 0);
    notes.push(
      'Los electrones se retiran de la capa de MAYOR n, que no coincide con el orden de llenado: ' +
        'por eso el Fe²⁺ es [Ar] 3d⁶ y no [Ar] 3d⁴ 4s².',
    );
  } else if (charge < 0) {
    let toAdd = -charge;
    for (const level of AUFBAU) {
      if (toAdd <= 0) break;
      const capacity = SUBSHELL_CAPACITY[level.subshell];
      const entry = working.find((s) => s.n === level.n && s.subshell === level.subshell);
      if (entry) {
        const room = capacity - entry.electrons;
        const put = Math.min(room, toAdd);
        entry.electrons += put;
        toAdd -= put;
      } else {
        const put = Math.min(capacity, toAdd);
        working.push({ n: level.n, subshell: level.subshell, electrons: put });
        toAdd -= put;
      }
    }
  }

  // --- Se ordena para escribir: por n y despues por l ----------------------
  const written = [...working].sort((a, b) => {
    if (a.n !== b.n) return a.n - b.n;
    return SUBSHELL_L[a.subshell] - SUBSHELL_L[b.subshell];
  });

  const valenceShell = written.reduce((max, s) => Math.max(max, s.n), 0);

  const subshells: SubshellOccupancy[] = written.map((s) => ({
    n: s.n,
    subshell: s.subshell,
    electrons: s.electrons,
    capacity: SUBSHELL_CAPACITY[s.subshell],
    orbitals: fillSubshell(s.n, s.subshell, s.electrons),
    label: `${s.n}${s.subshell}${sup(s.electrons)}`,
    isValence: s.n === valenceShell,
  }));

  const full = subshells.map((s) => s.label).join(' ');

  // --- Forma abreviada con el gas noble anterior --------------------------
  let core: string | null = null;
  let condensed = full;
  for (const [nobleZ, nobleSymbol] of NOBLE_GASES) {
    // Cuando el recuento COINCIDE con el de un gas noble, la abreviatura es
    // toda la configuracion: Mg²⁺ es [Ne], no [He] 2s² 2p⁶. Se exceptua el
    // propio gas noble neutro, donde "[Ne]" no explicaria nada.
    if (electrons === nobleZ && symbol !== nobleSymbol) {
      const coreConfig = configureCore(nobleZ);
      const matches = [...coreConfig.entries()].every(([key, count]) => {
        const found = subshells.find((s) => `${s.n}${s.subshell}` === key);
        return found !== undefined && found.electrons === count;
      });
      if (matches && subshells.every((s) => coreConfig.has(`${s.n}${s.subshell}`))) {
        core = nobleSymbol;
        condensed = `[${nobleSymbol}]`;
        break;
      }
    }
    if (electrons > nobleZ) {
      const coreConfig = configureCore(nobleZ);
      const rest = subshells.filter((s) => !coreConfig.has(`${s.n}${s.subshell}`) || s.electrons !== coreConfig.get(`${s.n}${s.subshell}`));
      // Solo se abrevia si el nucleo esta COMPLETO en esta configuracion.
      const coreComplete = [...coreConfig.entries()].every(([key, count]) => {
        const found = subshells.find((s) => `${s.n}${s.subshell}` === key);
        return found !== undefined && found.electrons === count;
      });
      if (coreComplete) {
        core = nobleSymbol;
        const outer = subshells.filter((s) => !coreConfig.has(`${s.n}${s.subshell}`));
        condensed = outer.length > 0 ? `[${nobleSymbol}] ${outer.map((s) => s.label).join(' ')}` : `[${nobleSymbol}]`;
      }
      break;
    }
  }

  /*
   * Electrones de valencia = los que quedan FUERA del core de gas noble.
   *
   * Contar "los de la capa n mas alta" falla en los cationes de transicion:
   * al quitarle los 4s al hierro, el n mas alto pasa a ser 3, y esa cuenta
   * devolvia 3s² + 3p⁶ + 3d⁶ = 14 electrones de valencia para el Fe²⁺. Lo
   * quimicamente significativo son los 6 electrones d que quedan sobre el
   * core de argon.
   */
  const coreOccupancy = core ? configureCore(NOBLE_GASES.find(([, sym]) => sym === core)![0]) : null;
  const outsideCore = coreOccupancy
    ? subshells.filter((s) => !coreOccupancy.has(`${s.n}${s.subshell}`))
    : null;

  /*
   * Caso aparte: la especie ES exactamente un core de gas noble (Na⁺, Cl⁻,
   * Mg²⁺). Entonces no queda nada fuera del core y la cuenta anterior daria
   * cero, cuando lo que tiene es la capa externa completa. Se cuentan los
   * electrones de la capa n mas alta, que es lo que un quimico llama su
   * octeto (o dueto, en el caso del helio).
   */
  const outermost = Math.max(...subshells.map((s) => s.n));
  const valenceElectrons =
    outsideCore && outsideCore.length > 0
      ? outsideCore.reduce((sum, s) => sum + s.electrons, 0)
      : outsideCore
        ? subshells.filter((s) => s.n === outermost).reduce((sum, s) => sum + s.electrons, 0)
        : subshells.filter((s) => s.isValence).reduce((sum, s) => sum + s.electrons, 0);

  const unpairedElectrons = subshells
    .flatMap((s) => s.orbitals)
    .filter((o) => o.electrons === 1).length;

  const isNobleGasLike = NOBLE_GASES.some(([z]) => z === electrons) || electrons === 2;

  if (isNobleGasLike && charge !== 0) {
    notes.push(
      `Con ${electrons} electrones alcanza la configuracion de un gas noble, que es especialmente estable. ` +
        'Es la razon por la que este ion se forma con facilidad.',
    );
  }
  if (unpairedElectrons > 0) {
    notes.push(
      `Quedan ${unpairedElectrons} electron${unpairedElectrons === 1 ? '' : 'es'} desapareado${unpairedElectrons === 1 ? '' : 's'}, ` +
        'asi que la especie es PARAMAGNETICA: es atraida por un campo magnetico.',
    );
  }

  return {
    symbol,
    Z: element.Z,
    charge,
    electrons,
    subshells,
    full,
    condensed,
    core,
    valenceShell,
    valenceElectrons,
    unpairedElectrons,
    magnetism: unpairedElectrons > 0 ? 'paramagnetico' : 'diamagnetico',
    isAnomalous,
    anomalyReason,
    isNobleGasLike,
    notes,
  };
}

/** Subcapas completas de un gas noble, para la forma abreviada. */
function configureCore(Z: number): Map<string, number> {
  const out = new Map<string, number>();
  let left = Z;
  for (const level of AUFBAU) {
    if (left <= 0) break;
    const capacity = SUBSHELL_CAPACITY[level.subshell];
    const take = Math.min(left, capacity);
    out.set(`${level.n}${level.subshell}`, take);
    left -= take;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ionizacion (§8)
// ---------------------------------------------------------------------------

export interface IonisationStep {
  /** "Na → Na⁺ + e⁻" */
  readonly equation: string;
  readonly before: ElectronConfiguration;
  readonly after: ElectronConfiguration;
  /** Que subcapa perdio o gano el electron. */
  readonly changedSubshell: string;
  readonly explanation: string;
  /** ¿El resultado tiene configuracion de gas noble? */
  readonly reachesNobleGas: boolean;
}

function chargeLabel(charge: number): string {
  if (charge === 0) return '';
  const magnitude = Math.abs(charge);
  return `${magnitude > 1 ? sup(magnitude) : ''}${charge > 0 ? '⁺' : '⁻'}`;
}

/**
 * Describe la conversion de una especie a otra por ganancia o perdida de un
 * electron, mostrando exactamente que cambia (§8).
 */
export function ionise(symbol: string, fromCharge: number, toCharge: number): IonisationStep | null {
  const before = configureAtom(symbol, fromCharge);
  const after = configureAtom(symbol, toCharge);
  if (!before || !after) return null;

  const delta = toCharge - fromCharge;
  if (delta === 0) return null;

  // Que subcapa cambio.
  let changedSubshell = '—';
  for (const b of before.subshells) {
    const a = after.subshells.find((x) => x.n === b.n && x.subshell === b.subshell);
    if (!a || a.electrons !== b.electrons) {
      changedSubshell = `${b.n}${b.subshell}`;
      break;
    }
  }
  if (changedSubshell === '—') {
    for (const a of after.subshells) {
      if (!before.subshells.find((x) => x.n === a.n && x.subshell === a.subshell)) {
        changedSubshell = `${a.n}${a.subshell}`;
        break;
      }
    }
  }

  const left = `${symbol}${chargeLabel(fromCharge)}`;
  const right = `${symbol}${chargeLabel(toCharge)}`;
  const n = Math.abs(delta);
  const electronTerm = `${n > 1 ? n : ''}e⁻`;

  const equation = delta > 0
    ? `${left} → ${right} + ${electronTerm}`
    : `${left} + ${electronTerm} → ${right}`;

  const explanation = delta > 0
    ? `Pierde ${n} electron${n === 1 ? '' : 'es'} del orbital ${changedSubshell}. ` +
      `La configuracion pasa de ${before.condensed} a ${after.condensed}.` +
      (after.isNobleGasLike ? ' El resultado tiene configuracion de gas noble, muy estable.' : '')
    : `Gana ${n} electron${n === 1 ? '' : 'es'} en el orbital ${changedSubshell}. ` +
      `La configuracion pasa de ${before.condensed} a ${after.condensed}.` +
      (after.isNobleGasLike ? ' El resultado tiene configuracion de gas noble, muy estable.' : '');

  return {
    equation,
    before,
    after,
    changedSubshell,
    explanation,
    reachesNobleGas: after.isNobleGasLike,
  };
}

/**
 * Diagrama de casillas en texto:
 *   2p [↑↓] [↑ ] [↑ ]
 */
export function orbitalDiagram(config: ElectronConfiguration): readonly string[] {
  return config.subshells.map((s) => {
    const boxes = s.orbitals
      .map((o) => {
        const up = o.spins.includes('up') ? '↑' : ' ';
        const down = o.spins.includes('down') ? '↓' : ' ';
        return `[${up}${down}]`;
      })
      .join(' ');
    return `${s.n}${s.subshell} ${boxes}`;
  });
}

/** Nombre habitual del orbital segun su ml, para el detalle didactico. */
export function orbitalName(orbital: Orbital): string {
  if (orbital.subshell === 's') return `${orbital.n}s`;
  if (orbital.subshell === 'p') {
    const names: Record<number, string> = { [-1]: 'x', 0: 'z', 1: 'y' };
    return `${orbital.n}p${names[orbital.ml] ?? orbital.ml}`;
  }
  return `${orbital.n}${orbital.subshell} (m_l = ${orbital.ml >= 0 ? '+' : ''}${orbital.ml})`;
}

/** Los cuatro numeros cuanticos de un electron concreto (§7). */
export function quantumNumbers(orbital: Orbital, spinIndex: number): {
  n: number; l: number; ml: number; ms: string; explanation: string;
} {
  const ms = orbital.spins[spinIndex] === 'up' ? '+1/2' : '−1/2';
  return {
    n: orbital.n,
    l: orbital.l,
    ml: orbital.ml,
    ms,
    explanation:
      `n = ${orbital.n} indica el nivel y el tamano. ` +
      `l = ${orbital.l} indica la forma (${orbital.subshell}). ` +
      `m_l = ${orbital.ml} indica la orientacion en el espacio. ` +
      `m_s = ${ms} es el espin. Por el principio de exclusion de Pauli, dos electrones del mismo orbital ` +
      'no pueden compartir los cuatro numeros: si coinciden n, l y m_l, deben diferir en el espin.',
  };
}

/** Valencia utilizable para Lewis (§9). Grupo principal. */
export function lewisValenceElectrons(element: Element): number {
  if (element.block === 'f') return 3;
  const group = element.group;
  if (group === null) return 3;
  if (group === 18 && element.Z === 2) return 2; // He
  if (group <= 2) return group;
  if (group >= 13) return group - 10;
  return group; // metales de transicion: s + d
}
