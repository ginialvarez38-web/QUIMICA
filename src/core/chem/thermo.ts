/**
 * Chemical thermodynamics.
 *
 * §26: the laws, the state functions, calorimetry, and the bridge to
 * equilibrium. Reaction quantities are assembled from formation data by Hess's
 * law, the equilibrium constant follows from ΔG°, and its temperature
 * dependence follows from van 't Hoff — so the thermodynamic and the
 * equilibrium engines cannot disagree with each other (§2).
 */

import { R, T_STANDARD, P_STANDARD, CP_WATER } from '../constants.js';
import type { Substance } from '../../domain/substance.js';
import { substanceById } from '../../data/substances.js';
import type { ChemicalEquation } from './balance.js';

export interface ReactionThermodynamics {
  /** Standard reaction enthalpy, kJ·mol⁻¹. */
  dH: number;
  /** Standard reaction entropy, J·mol⁻¹·K⁻¹. */
  dS: number;
  /** Standard reaction Gibbs energy at T, kJ·mol⁻¹. */
  dG: number;
  /** Equilibrium constant at T. */
  K: number;
  lnK: number;
  temperature: number;
  exothermic: boolean;
  spontaneous: boolean;
  /** Temperature above/below which the sign of ΔG flips, K. Null when it never does. */
  crossoverTemperature: number | null;
  /** Which term dominates — the enthalpy or the entropy. */
  driver: 'entálpico' | 'entrópico' | 'ambos' | 'ninguno';
  /** Species missing thermodynamic data; the result is partial if non-empty. */
  missing: string[];
}

/**
 * Reaction thermodynamics from tabulated formation data (Hess's law).
 *
 *   ΔH°_r = Σ ν·ΔH°_f(productos) − Σ ν·ΔH°_f(reactivos)
 *
 * Elements in their standard state have ΔH°_f = 0 by definition, which the
 * substance database encodes explicitly rather than by omission.
 */
export function reactionThermodynamics(
  equation: ChemicalEquation,
  temperature: number = T_STANDARD,
  lookup: (formula: string) => Substance | undefined = defaultLookup,
): ReactionThermodynamics {
  let dH = 0;
  let dS = 0;
  const missing: string[] = [];

  const accumulate = (formula: string, coefficient: number, sign: number): void => {
    const s = lookup(formula);
    if (!s?.thermo || s.thermo.dHf === undefined || s.thermo.S0 === undefined) {
      missing.push(formula);
      return;
    }
    dH += sign * coefficient * s.thermo.dHf;
    dS += sign * coefficient * s.thermo.S0;
  };

  equation.reactants.forEach((r) => accumulate(r.formula, r.coefficient, -1));
  equation.products.forEach((p) => accumulate(p.formula, p.coefficient, +1));

  return gibbs(dH, dS, temperature, missing);
}

function defaultLookup(formula: string): Substance | undefined {
  const direct = substanceById(formula.toLowerCase());
  if (direct) return direct;
  return undefined;
}

/**
 * Assemble ΔG, K and the qualitative reading from ΔH and ΔS.
 * ΔH is in kJ·mol⁻¹ and ΔS in J·mol⁻¹·K⁻¹ — the mismatched units of the
 * standard tables, and the single commonest arithmetic slip in the subject,
 * handled here once so no caller has to remember it.
 */
export function gibbs(
  dH: number, dS: number, temperature: number = T_STANDARD, missing: string[] = [],
): ReactionThermodynamics {
  const dG = dH - (temperature * dS) / 1000;
  const lnK = (-dG * 1000) / (R * temperature);
  const crossover = dS !== 0 ? (dH * 1000) / dS : null;

  let driver: ReactionThermodynamics['driver'];
  if (dH < 0 && dS > 0) driver = 'ambos';
  else if (dH > 0 && dS < 0) driver = 'ninguno';
  else if (dH < 0) driver = 'entálpico';
  else driver = 'entrópico';

  return {
    dH, dS, dG, lnK, K: Math.exp(lnK), temperature,
    exothermic: dH < 0,
    spontaneous: dG < 0,
    crossoverTemperature: crossover !== null && crossover > 0 && Number.isFinite(crossover)
      ? crossover : null,
    driver, missing,
  };
}

