/**
 * Statistics, regression and chemometric primitives.
 *
 * Everything an analytical chemistry / quimiometría course needs to treat real
 * experimental data: descriptive statistics, hypothesis tests, weighted and
 * unweighted regression with parameter uncertainties, calibration inverse
 * prediction with its confidence band, outlier tests, and PCA.
 */

import { jacobiEigen, lstsq, matMul, transpose, type Mat, type Vec } from './linalg.js';

// ---------------------------------------------------------------------------
// Descriptive
// ---------------------------------------------------------------------------

export interface Descriptive {
  n: number;
  mean: number;
  /** Sample standard deviation (n − 1). */
  sd: number;
  /** Standard error of the mean. */
  sem: number;
  /** Relative standard deviation, %. */
  rsd: number;
  min: number;
  max: number;
  range: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  variance: number;
  skewness: number;
  kurtosis: number;
}

export function describe(xs: number[]): Descriptive {
  const v = xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) {
    const nan = NaN;
    return { n: 0, mean: nan, sd: nan, sem: nan, rsd: nan, min: nan, max: nan, range: nan,
      median: nan, q1: nan, q3: nan, iqr: nan, variance: nan, skewness: nan, kurtosis: nan };
  }
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const m3 = v.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
  const m4 = v.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
  const sdPop = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

  return {
    n, mean, sd, variance,
    sem: n > 0 ? sd / Math.sqrt(n) : NaN,
    rsd: mean !== 0 ? (sd / Math.abs(mean)) * 100 : NaN,
    min: v[0], max: v[n - 1], range: v[n - 1] - v[0],
    median: quantile(v, 0.5), q1: quantile(v, 0.25), q3: quantile(v, 0.75),
    iqr: quantile(v, 0.75) - quantile(v, 0.25),
    skewness: sdPop > 0 ? m3 / sdPop ** 3 : NaN,
    kurtosis: sdPop > 0 ? m4 / sdPop ** 4 - 3 : NaN,
  };
}

/** Linear-interpolation quantile of a pre-sorted array. */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

export function covariance(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const mx = mean(xs), my = mean(ys);
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (n - 1);
}

export function correlation(xs: number[], ys: number[]): number {
  const sx = Math.sqrt(covariance(xs, xs));
  const sy = Math.sqrt(covariance(ys, ys));
  return sx > 0 && sy > 0 ? covariance(xs, ys) / (sx * sy) : NaN;
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

/** Lanczos approximation of ln Γ(x). */
export function lnGamma(x: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < g.length; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularised incomplete beta function I_x(a, b), by continued fraction. */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 250; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0) numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));

    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-12) break;
  }
  const val = front * (f - 1);
  return x < (a + 1) / (a + b + 2) ? val : 1 - incompleteBetaComplement(x, a, b);
}

function incompleteBetaComplement(x: number, a: number, b: number): number {
  // I_x(a,b) = 1 − I_{1−x}(b,a); recompute on the convergent side.
  const y = 1 - x;
  const lbeta = lnGamma(b) + lnGamma(a) - lnGamma(a + b);
  const front = Math.exp(Math.log(y) * b + Math.log(1 - y) * a - lbeta) / b;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 250; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0) numerator = (m * (a - m) * y) / ((b + 2 * m - 1) * (b + 2 * m));
    else numerator = -((b + m) * (b + a + m) * y) / ((b + 2 * m) * (b + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-12) break;
  }
  return front * (f - 1);
}

