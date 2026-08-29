/**
 * Industrial process simulation.
 *
 * §42–§44: reactors, pumps, valves, heat exchangers and their control system,
 * with the scale-up effects that only appear when a laboratory recipe becomes a
 * plant. Like everything else in CHEMIA the dynamics are integrated, not
 * scripted: the temperature of a reactor is the solution of its energy balance,
 * and a PID controller that is badly tuned oscillates because the closed loop
 * really is unstable, not because a flag was set.
 */

import { R } from '../core/constants.js';
import { integrate } from '../core/math/ode.js';
import { Rng } from '../core/math/random.js';

// ---------------------------------------------------------------------------
// PID control (§43)
// ---------------------------------------------------------------------------

export interface PidSettings {
  /** Proportional gain. */
  Kp: number;
  /** Integral time, seconds. Larger is slower. */
  Ti: number;
  /** Derivative time, seconds. */
  Td: number;
  /** Output limits. */
  min: number;
  max: number;
  /** Reverse acting: output falls when the measurement rises. */
  reverse?: boolean;
}

export class PidController {
  private integral = 0;
  private previousError = 0;
  private initialised = false;

  constructor(public settings: PidSettings) {}

  reset(): void {
    this.integral = 0;
    this.previousError = 0;
    this.initialised = false;
  }

  /**
   * One control step.
   *
   * Includes anti-windup by conditional integration: when the output is
   * saturated the integral stops accumulating. Without it a controller that
   * cannot reach its set point winds up and then overshoots massively — a
   * failure mode worth letting the student produce on purpose.
   */
  step(setpoint: number, measurement: number, dt: number): { output: number; p: number; i: number; d: number; error: number } {
    const { Kp, Ti, Td, min, max, reverse } = this.settings;
    const error = (reverse ? -1 : 1) * (setpoint - measurement);

    const p = Kp * error;
    const derivative = this.initialised && dt > 0 ? (error - this.previousError) / dt : 0;
    const d = Kp * Td * derivative;

    const candidateIntegral = this.integral + (Ti > 0 ? (error * dt) / Ti : 0);
    const iTerm = Kp * candidateIntegral;
    const raw = p + iTerm + d;

    // Anti-windup: only accept the integral if the output stays in range.
    if (raw >= min && raw <= max) this.integral = candidateIntegral;

    const i = Kp * this.integral;
    const output = Math.max(min, Math.min(max, p + i + d));

    this.previousError = error;
    this.initialised = true;
    return { output, p, i, d, error };
  }
}

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

export type Scale = 'laboratorio' | 'banco' | 'piloto' | 'industrial';

export interface ScaleSpec {
  id: Scale;
  label: string;
  /** Reactor volume, m³. */
  volume: number;
  /** Heat transfer area, m². */
  area: number;
  /** Overall heat transfer coefficient, W·m⁻²·K⁻¹. */
  U: number;
  /** Mixing time, s — how long a tracer takes to become uniform. */
  mixingTime: number;
  /** Description of what changes at this scale. */
  note: string;
}

/**
 * The four scales of §44.
 *
 * The essential physics is the surface-to-volume ratio. Volume grows as L³ and
 * heat-transfer area as L², so A/V falls as 1/L. A reaction that is trivially
 * thermostatted in a test tube can be impossible to cool in a 20 m³ reactor,
 * and that single ratio is why. The numbers below reproduce it.
 */
export const SCALES: ScaleSpec[] = [
  {
    id: 'laboratorio', label: 'Laboratorio', volume: 0.0005, area: 0.03, U: 400, mixingTime: 1,
    note: 'Matraz de 500 mL en baño termostático. La relación área/volumen es de 60 m⁻¹: '
      + 'el calor se evacúa sin esfuerzo y la mezcla es instantánea a efectos prácticos.',
  },
  {
    id: 'banco', label: 'Escala de banco', volume: 0.02, area: 0.42, U: 350, mixingTime: 8,
    note: 'Reactor encamisado de 20 L. Área/volumen 21 m⁻¹. Empiezan a notarse los gradientes de '
      + 'temperatura y el tiempo de mezcla deja de ser despreciable frente a la reacción.',
  },
  {
    id: 'piloto', label: 'Planta piloto', volume: 1, area: 5.5, U: 300, mixingTime: 40,
    note: 'Reactor de 1 m³. Área/volumen 5.5 m⁻¹. La evacuación de calor es ya un factor limitante '
      + 'del diseño y hay que dosificar el reactivo en lugar de cargarlo de una vez.',
  },
  {
    id: 'industrial', label: 'Planta industrial', volume: 20, area: 40, U: 250, mixingTime: 180,
    note: 'Reactor de 20 m³. Área/volumen 2 m⁻¹: treinta veces peor que en el laboratorio. '
      + 'Una reacción exotérmica que allí era manejable puede desbocarse aquí.',
  },
];

