/**
 * Clasificacion de compuestos.
 *
 * Decide si CaO es un oxido basico, si H2SO4 es un oxoacido y si NaHCO3 es una
 * sal acida. De esta decision dependen la nomenclatura, la prediccion de
 * reacciones y los filtros de la biblioteca, asi que vive en el nucleo y no
 * en la base de datos: se aplica igual a una sustancia curada que a un
 * compuesto que el usuario acaba de construir en el sandbox.
 */

import type { Composition, CompoundClass, Element } from './types.js';
import { METALLIC_CATEGORIES } from './types.js';
import { getElement } from '../data/elements.js';
import { ANION_LIST } from '../data/ions.js';
import { parseFormula } from './formula/parse.js';

export interface Classification {
  readonly compoundClass: CompoundClass;
  /** Etiqueta legible en espanol. */
  readonly label: string;
  /** Por que se ha clasificado asi. Alimenta el modo profesor. */
  readonly reason: string;
  /** Cation identificado, si lo hay. */
  readonly cationSymbol: string | null;
  /** Anion identificado (formula), si lo hay. */
  readonly anionFormula: string | null;
  /** Es un compuesto ionico (frente a covalente molecular). */
  readonly ionic: boolean;
  /** Etiquetas para la biblioteca: 'acid', 'base', 'salt', 'oxide'... */
  readonly tags: readonly string[];
}

const METAL = (el: Element | undefined): boolean =>
  el !== undefined && METALLIC_CATEGORIES.has(el.category);

/** Oxidos anfoteros conocidos. No se deduce: se declara. */
const AMPHOTERIC = new Set(['Al2O3', 'ZnO', 'PbO', 'SnO', 'SnO2', 'Cr2O3', 'BeO', 'Ga2O3', 'PbO2', 'As2O3', 'Sb2O3']);
const PEROXIDES = new Set(['H2O2', 'Na2O2', 'K2O2', 'BaO2', 'CaO2', 'Li2O2', 'MgO2', 'SrO2']);

/** Aniones poliatomicos ordenados de mayor a menor, para casar el sufijo. */
const POLYATOMIC_SORTED = [...ANION_LIST]
  .filter((i) => {
    let atoms = 0;
    for (const n of i.composition.values()) atoms += n;
    return atoms > 1;
  })
  .sort((a, b) => b.formula.length - a.formula.length);

/**
 * Intenta partir una formula en cation + anion poliatomico.
 * `CaCO3` -> { cation: 'Ca', anion: 'CO3' }
 * `Na2SO4` -> { cation: 'Na', anion: 'SO4' }
 */
function splitIonic(formula: string): { cationPart: string; anionFormula: string } | null {
  const compact = formula.replace(/[()\[\]]/g, '').replace(/·.*$/, '');
  for (const anion of POLYATOMIC_SORTED) {
    if (anion.formula === 'OH') continue; // los hidroxidos se tratan aparte
    if (compact.endsWith(anion.formula)) {
      const head = compact.slice(0, compact.length - anion.formula.length).replace(/\d+$/, '');
      if (head && /^[A-Z]/.test(head)) {
        return { cationPart: head, anionFormula: anion.formula };
      }
    }
  }
  return null;
}

/** Primer simbolo de elemento de una cadena. */
function leadingSymbol(s: string): string | null {
  const m = /^([A-Z][a-z]{0,2})/.exec(s);
  return m ? m[1]! : null;
}

/**
 * Clasifica un compuesto a partir de su formula y composicion.
 */
