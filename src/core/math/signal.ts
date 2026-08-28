/**
 * Signal processing for spectra and chromatograms.
 *
 * Peak shapes, smoothing, baseline correction, peak detection and integration.
 * These are the operations a student performs on real instrument output, so
 * CHEMIA exposes them as tools rather than applying them invisibly.
 */

export interface XY { x: number; y: number }

// ---------------------------------------------------------------------------
// Peak shapes
// ---------------------------------------------------------------------------

/** Gaussian with amplitude A, centre µ and standard deviation σ. */
export const gaussian = (x: number, A: number, mu: number, sigma: number): number =>
  A * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

/** Lorentzian with half-width at half-maximum γ — the natural NMR/IR line shape. */
export const lorentzian = (x: number, A: number, mu: number, gamma: number): number =>
  (A * gamma * gamma) / ((x - mu) ** 2 + gamma * gamma);

/**
 * Pseudo-Voigt: η·Lorentzian + (1 − η)·Gaussian, the standard practical
 * approximation to the true convolution. IR bands are ~Lorentzian, UV-Vis
 * electronic bands closer to Gaussian, so η is the knob that distinguishes them.
 */
export function pseudoVoigt(x: number, A: number, mu: number, fwhm: number, eta: number): number {
  const sigma = fwhm / (2 * Math.sqrt(2 * Math.LN2));
  const gamma = fwhm / 2;
  return eta * lorentzian(x, A, mu, gamma) + (1 - eta) * gaussian(x, A, mu, sigma);
}

/**
 * Exponentially-modified Gaussian — the realistic chromatographic peak.
 * τ is the exponential time constant that produces tailing; τ → 0 recovers a
 * symmetric Gaussian. Column overload and active sites both raise τ.
 */
export function emg(x: number, A: number, mu: number, sigma: number, tau: number): number {
  if (tau <= 1e-9) return gaussian(x, A, mu, sigma);
  const lambda = 1 / tau;
  const z = (lambda / 2) * (2 * mu + lambda * sigma * sigma - 2 * x);
  const arg = (mu + lambda * sigma * sigma - x) / (Math.SQRT2 * sigma);
  // exp(z)·erfc(arg) is computed in log space to avoid overflow for large z.
  const logTerm = z + logErfc(arg);
  return A * (lambda / 2) * Math.exp(logTerm) * sigma * Math.sqrt(2 * Math.PI);
}

/** log(erfc(x)) computed stably for large positive x. */
function logErfc(x: number): number {
  if (x < 3) {
    const v = erfc(x);
    return v > 0 ? Math.log(v) : -745;
  }
  // Asymptotic expansion.
  const x2 = x * x;
  return -x2 - Math.log(x * Math.sqrt(Math.PI)) + Math.log(1 - 1 / (2 * x2) + 3 / (4 * x2 * x2));
}

export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const ans = t * Math.exp(
    -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
      + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587
        + t * (-0.82215223 + t * 0.17087277)))))))),
  );
  return x >= 0 ? ans : 2 - ans;
}

// ---------------------------------------------------------------------------
// Smoothing
// ---------------------------------------------------------------------------

/**
 * Savitzky–Golay smoothing / differentiation.
 * The standard spectroscopic filter: it preserves peak height and width, which
 * a moving average destroys — a point worth demonstrating to students.
 */
export function savitzkyGolay(y: number[], window = 9, order = 2, derivative = 0): number[] {
  const w = window % 2 === 0 ? window + 1 : window;
  const half = (w - 1) / 2;
  if (y.length < w) return y.slice();

  // Build the Vandermonde design over the window and take the pseudo-inverse row.
  const A: number[][] = [];
  for (let i = -half; i <= half; i++) {
    A.push(Array.from({ length: order + 1 }, (_, j) => Math.pow(i, j)));
  }
  const AtA: number[][] = Array.from({ length: order + 1 }, () => new Array(order + 1).fill(0));
  for (let i = 0; i <= order; i++) {
    for (let j = 0; j <= order; j++) {
      let s = 0;
      for (let k = 0; k < w; k++) s += A[k][i] * A[k][j];
      AtA[i][j] = s;
    }
  }
  const inv = invertSmall(AtA);
  const coeffs = new Array(w).fill(0);
  for (let k = 0; k < w; k++) {
    let s = 0;
    for (let j = 0; j <= order; j++) s += inv[derivative][j] * A[k][j];
    coeffs[k] = s;
  }
  const fact = factorial(derivative);

  const out = y.slice();
  for (let i = half; i < y.length - half; i++) {
    let s = 0;
    for (let k = 0; k < w; k++) s += coeffs[k] * y[i - half + k];
    out[i] = s * fact;
  }
  // Edges keep the raw value — honest about the filter's domain.
  return out;
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function invertSmall(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[p], A[c]] = [A[c], A[p]];
    const pivot = A[c][c] || 1e-300;
    for (let j = 0; j < 2 * n; j++) A[c][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((r) => r.slice(n));
}

/** Simple moving average — kept so the two filters can be compared. */
export function movingAverage(y: number[], window = 5): number[] {
  const half = Math.floor(window / 2);
  return y.map((_, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(y.length - 1, i + half); k++) { s += y[k]; n++; }
    return s / n;
  });
}

