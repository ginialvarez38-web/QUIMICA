/**
 * Chemical kinetics.
 *
 * §21 and §63: a kinetic simulation must integrate a real rate law, not animate
 * a precomputed decay. A mechanism written here becomes a system of ordinary
 * differential equations that the ODE engine integrates; the concentration
 * profiles, the rate-versus-concentration plot, the effect of temperature and
 * the approach to equilibrium are all consequences of that integration.
 *
 * The same mechanism object serves the lesson (which shows the differential
 * equations), the simulation (which solves them), the laboratory (which
 * generates noisy sampled data from them) and the analysis module (which fits
 * a rate constant back out of that data).
 */

import { integrate, integrateStiff, type ODESolution } from '../math/ode.js';
import { levenbergMarquardt, linearRegression, type LinearFit } from '../math/stats.js';
import { R, T_STANDARD } from '../constants.js';

/** One elementary or empirical step. */
export interface ReactionStep {
  id: string;
  /** Reactant stoichiometry, species id → coefficient (positive). */
  reactants: Record<string, number>;
  products: Record<string, number>;
  /**
   * Rate law exponents, species id → order. Defaults to the reactant
   * stoichiometry, which is correct only for an elementary step — the
   * distinction CHEMIA insists on teaching.
   */
  orders?: Record<string, number>;
  /** Pre-exponential factor A, in units consistent with the overall order. */
  A: number;
  /** Activation energy, J·mol⁻¹. */
  Ea: number;
  /** Reverse reaction, when the step is reversible. */
  reverse?: { A: number; Ea: number; orders?: Record<string, number> };
  /** True when the step is elementary — only then is the molecularity meaningful. */
  elementary?: boolean;
  /** Catalyst species whose concentration multiplies the rate but is not consumed. */
  catalyst?: string;
  description?: string;
}

export interface Mechanism {
  id: string;
  name: string;
  species: string[];
  steps: ReactionStep[];
  /** Overall reaction, for display. */
  overall?: string;
  /** Species assumed to be at steady state, for the approximation lesson. */
  steadyState?: string[];
  notes?: string[];
}

/** Rate constant from the Arrhenius equation, k = A·exp(−Ea/RT). */
export const arrhenius = (A: number, Ea: number, T: number): number =>
  A * Math.exp(-Ea / (R * T));

/**
 * Activation energy from two rate constants at two temperatures — the
 * two-point form students derive and then use in the laboratory.
 *
 *   ln(k₂/k₁) = −(Ea/R)·(1/T₂ − 1/T₁)
 */
export function activationEnergyTwoPoint(k1: number, T1: number, k2: number, T2: number): number {
  return (-R * Math.log(k2 / k1)) / (1 / T2 - 1 / T1);
}

export interface ArrheniusFit {
  /** Activation energy, J·mol⁻¹. */
  Ea: number;
  /** Standard uncertainty of Ea. */
  uEa: number;
  /** Pre-exponential factor. */
  A: number;
  uA: number;
  r2: number;
  fit: LinearFit;
  /** The linearised data actually fitted: (1/T, ln k). */
  invT: number[];
  lnK: number[];
}

/**
 * Fit the Arrhenius equation to (T, k) data by linear regression of ln k
 * against 1/T. The slope is −Ea/R and the intercept is ln A; propagating the
 * regression uncertainties gives honest error bars on both, which is the whole
 * point of doing the experiment at more than two temperatures.
 */
export function fitArrhenius(temperatures: number[], rateConstants: number[]): ArrheniusFit {
  const invT = temperatures.map((T) => 1 / T);
  const lnK = rateConstants.map(Math.log);
  const fit = linearRegression(invT, lnK);
  const Ea = -fit.slope * R;
  const A = Math.exp(fit.intercept);
  return {
    Ea, uEa: fit.seSlope * R,
    A, uA: A * fit.seIntercept,     // u(A)/A = u(ln A)
    r2: fit.r2, fit, invT, lnK,
  };
}

// ---------------------------------------------------------------------------
// Integrated rate laws — the closed forms, for comparison with the simulation
// ---------------------------------------------------------------------------

export type RateOrder = 0 | 1 | 2;

/** [A] as a function of time for a simple order-n decay of a single reactant. */
export function integratedRateLaw(order: RateOrder, A0: number, k: number, t: number): number {
  switch (order) {
    case 0: return Math.max(A0 - k * t, 0);
    case 1: return A0 * Math.exp(-k * t);
    case 2: return A0 / (1 + k * A0 * t);
  }
}

/** Half-life for a simple order-n decay. Only first order is concentration-independent. */
export function halfLife(order: RateOrder, A0: number, k: number): number {
  switch (order) {
    case 0: return A0 / (2 * k);
    case 1: return Math.LN2 / k;
    case 2: return 1 / (k * A0);
  }
}

