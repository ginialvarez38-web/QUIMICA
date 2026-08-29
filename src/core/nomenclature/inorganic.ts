/**
 * Nomenclatura inorganica en espanol (§28).
 *
 * Genera los tres sistemas y DICE CUAL ES CUAL, que es exactamente lo que
 * pide el brief:
 *
 *   Fe2O3   Stock ......... oxido de hierro(III)
 *           Sistematica ... trioxido de dihierro
 *           Tradicional ... oxido ferrico
 *
 * La nomenclatura tradicional (-oso/-ico, hipo-/per-) se incluye porque sigue
 * siendo la que aparece en los enunciados de examen en espanol, aunque IUPAC
 * la haya desaconsejado.
 */

import type { Composition, Nomenclature } from '../types.js';
import { classify, type Classification } from '../classify.js';
import { getElement } from '../../data/elements.js';
import { getIon, getIonsByFormula, CATIONS_BY_ELEMENT } from '../../data/ions.js';
import { parseFormula } from '../formula/parse.js';
import { assignOxidationStates } from '../oxidation.js';

const MULT = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca', 'undeca', 'dodeca'];

/** Prefijo multiplicador; el "mono" inicial se omite salvo en el primer termino. */
function prefix(n: number, keepMono = false): string {
  if (n === 1) return keepMono ? 'mono' : '';
  return MULT[n] ?? `${n}-`;
}

/**
 * Une un prefijo multiplicador con la raiz aplicando la elision del espanol:
 * los prefijos terminados en -a o -o pierden esa vocal ante otra vocal.
 *
 *   mono  + oxido -> monoxido   (no "monooxido")
 *   tetra + oxido -> tetroxido
 *   penta + oxido -> pentoxido
 *
 * Los terminados en -i no eliden: dioxido, trioxido.
 */
function joinPrefix(pre: string, root: string): string {
  if (!pre) return root;
  const last = pre[pre.length - 1]!;
  const first = root[0]!;
  if ((last === 'a' || last === 'o') && 'aeiou'.includes(first)) {
    return pre.slice(0, -1) + root;
  }
  return pre + root;
}

/** Numero de oxidacion en numeros romanos, para la nomenclatura de Stock. */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  const table: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [value, sym] of table) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out;
}

/**
 * Raiz latina usada por la nomenclatura tradicional.
 * "hierro" -> "ferr", "cobre" -> "cupr", "plomo" -> "plumb".
 */
const TRADITIONAL_ROOT: Record<string, string> = {
  Fe: 'ferr', Cu: 'cupr', Pb: 'plumb', Sn: 'estann', Au: 'aur', Ag: 'argent',
  Hg: 'mercur', Mn: 'mangan', Cr: 'crom', Co: 'cobalt', Ni: 'niquel',
  Pt: 'platin', S: 'sulfur', N: 'nitr', P: 'fosf', C: 'carb', Cl: 'clor',
  Br: 'brom', I: 'yod', Si: 'silic', B: 'bor', Se: 'selen', Te: 'telur',
  As: 'arsen', Sb: 'antimon', Bi: 'bismut', Ti: 'titan', V: 'vanad',
  W: 'wolfram', Mo: 'molibd', Zn: 'zinc', Al: 'alumin',
};

/**
 * Nombres tradicionales de los oxoacidos.
 *
 * POR QUE ES UNA TABLA Y NO UN ALGORITMO
 * La tentacion es derivarlos de "raiz + sufijo segun el estado de oxidacion",
 * pero el espanol no coopera: la raiz de carbono da "carbonico" y no
 * "carbico", la de fosforo da "fosforico" y no "fosfico", y el manganeso
 * salta de +6 (mangánico) a +7 (permangánico) sin pasar por -oso. Un
 * algoritmo que "casi" acierta produciria nombres inexistentes como
 * "acido pernitrico", que es justo lo que el principio §32 prohibe.
 *
 * La lista de oxoacidos que se ensenan es cerrada y corta, asi que se escribe.
 * Clave: "<elemento central>:<estado de oxidacion>".
 */
