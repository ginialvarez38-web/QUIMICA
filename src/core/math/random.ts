/**
 * Deterministic pseudo-random number generation.
 *
 * Experimental error must be *reproducible*: if a student re-opens an
 * experiment, the noise on their spectrum has to be the same noise, and an
 * instructor must be able to reproduce a reported anomaly. Every stochastic
 * process in CHEMIA therefore draws from a seeded stream, never Math.random.
 *
 * The seed is derived from the experiment id, the instrument serial and the
 * run index, so two runs on the same instrument differ, but re-rendering a
 * stored run does not.
 */

/** Mulberry32 — small, fast, good enough for instrument noise. */
export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? Rng.hash(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  static hash(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Uniform on [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform on [lo, hi). */
  uniform(lo = 0, hi = 1): number {
    return lo + (hi - lo) * this.next();
  }

  /** Standard normal deviate (Box–Muller, cached pair). */
  private spare: number | null = null;
  normal(mean = 0, sd = 1): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return mean + sd * v;
    }
    let u = 0, v = 0, s = 0;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * f;
    return mean + sd * (u * f);
  }

  /** Poisson deviate — photon / decay counting statistics. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda > 30) return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }

  /** Exponential deviate with the given rate — inter-arrival times. */
  exponential(rate: number): number {
    return -Math.log(1 - this.next()) / rate;
  }

  int(lo: number, hi: number): number {
    return Math.floor(this.uniform(lo, hi + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Fork a derived stream — keeps sub-processes independent but reproducible. */
  fork(tag: string): Rng {
    return new Rng(Rng.hash(tag + ':' + this.state.toString(36)));
  }
}

/**
 * 1/f (pink) noise generator — instrument baseline drift is not white.
 * Voss–McCartney with a small number of octaves is convincing and cheap.
 */
export class PinkNoise {
  private rows: number[];
  private runningSum = 0;
  private counter = 0;
  private rng: Rng;

  constructor(rng: Rng, octaves = 8) {
    this.rng = rng;
    this.rows = new Array(octaves).fill(0);
    for (let i = 0; i < octaves; i++) {
      this.rows[i] = this.rng.normal(0, 1);
      this.runningSum += this.rows[i];
    }
  }

  next(): number {
    this.counter++;
    let n = this.counter;
    for (let i = 0; i < this.rows.length; i++) {
      if ((n & 1) === 1) {
        this.runningSum -= this.rows[i];
        this.rows[i] = this.rng.normal(0, 1);
        this.runningSum += this.rows[i];
        break;
      }
      n >>= 1;
    }
    // White component keeps the high-frequency end alive.
    return (this.runningSum + this.rng.normal(0, 1)) / (this.rows.length + 1);
  }
}

/**
 * Ornstein–Uhlenbeck process — the right model for instrument drift that
 * wanders but is pulled back toward a reference (a thermostatted detector,
 * an electrode potential between calibrations).
 *
 *   dx = θ(µ − x)dt + σ dW
 */
export class DriftProcess {
  constructor(
    private rng: Rng,
    private theta: number,
    private sigma: number,
    private mu = 0,
    private x = 0,
  ) {}

  step(dt: number): number {
    this.x += this.theta * (this.mu - this.x) * dt + this.sigma * Math.sqrt(dt) * this.rng.normal();
    return this.x;
  }

  get value(): number { return this.x; }
  reset(x = this.mu): void { this.x = x; }
}
