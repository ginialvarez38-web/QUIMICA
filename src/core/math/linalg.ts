/**
 * Linear algebra: matrices, decompositions, eigenproblems.
 *
 * Used by the equilibrium solver (Newton steps), reaction balancing (integer
 * null space), chemometrics (PCA, MLR) and the process flowsheet (mass balance
 * closure). Written for teaching as much as for computation — every routine is
 * the textbook algorithm, so a student can follow it against their notes.
 */

export type Vec = number[];
export type Mat = number[][];

export const zeros = (n: number): Vec => new Array(n).fill(0);
export const zerosMat = (r: number, c: number): Mat =>
  Array.from({ length: r }, () => new Array(c).fill(0));

export function identity(n: number): Mat {
  const m = zerosMat(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export const cloneMat = (a: Mat): Mat => a.map((r) => r.slice());

export function matVec(a: Mat, x: Vec): Vec {
  const out = zeros(a.length);
  for (let i = 0; i < a.length; i++) {
    let s = 0;
    const row = a[i];
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    out[i] = s;
  }
  return out;
}

export function matMul(a: Mat, b: Mat): Mat {
  const n = a.length;
  const m = b[0].length;
  const k = b.length;
  const out = zerosMat(n, m);
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const aip = a[i][p];
      if (aip === 0) continue;
      for (let j = 0; j < m; j++) out[i][j] += aip * b[p][j];
    }
  }
  return out;
}

export function transpose(a: Mat): Mat {
  const out = zerosMat(a[0].length, a.length);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i].length; j++) out[j][i] = a[i][j];
  }
  return out;
}

export const dot = (a: Vec, b: Vec): number => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm2 = (a: Vec): number => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
export const normInf = (a: Vec): number => a.reduce((s, v) => Math.max(s, Math.abs(v)), 0);
export const vecAdd = (a: Vec, b: Vec, k = 1): Vec => a.map((v, i) => v + k * b[i]);
export const vecScale = (a: Vec, k: number): Vec => a.map((v) => v * k);

// ---------------------------------------------------------------------------
// LU with partial pivoting
// ---------------------------------------------------------------------------

export interface LU {
  lu: Mat;
  piv: number[];
  sign: number;
  singular: boolean;
}

export function luDecompose(A: Mat): LU {
  const n = A.length;
  const lu = cloneMat(A);
  const piv = Array.from({ length: n }, (_, i) => i);
  let sign = 1;
  let singular = false;

  for (let k = 0; k < n; k++) {
    let p = k;
    let max = Math.abs(lu[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i][k]);
      if (v > max) { max = v; p = i; }
    }
    if (max < 1e-300) { singular = true; continue; }
    if (p !== k) {
      const t = lu[p]; lu[p] = lu[k]; lu[k] = t;
      const tp = piv[p]; piv[p] = piv[k]; piv[k] = tp;
      sign = -sign;
    }
    const pivot = lu[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = lu[i][k] / pivot;
      lu[i][k] = f;
      if (f === 0) continue;
      for (let j = k + 1; j < n; j++) lu[i][j] -= f * lu[k][j];
    }
  }
  return { lu, piv, sign, singular };
}

export function luSolve(dec: LU, b: Vec): Vec {
  const n = dec.lu.length;
  const y = zeros(n);
  for (let i = 0; i < n; i++) {
    let s = b[dec.piv[i]];
    for (let j = 0; j < i; j++) s -= dec.lu[i][j] * y[j];
    y[i] = s;
  }
  const x = zeros(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= dec.lu[i][j] * x[j];
    x[i] = dec.lu[i][i] === 0 ? 0 : s / dec.lu[i][i];
  }
  return x;
}

/** Solve A·x = b. Throws when A is numerically singular. */
export function solve(A: Mat, b: Vec): Vec {
  const dec = luDecompose(A);
  if (dec.singular) throw new Error('Matriz singular: el sistema no tiene solución única');
  return luSolve(dec, b);
}

/** Solve A·x = b, falling back to a least-squares solution when singular. */
export function solveSafe(A: Mat, b: Vec): Vec {
  const dec = luDecompose(A);
  if (!dec.singular) return luSolve(dec, b);
  return lstsq(A, b);
}

export function det(A: Mat): number {
  const dec = luDecompose(A);
  if (dec.singular) return 0;
  let d = dec.sign;
  for (let i = 0; i < A.length; i++) d *= dec.lu[i][i];
  return d;
}

export function inverse(A: Mat): Mat {
  const n = A.length;
  const dec = luDecompose(A);
  if (dec.singular) throw new Error('Matriz singular: no admite inversa');
  const inv = zerosMat(n, n);
  for (let j = 0; j < n; j++) {
    const e = zeros(n);
    e[j] = 1;
    const col = luSolve(dec, e);
    for (let i = 0; i < n; i++) inv[i][j] = col[i];
  }
  return inv;
}

// ---------------------------------------------------------------------------
// Least squares (normal equations with Tikhonov guard)
// ---------------------------------------------------------------------------

/** Minimise ‖A·x − b‖₂. `ridge` regularises rank-deficient designs. */
export function lstsq(A: Mat, b: Vec, ridge = 1e-12): Vec {
  const At = transpose(A);
  const AtA = matMul(At, A);
  for (let i = 0; i < AtA.length; i++) AtA[i][i] += ridge;
  const Atb = matVec(At, b);
  const dec = luDecompose(AtA);
  return luSolve(dec, Atb);
}

