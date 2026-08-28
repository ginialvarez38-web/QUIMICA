/**
 * Chemical formula parsing and elemental analysis.
 *
 * Handles the notation actually used in a chemistry course:
 *   H2SO4              simple formula
 *   Ca(OH)2            nested groups
 *   K4[Fe(CN)6]        bracketed complexes
 *   CuSO4·5H2O         hydrates (·, ., * all accepted)
 *   SO4^2-  Fe^3+      explicit charge
 *   NH4+   PO4 3-      trailing charge without a caret
 *   2 H2O              a leading stoichiometric coefficient
 *
 * The parser is the single entry point for turning text into composition, and
 * every molar mass in CHEMIA is computed from it against `data/elements`.
 */

import { atomicMass, elementBySymbol } from '../../data/elements.js';
import { ISOTOPES, monoisotopicMass } from '../../data/isotopes.js';

/** Element symbol → number of atoms. */
export type Composition = Record<string, number>;

export interface ParsedFormula {
  /** The input, normalised. */
  formula: string;
  composition: Composition;
  charge: number;
  /** Leading stoichiometric coefficient (1 unless the input carried one). */
  coefficient: number;
  /** Total atoms per formula unit. */
  atomCount: number;
  /** Hydrate waters split out of the formula, if any. */
  hydrate: number;
}

class FormulaError extends Error {
  constructor(message: string, readonly position?: number) {
    super(message);
    this.name = 'FormulaError';
  }
}

export { FormulaError };

/**
 * Parse a chemical formula into its composition and charge.
 * Throws a FormulaError with a position for anything malformed — the molecular
 * builder surfaces that position to the student rather than failing silently.
 */
export function parseFormula(input: string): ParsedFormula {
  const raw = input.trim();
  if (!raw) throw new FormulaError('Fórmula vacía');

  // Leading stoichiometric coefficient, e.g. "2 H2O" or "3NaCl".
  let coefficient = 1;
  let body = raw;
  const coeffMatch = body.match(/^(\d+)\s*(?=[A-Z(\[])/);
  if (coeffMatch) {
    coefficient = Number(coeffMatch[1]);
    body = body.slice(coeffMatch[0].length);
  }

  // Charge. Three accepted notations, disambiguated in this order:
  //   1. explicit caret          SO4^2-   Fe^3+
  //   2. separated by a space    SO4 2-
  //   3. attached                NH4+     Fe3+
  // Case 3 is genuinely ambiguous — the digits in "NH4+" are a subscript while
  // those in "Fe3+" are the charge — so attached digits are read as a charge
  // only when the remaining body is a single element symbol. Anything else
  // needs notation 1 or 2, which is what the substance database uses.
  let charge = 0;
  const caret = body.indexOf('^');
  if (caret >= 0) {
    charge = parseCharge(body.slice(caret + 1));
    body = body.slice(0, caret);
  } else {
    const spaced = body.match(/\s+(\d*[+−-]+)$/);
    if (spaced) {
      charge = parseCharge(spaced[1]);
      body = body.slice(0, spaced.index);
    } else {
      const attached = body.match(/(\d*)([+−-]+)$/);
      if (attached && attached[2] && /[A-Za-z0-9)\]]/.test(body.charAt(attached.index! - 1))) {
        const digits = attached[1];
        const signs = attached[2];
        const withoutDigits = body.slice(0, attached.index);
        const digitsAreCharge = digits !== '' && elementBySymbol(withoutDigits) !== undefined;
        if (digitsAreCharge) {
          charge = parseCharge(digits + signs[0]);
          body = withoutDigits;
        } else {
          // Digits belong to the formula; the sign run alone carries the charge.
          charge = parseCharge(signs);
          body = body.slice(0, body.length - signs.length);
        }
      }
    }
  }

  // Hydrates: split on the centre dot (or ASCII substitutes).
  const parts = body.split(/[·.*]/).map((p) => p.trim()).filter(Boolean);
  const composition: Composition = {};
  let hydrate = 0;

  parts.forEach((part, i) => {
    const m = part.match(/^(\d+)\s*(.*)$/);
    const mult = m ? Number(m[1]) : 1;
    const segment = m ? m[2] : part;
    if (i > 0 && /^H2O$/i.test(segment)) hydrate += mult;
    const sub = parseSegment(segment);
    for (const [el, n] of Object.entries(sub)) {
      composition[el] = (composition[el] ?? 0) + n * mult;
    }
  });

  const atomCount = Object.values(composition).reduce((a, b) => a + b, 0);
  if (atomCount === 0) throw new FormulaError(`No se reconoció ningún elemento en "${raw}"`);

  return { formula: raw, composition, charge, coefficient, atomCount, hydrate };
}