const OXOACID_TRADITIONAL: Record<string, string> = {
  'N:3': 'acido nitroso',
  'N:5': 'acido nitrico',
  'S:2': 'acido hiposulfuroso',
  'S:4': 'acido sulfuroso',
  'S:6': 'acido sulfurico',
  'Se:4': 'acido selenioso',
  'Se:6': 'acido selenico',
  'Te:4': 'acido teluroso',
  'Te:6': 'acido telurico',
  'C:4': 'acido carbonico',
  'Si:4': 'acido silicico',
  'B:3': 'acido borico',
  'P:1': 'acido hipofosforoso',
  'P:3': 'acido fosforoso',
  'P:5': 'acido fosforico',
  'As:3': 'acido arsenioso',
  'As:5': 'acido arsenico',
  'Sb:3': 'acido antimonioso',
  'Sb:5': 'acido antimonico',
  'Cl:1': 'acido hipocloroso',
  'Cl:3': 'acido cloroso',
  'Cl:5': 'acido clorico',
  'Cl:7': 'acido perclorico',
  'Br:1': 'acido hipobromoso',
  'Br:3': 'acido bromoso',
  'Br:5': 'acido bromico',
  'Br:7': 'acido perbromico',
  'I:1': 'acido hipoyodoso',
  'I:5': 'acido yodico',
  'I:7': 'acido peryodico',
  'Mn:6': 'acido manganico',
  'Mn:7': 'acido permanganico',
  'Cr:6': 'acido cromico',
};

/**
 * Raices de los hidracidos, que NO coinciden con las de los oxoacidos:
 * el azufre da "sulfhidrico" pero "sulfurico".
 */
const HYDRACID_NAME: Record<string, string> = {
  F: 'acido fluorhidrico',
  Cl: 'acido clorhidrico',
  Br: 'acido bromhidrico',
  I: 'acido yodhidrico',
  S: 'acido sulfhidrico',
  Se: 'acido selenhidrico',
  Te: 'acido telurhidrico',
};

/**
 * Sufijo tradicional segun la posicion del estado de oxidacion dentro de los
 * estados posibles del elemento. Se usa SOLO para cationes metalicos
 * (ferroso/ferrico, cuproso/cuprico), donde la morfologia es regular.
 *  2 estados -> -oso (menor), -ico (mayor)
 *  3 estados -> hipo--oso, -oso, -ico
 *  4 estados -> hipo--oso, -oso, -ico, per--ico
 */
function traditionalSuffix(state: number, states: readonly number[]): { prefix: string; suffix: string } | null {
  const positives = [...new Set(states.filter((s) => s > 0))].sort((a, b) => a - b);
  const idx = positives.indexOf(state);
  if (idx < 0) return null;

  switch (positives.length) {
    case 1:
      return { prefix: '', suffix: 'ico' };
    case 2:
      return { prefix: '', suffix: idx === 0 ? 'oso' : 'ico' };
    case 3:
      return [
        { prefix: 'hipo', suffix: 'oso' },
        { prefix: '', suffix: 'oso' },
        { prefix: '', suffix: 'ico' },
      ][idx]!;
    case 4:
      return [
        { prefix: 'hipo', suffix: 'oso' },
        { prefix: '', suffix: 'oso' },
        { prefix: '', suffix: 'ico' },
        { prefix: 'per', suffix: 'ico' },
      ][idx]!;
    default: {
      // Mas de cuatro estados: solo se nombran con seguridad los extremos.
      if (idx === 0) return { prefix: 'hipo', suffix: 'oso' };
      if (idx === positives.length - 1) return { prefix: 'per', suffix: 'ico' };
      return null;
    }
  }
}