/**
 * Asymmetric least squares baseline (Eilers & Boelens).
 *
 * Minimises  Σ wᵢ(yᵢ − zᵢ)² + λ Σ (Δ²zᵢ)²  where the weights are asymmetric:
 * points above the current baseline get weight p (≪ 1), points below get
 * 1 − p. Peaks are therefore ignored while the baseline follows the valleys.
 *
 * The normal equations (W + λ·DᵀD)z = W·y form a pentadiagonal system; the
 * five non-zero diagonals of DᵀD are accumulated explicitly and the system is
 * solved by Gauss–Seidel, which converges quickly because the matrix is
 * strictly diagonally dominant for the λ values used in practice.
 *
 * Exposed as a tool rather than applied invisibly: seeing what baseline
 * correction does to a chromatogram is part of the lesson (§38).
 */
export function alsBaseline(y: number[], lambda = 1e5, p = 0.01, iterations = 10): number[] {
  const n = y.length;
  if (n < 5) return y.slice();

  // DᵀD for the second-difference operator D (rows [1, −2, 1]).
  const d0 = new Array(n).fill(0);   // main diagonal
  const d1 = new Array(n).fill(0);   // first off-diagonal, entry (i, i+1)
  const d2 = new Array(n).fill(0);   // second off-diagonal, entry (i, i+2)
  for (let k = 0; k + 2 < n; k++) {
    // Row k of D touches columns k, k+1, k+2 with coefficients 1, −2, 1.
    d0[k] += 1; d0[k + 1] += 4; d0[k + 2] += 1;
    d1[k] += -2; d1[k + 1] += -2;
    d2[k] += 1;
  }

  let w = new Array(n).fill(1);
  let z = y.slice();

  for (let it = 0; it < iterations; it++) {
    for (let sweep = 0; sweep < 80; sweep++) {
      let maxDelta = 0;
      for (let i = 0; i < n; i++) {
        let off = 0;
        if (i >= 2) off += d2[i - 2] * z[i - 2];
        if (i >= 1) off += d1[i - 1] * z[i - 1];
        if (i + 1 < n) off += d1[i] * z[i + 1];
        if (i + 2 < n) off += d2[i] * z[i + 2];
        const diag = w[i] + lambda * d0[i];
        const next = (w[i] * y[i] - lambda * off) / diag;
        maxDelta = Math.max(maxDelta, Math.abs(next - z[i]));
        z[i] = next;
      }
      if (maxDelta < 1e-10) break;
    }
    w = y.map((v, i) => (v > z[i] ? p : 1 - p));
  }
  return z;
}

// ---------------------------------------------------------------------------
// Peak detection and integration
// ---------------------------------------------------------------------------

export interface Peak {
  index: number;
  x: number;
  height: number;
  /** Full width at half maximum, in x units. */
  fwhm: number;
  area: number;
  /** Integration limits actually used. */
  start: number;
  end: number;
  /** Asymmetry at 10 % height (USP tailing factor uses 5 %). */
  asymmetry: number;
  /** Signal-to-noise, height / (3·baseline noise σ). */
  snr: number;
}

export interface PeakDetectOptions {
  /** Minimum height above baseline. */
  minHeight?: number;
  /** Minimum separation in points. */
  minDistance?: number;
  /** Noise σ used for the S/N figure. */
  noise?: number;
  /** Baseline array; a flat zero baseline is assumed when omitted. */
  baseline?: number[];
}

export function detectPeaks(xs: number[], ys: number[], opts: PeakDetectOptions = {}): Peak[] {
  const n = ys.length;
  const base = opts.baseline ?? new Array(n).fill(0);
  const corrected = ys.map((v, i) => v - base[i]);
  const noise = opts.noise ?? estimateNoise(corrected);
  const minHeight = opts.minHeight ?? Math.max(noise * 3, 0);
  const minDistance = opts.minDistance ?? 3;

  const candidates: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (corrected[i] >= corrected[i - 1] && corrected[i] > corrected[i + 1] && corrected[i] >= minHeight) {
      candidates.push(i);
    }
  }

  // Suppress candidates too close to a taller neighbour.
  candidates.sort((a, b) => corrected[b] - corrected[a]);
  const kept: number[] = [];
  for (const c of candidates) {
    if (kept.every((k) => Math.abs(k - c) >= minDistance)) kept.push(c);
  }
  kept.sort((a, b) => a - b);

  return kept.map((i) => {
    const height = corrected[i];
    const halfHeight = height / 2;

    // Walk out to half height for FWHM.
    let l = i;
    while (l > 0 && corrected[l] > halfHeight) l--;
    let r = i;
    while (r < n - 1 && corrected[r] > halfHeight) r++;
    const xl = interpCross(xs, corrected, l, l + 1, halfHeight);
    const xr = interpCross(xs, corrected, r - 1, r, halfHeight);
    const fwhm = Math.abs(xr - xl);

    // Integration limits: walk to the valleys (or to 1 % of height).
    let s = i;
    while (s > 0 && corrected[s] > height * 0.01 && corrected[s - 1] <= corrected[s]) s--;
    let e = i;
    while (e < n - 1 && corrected[e] > height * 0.01 && corrected[e + 1] <= corrected[e]) e++;

    // Asymmetry at 10 % height: (right half-width)/(left half-width).
    const tenth = height * 0.1;
    let l10 = i; while (l10 > 0 && corrected[l10] > tenth) l10--;
    let r10 = i; while (r10 < n - 1 && corrected[r10] > tenth) r10++;
    const a = Math.abs(xs[i] - interpCross(xs, corrected, l10, l10 + 1, tenth));
    const b = Math.abs(interpCross(xs, corrected, r10 - 1, r10, tenth) - xs[i]);

    return {
      index: i,
      x: refinePeakPosition(xs, corrected, i),
      height,
      fwhm,
      area: trapezoid(xs.slice(s, e + 1), corrected.slice(s, e + 1)),
      start: xs[s],
      end: xs[e],
      asymmetry: a > 0 ? b / a : NaN,
      snr: noise > 0 ? height / noise : Infinity,
    };
  });
}