function parseCharge(s: string): number {
  const t = s.replace(/−/g, '-').trim();
  if (!t) return 0;
  // Forms: "2-", "-2", "-", "++", "3+"
  const repeated = t.match(/^([+-])\1*$/);
  if (repeated) return (t[0] === '+' ? 1 : -1) * t.length;
  const nSign = t.match(/^(\d+)([+-])$/);
  if (nSign) return Number(nSign[1]) * (nSign[2] === '+' ? 1 : -1);
  const signN = t.match(/^([+-])(\d+)$/);
  if (signN) return Number(signN[2]) * (signN[1] === '+' ? 1 : -1);
  throw new FormulaError(`Carga no reconocida: "${s}"`);
}

/** Recursive-descent parse of a bracketed formula segment. */
function parseSegment(s: string): Composition {
  const out: Composition = {};
  let i = 0;

  const consumeNumber = (): number => {
    const start = i;
    while (i < s.length && /\d/.test(s[i])) i++;
    return i > start ? Number(s.slice(start, i)) : 1;
  };

  const merge = (target: Composition, source: Composition, mult: number): void => {
    for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + v * mult;
  };

  const walk = (): Composition => {
    const local: Composition = {};
    while (i < s.length) {
      const c = s[i];

      if (c === '(' || c === '[' || c === '{') {
        i++;
        const inner = walk();
        const close = s[i];
        if (close !== ')' && close !== ']' && close !== '}') {
          throw new FormulaError(`Paréntesis sin cerrar en la posición ${i}`, i);
        }
        i++;
        merge(local, inner, consumeNumber());
        continue;
      }

      if (c === ')' || c === ']' || c === '}') return local;

      if (/[A-Z]/.test(c)) {
        let sym = c;
        i++;
        while (i < s.length && /[a-z]/.test(s[i])) { sym += s[i]; i++; }
        if (!elementBySymbol(sym)) {
          throw new FormulaError(`Símbolo de elemento desconocido: "${sym}"`, i - sym.length);
        }
        local[sym] = (local[sym] ?? 0) + consumeNumber();
        continue;
      }

      if (/\s/.test(c)) { i++; continue; }

      throw new FormulaError(`Carácter inesperado "${c}" en la posición ${i}`, i);
    }
    return local;
  };

  merge(out, walk(), 1);
  if (i < s.length) throw new FormulaError(`Paréntesis de cierre sobrante en la posición ${i}`, i);
  return out;
}

// ---------------------------------------------------------------------------
// Derived quantities
// ---------------------------------------------------------------------------

/** Molar mass, g·mol⁻¹, from the standard atomic weights. */
export function molarMass(formula: string | Composition): number {
  const comp = typeof formula === 'string' ? parseFormula(formula).composition : formula;
  let M = 0;
  for (const [el, n] of Object.entries(comp)) M += atomicMass(el) * n;
  return M;
}

/**
 * Monoisotopic mass, u — the mass of the ion built from each element's most
 * abundant isotope. This is what a high-resolution mass spectrometer reports,
 * and it differs from the molar mass by an amount students must learn to expect.
 */
export function monoisotopic(formula: string | Composition): number {
  const comp = typeof formula === 'string' ? parseFormula(formula).composition : formula;
  let m = 0;
  for (const [el, n] of Object.entries(comp)) {
    m += monoisotopicMass(el, atomicMass(el)) * n;
  }
  return m;
}

export interface ElementalAnalysis {
  element: string;
  atoms: number;
  massContribution: number;
  massPercent: number;
}

/** Percentage composition by mass — the classic Química General I calculation. */
export function elementalAnalysis(formula: string | Composition): ElementalAnalysis[] {
  const comp = typeof formula === 'string' ? parseFormula(formula).composition : formula;
  const M = molarMass(comp);
  return Object.entries(comp)
    .map(([element, atoms]) => {
      const massContribution = atomicMass(element) * atoms;
      return { element, atoms, massContribution, massPercent: (massContribution / M) * 100 };
    })
    .sort((a, b) => b.massPercent - a.massPercent);
}

/**
 * Empirical formula from mass percentages — the inverse problem, and the one
 * students find harder. Returns the composition scaled to the smallest
 * near-integer set, plus the residual so the quality of the rounding is visible.
 */
export function empiricalFromPercent(percents: Record<string, number>): {
  composition: Composition;
  moleRatios: Record<string, number>;
  multiplier: number;
  maxResidual: number;
} {
  const moles: Record<string, number> = {};
  for (const [el, pct] of Object.entries(percents)) moles[el] = pct / atomicMass(el);

  const minMoles = Math.min(...Object.values(moles));
  const ratios: Record<string, number> = {};
  for (const [el, n] of Object.entries(moles)) ratios[el] = n / minMoles;

  // Find the smallest multiplier that brings every ratio near an integer.
  let best = 1;
  let bestResidual = Infinity;
  for (let k = 1; k <= 12; k++) {
    const residual = Math.max(
      ...Object.values(ratios).map((r) => Math.abs(r * k - Math.round(r * k))),
    );
    if (residual < bestResidual - 1e-9) { bestResidual = residual; best = k; }
    if (residual < 0.06) break;
  }

  const composition: Composition = {};
  for (const [el, r] of Object.entries(ratios)) composition[el] = Math.round(r * best);
  return { composition, moleRatios: ratios, multiplier: best, maxResidual: bestResidual };
}