/** Covariance matrix of the least-squares estimate, σ²·(AᵀA)⁻¹. */
export function lstsqCovariance(A: Mat, residualVariance: number): Mat {
  const AtA = matMul(transpose(A), A);
  const inv = inverse(AtA);
  return inv.map((row) => row.map((v) => v * residualVariance));
}

// ---------------------------------------------------------------------------
// Row reduction and null space (used to balance chemical equations)
// ---------------------------------------------------------------------------

export interface RREF {
  R: Mat;
  pivots: number[];
  rank: number;
}

export function rref(Ain: Mat, tol = 1e-10): RREF {
  const R = cloneMat(Ain);
  const rows = R.length;
  const cols = R[0]?.length ?? 0;
  const pivots: number[] = [];
  let r = 0;

  for (let c = 0; c < cols && r < rows; c++) {
    let p = r;
    let max = Math.abs(R[r][c]);
    for (let i = r + 1; i < rows; i++) {
      if (Math.abs(R[i][c]) > max) { max = Math.abs(R[i][c]); p = i; }
    }
    if (max < tol) continue;

    const t = R[p]; R[p] = R[r]; R[r] = t;
    const pivot = R[r][c];
    for (let j = 0; j < cols; j++) R[r][j] /= pivot;
    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const f = R[i][c];
      if (Math.abs(f) < tol) continue;
      for (let j = 0; j < cols; j++) R[i][j] -= f * R[r][j];
    }
    pivots.push(c);
    r++;
  }
  return { R, pivots, rank: r };
}

/** Basis of the null space of A (columns as vectors). */
export function nullSpace(A: Mat, tol = 1e-10): Vec[] {
  const cols = A[0]?.length ?? 0;
  const { R, pivots } = rref(A, tol);
  const free = [];
  for (let c = 0; c < cols; c++) if (!pivots.includes(c)) free.push(c);

  return free.map((f) => {
    const v = zeros(cols);
    v[f] = 1;
    pivots.forEach((p, i) => { v[p] = -R[i][f]; });
    return v;
  });
}

// ---------------------------------------------------------------------------
// Symmetric eigenproblem — cyclic Jacobi (used by PCA)
// ---------------------------------------------------------------------------

export interface Eigen {
  /** Eigenvalues, descending. */
  values: Vec;
  /** Eigenvectors as columns of `vectors`, matching the order of `values`. */
  vectors: Mat;
}

export function jacobiEigen(Ain: Mat, maxSweeps = 100, tol = 1e-12): Eigen {
  const n = Ain.length;
  const A = cloneMat(Ain);
  let V = identity(n);

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    }
    if (Math.sqrt(2 * off) < tol) break;

    for (let p = 0; p < n - 1; p++) {
      for (let qi = p + 1; qi < n; qi++) {
        if (Math.abs(A[p][qi]) < 1e-300) continue;
        const theta = (A[qi][qi] - A[p][p]) / (2 * A[p][qi]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][qi];
          A[k][p] = c * akp - s * akq;
          A[k][qi] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[qi][k];
          A[p][k] = c * apk - s * aqk;
          A[qi][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][qi];
          V[k][p] = c * vkp - s * vkq;
          V[k][qi] = s * vkp + c * vkq;
        }
      }
    }
  }

  const pairs = Array.from({ length: n }, (_, i) => ({ v: A[i][i], col: V.map((row) => row[i]) }));
  pairs.sort((a, b) => b.v - a.v);
  const vectors = zerosMat(n, n);
  pairs.forEach((p, j) => { for (let i = 0; i < n; i++) vectors[i][j] = p.col[i]; });
  return { values: pairs.map((p) => p.v), vectors };
}

// ---------------------------------------------------------------------------
// Integer helpers — chemical equations must balance in integers
// ---------------------------------------------------------------------------

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

export const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

/**
 * Scale a rational vector to the smallest all-integer vector.
 * Denominators are recovered by continued-fraction approximation, which is
 * exactly how one clears fractions when balancing an equation by hand.
 */
export function toSmallestIntegers(v: Vec, maxDenom = 5000, tol = 1e-8): number[] {
  const denoms = v.map((x) => rationalDenominator(x, maxDenom, tol));
  const L = denoms.reduce((acc, d) => lcm(acc, d), 1);
  const ints = v.map((x) => Math.round(x * L));
  const g = ints.reduce((acc, x) => (x === 0 ? acc : gcd(acc, x)), 0) || 1;
  const out = ints.map((x) => x / g);
  const firstNonZero = out.find((x) => x !== 0) ?? 1;
  return firstNonZero < 0 ? out.map((x) => -x) : out;
}

function rationalDenominator(x: number, maxDenom: number, tol: number): number {
  if (!Number.isFinite(x)) return 1;
  if (Math.abs(x - Math.round(x)) < tol) return 1;
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
  let b = x;
  do {
    const a = Math.floor(b);
    let h2 = a * h1 + h0; h0 = h1; h1 = h2;
    let k2 = a * k1 + k0; k0 = k1; k1 = k2;
    if (k1 > maxDenom) break;
    if (Math.abs(x - h1 / k1) < tol) return k1;
    const frac = b - a;
    if (Math.abs(frac) < 1e-14) break;
    b = 1 / frac;
  } while (true);
  return Math.min(k1 || 1, maxDenom);
}