/** Two-tailed p-value of Student's t with ν degrees of freedom. */
export function tPValue(t: number, df: number): number {
  if (df <= 0) return NaN;
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Abramowitz–Stegun 7.1.26 error function, |ε| < 1.5·10⁻⁷. */
export function erf(x: number): number {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Two-tailed Student t critical value, by bisection on the p-value.
 * Preferred over a hard-coded table so any ν and any confidence level work.
 */
export function tCritical(confidence: number, df: number): number {
  if (df <= 0) return NaN;
  const targetP = 1 - confidence;
  let lo = 0, hi = 200;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tPValue(mid, df) > targetP) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Hypothesis tests
// ---------------------------------------------------------------------------

export interface TestResult {
  statistic: number;
  df: number;
  p: number;
  /** Reject H₀ at the given α? */
  reject: boolean;
  alpha: number;
  interpretation: string;
}

/** One-sample t-test against an accepted (reference) value. */
export function tTestOneSample(xs: number[], mu0: number, alpha = 0.05): TestResult {
  const d = describe(xs);
  const t = (d.mean - mu0) / d.sem;
  const df = d.n - 1;
  const p = tPValue(t, df);
  return {
    statistic: t, df, p, alpha, reject: p < alpha,
    interpretation: p < alpha
      ? `La media difiere significativamente del valor de referencia (p = ${p.toExponential(2)}).`
      : `No hay evidencia de diferencia con el valor de referencia (p = ${p.toFixed(3)}).`,
  };
}

/** Two-sample t-test; Welch's correction by default (unequal variances). */
export function tTestTwoSample(a: number[], b: number[], alpha = 0.05, pooled = false): TestResult {
  const da = describe(a);
  const db = describe(b);
  let t: number;
  let df: number;
  if (pooled) {
    const sp2 = ((da.n - 1) * da.variance + (db.n - 1) * db.variance) / (da.n + db.n - 2);
    t = (da.mean - db.mean) / Math.sqrt(sp2 * (1 / da.n + 1 / db.n));
    df = da.n + db.n - 2;
  } else {
    const va = da.variance / da.n;
    const vb = db.variance / db.n;
    t = (da.mean - db.mean) / Math.sqrt(va + vb);
    df = (va + vb) ** 2 / (va ** 2 / (da.n - 1) + vb ** 2 / (db.n - 1));
  }
  const p = tPValue(t, df);
  return {
    statistic: t, df, p, alpha, reject: p < alpha,
    interpretation: p < alpha
      ? `Las medias de los dos conjuntos son significativamente distintas (p = ${p.toExponential(2)}).`
      : `Los dos conjuntos son compatibles (p = ${p.toFixed(3)}).`,
  };
}

/** F-test comparing two variances (precision comparison of two methods). */
export function fTest(a: number[], b: number[], alpha = 0.05): TestResult {
  const da = describe(a);
  const db = describe(b);
  const hi = Math.max(da.variance, db.variance);
  const lo = Math.min(da.variance, db.variance);
  const F = hi / lo;
  const df1 = (da.variance >= db.variance ? da.n : db.n) - 1;
  const df2 = (da.variance >= db.variance ? db.n : da.n) - 1;
  const x = df2 / (df2 + df1 * F);
  const p = 2 * incompleteBeta(x, df2 / 2, df1 / 2);
  const pClamped = Math.min(1, Math.max(0, p));
  return {
    statistic: F, df: df1, p: pClamped, alpha, reject: pClamped < alpha,
    interpretation: pClamped < alpha
      ? 'Las precisiones difieren significativamente.'
      : 'No hay evidencia de diferencia de precisión.',
  };
}

/**
 * Grubbs test for a single outlier — the standard rejection criterion in an
 * analytical laboratory. Returns the suspect index or −1.
 */
export function grubbs(xs: number[], alpha = 0.05): { index: number; G: number; Gcrit: number; reject: boolean } {
  const d = describe(xs);
  let index = -1;
  let G = 0;
  xs.forEach((x, i) => {
    const g = Math.abs(x - d.mean) / d.sd;
    if (g > G) { G = g; index = i; }
  });
  const n = d.n;
  const tcrit = tCritical(1 - alpha / n, n - 2);
  const Gcrit = ((n - 1) / Math.sqrt(n)) * Math.sqrt(tcrit ** 2 / (n - 2 + tcrit ** 2));
  return { index, G, Gcrit, reject: G > Gcrit };
}

/** Dixon's Q test — used for very small data sets (3 ≤ n ≤ 10). */
export function dixonQ(xs: number[]): { Q: number; suspect: number; n: number } {
  const v = xs.slice().sort((a, b) => a - b);
  const n = v.length;
  if (n < 3) return { Q: NaN, suspect: NaN, n };
  const range = v[n - 1] - v[0];
  const qLow = (v[1] - v[0]) / range;
  const qHigh = (v[n - 1] - v[n - 2]) / range;
  return qHigh >= qLow
    ? { Q: qHigh, suspect: v[n - 1], n }
    : { Q: qLow, suspect: v[0], n };
}

// ---------------------------------------------------------------------------
// Regression
// ---------------------------------------------------------------------------

export interface LinearFit {
  slope: number;
  intercept: number;
  /** Standard errors of slope and intercept. */
  seSlope: number;
  seIntercept: number;
  /** Residual standard deviation, s_{y/x}. */
  sy: number;
  r: number;
  r2: number;
  n: number;
  df: number;
  residuals: number[];
  xMean: number;
  sxx: number;
  /** Weights actually used (all 1 for OLS). */
  weights: number[];
  predict(x: number): number;
  /** Confidence half-width of the fitted line at x. */
  confidence(x: number, level?: number): number;
  /** Prediction half-width for a single future observation at x. */
  prediction(x: number, level?: number): number;
}

/**
 * Weighted linear least squares y = a + b·x.
 *
 * Weights default to 1. In analytical calibration the correct choice is often
 * w_i = 1/s_i², which this supports directly — that difference is exactly the
 * point of a Quimiometría course.
 */
export function linearRegression(xs: number[], ys: number[], weights?: number[]): LinearFit {
  const n = Math.min(xs.length, ys.length);
  const w = weights ? weights.slice(0, n) : new Array(n).fill(1);
  const sw = w.reduce((a, b) => a + b, 0);
  const xm = xs.slice(0, n).reduce((a, b, i) => a + w[i] * b, 0) / sw;
  const ym = ys.slice(0, n).reduce((a, b, i) => a + w[i] * b, 0) / sw;

  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xm;
    const dy = ys[i] - ym;
    sxx += w[i] * dx * dx;
    sxy += w[i] * dx * dy;
    syy += w[i] * dy * dy;
  }
  const slope = sxy / sxx;
  const intercept = ym - slope * xm;

  const residuals: number[] = [];
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i] - (intercept + slope * xs[i]);
    residuals.push(r);
    ssr += w[i] * r * r;
  }
  const df = n - 2;
  const sy = df > 0 ? Math.sqrt(ssr / df) : NaN;
  const seSlope = sy / Math.sqrt(sxx);
  const seIntercept = sy * Math.sqrt(1 / sw + (xm * xm) / sxx);
  const r = sxy / Math.sqrt(sxx * syy);

  return {
    slope, intercept, seSlope, seIntercept, sy,
    r, r2: r * r, n, df, residuals, xMean: xm, sxx, weights: w,
    predict: (x: number) => intercept + slope * x,
    confidence(x: number, level = 0.95) {
      const t = tCritical(level, df);
      return t * sy * Math.sqrt(1 / sw + (x - xm) ** 2 / sxx);
    },
    prediction(x: number, level = 0.95) {
      const t = tCritical(level, df);
      return t * sy * Math.sqrt(1 + 1 / sw + (x - xm) ** 2 / sxx);
    },
  };
}

