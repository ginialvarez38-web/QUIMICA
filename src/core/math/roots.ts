/**
 * Root finding — scalar and multidimensional.
 *
 * The aqueous equilibrium solver lives or dies on these routines: a charge
 * balance in a polyprotic system is a badly-scaled nonlinear equation whose
 * unknown spans twenty decades, so bracketing-with-fallback is not optional.
 */

export interface RootResult {
  root: number;
  iterations: number;
  converged: boolean;
  residual: number;
}

/** Bisection — slow but unconditionally convergent inside a sign-change bracket. */
export function bisect(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-12,
  maxIter = 200,
): RootResult {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return { root: a, iterations: 0, converged: true, residual: 0 };
  if (fb === 0) return { root: b, iterations: 0, converged: true, residual: 0 };
  if (fa * fb > 0) return { root: NaN, iterations: 0, converged: false, residual: NaN };

  let lo = a, hi = b, mid = a, fm = fa;
  for (let i = 0; i < maxIter; i++) {
    mid = 0.5 * (lo + hi);
    fm = f(mid);
    if (fm === 0 || (hi - lo) / 2 < tol) {
      return { root: mid, iterations: i + 1, converged: true, residual: fm };
    }
    if (fa * fm < 0) { hi = mid; fb = fm; } else { lo = mid; fa = fm; }
  }
  return { root: mid, iterations: maxIter, converged: false, residual: fm };
}

/**
 * Brent's method — inverse quadratic interpolation with a bisection guarantee.
 * This is the workhorse for single-unknown equilibria.
 */
export function brent(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-14,
  maxIter = 200,
): RootResult {
  let fa = f(a);
  let fb = f(b);
  if (fa * fb > 0) return { root: NaN, iterations: 0, converged: false, residual: NaN };

  if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }

  let c = a, fc = fa, d = b - a, e = d;
  let mflag = true;
  let s = b, fs = fb;

  for (let i = 0; i < maxIter; i++) {
    if (fb === 0 || Math.abs(b - a) < tol) {
      return { root: b, iterations: i, converged: true, residual: fb };
    }
    if (fa !== fc && fb !== fc) {
      s = (a * fb * fc) / ((fa - fb) * (fa - fc))
        + (b * fa * fc) / ((fb - fa) * (fb - fc))
        + (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      s = b - fb * (b - a) / (fb - fa);
    }

    const cond1 = !((s > (3 * a + b) / 4 && s < b) || (s < (3 * a + b) / 4 && s > b));
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tol;
    const cond5 = !mflag && Math.abs(c - d) < tol;

    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    fs = f(s);
    d = c; c = b; fc = fb;
    if (fa * fs < 0) { b = s; fb = fs; } else { a = s; fa = fs; }
    if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
    e = d;
  }
  return { root: b, iterations: maxIter, converged: false, residual: fb };
}

/**
 * Expand outwards from a seed until f changes sign, then Brent it.
 * Chemical unknowns (a free proton concentration, a free ligand) are positive
 * and span many decades, so the search is done in log space.
 */
export function findRootLogSpace(
  f: (x: number) => number,
  seedLog10: number,
  loLog10 = -30,
  hiLog10 = 6,
  tol = 1e-14,
): RootResult {
  const g = (l: number): number => f(Math.pow(10, l));
  let lo = Math.max(seedLog10 - 0.5, loLog10);
  let hi = Math.min(seedLog10 + 0.5, hiLog10);
  let flo = g(lo);
  let fhi = g(hi);

  let guard = 0;
  while (flo * fhi > 0 && guard++ < 200) {
    if (lo > loLog10) { lo = Math.max(lo - 0.5, loLog10); flo = g(lo); }
    if (hi < hiLog10) { hi = Math.min(hi + 0.5, hiLog10); fhi = g(hi); }
    if (lo <= loLog10 && hi >= hiLog10) break;
  }
  if (flo * fhi > 0) {
    return { root: NaN, iterations: guard, converged: false, residual: NaN };
  }
  const r = brent(g, lo, hi, tol);
  return { ...r, root: Math.pow(10, r.root) };
}

