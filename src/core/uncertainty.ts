/**
 * Measurement values with uncertainty, and first-order propagation.
 *
 * §33 and §66 of the product specification: CHEMIA must never present an ideal
 * number as a measurement, and must never let a theoretical, simulated,
 * measured and estimated value be confused. Both requirements are enforced by
 * the type: a value that came off an instrument is a `Measurement` with a
 * provenance tag and a standard uncertainty; a value that came out of a model
 * is tagged differently and says so wherever it is displayed.
 *
 * Propagation is the standard first-order (GUM) treatment:
 *
 *   u_c(y)² = Σ (∂f/∂x_i)² u(x_i)²      (independent inputs)
 *
 * plus a covariance term when inputs are declared correlated. That is exactly
 * what an analytical chemistry course teaches, so the student can reproduce
 * every number the platform reports by hand.
 */

/** Where a number came from. Never mixed, never silently promoted (§66). */
export type Provenance =
  /** Exact / definitional / literature value used as ground truth. */
  | 'theoretical'
  /** Output of a CHEMIA simulation model (the "true" value of the sim world). */
  | 'simulated'
  /** What an instrument reported: simulated truth + instrument error model. */
  | 'measured'
  /** Derived by fitting, interpolation or correlation. */
  | 'estimated';

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  theoretical: 'teórico',
  simulated: 'simulado',
  measured: 'medido',
  estimated: 'estimado',
};

export const PROVENANCE_MARK: Record<Provenance, string> = {
  theoretical: '≡',   // definitional identity
  simulated: '∿',     // model output
  measured: '⌀',      // read from an instrument
  estimated: '≈',     // fitted / inferred
};

export interface Measurement {
  /** Best estimate, in the canonical unit of its dimension. */
  readonly value: number;
  /** Standard uncertainty u (1σ, absolute), in the same unit. */
  readonly u: number;
  readonly unit: string;
  readonly provenance: Provenance;
  /** Degrees of freedom, when the uncertainty came from a finite sample. */
  readonly df?: number;
  /** Optional note explaining the uncertainty budget. */
  readonly note?: string;
}

export function meas(
  value: number,
  u: number,
  unit: string,
  provenance: Provenance = 'measured',
  extra: { df?: number; note?: string } = {},
): Measurement {
  return { value, u: Math.abs(u), unit, provenance, ...extra };
}

/** An exact value (uncertainty zero) — definitions, counts, set-points. */
export const exact = (value: number, unit = ''): Measurement =>
  ({ value, u: 0, unit, provenance: 'theoretical' });

/** Output of a simulation: the model's own truth, uncertainty from the model. */
export const simulated = (value: number, unit = '', u = 0): Measurement =>
  ({ value, u, unit, provenance: 'simulated' });

/** Relative standard uncertainty, u/|x|. Returns NaN at x = 0. */
export const relU = (m: Measurement): number => (m.value === 0 ? NaN : m.u / Math.abs(m.value));

/** Expanded uncertainty U = k·u. k = 2 gives ≈95 % coverage for normal data. */
export const expandedU = (m: Measurement, k = 2): number => k * m.u;

// ---------------------------------------------------------------------------
// Propagation
// ---------------------------------------------------------------------------

/**
 * Propagate uncertainty through an arbitrary function of several measurements
 * using central finite differences for the sensitivity coefficients.
 *
 * This is deliberately numerical rather than symbolic: it lets any engine in
 * CHEMIA (equilibrium solver, calibration fit, mass balance) propagate through
 * models that have no closed form, which is the realistic case in a laboratory.
 */