/**
 * Inverse prediction from a calibration line: given a measured signal, return
 * the concentration and its uncertainty. This is the equation students are
 * asked to derive in Química Analítica II.
 *
 *   s_x0 = (s_{y/x} / b) · √(1/m + 1/n + (ȳ₀ − ȳ)² / (b²·S_xx))
 */
export interface InversePrediction {
  x: number;
  /** Standard uncertainty of x. */
  u: number;
  /** Half-width of the confidence interval at `level`. */
  ci: number;
  replicates: number;
  withinRange: boolean;
}

export function inversePredict(
  fit: LinearFit, signal: number, replicates = 1, level = 0.95,
  range?: [number, number],
): InversePrediction {
  const x = (signal - fit.intercept) / fit.slope;
  const sw = fit.weights.reduce((a, b) => a + b, 0);
  const ybar = fit.intercept + fit.slope * fit.xMean;
  const u = (fit.sy / Math.abs(fit.slope)) * Math.sqrt(
    1 / replicates + 1 / sw + (signal - ybar) ** 2 / (fit.slope ** 2 * fit.sxx),
  );
  const t = tCritical(level, fit.df);
  return {
    x, u, ci: t * u, replicates,
    withinRange: range ? x >= range[0] && x <= range[1] : true,
  };
}