export const scaleById = (id: Scale): ScaleSpec => SCALES.find((s) => s.id === id) ?? SCALES[0];

/** Surface-to-volume ratio, m⁻¹ — the number that explains scale-up. */
export const surfaceToVolume = (spec: ScaleSpec): number => spec.area / spec.volume;

// ---------------------------------------------------------------------------
// Stirred-tank reactor with a jacket (§42)
// ---------------------------------------------------------------------------

export interface ReactorSpec {
  scale: ScaleSpec;
  /** Initial concentration of the limiting reactant, mol·m⁻³. */
  C0: number;
  /** Arrhenius parameters of the reaction. */
  A: number;
  Ea: number;
  /** Reaction enthalpy, J·mol⁻¹. Negative is exothermic. */
  deltaH: number;
  /** Reaction order in the limiting reactant. */
  order: number;
  /** Density, kg·m⁻³ and specific heat, J·kg⁻¹·K⁻¹ of the mixture. */
  rho: number;
  cp: number;
  /** Coolant temperature, K. */
  coolantT: number;
  /** Initial and ambient temperature, K. */
  T0: number;
  /** Feed flow for a continuous reactor, m³·s⁻¹. Zero for a batch. */
  feedFlow?: number;
  feedConcentration?: number;
  feedTemperature?: number;
}

export interface ReactorState {
  t: number[];
  /** Concentration of the limiting reactant, mol·m⁻³. */
  C: number[];
  /** Reactor temperature, K. */
  T: number[];
  /** Jacket duty, W. Negative means heat is being removed. */
  duty: number[];
  /** Conversion, 0–1. */
  conversion: number[];
  /** Heat generation rate, W. */
  qGen: number[];
  /** Heat removal rate, W. */
  qRem: number[];
  /** True when the reactor lost thermal control (see `runawayReason`). */
  runaway: boolean;
  runawayReason?: string;
  maxTemperature: number;
  /** Adiabatic temperature rise for complete conversion, K. */
  adiabaticRise: number;
  /** Controller output at each step, 0–1 valve opening. */
  valve: number[];
}

/**
 * Integrate a jacketed stirred-tank reactor.
 *
 * Two coupled balances:
 *
 *   dC/dT:  −k(T)·C^n  (+ feed terms for a CSTR)
 *   dT/dt:  [(−ΔH)·k(T)·C^n·V − U·A·(T − T_jacket)] / (ρ·V·cp)
 *
 * The runaway condition emerges from the competition between the two: heat
 * generation depends exponentially on temperature, removal only linearly. When
 * the exponential wins, the reactor runs away — which is exactly the physical
 * reason, and the reason a 20 m³ reactor is dangerous where a flask is not.
 */