export function classify(formula: string, composition: Composition, charge = 0): Classification {
  const compact = formula.replace(/\s/g, '');
  const symbols = [...composition.keys()];
  const elements = new Map(symbols.map((s) => [s, getElement(s)]));

  const has = (s: string): boolean => composition.has(s);
  const tags: string[] = [];

  // --- Sustancia simple --------------------------------------------------
  if (composition.size === 1 && charge === 0) {
    const sym = symbols[0]!;
    const el = elements.get(sym);
    return {
      compoundClass: 'element',
      label: 'Sustancia simple',
      reason: `Contiene un unico elemento (${el?.name ?? sym}), luego no es un compuesto sino una sustancia simple.`,
      cationSymbol: null,
      anionFormula: null,
      ionic: false,
      tags: ['element', el && METAL(el) ? 'metal' : 'nonmetal'],
    };
  }

  // --- Organico ----------------------------------------------------------
  // Criterio operativo: contiene C y H, y no es un carbonato ni un oxido de
  // carbono. Los carbonatos contienen carbono pero son quimica inorganica.
  if (has('C') && has('H')) {
    const looksInorganic = /CO3|HCO3/.test(compact);
    if (!looksInorganic) {
      const isCarboxylic = /COOH|CO2H/.test(compact);
      return {
        compoundClass: 'organic',
        label: isCarboxylic ? 'Acido carboxilico' : 'Compuesto organico',
        reason: isCarboxylic
          ? 'Contiene el grupo carboxilo -COOH sobre un esqueleto carbonado.'
          : 'Contiene un esqueleto de carbono e hidrogeno: pertenece a la quimica organica.',
        cationSymbol: null,
        anionFormula: null,
        ionic: false,
        tags: isCarboxylic ? ['organic', 'acid'] : ['organic'],
      };
    }
  }

  // --- Peroxidos ---------------------------------------------------------
  if (PEROXIDES.has(compact)) {
    return {
      compoundClass: 'peroxide',
      label: 'Peroxido',
      reason: 'Contiene el grupo peroxo O—O, en el que el oxigeno actua con -1 en lugar de -2.',
      cationSymbol: leadingSymbol(compact),
      anionFormula: 'O2',
      ionic: true,
      tags: ['peroxide', 'oxide'],
    };
  }

  // --- Hidroxidos --------------------------------------------------------
  if (/\(OH\)\d*$|OH$/.test(compact) && has('O') && has('H')) {
    const head = compact.replace(/\(?OH\)?\d*$/, '');
    const cationSymbol = leadingSymbol(head);
    if (cationSymbol && METAL(getElement(cationSymbol))) {
      return {
        compoundClass: 'hydroxide',
        label: 'Hidroxido (base)',
        reason: `Un metal (${getElement(cationSymbol)!.name}) unido a grupos hidroxido OH⁻. En agua libera iones OH⁻, luego es una base de Arrhenius.`,
        cationSymbol,
        anionFormula: 'OH',
        ionic: true,
        tags: ['hydroxide', 'base'],
      };
    }
  }

  // --- Oxidos ------------------------------------------------------------
  if (has('O') && composition.size === 2 && !has('H')) {
    const other = symbols.find((s) => s !== 'O')!;
    const el = getElement(other);
    if (AMPHOTERIC.has(compact)) {
      return {
        compoundClass: 'amphoteric-oxide',
        label: 'Oxido anfotero',
        reason: `El ${el?.name ?? other} forma un oxido que reacciona tanto con acidos como con bases: es anfotero.`,
        cationSymbol: other,
        anionFormula: 'O',
        ionic: true,
        tags: ['oxide', 'amphoteric'],
      };
    }
    if (METAL(el)) {
      return {
        compoundClass: 'basic-oxide',
        label: 'Oxido basico',
        reason: `Metal (${el!.name}) combinado con oxigeno. Con agua da un hidroxido, luego se comporta como oxido basico.`,
        cationSymbol: other,
        anionFormula: 'O',
        ionic: true,
        tags: ['oxide', 'basic-oxide'],
      };
    }
    return {
      compoundClass: 'acidic-oxide',
      label: 'Oxido acido (anhidrido)',
      reason: `No metal (${el?.name ?? other}) combinado con oxigeno. Con agua da un oxoacido, luego se comporta como oxido acido.`,
      cationSymbol: null,
      anionFormula: 'O',
      ionic: false,
      tags: ['oxide', 'acidic-oxide', 'anhydride'],
    };
  }

  // --- Acidos ------------------------------------------------------------
  // Convencion: la formula empieza por H y el resto no es un metal.
  if (/^H\d*[A-Z]/.test(compact) && has('H')) {
    const rest = compact.replace(/^H\d*/, '');
    const restSymbol = leadingSymbol(rest);
    const restIsMetal = restSymbol ? METAL(getElement(restSymbol)) : false;

    if (!restIsMetal) {
      if (has('O') && composition.size >= 3) {
        const split = splitIonic(compact);
        return {
          compoundClass: 'oxoacid',
          label: 'Oxoacido',
          reason:
            'Hidrogeno, oxigeno y un elemento central no metalico. En disolucion cede protones H⁺, luego es un acido; al llevar oxigeno se llama oxoacido.',
          cationSymbol: 'H',
          anionFormula: split?.anionFormula ?? null,
          ionic: false,
          tags: ['acid', 'oxoacid'],
        };
      }
      if (composition.size === 2) {
        return {
          compoundClass: 'binary-acid',
          label: 'Acido binario (hidracido)',
          reason:
            'Hidrogeno combinado con un no metal, sin oxigeno. En disolucion acuosa cede H⁺, luego es un hidracido.',
          cationSymbol: 'H',
          anionFormula: symbols.find((s) => s !== 'H') ?? null,
          ionic: false,
          tags: ['acid', 'binary-acid', 'hydracid'],
        };
      }
    }
  }

  // --- Sales acidas: contienen H entre un metal y un oxoanion -----------
  const split = splitIonic(compact);
  if (split) {
    const cationSymbol = leadingSymbol(split.cationPart);
    const cationIsMetal = cationSymbol ? METAL(getElement(cationSymbol)) : false;
    const isAmmonium = split.cationPart.startsWith('NH4') || compact.startsWith('NH4');

    if (cationIsMetal || isAmmonium) {
      const anionHasH = split.anionFormula.startsWith('H');
      if (anionHasH) {
        return {
          compoundClass: 'acid-salt',
          label: 'Sal acida',
          reason:
            'Sal en la que el acido de partida no ha cedido todos sus hidrogenos: conserva al menos un H acido junto al cation metalico.',
          cationSymbol,
          anionFormula: split.anionFormula,
          ionic: true,
          tags: ['salt', 'acid-salt'],
        };
      }
      return {
        compoundClass: 'oxosalt',
        label: 'Oxosal',
        reason: `Cation ${isAmmonium ? 'amonio' : getElement(cationSymbol!)?.name ?? cationSymbol} combinado con el oxoanion ${split.anionFormula}. Es la sal del oxoacido correspondiente.`,
        cationSymbol,
        anionFormula: split.anionFormula,
        ionic: true,
        tags: ['salt', 'oxosalt'],
      };
    }
  }

  // --- Hidruros ----------------------------------------------------------
  if (has('H') && composition.size === 2) {
    const other = symbols.find((s) => s !== 'H')!;
    const el = getElement(other);
    if (METAL(el)) {
      return {
        compoundClass: 'metal-hydride',
        label: 'Hidruro metalico',
        reason: `El hidrogeno es mas electronegativo que el ${el!.name}, luego actua como H⁻ (hidruro).`,
        cationSymbol: other,
        anionFormula: 'H',
        ionic: true,
        tags: ['hydride', 'metal-hydride'],
      };
    }
    return {
      compoundClass: 'nonmetal-hydride',
      label: 'Hidruro no metalico',
      reason: `Hidrogeno combinado con el no metal ${el?.name ?? other} mediante enlaces covalentes.`,
      cationSymbol: null,
      anionFormula: null,
      ionic: false,
      tags: ['hydride', 'nonmetal-hydride'],
    };
  }

  // --- Sales binarias ----------------------------------------------------
  if (composition.size === 2) {
    const [a, b] = symbols as [string, string];
    const elA = getElement(a);
    const elB = getElement(b);
    if (METAL(elA) && !METAL(elB)) {
      return {
        compoundClass: 'binary-salt',
        label: 'Sal binaria',
        reason: `Metal (${elA!.name}) combinado con no metal (${elB?.name ?? b}): transferencia de electrones y enlace ionico.`,
        cationSymbol: a,
        anionFormula: b,
        ionic: true,
        tags: ['salt', 'binary-salt'],
      };
    }
    if (!METAL(elA) && !METAL(elB)) {
      return {
        compoundClass: 'binary-covalent',
        label: 'Compuesto binario covalente',
        reason: `Dos no metales (${elA?.name ?? a} y ${elB?.name ?? b}) comparten electrones: enlace covalente.`,
        cationSymbol: null,
        anionFormula: null,
        ionic: false,
        tags: ['covalent', 'binary-covalent'],
      };
    }
  }

  return {
    compoundClass: 'other',
    label: 'Compuesto',
    reason: 'No encaja en ninguna de las familias reconocidas por el clasificador.',
    cationSymbol: null,
    anionFormula: null,
    ionic: false,
    tags,
  };
}

