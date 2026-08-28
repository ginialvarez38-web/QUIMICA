/**
 * General aqueous equilibrium solver.
 *
 * This is the engine behind every solution-chemistry number in CHEMIA: pH,
 * buffer capacity, titration curves, speciation diagrams, solubility, the
 * common-ion effect, selective precipitation, complexation and the ionic
 * composition a pH electrode or a conductivity cell reports. There is exactly
 * one of it (§2, §76) — Química Analítica II and Hidroquímica call the same
 * code with different data.
 *
 * ── Method ────────────────────────────────────────────────────────────────
 * The component / species tableau formulation used by professional codes
 * (MINEQL, PHREEQC, Visual MINTEQ):
 *
 *   Every species i is written as a formation reaction from a chosen set of
 *   independent components j:
 *
 *       Σ_j a_ij · X_j  ⇌  S_i        with formation constant β_i
 *
 *   so its concentration follows directly from the free component activities:
 *
 *       [S_i] = β_i · Π_j (γ_j·[X_j])^{a_ij} / γ_i
 *
 *   The unknowns are the free component concentrations, fixed by the mass
 *   balance on each component:
 *
 *       T_j = Σ_i a_ij · [S_i]
 *
 *   That is a small system of nonlinear equations, solved by Newton's method
 *   in log space (the unknowns span twenty decades, so log space is not a
 *   convenience but a requirement), with activity coefficients refreshed on an
 *   outer loop until the ionic strength is self-consistent.
 *
 * Writing it this way means the solver never needs to know whether it is doing
 * "acid–base chemistry" or "complexation" — those are just different tableaux.
 */

import { newtonSystem } from '../math/roots.js';
import { R, T_STANDARD, KW_25, DH_WATER_IONISATION } from '../constants.js';
import {
  activityCoefficient, ionicStrength, waterPermittivity,
  type ActivityContext, type ActivityModel,
} from './activity.js';

/** An independent component of the system. H is always present. */
export interface Component {
  /** Short key used in the stoichiometry vectors, e.g. "H", "Ac", "Ca". */
  id: string;
  name: string;
  /** Charge of the free component species, e.g. H → +1, Ac → −1, Ca → +2. */
  charge: number;
  /** Formula of the free component as displayed, e.g. "H+", "CH3COO-". */
  formula: string;
}

/** A dissolved species formed from the components. */
export interface AqueousSpecies {
  id: string;
  formula: string;
  name?: string;
  /** Stoichiometric coefficients over the components, keyed by component id. */
  stoich: Record<string, number>;
  /** log₁₀ of the cumulative formation constant at 25 °C. */
  logBeta: number;
  /** Standard reaction enthalpy of formation from the components, J·mol⁻¹. Enables van 't Hoff. */
  deltaH?: number;
  charge: number;
  /** Marks the species as the free component itself (logβ = 0). */
  isComponent?: boolean;
}

/** A solid that may precipitate. */
export interface SolidPhase {
  id: string;
  formula: string;
  name?: string;
  stoich: Record<string, number>;
  /** log₁₀ K_s0 for  Solid ⇌ Σ a_ij X_j  (i.e. the solubility product). */
  logKsp: number;
  deltaH?: number;
  /** Molar mass, g·mol⁻¹ — used to report a precipitate mass. */
  molarMass?: number;
}

/**
 * A gas held at a fixed partial pressure, in equilibrium with the solution.
 *
 * A fixed-fugacity phase does not add a species to a mass balance — it
 * *replaces* one. An open beaker exchanging CO₂ with the atmosphere has no
 * fixed carbonate total: the total is whatever the atmosphere dictates at the
 * prevailing pH. The phase therefore names the component whose mass balance it
 * takes over, and contributes the constraint
 *
 *     Σ_j a_j · log(activity of component j) = log K + log P
 *
 * which is exactly the equilibrium condition for the dissolution reaction.
 */