export function simulateReactor(
  spec: ReactorSpec,
  options: {
    duration: number;
    setpoint?: number;
    pid?: PidSettings;
    points?: number;
    /** Instrument-like noise on the recorded temperature. */
    noiseSeed?: string;
  },
): ReactorState {
  const points = options.points ?? 400;
  const V = spec.scale.volume;
  const UA = spec.scale.U * spec.scale.area;
  const rhoVcp = spec.rho * V * spec.cp;
  const controller = options.pid ? new PidController(options.pid) : null;

  // The controller runs on a fixed sampling interval, as a real DCS does.
  const dt = options.duration / points;
  let valveOpening = 1;
  const valveTrace: number[] = [];

  const derivative = (t: number, y: number[]): number[] => {
    const [C, T] = y;
    const k = spec.A * Math.exp(-spec.Ea / (R * Math.max(T, 1)));
    const rate = k * Math.pow(Math.max(C, 0), spec.order);

    const feed = spec.feedFlow ?? 0;
    const dC = -rate
      + (feed > 0 ? (feed / V) * ((spec.feedConcentration ?? spec.C0) - C) : 0);

    const qGen = -spec.deltaH * rate * V;
    // The valve modulates the effective heat-transfer coefficient.
    const qRem = UA * valveOpening * (T - spec.coolantT);
    const qFeed = feed > 0 ? feed * spec.rho * spec.cp * ((spec.feedTemperature ?? spec.T0) - T) : 0;

    const dT = (qGen - qRem + qFeed) / rhoVcp;
    void t;
    return [dC, dT];
  };

  const tEval = Array.from({ length: points + 1 }, (_, i) => (options.duration * i) / points);
  /*
   * The adiabatic temperature rise is the number that decides whether a
   * reactor is inherently safe: it is the most the batch can heat itself even
   * if all cooling is lost, because the reactant is finite.
   *
   *   ΔT_ad = (−ΔH)·C₀ / (ρ·cp)
   */
  const adiabaticRise = (-spec.deltaH * spec.C0) / (spec.rho * spec.cp);

  const out: ReactorState = {
    t: [], C: [], T: [], duty: [], conversion: [], qGen: [], qRem: [],
    runaway: false, maxTemperature: spec.T0, adiabaticRise, valve: [],
  };
  /** Boiling point of the medium, K. Above it the single-liquid-phase model
   *  stops being valid, and in a real vessel the pressure rises. */
  const boilingPoint = 373.15;

  // Step through the sampling intervals so the controller acts discretely.
  let y = [spec.C0, spec.T0];
  const rng = options.noiseSeed ? new Rng(options.noiseSeed) : null;

  for (let i = 0; i <= points; i++) {
    const t = tEval[i];
    const [C, T] = y;

    if (controller && options.setpoint !== undefined) {
      // Measurement noise feeds the controller, as it would in a real loop.
      const measured = T + (rng ? rng.normal(0, 0.15) : 0);
      const result = controller.step(options.setpoint, measured, dt);
      // Reverse-acting cooling: hotter reactor opens the coolant valve.
      valveOpening = Math.max(0, Math.min(1, result.output));
    }
    valveTrace.push(valveOpening);

    const k = spec.A * Math.exp(-spec.Ea / (R * Math.max(T, 1)));
    const rate = k * Math.pow(Math.max(C, 0), spec.order);
    const qGen = -spec.deltaH * rate * V;
    const qRem = UA * valveOpening * (T - spec.coolantT);

    out.t.push(t);
    out.C.push(C);
    out.T.push(T);
    out.qGen.push(qGen);
    out.qRem.push(qRem);
    out.duty.push(-qRem);
    out.conversion.push(spec.C0 > 0 ? Math.max(0, 1 - C / spec.C0) : 0);
    out.valve.push(valveOpening);
    out.maxTemperature = Math.max(out.maxTemperature, T);

    /*
     * Loss of thermal control. Two independent criteria, both physical:
     *
     *  - The medium boils. Above the boiling point the model's assumption of a
     *    single liquid phase fails, and in a real vessel the pressure rises;
     *    continuing to integrate would produce numbers with no meaning.
     *  - The temperature exceeds the set point by more than 50 K. The loop has
     *    lost the reactor even if the batch never reaches boiling.
     */
    if (T >= boilingPoint) {
      out.runaway = true;
      out.runawayReason = `El medio alcanza su punto de ebullición (${(boilingPoint - 273.15).toFixed(0)} °C). `
        + 'A partir de aquí el modelo de fase líquida única deja de ser válido y en un reactor real '
        + 'la presión empezaría a subir.';
      break;
    }
    if (options.setpoint !== undefined && T > options.setpoint + 50) {
      out.runaway = true;
      out.runawayReason = `La temperatura supera la consigna en más de 50 K (${(T - 273.15).toFixed(0)} °C `
        + `frente a ${(options.setpoint - 273.15).toFixed(0)} °C). El lazo ha perdido el control del reactor.`;
    }
    if (i === points) break;

    const step = integrate(derivative, y, t, t + dt, { rtol: 1e-8, atol: 1e-12, nonNegative: true });
    y = step.y[step.y.length - 1];
    if (!Number.isFinite(y[1])) { out.runaway = true; break; }
  }

  return out;
}