/** Equilibrium constant from ΔG°, in kJ·mol⁻¹. */
export const kFromDeltaG = (dG: number, T: number = T_STANDARD): number =>
  Math.exp((-dG * 1000) / (R * T));

/** ΔG° from an equilibrium constant, in kJ·mol⁻¹. */
export const deltaGFromK = (K: number, T: number = T_STANDARD): number =>
  (-R * T * Math.log(K)) / 1000;

/**
 * Van 't Hoff: how K responds to temperature.
 *
 *   ln(K₂/K₁) = −(ΔH°/R)·(1/T₂ − 1/T₁)
 *
 * The sign is Le Châtelier made quantitative: an exothermic reaction has its K
 * *reduced* by heating.
 */
export function vantHoffK(K1: number, dH: number, T1: number, T2: number): number {
  return K1 * Math.exp((-dH * 1000 / R) * (1 / T2 - 1 / T1));
}

/** ΔG under non-standard conditions: ΔG = ΔG° + RT·ln Q. */
export function deltaGAtQ(dG0: number, Q: number, T: number = T_STANDARD): number {
  return dG0 + (R * T * Math.log(Q)) / 1000;
}

/**
 * Reaction quotient from concentrations (or partial pressures).
 * Pure solids and liquids have unit activity and are excluded — the omission
 * students most often get wrong, so the function takes an explicit phase.
 */
export function reactionQuotient(
  equation: ChemicalEquation,
  activities: Record<string, number>,
): number {
  let logQ = 0;
  for (const p of equation.products) {
    if (p.state === 's' || p.state === 'l') continue;
    const a = activities[p.formula];
    if (a === undefined || a <= 0) return NaN;
    logQ += p.coefficient * Math.log(a);
  }
  for (const r of equation.reactants) {
    if (r.state === 's' || r.state === 'l') continue;
    const a = activities[r.formula];
    if (a === undefined || a <= 0) return NaN;
    logQ -= r.coefficient * Math.log(a);
  }
  return Math.exp(logQ);
}

export type ShiftDirection = 'productos' | 'reactivos' | 'sin cambio';

export interface LeChatelierPrediction {
  direction: ShiftDirection;
  reason: string;
  /** Q/K before the change; > 1 means the system shifts back toward reactants. */
  ratio?: number;
}

/**
 * Le Châtelier's principle, derived rather than recited.
 *
 * The direction always follows from comparing Q with K after the disturbance,
 * which is the honest formulation — "the system opposes the change" is a
 * mnemonic that fails for the addition of an inert gas at constant volume, a
 * case this function gets right.
 */
