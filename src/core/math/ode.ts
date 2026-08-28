/**
 * Ordinary differential equation integration.
 *
 * §12 of the specification: chemical kinetics must produce a real ODE that the
 * student can inspect and study, not an animation. Every kinetic curve, every
 * reactor transient and every heating profile in CHEMIA comes out of these
 * integrators.
 *
 * Two schemes are provided:
 *  - RKF45 (Runge–Kutta–Fehlberg) with adaptive steps for the general case.
 *  - A semi-implicit Rosenbrock step for stiff systems, which chemical
 *    mechanisms with a fast pre-equilibrium always are.
 */

import { solveSafe, type Mat, type Vec } from './linalg.js';

export type Derivative = (t: number, y: Vec) => Vec;

export interface ODEOptions {
  /** Initial step size. */
  h0?: number;
  hMin?: number;
  hMax?: number;
  /** Absolute and relative error tolerances per component. */
  atol?: number;
  rtol?: number;
  /** Sampling grid: when given, output is interpolated onto these times. */
  tEval?: number[];
  /** Maximum internal steps before giving up. */
  maxSteps?: number;
  /** Clamp all components to ≥ 0 — concentrations cannot go negative. */
  nonNegative?: boolean;
  /** Stop early when this returns true. */
  stop?: (t: number, y: Vec) => boolean;
}

export interface ODESolution {
  t: number[];
  /** y[i] is the state vector at t[i]. */
  y: Vec[];
  steps: number;
  rejected: number;
  success: boolean;
  message?: string;
}

/** Extract one component's trajectory from a solution. */
export const component = (sol: ODESolution, i: number): number[] => sol.y.map((v) => v[i]);

// --- Cash–Karp coefficients for the embedded 4(5) pair ----------------------
const A2 = 1 / 5, A3 = 3 / 10, A4 = 3 / 5, A5 = 1, A6 = 7 / 8;
const B21 = 1 / 5;
const B31 = 3 / 40, B32 = 9 / 40;
const B41 = 3 / 10, B42 = -9 / 10, B43 = 6 / 5;
const B51 = -11 / 54, B52 = 5 / 2, B53 = -70 / 27, B54 = 35 / 27;
const B61 = 1631 / 55296, B62 = 175 / 512, B63 = 575 / 13824, B64 = 44275 / 110592, B65 = 253 / 4096;
const C1 = 37 / 378, C3 = 250 / 621, C4 = 125 / 594, C6 = 512 / 1771;
const D1 = 2825 / 27648, D3 = 18575 / 48384, D4 = 13525 / 55296, D5 = 277 / 14336, D6 = 1 / 4;

/**
 * Adaptive Cash–Karp Runge–Kutta integration of dy/dt = f(t, y) from t0 to t1.
 */
export function integrate(f: Derivative, y0: Vec, t0: number, t1: number, opts: ODEOptions = {}): ODESolution {
  const atol = opts.atol ?? 1e-10;
  const rtol = opts.rtol ?? 1e-7;
  const maxSteps = opts.maxSteps ?? 200000;
  const span = t1 - t0;
  let h = opts.h0 ?? span / 500;
  const hMax = opts.hMax ?? Math.abs(span) / 4;
  const hMin = opts.hMin ?? Math.abs(span) * 1e-12;

  const tEval = opts.tEval;
  const outT: number[] = [];
  const outY: Vec[] = [];

  let t = t0;
  let y = y0.slice();
  let evalIdx = 0;

  const record = (tt: number, yy: Vec): void => { outT.push(tt); outY.push(yy.slice()); };

  if (tEval) {
    while (evalIdx < tEval.length && tEval[evalIdx] <= t0 + 1e-15) {
      record(tEval[evalIdx], y);
      evalIdx++;
    }
  } else {
    record(t, y);
  }

  let steps = 0;
  let rejected = 0;

  while (t < t1 - 1e-15 && steps < maxSteps) {
    // Land exactly on each requested output time rather than interpolating to
    // it. Cubic Hermite dense output is only third-order accurate, so on a
    // coarse adaptive step it becomes the dominant error — which shows up as a
    // kinetic curve that is visibly wrong at the sampled points while the
    // integrator reports success. Stepping onto the point costs a little
    // efficiency and buys the integrator's full order.
    const nextOut = tEval && evalIdx < tEval.length ? tEval[evalIdx] : t1;
    const target = Math.min(t1, nextOut);
    if (t + h > target) h = target - t;

    const k1 = f(t, y);
    const k2 = f(t + A2 * h, y.map((v, i) => v + h * B21 * k1[i]));
    const k3 = f(t + A3 * h, y.map((v, i) => v + h * (B31 * k1[i] + B32 * k2[i])));
    const k4 = f(t + A4 * h, y.map((v, i) => v + h * (B41 * k1[i] + B42 * k2[i] + B43 * k3[i])));
    const k5 = f(t + A5 * h, y.map((v, i) => v + h * (B51 * k1[i] + B52 * k2[i] + B53 * k3[i] + B54 * k4[i])));
    const k6 = f(t + A6 * h, y.map((v, i) => v + h * (B61 * k1[i] + B62 * k2[i] + B63 * k3[i] + B64 * k4[i] + B65 * k5[i])));

    const y5 = y.map((v, i) => v + h * (C1 * k1[i] + C3 * k3[i] + C4 * k4[i] + C6 * k6[i]));
    const y4 = y.map((v, i) => v + h * (D1 * k1[i] + D3 * k3[i] + D4 * k4[i] + D5 * k5[i] + D6 * k6[i]));

    let err = 0;
    for (let i = 0; i < y.length; i++) {
      const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i]));
      const e = Math.abs(y5[i] - y4[i]) / sc;
      if (Number.isFinite(e)) err = Math.max(err, e);
      else err = Infinity;
    }

    if (err <= 1 || h <= hMin * 1.0001) {
      const tNew = t + h;
      let yNew = y5;
      if (opts.nonNegative) yNew = yNew.map((v) => (v < 0 ? 0 : v));

      if (tEval) {
        let fEnd: Vec | null = null;
        while (evalIdx < tEval.length && tEval[evalIdx] <= tNew + Math.abs(tNew) * 1e-12 + 1e-15) {
          const te = tEval[evalIdx];
          if (Math.abs(te - tNew) <= Math.abs(tNew) * 1e-12 + 1e-15) {
            record(te, yNew);                       // landed on it exactly
          } else {
            // A point inside the step (possible when several outputs are
            // closer together than hMin) still needs interpolation.
            fEnd ??= f(tNew, yNew);
            record(te, hermite(y, k1, yNew, fEnd, h, h === 0 ? 0 : (te - t) / h));
          }
          evalIdx++;
        }
      } else {
        record(tNew, yNew);
      }

      t = tNew;
      y = yNew;
      steps++;

      if (opts.stop?.(t, y)) {
        return { t: outT, y: outY, steps, rejected, success: true, message: 'detenido por condición de parada' };
      }
    } else {
      rejected++;
    }

    // PI-free classical step control with safety factor.
    const factor = err === 0 ? 4 : 0.9 * Math.pow(err, -0.2);
    h *= Math.min(4, Math.max(0.1, factor));
    h = Math.min(Math.abs(h), hMax);
    if (h < hMin) h = hMin;
  }

  const success = t >= t1 - 1e-9;
  return {
    t: outT, y: outY, steps, rejected, success,
    message: success ? undefined : 'no se alcanzó el tiempo final (sistema posiblemente rígido)',
  };
}

