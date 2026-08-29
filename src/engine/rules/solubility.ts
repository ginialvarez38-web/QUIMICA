/**
 * Reglas de solubilidad en agua.
 *
 * Deciden si una doble sustitucion produce precipitado (§8) y por tanto si la
 * reaccion ocurre realmente o los iones se quedan simplemente mezclados.
 *
 * Las reglas se aplican EN ORDEN y la primera que casa gana, que es como se
 * ensenan: "todos los nitratos son solubles" tiene prioridad sobre "los
 * compuestos de plata son insolubles", porque el AgNO3 es soluble.
 *
 * Cada regla lleva su enunciado, de modo que el sistema pueda decir no solo
 * "precipita" sino "precipita porque los cloruros son solubles SALVO los de
 * plata, mercurio(I) y plomo(II)".
 */

import type { Composition } from '../../core/types.js';
import { parseFormula } from '../../core/formula/parse.js';
import { curatedSolubility } from '../../data/species.js';

export type Solubility = 'soluble' | 'slightly-soluble' | 'insoluble' | 'unknown';

export interface SolubilityVerdict {
  readonly solubility: Solubility;
  /** Enunciado de la regla aplicada. */
  readonly rule: string;
  /** 'curated' si viene de un dato medido; 'rule' si viene de las reglas. */
  readonly source: 'curated' | 'rule' | 'unknown';
}

interface Rule {
  /** Iones o familias a los que se aplica. */
  readonly matches: (cation: string, anion: string) => boolean;
  readonly solubility: Solubility;
  readonly statement: string;
}

const ALKALI = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr']);
const isAlkaliOrAmmonium = (c: string): boolean => ALKALI.has(c) || c === 'NH4';

const RULES: Rule[] = [
  {
    matches: (c) => isAlkaliOrAmmonium(c),
    solubility: 'soluble',
    statement: 'Todas las sales de metales alcalinos (grupo 1) y de amonio son solubles.',
  },
  {
    matches: (_c, a) => a === 'NO3',
    solubility: 'soluble',
    statement: 'Todos los nitratos son solubles.',
  },
  {
    matches: (_c, a) => a === 'ClO3' || a === 'ClO4',
    solubility: 'soluble',
    statement: 'Todos los cloratos y percloratos son solubles.',
  },
  {
    matches: (_c, a) => a === 'CH3COO',
    solubility: 'soluble',
    statement: 'Casi todos los acetatos son solubles.',
  },
  {
    matches: (c, a) =>
      (a === 'Cl' || a === 'Br' || a === 'I') && (c === 'Ag' || c === 'Pb' || c === 'Hg2'),
    solubility: 'insoluble',
    statement:
      'Los cloruros, bromuros y yoduros son solubles SALVO los de plata(I), plomo(II) y mercurio(I).',
  },
  {
    matches: (_c, a) => a === 'Cl' || a === 'Br' || a === 'I',
    solubility: 'soluble',
    statement: 'Los cloruros, bromuros y yoduros son solubles (con las excepciones Ag, Pb, Hg₂).',
  },
  {
    matches: (c, a) => a === 'SO4' && (c === 'Ba' || c === 'Sr' || c === 'Pb' || c === 'Ra'),
    solubility: 'insoluble',
    statement: 'Los sulfatos son solubles SALVO los de bario, estroncio, plomo(II) y radio.',
  },
  {
    matches: (c, a) => a === 'SO4' && (c === 'Ca' || c === 'Ag' || c === 'Hg2'),
    solubility: 'slightly-soluble',
    statement: 'El sulfato de calcio, el de plata y el de mercurio(I) son poco solubles.',
  },
  {
    matches: (_c, a) => a === 'SO4',
    solubility: 'soluble',
    statement: 'Los sulfatos son solubles (con las excepciones Ba, Sr, Pb, Ca, Ag).',
  },
  {
    matches: (c, a) => a === 'OH' && (c === 'Ba' || c === 'Sr'),
    solubility: 'soluble',
    statement: 'Los hidroxidos son insolubles SALVO los de alcalinos, bario y estroncio.',
  },
  {
    matches: (c, a) => a === 'OH' && c === 'Ca',
    solubility: 'slightly-soluble',
    statement: 'El hidroxido de calcio es poco soluble: su disolucion saturada es el agua de cal.',
  },
  {
    matches: (_c, a) => a === 'OH',
    solubility: 'insoluble',
    statement: 'Los hidroxidos son insolubles salvo los de alcalinos, Ba²⁺, Sr²⁺ (y Ca²⁺ parcialmente).',
  },
  {
    matches: (c, a) => (a === 'S') && !isAlkaliOrAmmonium(c) && c !== 'Ca' && c !== 'Ba' && c !== 'Sr',
    solubility: 'insoluble',
    statement: 'Los sulfuros son insolubles salvo los de alcalinos, alcalinoterreos y amonio.',
  },
  {
    matches: (_c, a) => a === 'CO3' || a === 'PO4' || a === 'SO3' || a === 'CrO4' || a === 'C2O4',
    solubility: 'insoluble',
    statement:
      'Los carbonatos, fosfatos, sulfitos, cromatos y oxalatos son insolubles salvo los de alcalinos y amonio.',
  },
  {
    matches: (_c, a) => a === 'O',
    solubility: 'insoluble',
    statement: 'Los oxidos metalicos son insolubles; muchos reaccionan con el agua en vez de disolverse.',
  },
];