/** Parabolic interpolation through the three points around the apex. */
function refinePeakPosition(xs: number[], ys: number[], i: number): number {
  if (i <= 0 || i >= ys.length - 1) return xs[i];
  const y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
  const denom = y0 - 2 * y1 + y2;
  if (Math.abs(denom) < 1e-300) return xs[i];
  const delta = (0.5 * (y0 - y2)) / denom;
  const dx = (xs[i + 1] - xs[i - 1]) / 2;
  return xs[i] + delta * dx;
}

function interpCross(xs: number[], ys: number[], i: number, j: number, level: number): number {
  const yi = ys[i], yj = ys[j];
  if (yi === yj) return xs[i];
  const t = (level - yi) / (yj - yi);
  return xs[i] + t * (xs[j] - xs[i]);
}

/** Trapezoidal integration over a non-uniform grid. */
export function trapezoid(xs: number[], ys: number[]): number {
  let s = 0;
  for (let i = 1; i < xs.length; i++) s += ((ys[i] + ys[i - 1]) / 2) * (xs[i] - xs[i - 1]);
  return s;
}

/** Composite Simpson's rule on a uniform grid (falls back to trapezoid). */
export function simpson(xs: number[], ys: number[]): number {
  const n = xs.length - 1;
  if (n < 2 || n % 2 !== 0) return trapezoid(xs, ys);
  const h = (xs[n] - xs[0]) / n;
  let s = ys[0] + ys[n];
  for (let i = 1; i < n; i++) s += ys[i] * (i % 2 === 0 ? 2 : 4);
  return (h / 3) * s;
}

/**
 * Noise estimate from the median absolute deviation of the first difference.
 * Robust against the peaks themselves, which a plain standard deviation is not.
 */
export function estimateNoise(y: number[]): number {
  if (y.length < 3) return 0;
  const d: number[] = [];
  for (let i = 1; i < y.length; i++) d.push(Math.abs(y[i] - y[i - 1]));
  d.sort((a, b) => a - b);
  const mad = d[Math.floor(d.length / 2)];
  // 1.4826 converts MAD to σ for normal data; /√2 undoes the differencing.
  return (1.4826 * mad) / Math.SQRT2;
}

/** Gaussian standard deviation from a full width at half maximum. */
export const sigmaFromFwhm = (fwhm: number): number => fwhm / (2 * Math.sqrt(2 * Math.LN2));

/**
 * Chromatographic resolution between two adjacent peaks.
 *
 *   R_s = 2·Δt_R / (w_1 + w_2)   with w the baseline width, w = 4σ
 *
 * Baseline separation is conventionally R_s ≥ 1.5.
 */
export function resolution(a: Peak, b: Peak): number {
  const wA = 4 * sigmaFromFwhm(a.fwhm);
  const wB = 4 * sigmaFromFwhm(b.fwhm);
  const sum = wA + wB;
  return sum > 0 ? (2 * Math.abs(b.x - a.x)) / sum : NaN;
}

/** Number of theoretical plates from a peak, N = 5.54·(t_R/w½)². */
export const theoreticalPlates = (p: Peak): number =>
  p.fwhm > 0 ? 5.54 * (p.x / p.fwhm) ** 2 : NaN;

/** Linear interpolation of a sampled curve at arbitrary x. */
export function interpolate(xs: number[], ys: number[], x: number): number {
  if (xs.length === 0) return NaN;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid; else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

/** First derivative by central differences — spectral inflection analysis. */
export function derivative(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i - 1]) / (xs[i + 1] - xs[i - 1]);
  if (n > 1) {
    d[0] = (ys[1] - ys[0]) / (xs[1] - xs[0]);
    d[n - 1] = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
  }
  return d;
}