export function leChatelier(
  equation: ChemicalEquation,
  thermo: ReactionThermodynamics,
  change: { type: 'concentracion' | 'presion' | 'temperatura' | 'volumen' | 'gas-inerte' | 'catalizador'; species?: string; increase: boolean },
): LeChatelierPrediction {
  const gasMoles = (list: typeof equation.reactants): number =>
    list.filter((s) => s.state === 'g').reduce((sum, s) => sum + s.coefficient, 0);
  const dNGas = gasMoles(equation.products) - gasMoles(equation.reactants);

  switch (change.type) {
    case 'concentracion': {
      const isReactant = equation.reactants.some((r) => r.formula === change.species);
      const shifts = isReactant === change.increase ? 'productos' : 'reactivos';
      return {
        direction: shifts,
        reason: `Al ${change.increase ? 'aumentar' : 'disminuir'} [${change.species}], Q se aleja de K y el sistema evoluciona hacia ${shifts} hasta restaurar Q = K.`,
      };
    }
    case 'temperatura': {
      // Heat is a reactant for an endothermic reaction, a product for an exothermic one.
      const shifts: ShiftDirection = thermo.exothermic === change.increase ? 'reactivos' : 'productos';
      return {
        direction: shifts,
        reason: thermo.exothermic
          ? `La reacción es exotérmica (ΔH° = ${thermo.dH.toFixed(1)} kJ·mol⁻¹): calentar reduce K, y el equilibrio se desplaza hacia ${shifts}.`
          : `La reacción es endotérmica (ΔH° = +${thermo.dH.toFixed(1)} kJ·mol⁻¹): calentar aumenta K, y el equilibrio se desplaza hacia ${shifts}.`,
      };
    }
    case 'presion':
    case 'volumen': {
      const compressing = change.type === 'presion' ? change.increase : !change.increase;
      if (dNGas === 0) {
        return {
          direction: 'sin cambio',
          reason: 'El número de moles de gas es el mismo en ambos lados (Δn = 0): comprimir no desplaza el equilibrio.',
        };
      }
      const shifts: ShiftDirection = compressing === (dNGas < 0) ? 'productos' : 'reactivos';
      return {
        direction: shifts,
        reason: `Δn(gas) = ${dNGas > 0 ? '+' : ''}${dNGas}. Al ${compressing ? 'comprimir' : 'expandir'}, el sistema se desplaza hacia el lado con ${compressing ? 'menos' : 'más'} moles de gas: ${shifts}.`,
      };
    }
    case 'gas-inerte':
      return {
        direction: 'sin cambio',
        reason: 'Añadir un gas inerte a volumen constante no cambia las presiones parciales de las especies reactivas, así que Q no varía. (A presión total constante sí desplazaría, porque el volumen aumentaría.)',
      };
    case 'catalizador':
      return {
        direction: 'sin cambio',
        reason: 'Un catalizador acelera por igual las reacciones directa e inversa: cambia el tiempo hasta el equilibrio, nunca su posición.',
      };
  }
}

// ---------------------------------------------------------------------------
// Calorimetry
// ---------------------------------------------------------------------------

export interface CalorimetryResult {
  /** Heat absorbed by the calorimeter contents, J. */
  q: number;
  /** Molar enthalpy of the reaction, kJ·mol⁻¹ (negative when exothermic). */
  dHmolar: number;
  /** Temperature change, K. */
  dT: number;
  /** Contribution of the calorimeter itself, J. */
  qCalorimeter: number;
}

/**
 * Constant-pressure calorimetry.
 *
 *   q = (m·c + C_cal)·ΔT,   ΔH = −q/n
 *
 * The calorimeter constant C_cal is included because ignoring it is the
 * systematic error every coffee-cup calorimetry experiment actually suffers,
 * and the virtual laboratory reproduces it (§33).
 */
export function calorimetry(
  massGrams: number, specificHeat: number, deltaT: number,
  molesLimiting: number, calorimeterConstant = 0,
): CalorimetryResult {
  const qSolution = massGrams * specificHeat * deltaT;
  const qCal = calorimeterConstant * deltaT;
  const q = qSolution + qCal;
  return {
    q, qCalorimeter: qCal, dT: deltaT,
    dHmolar: molesLimiting > 0 ? -q / molesLimiting / 1000 : NaN,
  };
}

/** Heat needed to change the temperature of a mass of substance. */
export const sensibleHeat = (mass: number, cp: number, dT: number): number => mass * cp * dT;

/** Heat of a phase change. */
export const latentHeat = (moles: number, dHkJ: number): number => moles * dHkJ * 1000;

export interface HeatingCurvePoint { t: number; T: number; phase: string; heatAdded: number }

/**
 * Heating curve of a pure substance, including the plateaus at the phase
 * transitions.
 *
 * §63 in miniature: the temperature is not scripted to rise, it is computed
 * from the power delivered, the mass, the heat capacity and the latent heats,
 * so an under-powered heater produces a curve that never reaches the boiling
 * point and a student can see why.
 */