/** Version de conveniencia a partir de una cadena. */
export function classifyFormula(formula: string): Classification | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  return classify(formula, parsed.value.composition, parsed.value.charge);
}

/** ¿Es un acido segun la clasificacion? Lo consultan las reglas de reaccion. */
export function isAcid(c: Classification): boolean {
  return c.compoundClass === 'binary-acid' || c.compoundClass === 'oxoacid';
}

/** ¿Es una base de Arrhenius? */
export function isBase(c: Classification): boolean {
  return c.compoundClass === 'hydroxide';
}

/** ¿Es una sal? */
export function isSalt(c: Classification): boolean {
  return (
    c.compoundClass === 'binary-salt' ||
    c.compoundClass === 'oxosalt' ||
    c.compoundClass === 'acid-salt'
  );
}

export const CLASS_LABEL_ES: Record<CompoundClass, string> = {
  element: 'Sustancia simple',
  'basic-oxide': 'Oxido basico',
  'acidic-oxide': 'Oxido acido (anhidrido)',
  'amphoteric-oxide': 'Oxido anfotero',
  peroxide: 'Peroxido',
  hydroxide: 'Hidroxido (base)',
  'binary-acid': 'Acido binario (hidracido)',
  oxoacid: 'Oxoacido',
  'binary-salt': 'Sal binaria',
  oxosalt: 'Oxosal',
  'acid-salt': 'Sal acida',
  'metal-hydride': 'Hidruro metalico',
  'nonmetal-hydride': 'Hidruro no metalico',
  'binary-covalent': 'Compuesto binario covalente',
  organic: 'Compuesto organico',
  coordination: 'Compuesto de coordinacion',
  other: 'Compuesto',
};