export interface GasPhase {
  id: string;
  formula: string;
  /** Stoichiometry of the dissolution reaction over the components. */
  stoich: Record<string, number>;
  /** log₁₀ K for  Gas(g) ⇌ Σ a_j X_j, at 1 bar. */
  logK: number;
  deltaH?: number;
  /** Component whose mass balance this phase replaces. */
  controls: string;
}

export interface EquilibriumModel {
  components: Component[];
  species: AqueousSpecies[];
  solids?: SolidPhase[];
  gases?: GasPhase[];
  /** Charge carried by inert spectator ions (Na⁺ from NaOH, Cl⁻ from NaCl…). */
  inertCations?: number;
  inertAnions?: number;
}

export interface SolveOptions {
  temperature?: number;
  activityModel?: ActivityModel;
  /** Fix pH instead of solving for it (a pH-stat titration, or a buffer bath). */
  fixedPH?: number;
  /**
   * Which equation determines the proton component.
   *
   * `charge-balance` (the default) imposes electroneutrality, which is
   * reference-free and therefore always correct. `proton-condition` imposes the
   * mass balance on T_H, which is what a textbook writes but which depends on
   * choosing a proton reference level — and that choice breaks down as soon as
   * a component's total is itself free, as it is for a solution open to the
   * atmosphere. The two agree exactly on closed systems; offering both lets a
   * student verify that for themselves.
   */
  protonEquation?: 'charge-balance' | 'proton-condition';
  /** Partial pressures of any gas phases in equilibrium with the solution, bar. */
  partialPressures?: Record<string, number>;
  /** Allow solids to precipitate. When false, supersaturation is reported but not relieved. */
  allowPrecipitation?: boolean;
  maxOuterIterations?: number;
  tolerance?: number;
}

export interface SpeciesResult {
  id: string;
  formula: string;
  name?: string;
  /** Free concentration, mol·L⁻¹. */
  concentration: number;
  /** Activity, mol·L⁻¹. */
  activity: number;
  activityCoefficient: number;
  charge: number;
  /** Fraction of the component this species accounts for, per component id. */
  fractions: Record<string, number>;
}

export interface PrecipitateResult {
  id: string;
  formula: string;
  /** Moles precipitated per litre of solution. */
  amount: number;
  massGrams?: number;
  /** log(Q/K); 0 at equilibrium with the solid present. */
  saturationIndex: number;
}

export interface Speciation {
  /** −log₁₀ of the hydrogen-ion *activity* — what a pH electrode measures. */
  pH: number;
  /** −log₁₀ of the hydrogen-ion *concentration*. Differs from pH whenever I > 0. */
  pcH: number;
  pOH: number;
  /** Free concentration of each component, mol·L⁻¹. */
  free: Record<string, number>;
  species: SpeciesResult[];
  precipitates: PrecipitateResult[];
  /** Species that are supersaturated but were not allowed to precipitate. */
  supersaturated: PrecipitateResult[];
  ionicStrength: number;
  temperature: number;
  activityModel: ActivityModel;
  /** Sum of positive minus negative charge, mol·L⁻¹. Should be ~0. */
  chargeBalance: number;
  converged: boolean;
  iterations: number;
  /** Residual of the worst mass balance, relative. */
  residual: number;
  warnings: string[];
  /** Kw at the working temperature. */
  Kw: number;
}

/** Temperature correction of a formation constant by the van 't Hoff equation. */
export function vantHoff(logK25: number, deltaH: number | undefined, T: number): number {
  if (deltaH === undefined || T === T_STANDARD) return logK25;
  // ln(K_T/K_298) = −ΔH°/R · (1/T − 1/298.15)
  const dlnK = (-deltaH / R) * (1 / T - 1 / T_STANDARD);
  return logK25 + dlnK / Math.LN10;
}

/** Ion product of water at temperature T, from the enthalpy of ionisation. */
export function kwAt(T: number): number {
  return Math.pow(10, vantHoff(Math.log10(KW_25), DH_WATER_IONISATION, T));
}

/**
 * Water is always part of the system. `waterSpecies` adds H⁺ and OH⁻ to any
 * model, so no caller has to remember to — forgetting the autoprotolysis is
 * the classic mistake this design makes impossible.
 */