/**
 * The linearisation that makes each order a straight line — the classic method
 * of determining reaction order graphically.
 *   order 0: [A]      vs t
 *   order 1: ln[A]    vs t
 *   order 2: 1/[A]    vs t
 */
export function linearise(order: RateOrder, concentrations: number[]): number[] {
  switch (order) {
    case 0: return concentrations.slice();
    case 1: return concentrations.map((c) => (c > 0 ? Math.log(c) : NaN));
    case 2: return concentrations.map((c) => (c > 0 ? 1 / c : NaN));
  }
}

export const ORDER_AXIS_LABEL: Record<RateOrder, string> = {
  0: '[A] / mol·L⁻¹',
  1: 'ln([A] / mol·L⁻¹)',
  2: '1/[A] / L·mol⁻¹',
};

export interface OrderDetermination {
  order: RateOrder;
  r2: number;
  k: number;
  uK: number;
  fit: LinearFit;
}

/**
 * Determine the reaction order by fitting all three linearisations and
 * comparing the correlation coefficients — exactly the procedure a student
 * follows with a table of concentration against time.
 */
export function determineOrder(times: number[], concentrations: number[]): {
  best: OrderDetermination;
  all: OrderDetermination[];
  conclusive: boolean;
} {
  const all = ([0, 1, 2] as RateOrder[]).map((order) => {
    const y = linearise(order, concentrations);
    const valid = y.map((v, i) => ({ v, t: times[i] })).filter((p) => Number.isFinite(p.v));
    const fit = linearRegression(valid.map((p) => p.t), valid.map((p) => p.v));
    // k is −slope for orders 0 and 1, +slope for order 2.
    const k = order === 2 ? fit.slope : -fit.slope;
    return { order, r2: fit.r2, k, uK: fit.seSlope, fit };
  });

  const sorted = all.slice().sort((a, b) => b.r2 - a.r2);
  // Two orders fitting almost equally well means the data cannot distinguish
  // them — which happens when the reaction has not been followed far enough.
  const conclusive = sorted[0].r2 - sorted[1].r2 > 0.002 || sorted[0].r2 > 0.9995;
  return { best: sorted[0], all, conclusive };
}

// ---------------------------------------------------------------------------
// Mechanism → ODE system
// ---------------------------------------------------------------------------

export interface KineticsRun {
  /** Sample times, seconds. */
  t: number[];
  /** Concentration of each species at each time, keyed by species id. */
  c: Record<string, number[]>;
  /** Net rate of each step at each time, mol·L⁻¹·s⁻¹. */
  rates: Record<string, number[]>;
  species: string[];
  temperature: number;
  /** Rate constants actually used, for display. */
  constants: Record<string, { kf: number; kr?: number }>;
  solution: ODESolution;
  /** True when the solver had to fall back to the stiff integrator. */
  stiff: boolean;
}

export interface KineticsOptions {
  temperature?: number;
  /** Sample times; a uniform grid is generated when omitted. */
  tEval?: number[];
  duration?: number;
  points?: number;
  /** Fixed catalyst / buffer concentrations that do not change. */
  fixed?: Record<string, number>;
  stiff?: boolean;
}

/**
 * Build the right-hand side of the ODE system from a mechanism.
 *
 * For each step the rate is
 *
 *     r = k(T) · Π [S_i]^{ν_i}        (forward)
 *       − k'(T) · Π [P_j]^{ν'_j}      (reverse, when present)
 *
 * and each species accumulates Σ (stoichiometric coefficient) × (step rate).
 * Nothing about this is specific to any particular reaction — which is the
 * point: a new mechanism is data, not code.
 */