/** IUPAC limit of detection / quantitation from a calibration line. */
export function detectionLimits(fit: LinearFit): { lod: number; loq: number; sBlank: number } {
  const sBlank = fit.sy;
  return {
    sBlank,
    lod: (3.3 * sBlank) / Math.abs(fit.slope),
    loq: (10 * sBlank) / Math.abs(fit.slope),
  };
}

/** Polynomial least squares of the given degree. Returns coefficients a₀…a_d. */
export function polyFit(xs: number[], ys: number[], degree: number): number[] {
  const A: Mat = xs.map((x) => Array.from({ length: degree + 1 }, (_, j) => Math.pow(x, j)));
  return lstsq(A, ys);
}

export const polyEval = (coeffs: number[], x: number): number =>
  coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);

/**
 * Levenberg–Marquardt nonlinear least squares.
 * Used for kinetic fits, peak deconvolution and titration-curve fitting.
 */
export interface NonlinearFit {
  params: number[];
  residuals: number[];
  ssr: number;
  /** Standard errors of the parameters. */
  se: number[];
  iterations: number;
  converged: boolean;
  r2: number;
}

export function levenbergMarquardt(
  model: (x: number, p: number[]) => number,
  xs: number[], ys: number[], p0: number[],
  opts: { maxIter?: number; tol?: number; lambda0?: number } = {},
): NonlinearFit {
  const maxIter = opts.maxIter ?? 200;
  const tol = opts.tol ?? 1e-12;
  let lambda = opts.lambda0 ?? 1e-3;
  let p = p0.slice();
  const n = xs.length;
  const m = p.length;

  const resid = (pp: number[]): number[] => xs.map((x, i) => ys[i] - model(x, pp));
  const ssrOf = (r: number[]): number => r.reduce((a, b) => a + b * b, 0);

  let r = resid(p);
  let ssr = ssrOf(r);
  let converged = false;
  let it = 0;

  for (; it < maxIter; it++) {
    // Jacobian of the residuals with respect to the parameters.
    const J: Mat = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let j = 0; j < m; j++) {
      const h = Math.max(Math.abs(p[j]) * 1e-6, 1e-9);
      const pp = p.slice();
      pp[j] += h;
      for (let i = 0; i < n; i++) J[i][j] = -(model(xs[i], pp) - model(xs[i], p)) / h;
    }
    const Jt = transpose(J);
    const JtJ = matMul(Jt, J);
    const Jtr: number[] = Jt.map((row) => row.reduce((s, v, i) => s + v * r[i], 0));

    let improved = false;
    for (let k = 0; k < 30; k++) {
      const A = JtJ.map((row, i) => row.map((v, j) => (i === j ? v * (1 + lambda) : v)));
      let dp: number[];
      try { dp = lstsq(A, Jtr.map((v) => -v)); } catch { break; }
      const pTry = p.map((v, i) => v + dp[i]);
      const rTry = resid(pTry);
      const ssrTry = ssrOf(rTry);
      if (Number.isFinite(ssrTry) && ssrTry < ssr) {
        const rel = (ssr - ssrTry) / Math.max(ssr, 1e-300);
        p = pTry; r = rTry; ssr = ssrTry;
        lambda = Math.max(lambda / 10, 1e-12);
        improved = true;
        if (rel < tol) converged = true;
        break;
      }
      lambda = Math.min(lambda * 10, 1e12);
    }
    if (!improved || converged) { converged = converged || !improved; break; }
  }

  // Parameter standard errors from the covariance matrix σ²·(JᵀJ)⁻¹.
  const df = Math.max(n - m, 1);
  const s2 = ssr / df;
  const se = new Array(m).fill(NaN);
  try {
    const J: Mat = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let j = 0; j < m; j++) {
      const h = Math.max(Math.abs(p[j]) * 1e-6, 1e-9);
      const pp = p.slice(); pp[j] += h;
      for (let i = 0; i < n; i++) J[i][j] = (model(xs[i], pp) - model(xs[i], p)) / h;
    }
    const JtJ = matMul(transpose(J), J);
    const { values, vectors } = jacobiEigen(JtJ);
    // Pseudo-inverse via eigendecomposition, guarding tiny eigenvalues.
    for (let i = 0; i < m; i++) {
      let v = 0;
      for (let k = 0; k < m; k++) {
        if (Math.abs(values[k]) > 1e-14) v += (vectors[i][k] ** 2) / values[k];
      }
      se[i] = Math.sqrt(Math.max(v * s2, 0));
    }
  } catch { /* leave SEs as NaN when the design is degenerate */ }

  const ym = mean(ys);
  const sst = ys.reduce((a, b) => a + (b - ym) ** 2, 0);
  return { params: p, residuals: r, ssr, se, iterations: it, converged, r2: sst > 0 ? 1 - ssr / sst : NaN };
}