export function heatingCurve(
  substance: {
    massGrams: number; cpSolid: number; cpLiquid: number; cpGas: number;
    meltingPoint: number; boilingPoint: number;
    dHfusJPerG: number; dHvapJPerG: number;
  },
  powerWatts: number, startT: number, duration: number, points = 400,
): HeatingCurvePoint[] {
  const out: HeatingCurvePoint[] = [];
  const m = substance.massGrams;
  let T = startT;
  let phase: string = T < substance.meltingPoint ? 'sólido'
    : T < substance.boilingPoint ? 'líquido' : 'gas';
  let latentRemaining = 0;
  const dt = duration / points;
  let heat = 0;

  for (let i = 0; i <= points; i++) {
    out.push({ t: i * dt, T, phase, heatAdded: heat });
    const dQ = powerWatts * dt;
    heat += dQ;

    if (latentRemaining > 0) {
      // In a phase transition the temperature is pinned until the latent heat
      // has been supplied — the plateau is a consequence, not a drawing.
      latentRemaining -= dQ;
      if (latentRemaining <= 0) {
        phase = phase === 'fusión' ? 'líquido' : 'gas';
        const excess = -latentRemaining;
        const cp = phase === 'líquido' ? substance.cpLiquid : substance.cpGas;
        T += excess / (m * cp);
        latentRemaining = 0;
      }
      continue;
    }

    const cp = phase === 'sólido' ? substance.cpSolid
      : phase === 'líquido' ? substance.cpLiquid : substance.cpGas;
    const dT = dQ / (m * cp);

    if (phase === 'sólido' && T + dT >= substance.meltingPoint) {
      const used = (substance.meltingPoint - T) * m * cp;
      T = substance.meltingPoint;
      phase = 'fusión';
      latentRemaining = m * substance.dHfusJPerG - (dQ - used);
      if (latentRemaining <= 0) { phase = 'líquido'; latentRemaining = 0; }
    } else if (phase === 'líquido' && T + dT >= substance.boilingPoint) {
      const used = (substance.boilingPoint - T) * m * cp;
      T = substance.boilingPoint;
      phase = 'ebullición';
      latentRemaining = m * substance.dHvapJPerG - (dQ - used);
      if (latentRemaining <= 0) { phase = 'gas'; latentRemaining = 0; }
    } else {
      T += dT;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gases
// ---------------------------------------------------------------------------

/** Ideal gas law, solving for whichever quantity is omitted. */
export function idealGas(known: { P?: number; V?: number; n?: number; T?: number }): {
  P: number; V: number; n: number; T: number;
} {
  const { P, V, n, T } = known;
  if (P === undefined) return { P: (n! * R * T!) / V!, V: V!, n: n!, T: T! };
  if (V === undefined) return { P, V: (n! * R * T!) / P, n: n!, T: T! };
  if (n === undefined) return { P, V: V!, n: (P * V!) / (R * T!), T: T! };
  return { P, V: V!, n: n!, T: (P * V!) / (n * R) };
}

/** Van der Waals constants for the gases the curriculum uses. a: Pa·m⁶·mol⁻², b: m³·mol⁻¹ */
export const VAN_DER_WAALS: Record<string, { a: number; b: number; name: string }> = {
  He: { a: 0.00346, b: 23.71e-6, name: 'helio' },
  H2: { a: 0.02476, b: 26.61e-6, name: 'hidrógeno' },
  N2: { a: 0.1408, b: 39.13e-6, name: 'nitrógeno' },
  O2: { a: 0.1378, b: 31.83e-6, name: 'oxígeno' },
  CO2: { a: 0.3640, b: 42.67e-6, name: 'dióxido de carbono' },
  NH3: { a: 0.4225, b: 37.07e-6, name: 'amoníaco' },
  CH4: { a: 0.2283, b: 42.78e-6, name: 'metano' },
  H2O: { a: 0.5536, b: 30.49e-6, name: 'agua' },
  Ar: { a: 0.1355, b: 32.01e-6, name: 'argón' },
  Cl2: { a: 0.6579, b: 56.22e-6, name: 'cloro' },
};

/**
 * Van der Waals pressure:  (P + a·n²/V²)(V − n·b) = nRT
 *
 * The comparison with the ideal law is the lesson: at 1 bar the two agree to
 * a fraction of a percent, at 100 bar they do not, and the sign of the
 * deviation tells you whether attraction or excluded volume dominates.
 */
export function vanDerWaalsPressure(gas: string, n: number, V: number, T: number): number {
  const c = VAN_DER_WAALS[gas];
  if (!c) return (n * R * T) / V;
  return (n * R * T) / (V - n * c.b) - (c.a * n * n) / (V * V);
}

/** Compressibility factor Z = PV/nRT. Z = 1 exactly for an ideal gas. */
export function compressibility(gas: string, n: number, V: number, T: number): number {
  const P = vanDerWaalsPressure(gas, n, V, T);
  return (P * V) / (n * R * T);
}

/** Critical constants from the van der Waals parameters. */
export function criticalConstants(gas: string): { Tc: number; Pc: number; Vc: number } | null {
  const c = VAN_DER_WAALS[gas];
  if (!c) return null;
  return {
    Tc: (8 * c.a) / (27 * R * c.b),
    Pc: c.a / (27 * c.b * c.b),
    Vc: 3 * c.b,
  };
}

/** Antoine vapour pressure, log₁₀(P/bar) = A − B/(C + T). Returns Pa. */
export function antoinePressure(coeffs: { A: number; B: number; C: number }, T: number): number {
  return Math.pow(10, coeffs.A - coeffs.B / (coeffs.C + T)) * 1e5;
}

/** Boiling temperature at a given pressure, by inverting Antoine. */
export function boilingPointAt(coeffs: { A: number; B: number; C: number }, pressurePa: number): number {
  const logP = Math.log10(pressurePa / 1e5);
  return coeffs.B / (coeffs.A - logP) - coeffs.C;
}

/**
 * Clausius–Clapeyron: enthalpy of vaporisation from two (T, P) points, or the
 * vapour pressure at a second temperature.
 */
export function clausiusClapeyron(P1: number, T1: number, P2: number, T2: number): number {
  return (R * Math.log(P2 / P1)) / (1 / T1 - 1 / T2) / 1000; // kJ·mol⁻¹
}

// ---------------------------------------------------------------------------
// Colligative properties
// ---------------------------------------------------------------------------

/** Cryoscopic and ebullioscopic constants, K·kg·mol⁻¹. */
export const COLLIGATIVE_CONSTANTS: Record<string, { Kf: number; Kb: number; Tf: number; Tb: number; name: string }> = {
  agua: { Kf: 1.86, Kb: 0.512, Tf: 273.15, Tb: 373.15, name: 'agua' },
  benceno: { Kf: 5.12, Kb: 2.53, Tf: 278.68, Tb: 353.24, name: 'benceno' },
  ciclohexano: { Kf: 20.0, Kb: 2.79, Tf: 279.69, Tb: 353.87, name: 'ciclohexano' },
  acidoacetico: { Kf: 3.90, Kb: 3.07, Tf: 289.6, Tb: 391.05, name: 'ácido acético' },
};

export interface ColligativeResult {
  freezingPointDepression: number;
  boilingPointElevation: number;
  osmoticPressure: number;
  /** Van 't Hoff factor actually used. */
  i: number;
  molality: number;
}

/**
 * Colligative properties. The van 't Hoff factor i is the number of particles
 * per formula unit — 1 for glucose, 2 for NaCl, 3 for CaCl₂ — and it is the
 * reason a mole of salt depresses the freezing point twice as far as a mole of
 * sugar.
 */
export function colligative(
  molality: number, i = 1, solvent = 'agua', molarityForOsmotic = molality, T = T_STANDARD,
): ColligativeResult {
  const c = COLLIGATIVE_CONSTANTS[solvent] ?? COLLIGATIVE_CONSTANTS.agua;
  return {
    freezingPointDepression: i * c.Kf * molality,
    boilingPointElevation: i * c.Kb * molality,
    osmoticPressure: i * molarityForOsmotic * 1000 * R * T, // Pa, with c in mol·m⁻³
    i, molality,
  };
}

/** Specific heat capacity of water, re-exported for calorimetry callers. */
export { CP_WATER, P_STANDARD };