export const H_COMPONENT: Component = { id: 'H', name: 'Protón', charge: 1, formula: 'H+' };

export function waterSpecies(): AqueousSpecies[] {
  return [
    { id: 'H+', formula: 'H+', name: 'ion hidrógeno', stoich: { H: 1 }, logBeta: 0, charge: 1, isComponent: true },
    {
      id: 'OH-', formula: 'OH-', name: 'ion hidróxido', stoich: { H: -1 },
      logBeta: Math.log10(KW_25), charge: -1, deltaH: -DH_WATER_IONISATION,
    },
  ];
}

/**
 * Solve the equilibrium system for the given analytical totals.
 *
 * `totals` gives T_j for each component in mol·L⁻¹ — the *analytical*
 * concentration, i.e. what was weighed out, not what is free in solution.
 * The proton total T_H is a proton *condition*: it may legitimately be
 * negative (a solution of pure NaOH has T_H < 0).
 */
export function solveEquilibrium(
  model: EquilibriumModel,
  totals: Record<string, number>,
  options: SolveOptions = {},
): Speciation {
  const T = options.temperature ?? T_STANDARD;
  const activityModel = options.activityModel ?? 'davies';
  const tol = options.tolerance ?? 1e-11;
  const maxOuter = options.maxOuterIterations ?? 40;
  const allowPrecipitation = options.allowPrecipitation ?? true;
  const warnings: string[] = [];

  const components = model.components;
  const compIds = components.map((c) => c.id);
  const nC = compIds.length;

  // Temperature-corrected constants.
  const species = model.species.map((s) => ({ ...s, logBeta: vantHoff(s.logBeta, s.deltaH, T) }));
  const solids = (model.solids ?? []).map((s) => ({ ...s, logKsp: vantHoff(s.logKsp, s.deltaH, T) }));

  // Fixed-fugacity gas phases replace the mass balance of the component they
  // control (see the GasPhase doc comment).
  const activeGases = (model.gases ?? [])
    .map((g) => ({ g, P: options.partialPressures?.[g.id] }))
    .filter((e): e is { g: GasPhase; P: number } => e.P !== undefined && e.P > 0);
  const gasControlled = new Map<string, { g: GasPhase; P: number }>();
  for (const entry of activeGases) gasControlled.set(entry.g.controls, entry);

  const allSpecies = species;
  const useChargeBalance = (options.protonEquation ?? 'charge-balance') === 'charge-balance'
    && options.fixedPH === undefined;

  // Outer loop: activity coefficients depend on the ionic strength, which
  // depends on the speciation, which depends on the activity coefficients.
  let I = 0;
  let gamma: Record<string, number> = {};
  let logFree = compIds.map((id) => seedLog(id, totals[id] ?? 0));
  let converged = false;
  let iterations = 0;
  let residual = Infinity;
  let precipitated: Record<string, number> = {};
  const activeSolids = new Set<string>();

  for (let outer = 0; outer < maxOuter; outer++) {
    const ctx: ActivityContext = { model: activityModel, I, temperature: T };
    gamma = {};
    for (const s of allSpecies) gamma[s.id] = activityCoefficient(s.charge, ctx, s.formula);
    for (const c of components) gamma[c.id] = activityCoefficient(c.charge, ctx, c.formula);

    // Concentration of each species from the free component concentrations.
    const speciesConc = (lf: number[]): number[] =>
      allSpecies.map((s) => {
        let logC = s.logBeta;
        for (let j = 0; j < nC; j++) {
          const a = s.stoich[compIds[j]] ?? 0;
          if (a === 0) continue;
          // β is written in activities: convert to concentration at the end.
          logC += a * (lf[j] + Math.log10(gamma[compIds[j]] || 1));
        }
        logC -= Math.log10(gamma[s.id] || 1);
        return Math.pow(10, Math.min(logC, 40));
      });

    /**
     * Per-equation normalisation, computed once per outer iteration.
     *
     * The scales must not depend on the current iterate. Normalising by the
     * largest term present at each step saturates the residual near 1 however
     * far the guess is from the answer, which flattens the gradient and stalls
     * Newton on any polyprotic system. A fixed scale keeps the residual
     * proportional to the error, which is what the line search needs.
     */
    const maxTotal = Math.max(...compIds.map((id) => Math.abs(totals[id] ?? 0)), 1e-9);
    const chargeScale = Math.max(
      Math.abs((model.inertCations ?? 0) - (model.inertAnions ?? 0)),
      maxTotal,
      1e-9,
    );
    const balanceScale: Record<string, number> = {};
    for (const id of compIds) balanceScale[id] = Math.max(Math.abs(totals[id] ?? 0), 1e-12);

    /**
     * The unknown vector is [log(free component)…, precipitated amount…].
     *
     * A precipitate cannot be computed after the fact. Once a solid is present
     * the free concentrations are pinned by its solubility product rather than
     * by the mass balances, and the amount precipitated is what absorbs the
     * difference — so the amount is a genuine unknown and the solubility
     * product is a genuine equation. Solving them together is what makes the
     * common-ion effect and selective precipitation come out right.
     *
     * Amounts are scaled by the largest analytical total so the Jacobian mixes
     * log-space and linear-space unknowns without becoming ill-conditioned.
     */
    const solidList = solids.filter((s) => activeSolids.has(s.id));
    const nS = solidList.length;
    const amountScale = maxTotal;

    const F = (x: number[]): number[] => {
      const lf = x.slice(0, nC);
      const amounts = x.slice(nC).map((v) => v * amountScale);
      const conc = speciesConc(lf);
      const logA = compIds.map((id, j) => lf[j] + Math.log10(gamma[id] || 1));
      const out = new Array(nC + nS).fill(0);

      for (let j = 0; j < nC; j++) {
        const id = compIds[j];

        // Electroneutrality determines the free proton concentration.
        if (id === 'H' && useChargeBalance) {
          // Solids are electrically neutral by construction, so they drop out
          // of the charge balance entirely — only dissolved species count.
          let net = (model.inertCations ?? 0) - (model.inertAnions ?? 0);
          for (let i = 0; i < allSpecies.length; i++) {
            const z = allSpecies[i].charge;
            if (z !== 0) net += z * conc[i];
          }
          out[j] = net / chargeScale;
          continue;
        }

        // A phase held at fixed fugacity replaces this component's balance.
        const gas = gasControlled.get(id);
        if (gas) {
          const logK = vantHoff(gas.g.logK, gas.g.deltaH, T) + Math.log10(gas.P);
          let lhs = 0;
          for (let k = 0; k < nC; k++) {
            const a = gas.g.stoich[compIds[k]] ?? 0;
            if (a !== 0) lhs += a * logA[k];
          }
          out[j] = lhs - logK;
          continue;
        }

        let sum = 0;
        for (let i = 0; i < allSpecies.length; i++) {
          const a = allSpecies[i].stoich[id] ?? 0;
          if (a !== 0) sum += a * conc[i];
        }
        solidList.forEach((s, k) => { sum += (s.stoich[id] ?? 0) * amounts[k]; });
        out[j] = (sum - (totals[id] ?? 0)) / balanceScale[id];
      }

      // One solubility-product equation per solid present.
      solidList.forEach((s, k) => {
        let logQ = 0;
        for (let j = 0; j < nC; j++) {
          const a = s.stoich[compIds[j]] ?? 0;
          if (a !== 0) logQ += a * logA[j];
        }
        out[nC + k] = logQ - s.logKsp;
      });

      // A pH-stat run replaces the proton mass balance with a fixed pH.
      if (options.fixedPH !== undefined) {
        const hIndex = compIds.indexOf('H');
        if (hIndex >= 0) out[hIndex] = logA[hIndex] + options.fixedPH;
      }
      return out;
    };

    const bounds: [number[], number[]] = [
      [...new Array(nC).fill(-45), ...new Array(nS).fill(0)],
      [...new Array(nC).fill(3), ...new Array(nS).fill(1e6)],
    ];
    const seedAmounts = solidList.map((s) => (precipitated[s.id] ?? maxTotal * 0.5) / amountScale);
    let result = newtonSystem(F, [...logFree, ...seedAmounts], { tol, maxIter: 220, bounds });

    // A multi-equilibrium system has a wide basin of attraction but not an
    // infinite one; a badly-placed start on a polyprotic ladder can leave the
    // iteration on a plateau. Retry from a spread of pH seeds before giving up.
    if (!result.converged) {
      const seeds = [-1, -3, -5, -7, -9, -11, -13];
      for (const pHSeed of seeds) {
        const trial = [
          ...compIds.map((id) =>
            id === 'H' ? pHSeed : Math.log10(Math.max(Math.abs(totals[id] ?? 0), 1e-10))),
          ...solidList.map(() => 0.5),
        ];
        const attempt = newtonSystem(F, trial, { tol, maxIter: 220, bounds });
        iterations += attempt.iterations;
        if (attempt.residual < result.residual) result = attempt;
        if (result.converged) break;
      }
    }

    logFree = result.x.slice(0, nC);
    const solvedAmounts = result.x.slice(nC).map((v) => v * amountScale);
    solidList.forEach((s, k) => { precipitated[s.id] = solvedAmounts[k]; });
    residual = result.residual;
    iterations += result.iterations;
    converged = result.converged;

    const conc = speciesConc(logFree);

    // Ionic strength from every charged species plus the inert spectators.
    const contributions = allSpecies.map((s, i) => ({ c: conc[i], z: s.charge }));
    if (model.inertCations) contributions.push({ c: model.inertCations, z: 1 });
    if (model.inertAnions) contributions.push({ c: model.inertAnions, z: -1 });
    const newI = ionicStrength(contributions);

    /*
     * Phase assemblage update.
     *
     * A solid joins the assemblage when the solution is supersaturated with
     * respect to it, and leaves when the amount the solver returns has fallen
     * to zero — meaning it has completely redissolved. Changing the assemblage
     * changes the equations, so the outer loop runs again whenever it happens.
     */
    let phaseChanged = false;
    if (allowPrecipitation && solids.length > 0) {
      const freeLogA = compIds.map((id, j) => logFree[j] + Math.log10(gamma[id] || 1));
      for (const s of solids) {
        let logQ = 0;
        for (let j = 0; j < nC; j++) logQ += (s.stoich[compIds[j]] ?? 0) * freeLogA[j];
        const si = logQ - s.logKsp;
        if (!activeSolids.has(s.id) && si > 1e-6) {
          activeSolids.add(s.id);
          precipitated[s.id] = maxTotal * 0.5;
          phaseChanged = true;
        } else if (activeSolids.has(s.id) && (precipitated[s.id] ?? 0) <= maxTotal * 1e-12) {
          activeSolids.delete(s.id);
          delete precipitated[s.id];
          phaseChanged = true;
        }
      }
    }

    const dI = Math.abs(newI - I);
    I = newI;
    if (!phaseChanged && dI < 1e-9 * Math.max(newI, 1e-6) && converged) break;
    if (outer === maxOuter - 1) {
      warnings.push('El cálculo de fuerza iónica no convergió por completo; los coeficientes de actividad son aproximados.');
    }
  }

  // ---- Assemble the result -------------------------------------------------
  const ctx: ActivityContext = { model: activityModel, I, temperature: T };
  for (const s of allSpecies) gamma[s.id] = activityCoefficient(s.charge, ctx, s.formula);
  for (const c of components) gamma[c.id] = activityCoefficient(c.charge, ctx, c.formula);

  const free: Record<string, number> = {};
  compIds.forEach((id, j) => { free[id] = Math.pow(10, logFree[j]); });

  const conc = allSpecies.map((s) => {
    let logC = s.logBeta;
    for (let j = 0; j < nC; j++) {
      const a = s.stoich[compIds[j]] ?? 0;
      if (a !== 0) logC += a * (logFree[j] + Math.log10(gamma[compIds[j]] || 1));
    }
    logC -= Math.log10(gamma[s.id] || 1);
    return Math.pow(10, Math.min(logC, 40));
  });

  const speciesResults: SpeciesResult[] = allSpecies.map((s, i) => {
    const fractions: Record<string, number> = {};
    for (const id of compIds) {
      const a = s.stoich[id] ?? 0;
      const Tj = totals[id] ?? 0;
      if (a !== 0 && Tj > 0) fractions[id] = (a * conc[i]) / Tj;
    }
    return {
      id: s.id, formula: s.formula, name: s.name,
      concentration: conc[i],
      activity: conc[i] * (gamma[s.id] || 1),
      activityCoefficient: gamma[s.id] || 1,
      charge: s.charge,
      fractions,
    };
  });

  const hIdx = compIds.indexOf('H');
  const hFree = hIdx >= 0 ? free.H : NaN;
  const gammaH = gamma.H || 1;
  const pcH = -Math.log10(hFree);
  const pH = -Math.log10(hFree * gammaH);
  const Kw = kwAt(T);
  const pOH = -Math.log10(Kw / (hFree * gammaH));

  // Precipitates and unrelieved supersaturation.
  const freeLogA = compIds.map((id, j) => logFree[j] + Math.log10(gamma[id] || 1));
  const precipitates: PrecipitateResult[] = [];
  const supersaturated: PrecipitateResult[] = [];
  for (const s of solids) {
    let logQ = 0;
    for (let j = 0; j < nC; j++) logQ += (s.stoich[compIds[j]] ?? 0) * freeLogA[j];
    const si = logQ - s.logKsp;
    const amount = precipitated[s.id] ?? 0;
    const entry: PrecipitateResult = {
      id: s.id, formula: s.formula, amount,
      massGrams: s.molarMass ? amount * s.molarMass : undefined,
      saturationIndex: si,
    };
    if (activeSolids.has(s.id) && amount > 1e-14) precipitates.push(entry);
    else if (si > 1e-6) supersaturated.push(entry);
  }

  // Charge balance is an independent check on the solution, not an input to it.
  let chargeBalance = (model.inertCations ?? 0) - (model.inertAnions ?? 0);
  speciesResults.forEach((s) => { chargeBalance += s.charge * s.concentration; });

  if (Math.abs(chargeBalance) > 1e-6 * Math.max(...Object.values(totals).map(Math.abs), 1e-6)) {
    warnings.push(
      `El balance de cargas no cierra (${chargeBalance.toExponential(2)} eq·L⁻¹). `
      + 'Comprueba los iones espectadores declarados en el modelo.',
    );
  }
  if (!converged) {
    warnings.push('El solver no alcanzó la tolerancia: trata el resultado como orientativo.');
  }

  return {
    pH, pcH, pOH, free, species: speciesResults, precipitates, supersaturated,
    ionicStrength: I, temperature: T, activityModel, chargeBalance,
    converged, iterations, residual, warnings, Kw,
  };
}

/** Initial guess for a free component concentration, in log₁₀. */
function seedLog(id: string, total: number): number {
  if (id === 'H') return -7;
  return Math.log10(Math.max(Math.abs(total), 1e-9)) - 0.5;
}

/**
 * Saturation index of a solid for an arbitrary solution, without solving:
 * SI = log(Q/K). Positive means supersaturated, negative undersaturated.
 * Reported alongside every hydrochemistry analysis (§46).
 */
export function saturationIndex(
  solid: SolidPhase,
  activities: Record<string, number>,
): number {
  let logQ = 0;
  for (const [id, a] of Object.entries(solid.stoich)) {
    const act = activities[id];
    if (act === undefined || act <= 0) return -Infinity;
    logQ += a * Math.log10(act);
  }
  return logQ - solid.logKsp;
}

/** Convenience: solve and return only the pH. */
export function pHOf(model: EquilibriumModel, totals: Record<string, number>, opts?: SolveOptions): number {
  return solveEquilibrium(model, totals, opts).pH;
}

/** Water permittivity re-exported so callers do not need the activity module. */
export { waterPermittivity };