/**
 * The classic semenov analysis: at what jacket temperature does heat generation
 * overtake removal? Returns the critical coolant temperature above which the
 * reactor cannot be held stable at this scale.
 */
export function criticalCoolantTemperature(spec: ReactorSpec): number {
  const UA = spec.scale.U * spec.scale.area;
  const V = spec.scale.volume;
  // Search for the coolant temperature at which the steady state disappears.
  let low = 250;
  let high = 500;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (low + high) / 2;
    const stable = hasStableSteadyState({ ...spec, coolantT: mid }, UA, V);
    if (stable) low = mid; else high = mid;
  }
  return low;
}

function hasStableSteadyState(spec: ReactorSpec, UA: number, V: number): boolean {
  // Steady state at full conversion is trivial; the interesting question is
  // whether the temperature stays bounded during the transient.
  const result = simulateReactor(spec, { duration: 4000, points: 300 });
  return !result.runaway;
}

// ---------------------------------------------------------------------------
// Unit operations for the flowsheet
// ---------------------------------------------------------------------------

export type UnitKind = 'tanque' | 'reactor' | 'bomba' | 'valvula' | 'intercambiador' | 'columna' | 'sensor';

export interface ProcessTag {
  id: string;
  /** ISA-style tag: TIC-101, FT-203… */
  tag: string;
  label: string;
  unit: string;
  value: number;
  setpoint?: number;
  /** Alarm limits. */
  loLo?: number;
  lo?: number;
  hi?: number;
  hiHi?: number;
  kind: 'temperatura' | 'presion' | 'caudal' | 'nivel' | 'ph' | 'composicion' | 'potencia' | 'valvula';
}

export type AlarmPriority = 'alta' | 'media' | 'baja';

export interface Alarm {
  tag: string;
  message: string;
  priority: AlarmPriority;
  time: number;
  acknowledged: boolean;
}

/** Evaluate a tag against its alarm limits. */
export function checkAlarms(tag: ProcessTag, now: number): Alarm | null {
  if (tag.hiHi !== undefined && tag.value >= tag.hiHi) {
    return { tag: tag.tag, message: `${tag.label} muy alta (${tag.value.toFixed(1)} ${tag.unit})`, priority: 'alta', time: now, acknowledged: false };
  }
  if (tag.loLo !== undefined && tag.value <= tag.loLo) {
    return { tag: tag.tag, message: `${tag.label} muy baja (${tag.value.toFixed(1)} ${tag.unit})`, priority: 'alta', time: now, acknowledged: false };
  }
  if (tag.hi !== undefined && tag.value >= tag.hi) {
    return { tag: tag.tag, message: `${tag.label} alta (${tag.value.toFixed(1)} ${tag.unit})`, priority: 'media', time: now, acknowledged: false };
  }
  if (tag.lo !== undefined && tag.value <= tag.lo) {
    return { tag: tag.tag, message: `${tag.label} baja (${tag.value.toFixed(1)} ${tag.unit})`, priority: 'media', time: now, acknowledged: false };
  }
  return null;
}

export const tagState = (tag: ProcessTag): 'normal' | 'warn' | 'alarm' => {
  if ((tag.hiHi !== undefined && tag.value >= tag.hiHi) || (tag.loLo !== undefined && tag.value <= tag.loLo)) return 'alarm';
  if ((tag.hi !== undefined && tag.value >= tag.hi) || (tag.lo !== undefined && tag.value <= tag.lo)) return 'warn';
  return 'normal';
};

// ---------------------------------------------------------------------------
// A worked process: neutralisation with pH control
// ---------------------------------------------------------------------------