export function buildRateSystem(
  mechanism: Mechanism, opts: KineticsOptions = {},
): {
  derivative: (t: number, y: number[]) => number[];
  rateOf: (y: number[]) => Record<string, number>;
  index: Record<string, number>;
  constants: Record<string, { kf: number; kr?: number }>;
} {
  const T = opts.temperature ?? T_STANDARD;
  const species = mechanism.species;
  const index: Record<string, number> = {};
  species.forEach((s, i) => { index[s] = i; });

  const constants: Record<string, { kf: number; kr?: number }> = {};
  for (const step of mechanism.steps) {
    constants[step.id] = {
      kf: arrhenius(step.A, step.Ea, T),
      kr: step.reverse ? arrhenius(step.reverse.A, step.reverse.Ea, T) : undefined,
    };
  }

  const conc = (y: number[], id: string): number =>
    opts.fixed?.[id] ?? (index[id] !== undefined ? Math.max(y[index[id]], 0) : 0);

  const stepRate = (y: number[], step: ReactionStep): number => {
    const k = constants[step.id];
    const orders = step.orders ?? step.reactants;
    let forward = k.kf;
    for (const [id, n] of Object.entries(orders)) forward *= Math.pow(conc(y, id), n);
    if (step.catalyst) forward *= conc(y, step.catalyst);

    let reverse = 0;
    if (step.reverse && k.kr !== undefined) {
      const rOrders = step.reverse.orders ?? step.products;
      reverse = k.kr;
      for (const [id, n] of Object.entries(rOrders)) reverse *= Math.pow(conc(y, id), n);
    }
    return forward - reverse;
  };

  const derivativeFn = (_t: number, y: number[]): number[] => {
    const dy = new Array(species.length).fill(0);
    for (const step of mechanism.steps) {
      const r = stepRate(y, step);
      for (const [id, n] of Object.entries(step.reactants)) {
        if (index[id] !== undefined && opts.fixed?.[id] === undefined) dy[index[id]] -= n * r;
      }
      for (const [id, n] of Object.entries(step.products)) {
        if (index[id] !== undefined && opts.fixed?.[id] === undefined) dy[index[id]] += n * r;
      }
    }
    return dy;
  };

  const rateOf = (y: number[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const step of mechanism.steps) out[step.id] = stepRate(y, step);
    return out;
  };

  return { derivative: derivativeFn, rateOf, index, constants };
}

/** Integrate a mechanism from a set of initial concentrations. */
export function runKinetics(
  mechanism: Mechanism,
  initial: Record<string, number>,
  opts: KineticsOptions = {},
): KineticsRun {
  const T = opts.temperature ?? T_STANDARD;
  const duration = opts.duration ?? 100;
  const points = opts.points ?? 200;
  const tEval = opts.tEval ?? Array.from({ length: points + 1 }, (_, i) => (duration * i) / points);

  const { derivative: f, rateOf, index, constants } = buildRateSystem(mechanism, opts);
  const y0 = mechanism.species.map((s) => initial[s] ?? 0);

  let solution = opts.stiff
    ? integrateStiff(f, y0, 0, tEval[tEval.length - 1], { nonNegative: true })
    : integrate(f, y0, 0, tEval[tEval.length - 1], { tEval, nonNegative: true, rtol: 1e-9, atol: 1e-14 });

  let stiff = Boolean(opts.stiff);
  if (!solution.success && !stiff) {
    // A mechanism with a fast pre-equilibrium is stiff; fall back rather than
    // returning a truncated trajectory and calling it a result.
    solution = integrateStiff(f, y0, 0, tEval[tEval.length - 1], { steps: 20000, nonNegative: true });
    stiff = true;
  }

  const c: Record<string, number[]> = {};
  mechanism.species.forEach((s) => { c[s] = []; });
  const rates: Record<string, number[]> = {};
  mechanism.steps.forEach((s) => { rates[s.id] = []; });

  solution.y.forEach((y) => {
    mechanism.species.forEach((s) => c[s].push(y[index[s]]));
    const r = rateOf(y);
    mechanism.steps.forEach((s) => rates[s.id].push(r[s.id]));
  });

  return { t: solution.t, c, rates, species: mechanism.species, temperature: T, constants, solution, stiff };
}

// ---------------------------------------------------------------------------
// Fitting a rate constant back out of data
// ---------------------------------------------------------------------------

export interface RateConstantFit {
  k: number;
  uK: number;
  A0: number;
  r2: number;
  order: RateOrder;
  residuals: number[];
}

/**
 * Fit k and [A]₀ to noisy concentration-time data by nonlinear least squares.
 * Fitting the integrated law directly, rather than regressing a linearised
 * form, avoids the bias that the log transform introduces into the weighting —
 * a point worth making explicitly in a Quimiometría course.
 */
export function fitRateConstant(
  times: number[], concentrations: number[], order: RateOrder,
): RateConstantFit {
  const model = (t: number, p: number[]): number => integratedRateLaw(order, p[0], Math.max(p[1], 0), t);
  const A0Guess = concentrations[0];
  const kGuess = order === 1
    ? Math.LN2 / (times[Math.floor(times.length / 2)] || 1)
    : 1 / ((times[times.length - 1] || 1) * Math.max(A0Guess, 1e-9));

  const fit = levenbergMarquardt(model, times, concentrations, [A0Guess, kGuess]);
  return {
    A0: fit.params[0], k: fit.params[1], uK: fit.se[1],
    r2: fit.r2, order, residuals: fit.residuals,
  };
}

// ---------------------------------------------------------------------------
// A library of the mechanisms the curriculum uses
// ---------------------------------------------------------------------------