/** Render a composition back to a formula string, in Hill order. */
export function formatComposition(comp: Composition): string {
  return hillOrder(comp)
    .map(([el, n]) => (n === 1 ? el : `${el}${n}`))
    .join('');
}

/**
 * Hill order: carbon first, then hydrogen, then everything else alphabetically.
 * When there is no carbon, everything is alphabetical. This is the convention
 * used by CAS and by every chemical database.
 */
export function hillOrder(comp: Composition): Array<[string, number]> {
  const entries = Object.entries(comp).filter(([, n]) => n !== 0);
  const hasCarbon = 'C' in comp;
  const rank = (el: string): number => {
    if (!hasCarbon) return 2;
    if (el === 'C') return 0;
    if (el === 'H') return 1;
    return 2;
  };
  return entries.sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

/** Degrees of unsaturation (rings + π bonds) for a CHNOX formula. */
export function degreeOfUnsaturation(comp: Composition): number {
  const C = comp.C ?? 0;
  const H = comp.H ?? 0;
  const N = comp.N ?? 0;
  const halogens = (comp.F ?? 0) + (comp.Cl ?? 0) + (comp.Br ?? 0) + (comp.I ?? 0);
  return (2 * C + 2 + N - H - halogens) / 2;
}

/** Is this composition the same substance as that one? */
export function sameComposition(a: Composition, b: Composition): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Isotope patterns (§36 — mass spectrometry)
// ---------------------------------------------------------------------------

export interface IsotopePeak {
  /** Mass-to-charge ratio. */
  mz: number;
  /** Intensity relative to the base peak, 0–100. */
  intensity: number;
  /** Nominal mass offset from the monoisotopic peak (M, M+1, M+2 …). */
  offset: number;
}

/**
 * Full isotopic distribution of a molecular formula, by convolving each
 * element's isotope distribution `n` times.
 *
 * This is why the chlorine M+2 peak comes out at 32 % of M and the bromine one
 * at 97 %: nothing is hard-coded, the pattern falls out of the natural
 * abundances in `data/isotopes`.
 */
export function isotopePattern(
  formula: string | Composition,
  opts: { charge?: number; threshold?: number; maxPeaks?: number } = {},
): IsotopePeak[] {
  const comp = typeof formula === 'string' ? parseFormula(formula).composition : formula;
  const threshold = opts.threshold ?? 1e-5;
  const charge = Math.abs(opts.charge ?? 1) || 1;

  // Distribution as a list of (mass, probability) pairs, convolved element by element.
  let dist: Array<{ m: number; p: number }> = [{ m: 0, p: 1 }];

  for (const [el, count] of Object.entries(comp)) {
    const isos = ISOTOPES[el];
    const single = isos && isos.length > 1
      ? isos.map((i) => ({ m: i.mass, p: i.abundance }))
      : [{ m: monoisotopicMass(el, atomicMass(el)), p: 1 }];

    for (let k = 0; k < count; k++) {
      const next = new Map<string, { m: number; p: number }>();
      for (const a of dist) {
        for (const b of single) {
          const p = a.p * b.p;
          if (p < threshold * 1e-3) continue;
          const m = a.m + b.m;
          // Bin by nominal mass so the list cannot grow without bound.
          const key = Math.round(m * 100) / 100;
          const cur = next.get(String(key));
          if (cur) {
            cur.m = (cur.m * cur.p + m * p) / (cur.p + p);
            cur.p += p;
          } else {
            next.set(String(key), { m, p });
          }
        }
      }
      dist = [...next.values()];
      // Keep the distribution bounded: drop negligible branches each step.
      if (dist.length > 400) {
        dist.sort((a, b) => b.p - a.p);
        dist = dist.slice(0, 400);
      }
    }
  }

  const maxP = dist.reduce((m, d) => Math.max(m, d.p), 0);
  const monoMass = monoisotopic(comp);

  return dist
    .filter((d) => d.p / maxP >= threshold)
    .map((d) => ({
      mz: d.m / charge,
      intensity: (d.p / maxP) * 100,
      offset: Math.round(d.m - monoMass),
    }))
    .sort((a, b) => a.mz - b.mz)
    .slice(0, opts.maxPeaks ?? 40);
}