export interface NeutralisationSpec {
  /** Influent flow, m³·s⁻¹. */
  flow: number;
  /** Influent acid concentration, mol·m⁻³. */
  acidIn: number;
  /** Tank volume, m³. */
  volume: number;
  /** Base concentration in the dosing line, mol·m⁻³. */
  baseConcentration: number;
  /** Maximum dosing pump flow, m³·s⁻¹. */
  maxDose: number;
  setpointPH: number;
  pid: PidSettings;
}

export interface NeutralisationRun {
  t: number[];
  pH: number[];
  dose: number[];
  excess: number[];
  setpoint: number[];
  /** Integral of absolute error — the standard controller performance index. */
  iae: number;
}

/**
 * pH control of a neutralisation tank.
 *
 * The reason this is the textbook example of a hard control problem is
 * visible in the simulation: the process gain varies by orders of magnitude
 * across the titration curve. Far from neutrality the pH barely moves; near
 * the equivalence point a tiny dose swings it by units. A single set of PID
 * settings cannot be right everywhere, and the student can see the loop go
 * unstable by tuning it for the flat region and then approaching neutrality.
 */
export function simulateNeutralisation(spec: NeutralisationSpec, duration: number, points = 600): NeutralisationRun {
  const dt = duration / points;
  const controller = new PidController(spec.pid);
  const out: NeutralisationRun = { t: [], pH: [], dose: [], excess: [], setpoint: [], iae: 0 };

  // State: net excess of acid in the tank, mol·m⁻³ (negative = excess base).
  let excess = spec.acidIn;
  const tau = spec.volume / spec.flow;

  for (let i = 0; i <= points; i++) {
    const t = i * dt;
    // Strong acid / strong base: pH from the net excess directly, with the
    // water autoprotolysis handled exactly rather than by a branch.
    const pH = pHFromExcess(excess);

    const control = controller.step(spec.setpointPH, pH, dt);
    const dose = Math.max(0, Math.min(spec.maxDose, control.output * spec.maxDose));

    out.t.push(t / 60);
    out.pH.push(pH);
    out.dose.push((dose / spec.maxDose) * 100);
    out.excess.push(excess);
    out.setpoint.push(spec.setpointPH);
    out.iae += Math.abs(spec.setpointPH - pH) * dt;

    // Well-mixed tank: dilution by the influent plus the dosed base.
    const dExcess = (spec.acidIn - excess) / tau
      - (dose * spec.baseConcentration) / spec.volume;
    excess += dExcess * dt;
  }

  return out;
}

/**
 * pH of a strong acid / strong base mixture from the net excess concentration.
 * Solves [H⁺] − K_w/[H⁺] = excess exactly, so it is continuous through
 * neutrality instead of switching between two approximations.
 */
export function pHFromExcess(excessMolPerM3: number): number {
  const c = excessMolPerM3 / 1000; // mol·L⁻¹
  const Kw = 1e-14;
  // [H+]² − c·[H+] − Kw = 0
  const h = (c + Math.sqrt(c * c + 4 * Kw)) / 2;
  return -Math.log10(Math.max(h, 1e-30));
}

/** Residence time distribution of a stirred tank — the E(t) curve. */
export function residenceTimeDistribution(tau: number, tMax: number, points = 200): { t: number[]; E: number[]; F: number[] } {
  const t: number[] = [];
  const E: number[] = [];
  const F: number[] = [];
  for (let i = 0; i <= points; i++) {
    const time = (tMax * i) / points;
    t.push(time);
    E.push((1 / tau) * Math.exp(-time / tau));
    F.push(1 - Math.exp(-time / tau));
  }
  return { t, E, F };
}

/**
 * Conversion in a CSTR versus a plug-flow reactor of the same volume.
 * For a first-order reaction, PFR always wins — one of the first quantitative
 * results of reactor engineering.
 */
export function reactorComparison(k: number, tau: number, order = 1): { cstr: number; pfr: number } {
  if (order === 1) {
    return { cstr: (k * tau) / (1 + k * tau), pfr: 1 - Math.exp(-k * tau) };
  }
  // Second order, equal initial concentrations, in dimensionless form.
  const Da = k * tau;
  const cstr = (-1 + Math.sqrt(1 + 4 * Da)) / (2 * Da);
  return { cstr: 1 - cstr, pfr: Da / (1 + Da) };
}
