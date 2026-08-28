/**
 * Chemical equation balancing and stoichiometry.
 *
 * Balancing is done properly — as the integer null space of the element/charge
 * conservation matrix — rather than by table lookup. That means CHEMIA can
 * balance an equation it has never seen, including redox half-reactions with
 * explicit charges, and can *prove* to the student that a proposed equation is
 * or is not balanced, element by element.
 */

import { nullSpace, toSmallestIntegers, type Mat } from '../math/linalg.js';
import { molarMass, parseFormula, type Composition } from './formula.js';

export interface Species {
  formula: string;
  composition: Composition;
  charge: number;
  /** Stoichiometric coefficient (positive for both sides; sign is implied by side). */
  coefficient: number;
  /** Physical state, when annotated: (s), (l), (g), (ac). */
  state?: State;
}

export type State = 's' | 'l' | 'g' | 'ac';

export interface ChemicalEquation {
  reactants: Species[];
  products: Species[];
  balanced: boolean;
  /** Per-element atom balance; empty when balanced. */
  imbalance: Array<{ element: string; left: number; right: number }>;
  chargeLeft: number;
  chargeRight: number;
}

const STATE_RE = /\((s|l|g|ac|aq)\)\s*$/i;

/** Parse "2 H2 (g) + O2 (g) -> 2 H2O (l)" into a structured equation. */
export function parseEquation(text: string): ChemicalEquation {
  const arrow = text.match(/(<=>|<->|⇌|→|->|=>|=)/);
  if (!arrow) throw new Error('La ecuación debe incluir una flecha (→, ->, = o ⇌)');
  const [lhs, rhs] = text.split(arrow[0]);

  const reactants = parseSide(lhs);
  const products = parseSide(rhs);
  return check({ reactants, products });
}

/**
 * Split one side of an equation into species.
 *
 * A naive split on "+" destroys ionic equations: "Fe2+ + MnO4-" has three plus
 * signs, only one of which is a separator. The rule applied here is the one a
 * reader uses unconsciously — a "+" is part of a charge when it is attached to
 * the token on its left (letter, digit, closing bracket or another charge sign)
 * *and* nothing but whitespace, another "+" or the end follows it.
 */
export function splitSide(side: string): string[] {
  const tokens: string[] = [];
  let current = '';

  for (let i = 0; i < side.length; i++) {
    const c = side[i];
    if (c !== '+') { current += c; continue; }

    const prev = side[i - 1] ?? '';
    const attachedLeft = /[A-Za-z0-9)\]+]/.test(prev);
    let j = i + 1;
    while (j < side.length && side[j] === ' ') j++;
    const nextChar = side[j] ?? '';
    const openRight = j >= side.length || nextChar === '+';

    if (attachedLeft && (openRight || side[i + 1] === undefined || /\s/.test(side[i + 1] ?? ''))) {
      current += c;                       // charge sign
    } else {
      tokens.push(current);               // separator
      current = '';
    }
  }
  tokens.push(current);
  return tokens.map((t) => t.trim()).filter(Boolean);
}

function parseSide(side: string): Species[] {
  return splitSide(side)
    .map((token) => {
      let state: State | undefined;
      const sm = token.match(STATE_RE);
      let body = token;
      if (sm) {
        const s = sm[1].toLowerCase();
        state = (s === 'aq' ? 'ac' : s) as State;
        body = token.slice(0, sm.index).trim();
      }
      const parsed = parseFormula(body);
      return {
        formula: parsed.formula.replace(/^\d+\s*/, ''),
        composition: parsed.composition,
        charge: parsed.charge,
        coefficient: parsed.coefficient,
        state,
      };
    });
}

/** Verify a proposed equation and report exactly which elements fail. */
export function check(eq: { reactants: Species[]; products: Species[] }): ChemicalEquation {
  const elements = new Set<string>();
  [...eq.reactants, ...eq.products].forEach((s) =>
    Object.keys(s.composition).forEach((e) => elements.add(e)));

  const imbalance: ChemicalEquation['imbalance'] = [];
  for (const el of elements) {
    const left = eq.reactants.reduce((s, r) => s + r.coefficient * (r.composition[el] ?? 0), 0);
    const right = eq.products.reduce((s, p) => s + p.coefficient * (p.composition[el] ?? 0), 0);
    if (Math.abs(left - right) > 1e-9) imbalance.push({ element: el, left, right });
  }

  const chargeLeft = eq.reactants.reduce((s, r) => s + r.coefficient * r.charge, 0);
  const chargeRight = eq.products.reduce((s, p) => s + p.coefficient * p.charge, 0);

  return {
    ...eq,
    imbalance,
    chargeLeft,
    chargeRight,
    balanced: imbalance.length === 0 && Math.abs(chargeLeft - chargeRight) < 1e-9,
  };
}

