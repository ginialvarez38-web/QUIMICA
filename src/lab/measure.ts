/**
 * The instrument error model.
 *
 * §33: CHEMIA must never produce ideal data. Everything an instrument reports
 * passes through here, where the simulation's *true* value acquires the
 * imperfections of a real measurement:
 *
 *   true value
 *     → calibration error   (a bad calibration produces a wrong result — §32)
 *     → drift               (since the last calibration)
 *     → systematic offsets  (contamination, technique)
 *     → random noise        (repeatability)
 *     → resolution          (the display quantises)
 *   = the reading
 *
 * The result is tagged `measured`, which is what keeps it distinguishable from
 * the simulated truth everywhere it is displayed (§66).
 *
 * All randomness is drawn from a seeded stream, so the same experiment
 * re-opened shows the same noise, and an instructor can reproduce a reported
 * anomaly exactly.
 */

import { Rng, DriftProcess } from '../core/math/random.js';
import { meas, type Measurement } from '../core/uncertainty.js';
import { instrumentById, type Instrument } from '../data/instruments.js';
import type { InstrumentState, RealismMode } from '../state/store.js';

export interface MeasureContext {
  instrumentId: string;
  /** Persistent state: calibration, drift clock, contamination. */
  state: InstrumentState;
  realism: RealismMode;
  /** Seed components: the experiment, the run index, the reading index. */
  seed: string;
  /** Hours elapsed since the calibration; defaults to the stored clock. */
  hoursSinceCalibration?: number;
  /** Extra systematic offset from operator technique, in the instrument's unit. */
  operatorBias?: number;
  /** Suppress all error — only for the "educativo" realism mode. */
  ideal?: boolean;
}

export interface Reading {
  /** What the display shows, after quantisation. */
  value: number;
  /** The simulation's true value, kept for the instructor view and the analysis. */
  trueValue: number;
  unit: string;
  /** Combined standard uncertainty attributed to this reading. */
  uncertainty: number;
  /** Whether the reading has stabilised yet. */
  stable: boolean;
  /** Breakdown of what was added, for the error-analysis lesson. */
  budget: Array<{ source: string; contribution: number; kind: 'sistematico' | 'aleatorio' | 'deriva' | 'resolucion' }>;
  /** Problems the instrument itself would flag. */
  flags: string[];
  measurement: Measurement;
}

/** Rounding to the instrument's display resolution. */
const quantise = (value: number, resolution: number): number =>
  resolution > 0 ? Math.round(value / resolution) * resolution : value;

/**
 * Produce a reading from a true value.
 *
 * `trueValue` comes from the physical simulation — the equilibrium solver, the
 * kinetics integrator, the mass balance. This function does not know or care
 * how it was produced; it only degrades it the way the named instrument would.
 */
