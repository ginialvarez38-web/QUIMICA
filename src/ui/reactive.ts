/**
 * A minimal reactive layer.
 *
 * No framework is available in this environment (the npm registry is not
 * reachable), so CHEMIA ships its own — about a hundred lines of signals and
 * effects, which is all a scientific instrument panel actually needs. The
 * design goal is §69: a heavy simulation must never freeze the interface, so
 * updates are batched onto a microtask and long computations are explicitly
 * yielded rather than being allowed to block a render.
 */

type Subscriber = () => void;

let activeEffect: Effect | null = null;
const pendingEffects = new Set<Effect>();
let flushScheduled = false;

class Effect {
  deps = new Set<Set<Effect>>();
  active = true;

  constructor(private fn: () => void, readonly onStop?: () => void) {}

  run(): void {
    if (!this.active) return;
    this.cleanup();
    const previous = activeEffect;
    activeEffect = this;
    try {
      this.fn();
    } finally {
      activeEffect = previous;
    }
  }

  cleanup(): void {
    for (const dep of this.deps) dep.delete(this);
    this.deps.clear();
  }

  stop(): void {
    this.cleanup();
    this.active = false;
    this.onStop?.();
  }
}

function schedule(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    const batch = [...pendingEffects];
    pendingEffects.clear();
    for (const e of batch) e.run();
  });
}

export interface Signal<T> {
  (): T;
  set(value: T): void;
  update(fn: (previous: T) => T): void;
  /** Read without subscribing — for use inside an effect that must not re-run. */
  peek(): T;
}

/** A reactive value. Reading it inside an effect subscribes that effect. */
export function signal<T>(initial: T, equals: (a: T, b: T) => boolean = Object.is): Signal<T> {
  let value = initial;
  const subscribers = new Set<Effect>();

  const read = ((): T => {
    if (activeEffect) {
      subscribers.add(activeEffect);
      activeEffect.deps.add(subscribers);
    }
    return value;
  }) as Signal<T>;

  read.set = (next: T): void => {
    if (equals(value, next)) return;
    value = next;
    for (const s of subscribers) pendingEffects.add(s);
    schedule();
  };
  read.update = (fn: (previous: T) => T): void => read.set(fn(value));
  read.peek = (): T => value;

  return read;
}

/** Run `fn` now and again whenever any signal it read changes. */
export function effect(fn: () => void): () => void {
  const e = new Effect(fn);
  e.run();
  return () => e.stop();
}

/** A signal derived from other signals, recomputed lazily on change. */
export function computed<T>(fn: () => T, equals?: (a: T, b: T) => boolean): Signal<T> {
  const out = signal<T>(undefined as T, equals);
  effect(() => out.set(fn()));
  return out;
}

/** Apply several updates without triggering intermediate renders. */
export function batch(fn: () => void): void {
  const wasScheduled = flushScheduled;
  flushScheduled = true;
  try {
    fn();
  } finally {
    flushScheduled = wasScheduled;
    schedule();
  }
}

/** Read signals without subscribing the enclosing effect. */
export function untracked<T>(fn: () => T): T {
  const previous = activeEffect;
  activeEffect = null;
  try {
    return fn();
  } finally {
    activeEffect = previous;
  }
}

// ---------------------------------------------------------------------------
// Keeping the interface responsive (§69)
// ---------------------------------------------------------------------------

/** Yield to the browser so pending input and paint can happen. */
export const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

export interface ChunkedOptions {
  /** Milliseconds of work before yielding. */
  budgetMs?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: { aborted: boolean };
}

/**
 * Run a long loop in slices, yielding between them.
 *
 * A titration curve is three hundred independent equilibrium solves; a
 * speciation sweep is a hundred and forty. Running them straight through
 * freezes the page for a second, which §69 forbids. This runs them in
 * time-boxed slices so the interface keeps painting and the progress bar
 * actually moves.
 */
export async function chunked<T>(
  total: number,
  step: (index: number) => T,
  opts: ChunkedOptions = {},
): Promise<T[]> {
  const budget = opts.budgetMs ?? 12;
  const out: T[] = [];
  let i = 0;
  while (i < total) {
    const start = performance.now();
    while (i < total && performance.now() - start < budget) {
      out.push(step(i));
      i++;
    }
    opts.onProgress?.(i, total);
    if (opts.signal?.aborted) break;
    if (i < total) await yieldToBrowser();
  }
  return out;
}

/** Debounce a function — used for text inputs that drive a simulation. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 180): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Throttle to at most one call per animation frame — for pointer drags. */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let queued = false;
  let lastArgs: A;
  return (...args: A): void => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}