/** Newton–Raphson with a numerical derivative and step damping. */
export function newton(
  f: (x: number) => number,
  x0: number,
  opts: { tol?: number; maxIter?: number; df?: (x: number) => number; maxStep?: number } = {},
): RootResult {
  const tol = opts.tol ?? 1e-12;
  const maxIter = opts.maxIter ?? 80;
  const df = opts.df ?? ((x: number) => {
    const h = Math.max(Math.abs(x) * 1e-7, 1e-10);
    return (f(x + h) - f(x - h)) / (2 * h);
  });

  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    if (Math.abs(fx) < tol) return { root: x, iterations: i, converged: true, residual: fx };
    const d = df(x);
    if (!Number.isFinite(d) || d === 0) break;
    let step = fx / d;
    if (opts.maxStep) step = Math.sign(step) * Math.min(Math.abs(step), opts.maxStep);
    const next = x - step;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - x) < tol * (1 + Math.abs(x))) {
      return { root: next, iterations: i + 1, converged: true, residual: f(next) };
    }
    x = next;
  }
  return { root: x, iterations: maxIter, converged: false, residual: f(x) };
}

// ---------------------------------------------------------------------------
// Multidimensional Newton with line search
// ---------------------------------------------------------------------------

import { solveSafe, normInf, type Mat, type Vec } from './linalg.js';

export interface VectorRootResult {
  x: Vec;
  iterations: number;
  converged: boolean;
  residual: number;
}

/**
 * Solve F(x) = 0 for a vector unknown.
 *
 * The Jacobian is built by forward differences unless supplied. A simple
 * backtracking line search on ‖F‖ keeps the iteration from diverging when the
 * initial guess is poor — which it always is for a multi-equilibrium system
 * before the first solve.
 */
export function newtonSystem(
  F: (x: Vec) => Vec,
  x0: Vec,
  opts: { tol?: number; maxIter?: number; jacobian?: (x: Vec) => Mat; bounds?: [Vec, Vec] } = {},
): VectorRootResult {
  const tol = opts.tol ?? 1e-11;
  const maxIter = opts.maxIter ?? 120;
  const n = x0.length;
  let x = x0.slice();

  const numJac = (xv: Vec, Fx: Vec): Mat => {
    const J: Mat = Array.from({ length: Fx.length }, () => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const h = Math.max(Math.abs(xv[j]) * 1e-7, 1e-9);
      const xp = xv.slice();
      xp[j] += h;
      const Fp = F(xp);
      for (let i = 0; i < Fx.length; i++) J[i][j] = (Fp[i] - Fx[i]) / h;
    }
    return J;
  };

  for (let it = 0; it < maxIter; it++) {
    const Fx = F(x);
    const res = normInf(Fx);
    if (!Number.isFinite(res)) break;
    if (res < tol) return { x, iterations: it, converged: true, residual: res };

    const J = opts.jacobian ? opts.jacobian(x) : numJac(x, Fx);
    let dx: Vec;
    try {
      dx = solveSafe(J, Fx.map((v) => -v));
    } catch {
      break;
    }
    if (dx.some((v) => !Number.isFinite(v))) break;

    // Backtracking line search on the infinity norm of the residual.
    let lambda = 1;
    let accepted = false;
    for (let k = 0; k < 30; k++) {
      let trial = x.map((v, i) => v + lambda * dx[i]);
      if (opts.bounds) {
        const [lo, hi] = opts.bounds;
        trial = trial.map((v, i) => Math.min(Math.max(v, lo[i]), hi[i]));
      }
      const ft = normInf(F(trial));
      if (Number.isFinite(ft) && ft < res * (1 - 1e-4 * lambda)) {
        x = trial;
        accepted = true;
        break;
      }
      lambda /= 2;
    }
    if (!accepted) {
      // Take a small damped step anyway to escape a flat region.
      x = x.map((v, i) => v + 1e-3 * dx[i]);
    }
  }
  const finalRes = normInf(F(x));
  return { x, iterations: maxIter, converged: finalRes < tol * 100, residual: finalRes };
}