export function readInstrument(trueValue: number, ctx: MeasureContext): Reading {
  const instrument = instrumentById(ctx.instrumentId);
  if (!instrument) {
    return {
      value: trueValue, trueValue, unit: '', uncertainty: 0, stable: true,
      budget: [], flags: [`Instrumento desconocido: ${ctx.instrumentId}`],
      measurement: meas(trueValue, 0, '', 'simulated'),
    };
  }

  const flags: string[] = [];
  const budget: Reading['budget'] = [];
  const rng = new Rng(`${ctx.instrumentId}:${ctx.seed}`);

  // Educational mode reports the model's truth, quantised but otherwise clean,
  // so the phenomenon can be studied before the metrology.
  if (ctx.ideal || ctx.realism === 'educativo') {
    const shown = quantise(trueValue, instrument.resolution);
    return {
      value: shown, trueValue, unit: instrument.unit,
      uncertainty: instrument.resolution / Math.sqrt(12),
      stable: true,
      budget: [{ source: 'Resolución del instrumento', contribution: instrument.resolution / Math.sqrt(12), kind: 'resolucion' }],
      flags: ['Modo educativo: se muestra el valor del modelo sin error experimental.'],
      measurement: meas(shown, instrument.resolution / Math.sqrt(12), instrument.unit, 'simulated'),
    };
  }

  const professional = ctx.realism === 'profesional';
  let value = trueValue;

  // ---- calibration ---------------------------------------------------------
  if (instrument.requiresCalibration) {
    if (ctx.state.calibratedAt === null) {
      flags.push(
        `${instrument.name} sin calibrar. El resultado no es trazable a ningún patrón: `
        + 'la lectura puede tener un error arbitrariamente grande.',
      );
      // An uncalibrated instrument carries the manufacturer's factory offset,
      // which is reproducible per instrument but unknown to the user.
      const factoryOffset = rng.normal(0, instrument.precision * 25);
      value += factoryOffset;
      budget.push({ source: 'Sin calibrar (desviación de fábrica)', contribution: Math.abs(factoryOffset), kind: 'sistematico' });
    } else {
      // A poor calibration degrades every subsequent reading, in proportion to
      // how poor it was. This is §32 made mechanical rather than advisory.
      const quality = Math.max(0, Math.min(1, ctx.state.calibrationQuality));
      const calibrationError = (1 - quality) * instrument.precision * 18 * rng.normal(0, 1);
      value += calibrationError;
      if (quality < 0.75) {
        flags.push(
          `Calibración de baja calidad (${(quality * 100).toFixed(0)} %). `
          + 'Repite el procedimiento: el error de calibración se propaga a todas las medidas.',
        );
      }
      if (Math.abs(calibrationError) > 0) {
        budget.push({ source: 'Error de calibración', contribution: Math.abs(calibrationError), kind: 'sistematico' });
      }
    }
  }

  // ---- drift ---------------------------------------------------------------
  const hours = ctx.hoursSinceCalibration
    ?? (ctx.state.calibratedAt ? (Date.now() - ctx.state.calibratedAt) / 3_600_000 : 0);

  if (hours > 0 && instrument.driftPerHour > 0) {
    // Ornstein–Uhlenbeck drift: it wanders but is bounded, like a real
    // thermostatted instrument between calibrations.
    const drift = new DriftProcess(rng.fork('drift'), 0.35, instrument.driftPerHour, 0, 0);
    let d = 0;
    const steps = Math.min(Math.ceil(hours), 200);
    for (let i = 0; i < steps; i++) d = drift.step(hours / steps);
    value += d;
    budget.push({ source: 'Deriva desde la calibración', contribution: Math.abs(d), kind: 'deriva' });

    if (hours > instrument.calibrationValidHours) {
      flags.push(
        `Han pasado ${hours.toFixed(1)} h desde la calibración y su validez es de `
        + `${instrument.calibrationValidHours} h. Recalibra antes de dar el resultado por bueno.`,
      );
    }
  }

  // ---- contamination -------------------------------------------------------
  if (ctx.state.contamination.length > 0) {
    const total = ctx.state.contamination.reduce((s, c) => s + c.amount, 0);
    const effect = total * instrument.precision * 30;
    value += effect;
    budget.push({ source: 'Contaminación residual', contribution: Math.abs(effect), kind: 'sistematico' });
    flags.push(
      `Contaminación arrastrada de: ${ctx.state.contamination.map((c) => c.from).join(', ')}. `
      + 'Lava el sensor y repite la medida.',
    );
  }

  // ---- operator technique --------------------------------------------------
  if (ctx.operatorBias) {
    value += ctx.operatorBias;
    budget.push({ source: 'Técnica del operador', contribution: Math.abs(ctx.operatorBias), kind: 'sistematico' });
  }

  // ---- random noise --------------------------------------------------------
  const noiseScale = professional ? 1.4 : 1;
  const random = rng.normal(0, instrument.noise * noiseScale);
  value += random;
  budget.push({ source: 'Ruido de repetibilidad', contribution: instrument.precision * noiseScale, kind: 'aleatorio' });

  // ---- resolution ----------------------------------------------------------
  const displayed = quantise(value, instrument.resolution);
  budget.push({
    source: 'Resolución del instrumento',
    contribution: instrument.resolution / Math.sqrt(12),
    kind: 'resolucion',
  });

  // ---- range check ---------------------------------------------------------
  let stable = true;
  if (displayed < instrument.range[0] || displayed > instrument.range[1]) {
    flags.push(
      `Fuera del intervalo de medida (${instrument.range[0]}–${instrument.range[1]} ${instrument.unit}). `
      + 'La lectura no es válida.',
    );
    stable = false;
  }

  // Combined standard uncertainty: quadrature of the independent contributions.
  const uncertainty = Math.sqrt(
    budget.reduce((s, e) => s + e.contribution * e.contribution, 0),
  );

  return {
    value: displayed,
    trueValue,
    unit: instrument.unit,
    uncertainty,
    stable,
    budget: budget.sort((a, b) => b.contribution - a.contribution),
    flags,
    measurement: meas(displayed, uncertainty, instrument.unit, 'measured', {
      note: flags.length > 0 ? flags[0] : undefined,
    }),
  };
}

/**
 * Simulate the approach to a stable reading.
 *
 * Returns the reading an instrument would show `elapsed` seconds after the
 * sample was presented — a first-order approach to the final value plus the
 * noise, which is why a balance wobbles and a pH electrode creeps. §71 asks
 * for micro-interactions that carry information: this is the information.
 */