function hermite(y0: Vec, f0: Vec, y1: Vec, f1: Vec, h: number, th: number): Vec {
  const t2 = th * th;
  const t3 = t2 * th;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + th;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return y0.map((v, i) => h00 * v + h10 * h * f0[i] + h01 * y1[i] + h11 * h * f1[i]);
}

/**
 * Fixed-step classical RK4. Used where a deterministic, evenly-sampled
 * trajectory matters more than error control (real-time process animation).
 */
export function rk4(f: Derivative, y0: Vec, t0: number, t1: number, steps: number): ODESolution {
  const h = (t1 - t0) / steps;
  let y = y0.slice();
  let t = t0;
  const outT = [t];
  const outY = [y.slice()];

  for (let s = 0; s < steps; s++) {
    const k1 = f(t, y);
    const k2 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k1[i]));
    const k3 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k2[i]));
    const k4 = f(t + h, y.map((v, i) => v + h * k3[i]));
    y = y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += h;
    outT.push(t);
    outY.push(y.slice());
  }
  return { t: outT, y: outY, steps, rejected: 0, success: true };
}

/**
 * One semi-implicit Euler (Rosenbrock-like) step for stiff systems:
 *
 *   (I − h·J)·Δy = h·f(t, y)
 *
 * Stable for the fast modes that make an equilibrium-limited mechanism stiff.
 */
export function stiffStep(f: Derivative, t: number, y: Vec, h: number): Vec {
  const n = y.length;
  const f0 = f(t, y);
  const J: Mat = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    const hh = Math.max(Math.abs(y[j]) * 1e-7, 1e-12);
    const yp = y.slice();
    yp[j] += hh;
    const fp = f(t, yp);
    for (let i = 0; i < n; i++) J[i][j] = (fp[i] - f0[i]) / hh;
  }
  const A: Mat = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) - h * J[i][j]));
  const dy = solveSafe(A, f0.map((v) => h * v));
  return y.map((v, i) => v + dy[i]);
}

/** Integrate a stiff system with fixed semi-implicit steps. */
export function integrateStiff(
  f: Derivative, y0: Vec, t0: number, t1: number,
  opts: { steps?: number; nonNegative?: boolean } = {},
): ODESolution {
  const steps = opts.steps ?? 2000;
  const h = (t1 - t0) / steps;
  let y = y0.slice();
  let t = t0;
  const outT = [t];
  const outY = [y.slice()];
  for (let s = 0; s < steps; s++) {
    y = stiffStep(f, t, y, h);
    if (opts.nonNegative) y = y.map((v) => (v < 0 ? 0 : v));
    t += h;
    outT.push(t);
    outY.push(y.slice());
  }
  return { t: outT, y: outY, steps, rejected: 0, success: true };
}