export interface BalanceResult {
  equation: ChemicalEquation;
  /** Coefficients in input order: reactants then products. */
  coefficients: number[];
  /** True when the conservation matrix had a one-dimensional null space. */
  unique: boolean;
  /** Set when balancing is impossible with these species. */
  error?: string;
}

/**
 * Balance an equation by solving the homogeneous conservation system.
 *
 * Each element contributes one row and each species one column, with reactant
 * coefficients positive and product coefficients negative. Charge contributes
 * one further row, which is what lets redox half-reactions balance. Any vector
 * in the null space of that matrix is a valid set of coefficients; the smallest
 * positive integer vector is the conventional answer.
 *
 * A null space of dimension > 1 means the reaction is under-determined (for
 * example two independent reactions written together) — reported, not hidden.
 */
export function balance(input: ChemicalEquation | string): BalanceResult {
  const eq = typeof input === 'string' ? parseEquation(input) : input;
  const species = [...eq.reactants, ...eq.products];
  const nR = eq.reactants.length;

  const elements = Array.from(new Set(species.flatMap((s) => Object.keys(s.composition)))).sort();
  const anyCharge = species.some((s) => s.charge !== 0);

  const A: Mat = elements.map((el) =>
    species.map((s, i) => (i < nR ? 1 : -1) * (s.composition[el] ?? 0)),
  );
  if (anyCharge) {
    A.push(species.map((s, i) => (i < nR ? 1 : -1) * s.charge));
  }

  const basis = nullSpace(A);
  if (basis.length === 0) {
    return {
      equation: eq, coefficients: species.map((s) => s.coefficient), unique: false,
      error: 'No existe combinación que conserve todos los elementos: revisa las especies.',
    };
  }

  const positive = findPositiveSolution(basis);
  if (!positive) {
    return {
      equation: eq, coefficients: species.map((s) => s.coefficient), unique: basis.length === 1,
      error: basis.length > 1
        ? `El sistema es indeterminado (${basis.length} reacciones independientes entre estas especies) y ninguna combinación da coeficientes positivos.`
        : 'La solución exige coeficientes negativos: alguna especie está en el lado equivocado de la flecha.',
    };
  }

  const ints = toSmallestIntegers(positive);
  const reactants = eq.reactants.map((s, i) => ({ ...s, coefficient: ints[i] }));
  const products = eq.products.map((s, i) => ({ ...s, coefficient: ints[nR + i] }));

  return {
    equation: check({ reactants, products }),
    coefficients: ints,
    unique: basis.length === 1,
    error: basis.length > 1
      ? `El sistema es indeterminado: entre estas ${species.length} especies existen ${basis.length} reacciones independientes, `
        + 'por lo que hay infinitos conjuntos de coeficientes válidos. Se muestra uno de ellos. '
        + 'Para fijar la estequiometría, escribe cada reacción por separado o elimina una especie redundante.'
      : undefined,
  };
}

/**
 * Pick a strictly-positive vector from the null space.
 *
 * With a one-dimensional null space this is just a sign check. When the space
 * is larger — MnO₄⁻/H₂O₂ is the classic example, because hydrogen peroxide can
 * both reduce permanganate and disproportionate — a small integer combination
 * of the basis vectors is searched for, preferring the one with the smallest
 * coefficients. Returning *a* valid answer while flagging the ambiguity is more
 * useful than refusing to balance.
 */
function findPositiveSolution(basis: number[][], limit = 8): number[] | null {
  const dim = basis.length;
  const n = basis[0].length;
  const allPositive = (v: number[]): boolean => v.every((x) => x > 1e-9);

  for (const sign of [1, -1]) {
    const v = basis[0].map((x) => x * sign);
    if (allPositive(v)) return v;
  }
  if (dim === 1) return null;

  let best: number[] | null = null;
  let bestScore = Infinity;

  const coeffs = new Array(dim).fill(0);
  const search = (k: number): void => {
    if (k === dim) {
      if (coeffs.every((c) => c === 0)) return;
      const v = new Array(n).fill(0);
      for (let d = 0; d < dim; d++) {
        if (coeffs[d] === 0) continue;
        for (let i = 0; i < n; i++) v[i] += coeffs[d] * basis[d][i];
      }
      if (!allPositive(v)) return;
      const ints = toSmallestIntegers(v);
      if (ints.some((x) => x <= 0)) return;
      const score = Math.max(...ints);
      if (score < bestScore) { bestScore = score; best = v; }
      return;
    }
    for (let c = -limit; c <= limit; c++) {
      coeffs[k] = c;
      search(k + 1);
    }
    coeffs[k] = 0;
  };
  search(0);

  return best;
}