// ---------------------------------------------------------------------------
// Multivariate — PCA
// ---------------------------------------------------------------------------

export interface PCAResult {
  /** Column means removed before decomposition. */
  center: number[];
  /** Column scaling applied (1 when not autoscaled). */
  scale: number[];
  /** Eigenvalues of the covariance matrix, descending. */
  eigenvalues: number[];
  /** Loadings: loadings[variable][component]. */
  loadings: Mat;
  /** Scores: scores[sample][component]. */
  scores: Mat;
  /** Fraction of total variance per component. */
  explained: number[];
  cumulative: number[];
}

/**
 * Principal component analysis by eigendecomposition of the covariance matrix.
 * `autoscale` divides each column by its standard deviation — mandatory when
 * variables carry different units, which in a chemometric data set they do.
 */
export function pca(X: Mat, opts: { autoscale?: boolean; components?: number } = {}): PCAResult {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const center = new Array(p).fill(0);
  for (let j = 0; j < p; j++) center[j] = X.reduce((s, row) => s + row[j], 0) / n;

  const scale = new Array(p).fill(1);
  if (opts.autoscale) {
    for (let j = 0; j < p; j++) {
      const v = X.reduce((s, row) => s + (row[j] - center[j]) ** 2, 0) / Math.max(n - 1, 1);
      scale[j] = Math.sqrt(v) || 1;
    }
  }

  const Z: Mat = X.map((row) => row.map((v, j) => (v - center[j]) / scale[j]));
  const cov: Mat = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += Z[k][i] * Z[k][j];
      const c = s / Math.max(n - 1, 1);
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }

  const { values, vectors } = jacobiEigen(cov);
  const k = Math.min(opts.components ?? p, p);
  const total = values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;

  const loadings: Mat = Array.from({ length: p }, (_, i) =>
    Array.from({ length: k }, (_, c) => vectors[i][c]));
  const scores: Mat = Z.map((row) =>
    Array.from({ length: k }, (_, c) => row.reduce((s, v, i) => s + v * vectors[i][c], 0)));

  const explained = values.slice(0, k).map((v) => Math.max(v, 0) / total);
  const cumulative: number[] = [];
  explained.reduce((acc, v) => { const s = acc + v; cumulative.push(s); return s; }, 0);

  return { center, scale, eigenvalues: values.slice(0, k), loadings, scores, explained, cumulative };
}

/** Euclidean distance — used by the nearest-neighbour classifier in §54. */
export const distance = (a: Vec, b: Vec): number =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

/**
 * k-nearest-neighbour classification over a labelled training set.
 * Deliberately the simplest defensible classifier: the teaching point is the
 * data pre-treatment, not the algorithm.
 */
export function knnClassify(train: Mat, labels: string[], sample: Vec, k = 3): { label: string; votes: Record<string, number>; confidence: number } {
  const ds = train.map((row, i) => ({ d: distance(row, sample), label: labels[i] }));
  ds.sort((a, b) => a.d - b.d);
  const votes: Record<string, number> = {};
  ds.slice(0, k).forEach((e) => { votes[e.label] = (votes[e.label] ?? 0) + 1; });
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return { label: best?.[0] ?? '', votes, confidence: best ? best[1] / k : 0 };
}