/** Concuerda el genero del adjetivo tradicional: "oxido ferrico". */
function traditionalCationName(symbol: string, state: number): string | null {
  const el = getElement(symbol);
  if (!el) return null;

  // Si el ion esta en la base de datos con nombre tradicional, se usa ese.
  const ion = getIon(symbol, state);
  if (ion?.traditionalName) return ion.traditionalName;

  const root = TRADITIONAL_ROOT[symbol];
  if (!root) return null;
  const s = traditionalSuffix(state, el.oxidationStates);
  if (!s) return null;
  return `${s.prefix}${root}${s.suffix}`;
}

/** ¿Tiene el elemento un unico estado de oxidacion positivo? */
function hasSingleState(symbol: string): boolean {
  const el = getElement(symbol);
  if (!el) return false;
  return el.oxidationStates.filter((s) => s > 0).length <= 1;
}

/** Nombre del anion monoatomico: Cl -> cloruro, O -> oxido. */
function monatomicAnionName(symbol: string): string {
  const ion = getIon(symbol, -1) ?? getIon(symbol, -2) ?? getIon(symbol, -3) ?? getIon(symbol, -4);
  if (ion) return ion.name;
  const el = getElement(symbol);
  return el ? `${el.name.toLowerCase()}uro` : symbol;
}

/** Nombre del oxoanion: SO4 -> sulfato. */
function polyatomicAnionName(formula: string): string | null {
  const candidates = getIonsByFormula(formula).filter((i) => i.charge < 0);
  return candidates[0]?.name ?? null;
}

/**
 * Estado de oxidacion del cation dentro del compuesto.
 * Se toma del motor de oxidacion, que ya sabe resolver los casos con reglas.
 */
function cationState(composition: Composition, formula: string, cationSymbol: string): number | null {
  const ox = assignOxidationStates(composition, 0, formula);
  if (!ox.ok) return null;
  const a = ox.value.assignments.find((x) => x.symbol === cationSymbol);
  if (!a || !Number.isInteger(a.state)) return null;
  return a.state;
}

/**
 * Genera los tres nombres de un compuesto inorganico.
 * Cada campo puede ser null: se prefiere no dar nombre a dar uno inventado.
 */