export function readingAtTime(
  trueValue: number, elapsed: number, ctx: MeasureContext,
): Reading & { fractionSettled: number } {
  const instrument = instrumentById(ctx.instrumentId);
  const tau = (instrument?.settlingTime ?? 1) / 3;
  const fraction = 1 - Math.exp(-elapsed / Math.max(tau, 0.01));

  const final = readInstrument(trueValue, ctx);
  const rng = new Rng(`${ctx.seed}:settle:${Math.floor(elapsed * 4)}`);

  // Before settling the reading is between the previous value (taken as the
  // instrument's zero) and the final one, with extra noise.
  const transient = final.trueValue * fraction;
  const extraNoise = (instrument?.noise ?? 0) * (1 - fraction) * 8;
  const shown = quantise(
    transient + rng.normal(0, extraNoise) + (final.value - final.trueValue) * fraction,
    instrument?.resolution ?? 0.001,
  );

  const settled = fraction > 0.995;
  return {
    ...final,
    value: settled ? final.value : shown,
    stable: settled && final.stable,
    fractionSettled: fraction,
  };
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export interface CalibrationAttempt {
  instrumentId: string;
  /** Steps the student actually completed, in order. */
  completedSteps: string[];
  /** Standards used, keyed by step id, with the value the student entered. */
  standards: Record<string, number>;
  /** Whether each step's waiting requirement was respected. */
  waited: Record<string, boolean>;
  seed: string;
}

export interface CalibrationOutcome {
  quality: number;
  parameters: Record<string, number>;
  accepted: boolean;
  messages: Array<{ tone: 'ok' | 'warn' | 'danger'; text: string }>;
  /** For a pH meter: the electrode slope actually obtained. */
  slope?: number;
  slopePercent?: number;
}

/**
 * Evaluate a calibration attempt.
 *
 * The quality it returns feeds straight back into `readInstrument`, which is
 * what makes §32 real: skipping the stabilisation wait, or calibrating with a
 * single buffer, produces a numerically worse instrument for the rest of the
 * session rather than a warning that can be ignored.
 */
export function evaluateCalibration(attempt: CalibrationAttempt): CalibrationOutcome {
  const instrument = instrumentById(attempt.instrumentId);
  if (!instrument) {
    return { quality: 0, parameters: {}, accepted: false, messages: [{ tone: 'danger', text: 'Instrumento desconocido.' }] };
  }

  const rng = new Rng(`cal:${attempt.instrumentId}:${attempt.seed}`);
  const messages: CalibrationOutcome['messages'] = [];
  const required = instrument.calibrationSteps;
  const done = new Set(attempt.completedSteps);

  // Completeness.
  const missing = required.filter((s) => !done.has(s.id));
  let quality = 1 - missing.length / Math.max(required.length, 1);

  for (const step of missing) {
    messages.push({ tone: 'warn', text: `Paso omitido: ${step.title}. ${step.detail}` });
  }

  // Waiting requirements: skipping the stabilisation is the classic shortcut.
  let rushed = 0;
  for (const step of required) {
    if (step.requires?.kind === 'espera' && done.has(step.id) && attempt.waited[step.id] === false) {
      rushed++;
      messages.push({
        tone: 'warn',
        text: `No se esperó la estabilización en «${step.title}». `
          + 'La lectura tomada antes de tiempo desplaza el punto de calibración.',
      });
    }
  }
  quality -= rushed * 0.18;

  const parameters: Record<string, number> = {};
  const outcome: CalibrationOutcome = { quality: 0, parameters, accepted: false, messages };

  // Instrument-specific evaluation.
  if (attempt.instrumentId === 'phmetro') {
    const points = Object.entries(attempt.standards).filter(([, v]) => Number.isFinite(v));
    if (points.length < 2) {
      quality = Math.min(quality, 0.45);
      messages.push({
        tone: 'danger',
        text: 'Calibración con un solo punto: corrige el desplazamiento pero no la pendiente. '
          + 'El error crecerá al alejarse del pH calibrado.',
      });
    }
    // Electrode ageing gives a slope below the ideal 59.16 mV/pH.
    const ageing = rng.uniform(0.955, 1.005);
    const slope = 59.16 * ageing * (rushed > 0 ? 0.985 : 1);
    const slopePercent = (slope / 59.16) * 100;
    parameters.slope = slope;
    parameters.offset = rng.normal(0, 4);
    outcome.slope = slope;
    outcome.slopePercent = slopePercent;

    if (slopePercent < 95) {
      quality = Math.min(quality, 0.5);
      messages.push({
        tone: 'danger',
        text: `Pendiente del ${slopePercent.toFixed(1)} %, por debajo del 95 % admisible. `
          + 'El electrodo está agotado: regenéralo en KCl 3 M o sustitúyelo.',
      });
    } else if (slopePercent < 97) {
      messages.push({
        tone: 'warn',
        text: `Pendiente del ${slopePercent.toFixed(1)} %: aceptable pero baja. Vigila el electrodo.`,
      });
    } else {
      messages.push({ tone: 'ok', text: `Pendiente del ${slopePercent.toFixed(1)} %: electrodo en buen estado.` });
    }
  }

  if (attempt.instrumentId === 'balanza') {
    const drift = rng.normal(0, 0.00005);
    parameters.span = 1 + drift;
    parameters.zero = rng.normal(0, 0.00003);
    if (!done.has('estabilizar')) {
      quality = Math.min(quality, 0.6);
      messages.push({
        tone: 'warn',
        text: 'La balanza no llegó a estabilizarse térmicamente. La celda seguirá derivando durante la sesión.',
      });
    }
    if (!done.has('nivel')) {
      quality = Math.min(quality, 0.55);
      messages.push({
        tone: 'danger',
        text: 'Balanza sin nivelar: mide sólo una componente del peso y todas las masas saldrán bajas de forma sistemática.',
      });
    }
  }

  if (attempt.instrumentId === 'espectrofotometro') {
    if (!done.has('blanco')) {
      quality = Math.min(quality, 0.3);
      messages.push({
        tone: 'danger',
        text: 'Sin ajustar el blanco no hay referencia I₀: la absorbancia medida carece de significado.',
      });
    }
    if (!done.has('calentar')) {
      quality = Math.min(quality, 0.7);
      messages.push({ tone: 'warn', text: 'Lámparas no estabilizadas: la línea base derivará durante la sesión.' });
    }
    parameters.baseline = rng.normal(0, 0.002);
  }

  if (attempt.instrumentId === 'conductimetro') {
    const nominal = 1.0;
    parameters.cellConstant = nominal * rng.uniform(0.96, 1.04);
    messages.push({
      tone: 'ok',
      text: `Constante de célula determinada: ${parameters.cellConstant.toFixed(4)} cm⁻¹.`,
    });
  }

  quality = Math.max(0, Math.min(1, quality));
  outcome.quality = quality;
  outcome.accepted = quality >= 0.6;

  if (outcome.accepted && messages.every((m) => m.tone === 'ok')) {
    messages.unshift({ tone: 'ok', text: 'Calibración completa y dentro de especificación.' });
  } else if (!outcome.accepted) {
    messages.unshift({
      tone: 'danger',
      text: `Calibración rechazada (calidad ${(quality * 100).toFixed(0)} %). `
        + 'Los resultados obtenidos con ella estarán afectados; repite el procedimiento.',
    });
  }

  return outcome;
}

/**
 * Replicate measurements, so the student can see the scatter and compute a
 * standard deviation from data that actually has one.
 */
export function replicate(trueValue: number, n: number, ctx: MeasureContext): Reading[] {
  return Array.from({ length: n }, (_, i) =>
    readInstrument(trueValue, { ...ctx, seed: `${ctx.seed}:rep${i}` }));
}

/** Human-readable description of what an instrument is currently capable of. */
export function instrumentStatus(instrument: Instrument, state: InstrumentState): {
  tone: 'ok' | 'warn' | 'danger';
  label: string;
  detail: string;
} {
  if (!instrument.requiresCalibration) {
    return { tone: 'ok', label: 'Listo', detail: 'No requiere calibración.' };
  }
  if (state.calibratedAt === null) {
    return {
      tone: 'danger', label: 'Sin calibrar',
      detail: 'Los resultados no serán trazables. Calibra antes de medir.',
    };
  }
  const hours = (Date.now() - state.calibratedAt) / 3_600_000;
  if (hours > instrument.calibrationValidHours) {
    return {
      tone: 'warn', label: 'Calibración caducada',
      detail: `Han pasado ${hours.toFixed(1)} h de las ${instrument.calibrationValidHours} h de validez.`,
    };
  }
  if (state.calibrationQuality < 0.75) {
    return {
      tone: 'warn', label: 'Calibración deficiente',
      detail: `Calidad del ${(state.calibrationQuality * 100).toFixed(0)} %. Conviene repetirla.`,
    };
  }
  return {
    tone: 'ok', label: 'Calibrado',
    detail: `Hace ${hours.toFixed(1)} h, calidad ${(state.calibrationQuality * 100).toFixed(0)} %.`,
  };
}
