/**
 * Aritmetica racional exacta.
 *
 * El balanceo de ecuaciones (§10) resuelve un sistema lineal homogeneo y exige
 * "coeficientes minimos enteros". Con aritmetica de punto flotante, una
 * eliminacion gaussiana sobre una matriz como la de
 *   Ca5(PO4)3OH + H3PO4 + H2O -> Ca(H2PO4)2·H2O
 * acumula error y produce coeficientes tipo 2.9999999997. El estudiante veria
 * un resultado incorrecto y el sistema perderia justamente lo que promete:
 * conservacion verificable de atomos y de carga.
 *
 * Se usa BigInt para que no exista desbordamiento en los determinantes
 * intermedios, que crecen rapido durante la eliminacion.
 */

export interface Rational {
  /** Numerador con signo. */
  readonly n: bigint;
  /** Denominador, siempre > 0. */
  readonly d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Construye un racional ya reducido y con denominador positivo. */
export function rat(n: bigint | number, d: bigint | number = 1n): Rational {
  let nn = typeof n === 'bigint' ? n : BigInt(Math.trunc(n));
  let dd = typeof d === 'bigint' ? d : BigInt(Math.trunc(d));
  if (dd === 0n) throw new Error('Racional con denominador cero');
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  if (nn === 0n) return { n: 0n, d: 1n };
  const g = gcd(nn, dd);
  return { n: nn / g, d: dd / g };
}

export const ZERO: Rational = { n: 0n, d: 1n };
export const ONE: Rational = { n: 1n, d: 1n };

export const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);

export function div(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new Error('Division racional por cero');
  return rat(a.n * b.d, a.d * b.n);
}

export const neg = (a: Rational): Rational => ({ n: -a.n, d: a.d });
export const isZero = (a: Rational): boolean => a.n === 0n;
export const sign = (a: Rational): -1 | 0 | 1 => (a.n === 0n ? 0 : a.n < 0n ? -1 : 1);
export const toNumber = (a: Rational): number => Number(a.n) / Number(a.d);

export function equals(a: Rational, b: Rational): boolean {
  return a.n === b.n && a.d === b.d;
}

export function toString(a: Rational): string {
  return a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`;
}

function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const g = gcd(a, b);
  const l = (a / g) * b;
  return l < 0n ? -l : l;
}

/**
 * Escala un vector de racionales al menor vector de enteros positivos
 * proporcional a el. Es el paso que convierte la solucion del nucleo del
 * sistema en los coeficientes estequiometricos que ve el estudiante.
 *
 * Devuelve `null` si el vector es nulo o contiene componentes de signo
 * opuesto (una ecuacion que solo se "balancea" moviendo una especie al otro
 * lado no es un balanceo valido y el motor debe rechazarla).
 */
export function toSmallestIntegers(vec: readonly Rational[]): bigint[] | null {
  if (vec.length === 0) return null;
  if (vec.every(isZero)) return null;

  // Todos los coeficientes deben poder hacerse positivos con un unico signo
  // global. Si hay signos mezclados, la solucion no es quimicamente valida.
  const signs = vec.filter((v) => !isZero(v)).map(sign);
  const first = signs[0]!;
  const flip = first < 0 ? -1n : 1n;
  if (!signs.every((s) => s === first)) return null;

  let denomLcm = 1n;
  for (const v of vec) denomLcm = lcm(denomLcm, v.d);

  const ints = vec.map((v) => (v.n * (denomLcm / v.d)) * flip);

  let g = 0n;
  for (const i of ints) g = gcd(g, i);
  if (g === 0n) return null;

  return ints.map((i) => i / g);
}

// ---------------------------------------------------------------------------
// Matrices racionales
// ---------------------------------------------------------------------------

export type RationalMatrix = Rational[][];

/**
 * Reduce la matriz a forma escalonada reducida por filas (RREF) in situ y
 * devuelve, para cada fila, el indice de su pivote.
 */
export function rref(m: RationalMatrix): number[] {
  const rows = m.length;
  if (rows === 0) return [];
  const cols = m[0]!.length;
  const pivots: number[] = [];
  let row = 0;

  for (let col = 0; col < cols && row < rows; col++) {
    // Pivoteo: elegimos la fila con numerador de mayor magnitud para mantener
    // pequenos los enteros intermedios.
    let best = -1;
    let bestMag = 0n;
    for (let r = row; r < rows; r++) {
      const v = m[r]![col]!;
      if (isZero(v)) continue;
      const mag = v.n < 0n ? -v.n : v.n;
      if (best === -1 || mag > bestMag) {
        best = r;
        bestMag = mag;
      }
    }
    if (best === -1) continue;

    [m[row], m[best]] = [m[best]!, m[row]!];

    const pivot = m[row]![col]!;
    for (let c = 0; c < cols; c++) m[row]![c] = div(m[row]![c]!, pivot);

    for (let r = 0; r < rows; r++) {
      if (r === row) continue;
      const factor = m[r]![col]!;
      if (isZero(factor)) continue;
      for (let c = 0; c < cols; c++) {
        m[r]![c] = sub(m[r]![c]!, mul(factor, m[row]![c]!));
      }
    }

    pivots.push(col);
    row++;
  }

  return pivots;
}

/**
 * Base del espacio nulo (kernel) de la matriz. Cada vector devuelto es una
 * solucion independiente de A x = 0.
 *
 * Para el balanceo: una ecuacion quimica bien planteada produce un nucleo de
 * dimension 1. Dimension 0 significa que no hay balanceo posible; dimension
 * > 1 significa que la ecuacion es ambigua (por ejemplo, si se mezclan dos
 * reacciones independientes en una sola linea) y el motor debe decirlo en vez
 * de elegir una solucion arbitraria.
 */
export function nullSpace(matrix: RationalMatrix): Rational[][] {
  if (matrix.length === 0) return [];
  const cols = matrix[0]!.length;
  const m = matrix.map((r) => r.slice());
  const pivots = rref(m);
  const pivotSet = new Set(pivots);
  const free: number[] = [];
  for (let c = 0; c < cols; c++) if (!pivotSet.has(c)) free.push(c);

  return free.map((freeCol) => {
    const vec: Rational[] = new Array(cols).fill(ZERO);
    vec[freeCol] = ONE;
    for (let i = 0; i < pivots.length; i++) {
      vec[pivots[i]!] = neg(m[i]![freeCol]!);
    }
    return vec;
  });
}