/** Render an equation back to text, with states and typographic arrows. */
export function formatEquation(eq: ChemicalEquation, arrow = '→'): string {
  const side = (list: Species[]): string =>
    list.map((s) => {
      const c = s.coefficient === 1 ? '' : `${s.coefficient} `;
      const st = s.state ? `(${s.state})` : '';
      return `${c}${s.formula}${st}`;
    }).join(' + ');
  return `${side(eq.reactants)} ${arrow} ${side(eq.products)}`;
}

// ---------------------------------------------------------------------------
// Stoichiometry
// ---------------------------------------------------------------------------

export interface StoichiometryInput {
  /** Moles supplied of each reactant, keyed by formula. Missing = in excess. */
  available: Record<string, number>;
}

export interface StoichiometryResult {
  limiting: string | null;
  /** Extent of reaction, ξ, in moles. */
  extent: number;
  consumed: Record<string, number>;
  produced: Record<string, number>;
  remaining: Record<string, number>;
  /** Theoretical yield of each product, in grams. */
  theoreticalYieldGrams: Record<string, number>;
  /** How many equivalents each reactant supplies, ranked — reveals the limiting one. */
  equivalents: Array<{ formula: string; moles: number; perCoefficient: number; limiting: boolean }>;
}

/**
 * Limiting reagent and extent of reaction.
 *
 * The extent ξ is the honest way to express this: every reactant is consumed
 * by ν_i·ξ and every product formed by ν_j·ξ, so one number describes the whole
 * conversion. Students who learn the "divide moles by coefficient" trick get
 * the same answer, and the table of equivalents shows them why it works.
 */
export function stoichiometry(eq: ChemicalEquation, input: StoichiometryInput): StoichiometryResult {
  const equivalents = eq.reactants
    .map((r) => {
      const moles = input.available[r.formula];
      return {
        formula: r.formula,
        moles: moles ?? Infinity,
        perCoefficient: (moles ?? Infinity) / r.coefficient,
        limiting: false,
      };
    });

  const minPer = Math.min(...equivalents.map((e) => e.perCoefficient));
  equivalents.forEach((e) => { e.limiting = e.perCoefficient === minPer && Number.isFinite(minPer); });
  const limiting = equivalents.find((e) => e.limiting)?.formula ?? null;
  const extent = Number.isFinite(minPer) ? minPer : 0;

  const consumed: Record<string, number> = {};
  const remaining: Record<string, number> = {};
  for (const r of eq.reactants) {
    const used = r.coefficient * extent;
    consumed[r.formula] = used;
    const have = input.available[r.formula];
    if (have !== undefined) remaining[r.formula] = Math.max(have - used, 0);
  }

  const produced: Record<string, number> = {};
  const theoreticalYieldGrams: Record<string, number> = {};
  for (const p of eq.products) {
    const n = p.coefficient * extent;
    produced[p.formula] = n;
    theoreticalYieldGrams[p.formula] = n * molarMass(p.composition);
  }

  return { limiting, extent, consumed, produced, remaining, theoreticalYieldGrams, equivalents };
}

/** Percentage yield, with the actual and theoretical masses that produced it. */
export function percentYield(actualGrams: number, theoreticalGrams: number): number {
  return theoreticalGrams > 0 ? (actualGrams / theoreticalGrams) * 100 : NaN;
}

/**
 * Atom economy — the mass fraction of all reactant atoms that ends up in the
 * desired product. The primary metric of Química Verde (§51), and one that a
 * high percentage yield can hide: a reaction can run at 95 % yield with 20 %
 * atom economy.
 */
export function atomEconomy(eq: ChemicalEquation, desiredProduct: string): number {
  const product = eq.products.find((p) => p.formula === desiredProduct);
  if (!product) return NaN;
  const wanted = product.coefficient * molarMass(product.composition);
  const total = eq.reactants.reduce((s, r) => s + r.coefficient * molarMass(r.composition), 0);
  return total > 0 ? (wanted / total) * 100 : NaN;
}