export const MECHANISMS: Mechanism[] = [
  {
    id: 'first-order-decay',
    name: 'Descomposición de primer orden',
    overall: 'A → P',
    species: ['A', 'P'],
    steps: [{
      id: 'r1', reactants: { A: 1 }, products: { P: 1 },
      A: 1e13, Ea: 80000, elementary: true,
      description: 'Descomposición unimolecular. La semivida no depende de la concentración inicial.',
    }],
    notes: ['El caso de referencia: ln[A] frente a t es una recta y t½ = ln2/k es constante.'],
  },
  {
    id: 'second-order',
    name: 'Reacción bimolecular de segundo orden',
    overall: 'A + B → P',
    species: ['A', 'B', 'P'],
    steps: [{
      id: 'r1', reactants: { A: 1, B: 1 }, products: { P: 1 },
      A: 1e11, Ea: 50000, elementary: true,
    }],
    notes: ['Con [A]₀ = [B]₀ la ley integrada se reduce a 1/[A] = 1/[A]₀ + kt.'],
  },
  {
    id: 'reversible',
    name: 'Reacción reversible A ⇌ B',
    overall: 'A ⇌ B',
    species: ['A', 'B'],
    steps: [{
      id: 'r1', reactants: { A: 1 }, products: { B: 1 },
      A: 1e12, Ea: 60000, elementary: true,
      reverse: { A: 1e12, Ea: 75000 },
      description: 'El sistema evoluciona hacia el equilibrio, no hacia el consumo total.',
    }],
    notes: [
      'La constante de equilibrio sale de la cinética: K = k_directa/k_inversa.',
      'La relajación hacia el equilibrio es exponencial con constante (k_d + k_i).',
    ],
  },
  {
    id: 'consecutive',
    name: 'Reacciones consecutivas A → B → C',
    overall: 'A → B → C',
    species: ['A', 'B', 'C'],
    steps: [
      { id: 'r1', reactants: { A: 1 }, products: { B: 1 }, A: 1e13, Ea: 75000, elementary: true },
      { id: 'r2', reactants: { B: 1 }, products: { C: 1 }, A: 1e13, Ea: 85000, elementary: true },
    ],
    steadyState: ['B'],
    notes: [
      'El intermedio B pasa por un máximo: es el ejemplo con el que se justifica la aproximación del estado estacionario.',
      'La aproximación sólo es válida cuando k₂ ≫ k₁; el simulador permite comprobar cuándo deja de serlo.',
    ],
  },
  {
    id: 'michaelis-menten',
    name: 'Cinética enzimática de Michaelis–Menten',
    overall: 'S + E ⇌ ES → P + E',
    species: ['S', 'E', 'ES', 'P'],
    steps: [
      {
        id: 'binding', reactants: { S: 1, E: 1 }, products: { ES: 1 },
        A: 1e8, Ea: 10000, elementary: true,
        reverse: { A: 1e6, Ea: 20000 },
      },
      {
        id: 'catalysis', reactants: { ES: 1 }, products: { P: 1, E: 1 },
        A: 1e7, Ea: 40000, elementary: true,
      },
    ],
    steadyState: ['ES'],
    notes: [
      'K_M = (k₋₁ + k₂)/k₁ sale de aplicar el estado estacionario al complejo ES.',
      'A [S] ≫ K_M la velocidad se satura en V_max = k₂·[E]₀: orden cero en sustrato.',
    ],
  },
  {
    id: 'autocatalytic',
    name: 'Reacción autocatalítica A + P → 2 P',
    overall: 'A + P → 2 P',
    species: ['A', 'P'],
    steps: [{
      id: 'r1', reactants: { A: 1, P: 1 }, products: { P: 2 },
      A: 1e10, Ea: 45000, elementary: true,
    }],
    notes: [
      'La curva es sigmoidal: lenta al principio por falta de producto, luego acelerada.',
      'Explica el periodo de inducción de la valoración de oxalato con permanganato, catalizada por el Mn²⁺ que ella misma produce.',
    ],
  },
];

export const mechanismById = (id: string): Mechanism | undefined =>
  MECHANISMS.find((m) => m.id === id);

/**
 * Analytical Michaelis–Menten rate, for comparison against the full
 * integration of the mechanism. Seeing where they diverge is the lesson.
 */
export function michaelisMenten(S: number, Vmax: number, Km: number): number {
  return (Vmax * S) / (Km + S);
}

/** Lineweaver–Burk linearisation, 1/v against 1/[S]. */
export function lineweaverBurk(S: number[], v: number[]): { fit: LinearFit; Vmax: number; Km: number } {
  const x = S.map((s) => 1 / s);
  const y = v.map((r) => 1 / r);
  const fit = linearRegression(x, y);
  const Vmax = 1 / fit.intercept;
  return { fit, Vmax, Km: fit.slope * Vmax };
}