export function nameCompound(
  formula: string,
  composition: Composition,
  classification?: Classification,
): Nomenclature {
  const c = classification ?? classify(formula, composition, 0);
  const empty: Nomenclature = { stock: null, systematic: null, traditional: null, common: null };

  switch (c.compoundClass) {
    // --- Oxidos ---------------------------------------------------------
    case 'basic-oxide':
    case 'acidic-oxide':
    case 'amphoteric-oxide': {
      const metal = c.cationSymbol ?? [...composition.keys()].find((s) => s !== 'O');
      if (!metal) return empty;
      const el = getElement(metal);
      if (!el) return empty;

      const nOx = composition.get('O') ?? 0;
      const nEl = composition.get(metal) ?? 0;
      const systematic = `${joinPrefix(prefix(nOx, true), 'oxido')} de ${joinPrefix(prefix(nEl), el.name.toLowerCase())}`;

      const state = cationState(composition, formula, metal);
      const stock =
        state === null
          ? null
          : hasSingleState(metal)
            ? `oxido de ${el.name.toLowerCase()}`
            : `oxido de ${el.name.toLowerCase()}(${roman(state)})`;

      const trad = state === null ? null : traditionalCationName(metal, state);
      const traditional = trad ? `oxido ${trad}` : null;

      return { stock, systematic, traditional, common: null };
    }

    case 'peroxide': {
      const metal = c.cationSymbol;
      const el = metal ? getElement(metal) : null;
      if (!el) return { stock: 'peroxido de hidrogeno', systematic: 'dioxido de dihidrogeno', traditional: null, common: 'agua oxigenada' };
      return {
        stock: `peroxido de ${el.name.toLowerCase()}`,
        systematic: null,
        traditional: null,
        common: null,
      };
    }

    // --- Hidroxidos ------------------------------------------------------
    case 'hydroxide': {
      const metal = c.cationSymbol;
      if (!metal) return empty;
      const el = getElement(metal);
      if (!el) return empty;

      const nOH = composition.get('O') ?? 1;
      const state = cationState(composition, formula, metal);
      const stock =
        state === null
          ? null
          : hasSingleState(metal)
            ? `hidroxido de ${el.name.toLowerCase()}`
            : `hidroxido de ${el.name.toLowerCase()}(${roman(state)})`;

      const trad = state === null ? null : traditionalCationName(metal, state);

      return {
        stock,
        systematic: `${joinPrefix(prefix(nOH, true), 'hidroxido')} de ${el.name.toLowerCase()}`,
        traditional: trad ? `hidroxido ${trad}` : null,
        common: null,
      };
    }

    // --- Hidruros --------------------------------------------------------
    case 'metal-hydride': {
      const metal = c.cationSymbol;
      if (!metal) return empty;
      const el = getElement(metal);
      if (!el) return empty;
      const nH = composition.get('H') ?? 1;
      const state = cationState(composition, formula, metal);
      return {
        stock:
          state === null || hasSingleState(metal)
            ? `hidruro de ${el.name.toLowerCase()}`
            : `hidruro de ${el.name.toLowerCase()}(${roman(state)})`,
        systematic: `${joinPrefix(prefix(nH, true), 'hidruro')} de ${el.name.toLowerCase()}`,
        traditional: null,
        common: null,
      };
    }

    case 'nonmetal-hydride': {
      const other = [...composition.keys()].find((s) => s !== 'H');
      if (!other) return empty;
      const el = getElement(other);
      if (!el) return empty;
      const nH = composition.get('H') ?? 1;
      const nX = composition.get(other) ?? 1;
      return {
        stock: null,
        systematic: `${joinPrefix(prefix(nX, true), el.name.toLowerCase())} de ${joinPrefix(prefix(nH), 'hidrogeno')}`,
        traditional: null,
        common: null,
      };
    }

    // --- Acidos ----------------------------------------------------------
    case 'binary-acid': {
      const other = [...composition.keys()].find((s) => s !== 'H');
      if (!other) return empty;
      const el = getElement(other);
      if (!el) return empty;
      // El nombre tradicional del hidracido se toma de la tabla: la raiz no
      // coincide con la del oxoacido (sulfhidrico frente a sulfurico).
      return {
        stock: `${monatomicAnionName(other)} de hidrogeno`,
        systematic: `${monatomicAnionName(other)} de hidrogeno`,
        traditional: HYDRACID_NAME[other] ?? null,
        common: null,
      };
    }

    case 'oxoacid': {
      const central = [...composition.keys()].find((s) => s !== 'H' && s !== 'O');
      if (!central) return empty;
      const el = getElement(central);
      if (!el) return empty;

      const state = cationState(composition, formula, central);
      const root = TRADITIONAL_ROOT[central] ?? el.name.toLowerCase();
      // Tabla explicita: derivar el nombre por sufijos produce invenciones
      // como "acido pernitrico". Si no esta en la tabla, se devuelve null.
      const traditional = state === null ? null : OXOACID_TRADITIONAL[`${central}:${state}`] ?? null;

      // Nomenclatura de hidrogeno: H2SO4 -> "tetraoxosulfato(VI) de hidrogeno".
      const nO = composition.get('O') ?? 0;
      const nH = composition.get('H') ?? 0;
      const stock =
        state === null
          ? null
          : `${joinPrefix(prefix(nO, true), 'oxo')}${root}ato(${roman(state)}) de ${joinPrefix(prefix(nH), 'hidrogeno')}`;

      return { stock, systematic: stock, traditional, common: null };
    }

    // --- Sales -----------------------------------------------------------
    case 'binary-salt': {
      const metal = c.cationSymbol;
      const nonmetal = c.anionFormula;
      if (!metal || !nonmetal) return empty;
      const elM = getElement(metal);
      if (!elM) return empty;

      const anionName = monatomicAnionName(nonmetal);
      const state = cationState(composition, formula, metal);
      const stock =
        state === null || hasSingleState(metal)
          ? `${anionName} de ${elM.name.toLowerCase()}`
          : `${anionName} de ${elM.name.toLowerCase()}(${roman(state)})`;

      const nX = composition.get(nonmetal) ?? 1;
      const nM = composition.get(metal) ?? 1;
      const trad = state === null ? null : traditionalCationName(metal, state);

      return {
        stock,
        systematic: `${joinPrefix(prefix(nX, true), anionName)} de ${joinPrefix(prefix(nM), elM.name.toLowerCase())}`,
        traditional: trad ? `${anionName} ${trad}` : null,
        common: null,
      };
    }

    case 'oxosalt':
    case 'acid-salt': {
      const anionFormula = c.anionFormula;
      if (!anionFormula) return empty;
      const anionName = polyatomicAnionName(anionFormula);
      if (!anionName) return empty;

      const cationSymbol = c.cationSymbol;
      if (!cationSymbol) return empty;

      // Amonio no es un elemento: se trata aparte.
      if (formula.startsWith('NH4')) {
        return { stock: `${anionName} de amonio`, systematic: `${anionName} de amonio`, traditional: null, common: null };
      }

      const elM = getElement(cationSymbol);
      if (!elM) return empty;

      const state = cationState(composition, formula, cationSymbol);
      const stock =
        state === null || hasSingleState(cationSymbol)
          ? `${anionName} de ${elM.name.toLowerCase()}`
          : `${anionName} de ${elM.name.toLowerCase()}(${roman(state)})`;

      const trad = state === null ? null : traditionalCationName(cationSymbol, state);

      return {
        stock,
        systematic: stock,
        traditional: trad ? `${anionName} ${trad}` : null,
        common: null,
      };
    }

    // --- Binarios covalentes ---------------------------------------------
    case 'binary-covalent': {
      const symbols = [...composition.keys()];
      if (symbols.length !== 2) return empty;
      // El menos electronegativo va segundo en el nombre espanol.
      const [a, b] = symbols as [string, string];
      const elA = getElement(a);
      const elB = getElement(b);
      if (!elA || !elB) return empty;
      const aFirst = (elA.electronegativity ?? 0) > (elB.electronegativity ?? 0);
      const [neg, pos] = aFirst ? [a, b] : [b, a];
      const elNeg = getElement(neg)!;
      const elPos = getElement(pos)!;
      const negName = monatomicAnionName(neg);
      return {
        stock: null,
        systematic: `${joinPrefix(prefix(composition.get(neg) ?? 1, true), negName)} de ${joinPrefix(prefix(composition.get(pos) ?? 1), elPos.name.toLowerCase())}`,
        traditional: null,
        common: null,
      };
    }

    case 'element': {
      const sym = [...composition.keys()][0]!;
      const el = getElement(sym);
      const n = composition.get(sym) ?? 1;
      if (!el) return empty;
      return {
        stock: el.name,
        systematic: n > 1 ? joinPrefix(prefix(n, true), el.name.toLowerCase()) : el.name,
        traditional: null,
        common: null,
      };
    }

    default:
      return empty;
  }
}

/** Version de conveniencia a partir de una cadena de formula. */
export function nameFormula(formula: string): Nomenclature | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  return nameCompound(formula, parsed.value.composition);
}

/** El primer nombre disponible, en orden de preferencia didactica. */
export function preferredName(n: Nomenclature): string | null {
  return n.common ?? n.stock ?? n.traditional ?? n.systematic;
}

/** Etiquetas de los sistemas, para mostrar "cual es cual" (§28). */
export const NOMENCLATURE_LABELS = {
  stock: 'Stock',
  systematic: 'Sistematica',
  traditional: 'Tradicional',
  common: 'Comun',
} as const;

/** Todos los cationes posibles de un elemento, para el constructor. */
export function cationsOf(symbol: string) {
  return CATIONS_BY_ELEMENT.get(symbol) ?? [];
}