export function propagate(
  f: (xs: number[]) => number,
  inputs: Measurement[],
  opts: { unit?: string; provenance?: Provenance; correlation?: number[][] } = {},
): Measurement {
  const xs = inputs.map((m) => m.value);
  const y = f(xs);

  const sens = inputs.map((m, i) => {
    // Step size: relative where possible, absolute near zero.
    const h = m.u > 0 ? m.u * 1e-2 : Math.max(Math.abs(xs[i]) * 1e-7, 1e-12);
    const up = xs.slice(); up[i] = xs[i] + h;
    const dn = xs.slice(); dn[i] = xs[i] - h;
    const d = (f(up) - f(dn)) / (2 * h);
    return Number.isFinite(d) ? d : 0;
  });

  let varSum = 0;
  for (let i = 0; i < inputs.length; i++) {
    varSum += (sens[i] * inputs[i].u) ** 2;
  }
  const corr = opts.correlation;
  if (corr) {
    for (let i = 0; i < inputs.length; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        const r = corr[i]?.[j] ?? 0;
        if (r !== 0) varSum += 2 * sens[i] * sens[j] * inputs[i].u * inputs[j].u * r;
      }
    }
  }

  // Provenance is contagious in a defined order: a result that touches a
  // measurement is a measurement-derived result, never "theoretical" (§66).
  const rank: Provenance[] = ['theoretical', 'simulated', 'estimated', 'measured'];
  const worst = inputs.reduce<Provenance>(
    (acc, m) => (rank.indexOf(m.provenance) > rank.indexOf(acc) ? m.provenance : acc),
    'theoretical',
  );

  return {
    value: y,
    u: Math.sqrt(Math.max(varSum, 0)),
    unit: opts.unit ?? '',
    provenance: opts.provenance ?? worst,
  };
}

// Closed-form shortcuts for the common arithmetic, kept exact and fast.

export function add(a: Measurement, b: Measurement): Measurement {
  return propagate(([x, y]) => x + y, [a, b], { unit: a.unit });
}
export function sub(a: Measurement, b: Measurement): Measurement {
  return propagate(([x, y]) => x - y, [a, b], { unit: a.unit });
}
export function mul(a: Measurement, b: Measurement, unit = ''): Measurement {
  return propagate(([x, y]) => x * y, [a, b], { unit });
}
export function div(a: Measurement, b: Measurement, unit = ''): Measurement {
  return propagate(([x, y]) => x / y, [a, b], { unit });
}
export function scale(a: Measurement, k: number, unit = a.unit): Measurement {
  return { value: a.value * k, u: a.u * Math.abs(k), unit, provenance: a.provenance };
}

/** −log₁₀(x) with correct propagation: u(pX) = u(x) / (x·ln10). */
export function pFunction(a: Measurement): Measurement {
  return {
    value: -Math.log10(a.value),
    u: a.value > 0 ? a.u / (a.value * Math.LN10) : NaN,
    unit: '',
    provenance: a.provenance,
  };
}

/** Weighted mean of repeated measurements, weights = 1/u². */
export function weightedMean(ms: Measurement[]): Measurement {
  const usable = ms.filter((m) => m.u > 0);
  if (usable.length === 0) {
    const mean = ms.reduce((s, m) => s + m.value, 0) / Math.max(ms.length, 1);
    return { value: mean, u: 0, unit: ms[0]?.unit ?? '', provenance: ms[0]?.provenance ?? 'simulated' };
  }
  let sw = 0;
  let swx = 0;
  for (const m of usable) {
    const w = 1 / (m.u * m.u);
    sw += w;
    swx += w * m.value;
  }
  return {
    value: swx / sw,
    u: Math.sqrt(1 / sw),
    unit: usable[0].unit,
    provenance: usable[0].provenance,
    df: usable.length - 1,
  };
}

/** Mean ± standard error of a plain sample. */
export function sampleMean(values: number[], unit = '', provenance: Provenance = 'measured'): Measurement {
  const n = values.length;
  if (n === 0) return { value: NaN, u: NaN, unit, provenance };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { value: mean, u: NaN, unit, provenance, df: 0 };
  const s2 = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { value: mean, u: Math.sqrt(s2 / n), unit, provenance, df: n - 1 };
}

/**
 * Normalised deviation between two measurements — the standard "are these
 * consistent?" test taught in metrology.
 *
 *   E_n = |x₁ − x₂| / √(U₁² + U₂²),  compatible when E_n ≤ 1
 */
export function enScore(a: Measurement, b: Measurement, k = 2): number {
  const ua = k * a.u;
  const ub = k * b.u;
  const denom = Math.hypot(ua, ub);
  return denom === 0 ? Infinity : Math.abs(a.value - b.value) / denom;
}

/** Relative error against an accepted reference value, in percent. */
export function percentError(measured: number, accepted: number): number {
  return accepted === 0 ? NaN : ((measured - accepted) / accepted) * 100;
}

/** Recovery (%) — the accuracy figure of merit for spiked analyses. */
export function recovery(found: number, added: number): number {
  return added === 0 ? NaN : (found / added) * 100;
}