/** Aniones poliatomicos que el separador debe reconocer, de mayor a menor. */
const KNOWN_ANIONS = [
  'CH3COO', 'Cr2O7', 'C2O4', 'MnO4', 'ClO4', 'ClO3', 'HCO3', 'HSO4', 'CrO4',
  'NO3', 'NO2', 'SO4', 'SO3', 'PO4', 'CO3', 'OH', 'CN',
  'Cl', 'Br', 'I', 'F', 'S', 'O',
];

/** Cationes reconocidos, de mayor longitud a menor para casar antes NH4. */
const KNOWN_CATIONS = [
  'NH4', 'Hg2', 'Ba', 'Sr', 'Ca', 'Mg', 'Be', 'Ra', 'Li', 'Na', 'Rb', 'Cs', 'Fr',
  'Al', 'Zn', 'Fe', 'Cu', 'Ag', 'Pb', 'Sn', 'Ni', 'Co', 'Mn', 'Cr', 'Cd', 'Hg',
  'Bi', 'Ti', 'K',
];

/** Separa una sal en cation y anion por reconocimiento de patrones. */
export function splitSalt(formula: string): { cation: string; anion: string } | null {
  const compact = formula.replace(/[()\[\]]/g, '').replace(/·.*$/, '');
  for (const cation of KNOWN_CATIONS) {
    if (!compact.startsWith(cation)) continue;
    // Evita que "C" de carbono case como catión inexistente, y que "Cl"
    // se lea como "C" + "l".
    const rest = compact.slice(cation.length).replace(/^\d+/, '');
    for (const anion of KNOWN_ANIONS) {
      if (rest === anion || rest === anion + rest.slice(anion.length).replace(/\d+/g, '')) {
        if (rest.replace(/\d+$/, '') === anion) return { cation, anion };
      }
      if (rest.startsWith(anion) && /^\d*$/.test(rest.slice(anion.length))) {
        return { cation, anion };
      }
    }
  }
  return null;
}

/**
 * Solubilidad de una sustancia en agua.
 *
 * Se consulta primero el dato curado (una medida real siempre gana a una
 * regla general) y solo despues las reglas.
 */
export function solubilityOf(formula: string): SolubilityVerdict {
  const curated = curatedSolubility(formula);
  if (curated !== null) {
    if (curated === 'reacts') {
      return {
        solubility: 'unknown',
        rule: 'Esta sustancia no se disuelve: REACCIONA con el agua.',
        source: 'curated',
      };
    }
    return {
      solubility: curated,
      rule: 'Solubilidad medida experimentalmente (dato de la base de datos).',
      source: 'curated',
    };
  }

  const parts = splitSalt(formula);
  if (!parts) {
    return { solubility: 'unknown', rule: 'No se ha podido separar la sustancia en cation y anion.', source: 'unknown' };
  }

  for (const rule of RULES) {
    if (rule.matches(parts.cation, parts.anion)) {
      return { solubility: rule.solubility, rule: rule.statement, source: 'rule' };
    }
  }

  return {
    solubility: 'unknown',
    rule: 'Ninguna regla de solubilidad cubre esta combinacion de iones.',
    source: 'unknown',
  };
}

/** ¿Precipitaria esta sustancia al formarse en disolucion acuosa? */
export function precipitates(formula: string): boolean {
  const v = solubilityOf(formula);
  return v.solubility === 'insoluble' || v.solubility === 'slightly-soluble';
}

/** Composicion de una formula, o null si no se puede leer. */
export function compositionOf(formula: string): Composition | null {
  const p = parseFormula(formula);
  return p.ok ? p.value.composition : null;
}
