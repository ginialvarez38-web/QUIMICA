/**
 * Titration simulation.
 *
 * §35: a titration must be a real simulation, not a drawn curve. Every point on
 * every curve produced here is an independent call to the equilibrium solver
 * with the volume-corrected totals — so the shape of the curve, the position of
 * the equivalence point, the height of the break and the buffer plateau are all
 * consequences of the chemistry, never of a fitted function.
 *
 * That has a pedagogical payoff the drawn version cannot match: change the pKa
 * in the substance database and the curve changes correctly; dilute the titrant
 * and the break shrinks by the right amount; titrate a polyprotic acid and the
 * second inflection appears (or fails to appear, when the pKa values are too
 * close) for the right reason.
 */

import { buildSolution, solveSolution, type Addition } from './solution.js';
import { solveEquilibrium, type Speciation } from './equilibrium.js';
import type { ActivityModel } from './activity.js';
import { derivative } from '../math/signal.js';
import { T_STANDARD } from '../constants.js';

export interface TitrationSetup {
  /** What is in the flask at the start. */
  analyte: Addition[];
  /** Initial volume in the flask, litres. */
  initialVolume: number;
  /** Reagent delivered from the burette. */
  titrantId: string;
  /** Titrant concentration, mol·L⁻¹. */
  titrantConcentration: number;
  /** Final burette volume to simulate, litres. */
  finalVolume: number;
  /** Number of points across that range. */
  points?: number;
  temperature?: number;
  activityModel?: ActivityModel;
  /** Extra background electrolyte in the flask (ionic-strength adjuster). */
  background?: Addition[];
}

export interface TitrationPoint {
  /** Titrant volume added, litres. */
  volume: number;
  /** Titrant volume added, millilitres — the number on the burette. */
  volumeML: number;
  pH: number;
  pcH: number;
  /** Total volume in the flask. */
  totalVolume: number;
  ionicStrength: number;
  /** Free concentration of every component, mol·L⁻¹. */
  free: Record<string, number>;
  /** Fraction of each analyte species, for the speciation overlay. */
  fractions: Record<string, number>;
  /** Buffer capacity β = dC_base/dpH, mol·L⁻¹ per pH unit. */
  bufferCapacity?: number;
  precipitates: Array<{ formula: string; amount: number }>;
}

export interface EquivalencePoint {
  /** Volume at the equivalence point, litres. */
  volume: number;
  volumeML: number;
  pH: number;
  /** Which stoichiometric equivalence this is (1 for the first, 2 for the second…). */
  index: number;
  /** dpH/dV at the point — the height of the break, and therefore how sharp it is. */
  steepness: number;
  /** A break below ~2 pH units per 0.1 mL cannot be seen with an indicator. */
  detectable: boolean;
}

export interface TitrationCurve {
  points: TitrationPoint[];
  equivalencePoints: EquivalencePoint[];
  /** First derivative dpH/dV, the classic way to locate the end point. */
  firstDerivative: number[];
  /** Second derivative — its zero crossing is the sharpest locator. */
  secondDerivative: number[];
  setup: TitrationSetup;
  /** Theoretical equivalence volume from the stoichiometry, litres. */
  theoreticalEquivalence: number[];
  warnings: string[];
}

/**
 * Number of titratable equivalents a reagent supplies or consumes per mole.
 * Used only to predict where the equivalence points *should* be, so the
 * simulated curve can be compared against the stoichiometric expectation.
 */
const EQUIVALENTS: Record<string, number> = {
  hcl: 1, hno3: 1, h2so4: 2, ch3cooh: 1, h3po4: 3, h2co3: 2,
  naoh: 1, nh3: 1, na2co3: 2, nahco3: 1, khp: 1, na2b4o7: 2,
  'acido-salicilico': 1, edta: 1, agno3: 1, kmno4: 5, na2s2o3: 1,
};

/**
 * Run a titration.
 *
 * Each point re-solves the whole equilibrium from the volume-corrected
 * analytical totals. Dilution by the added titrant is therefore automatic and
 * exact — one of the corrections students most often forget, and one that a
 * drawn curve hides completely.
 */
export function titrate(setup: TitrationSetup): TitrationCurve {
  const n = setup.points ?? 300;
  const T = setup.temperature ?? T_STANDARD;
  const activityModel = setup.activityModel ?? 'davies';
  const warnings: string[] = [];

  const points: TitrationPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const V = (setup.finalVolume * i) / n;
    const totalVolume = setup.initialVolume + V;
    const additions: Addition[] = [
      ...setup.analyte,
      ...(setup.background ?? []),
      { substanceId: setup.titrantId, moles: V * setup.titrantConcentration },
    ];

    const result = solveSolution(
      { additions, volume: totalVolume, temperature: T },
      { activityModel },
    );

    const fractions: Record<string, number> = {};
    for (const s of result.species) {
      for (const [comp, f] of Object.entries(s.fractions)) {
        if (comp !== 'H') fractions[s.formula] = f;
      }
    }

    points.push({
      volume: V,
      volumeML: V * 1000,
      pH: result.pH,
      pcH: result.pcH,
      totalVolume,
      ionicStrength: result.ionicStrength,
      free: result.free,
      fractions,
      precipitates: result.precipitates.map((p) => ({ formula: p.formula, amount: p.amount })),
    });

    if (!result.converged && warnings.length < 3) {
      warnings.push(`El equilibrio no convergió a V = ${(V * 1000).toFixed(2)} mL.`);
    }
  }

  // Buffer capacity from the curve itself: β = dC/dpH, with dC the titrant
  // equivalents added per litre. This is the definition, computed numerically
  // rather than from the Van Slyke approximation — so it stays correct for a
  // polyprotic system where the approximation does not.
  for (let i = 1; i < points.length - 1; i++) {
    const dpH = points[i + 1].pH - points[i - 1].pH;
    const dC = ((points[i + 1].volume - points[i - 1].volume) * setup.titrantConcentration)
      / points[i].totalVolume;
    points[i].bufferCapacity = dpH !== 0 ? Math.abs(dC / dpH) : Infinity;
  }

  const volumes = points.map((p) => p.volume);
  const pHs = points.map((p) => p.pH);
  const d1 = derivative(volumes, pHs);
  const d2 = derivative(volumes, d1);

  return {
    points,
    equivalencePoints: findEquivalencePoints(points, d1, d2),
    firstDerivative: d1,
    secondDerivative: d2,
    setup,
    theoreticalEquivalence: predictEquivalence(setup),
    warnings,
  };
}

/**
 * Locate the equivalence points as the maxima of |dpH/dV|.
 *
 * Using the derivative rather than a stoichiometric formula is deliberate: it
 * is the method a student uses on real data, and it correctly finds *nothing*
 * when a break is too shallow to exist — which is exactly what happens to the
 * second equivalence point of carbonic acid, and to any acid weaker than
 * about pKa 8 in water.
 */
function findEquivalencePoints(
  points: TitrationPoint[], d1: number[], d2: number[],
): EquivalencePoint[] {
  const out: EquivalencePoint[] = [];
  const abs = d1.map(Math.abs);
  const maxSlope = Math.max(...abs);
  if (!Number.isFinite(maxSlope) || maxSlope <= 0) return out;

  for (let i = 2; i < abs.length - 2; i++) {
    const isPeak = abs[i] > abs[i - 1] && abs[i] >= abs[i + 1] && abs[i] > maxSlope * 0.06;
    if (!isPeak) continue;
    if (out.some((e) => Math.abs(e.volume - points[i].volume) < 1e-6)) continue;

    // Refine by the zero crossing of the second derivative, which is the
    // inflection point proper.
    let volume = points[i].volume;
    let pH = points[i].pH;
    if (d2[i] * d2[i + 1] < 0) {
      const t = d2[i] / (d2[i] - d2[i + 1]);
      volume = points[i].volume + t * (points[i + 1].volume - points[i].volume);
      pH = points[i].pH + t * (points[i + 1].pH - points[i].pH);
    }

    // Steepness expressed per 0.1 mL — one drop from a burette.
    const steepness = abs[i] * 1e-4;
    out.push({
      volume, volumeML: volume * 1000, pH,
      index: out.length + 1,
      steepness,
      detectable: steepness > 0.3,
    });
  }
  return out.sort((a, b) => a.volume - b.volume).map((e, i) => ({ ...e, index: i + 1 }));
}

/** Stoichiometric prediction of where each equivalence point should fall. */
function predictEquivalence(setup: TitrationSetup): number[] {
  const titrantEq = EQUIVALENTS[setup.titrantId] ?? 1;
  let analyteEq = 0;
  for (const a of setup.analyte) analyteEq += a.moles * (EQUIVALENTS[a.substanceId] ?? 1);
  if (analyteEq <= 0 || setup.titrantConcentration <= 0) return [];

  const perEquivalent = analyteEq / (setup.titrantConcentration * titrantEq);
  const steps = Math.max(...setup.analyte.map((a) => EQUIVALENTS[a.substanceId] ?? 1));
  return Array.from({ length: steps }, (_, k) => (perEquivalent * (k + 1)) / steps);
}

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

export interface Indicator {
  id: string;
  name: string;
  /** pKa of the indicator; the transition centres here. */
  pKa: number;
  /** Usable transition range, roughly pKa ± 1. */
  range: [number, number];
  /** Colour of the acid form. */
  acidColour: string;
  acidHex: string;
  baseColour: string;
  baseHex: string;
  /** Concentration at which it is normally used, mol·L⁻¹. */
  workingConcentration: number;
  notes?: string;
}

export const INDICATORS: Indicator[] = [
  {
    id: 'fenolftaleina', name: 'Fenolftaleína', pKa: 9.4, range: [8.2, 10.0],
    acidColour: 'incoloro', acidHex: '#00000000', baseColour: 'rosa fucsia', baseHex: '#e0218a',
    workingConcentration: 1e-5,
    notes: 'El viraje de incoloro a rosa es el más fácil de ver; por eso es el indicador estándar para valorar ácidos con NaOH.',
  },
  {
    id: 'naranja-metilo', name: 'Naranja de metilo', pKa: 3.46, range: [3.1, 4.4],
    acidColour: 'rojo', acidHex: '#d43b28', baseColour: 'amarillo-naranja', baseHex: '#f5a623',
    workingConcentration: 2e-5,
    notes: 'Vira en zona ácida: se usa para valorar bases fuertes y para el primer punto del carbonato.',
  },
  {
    id: 'rojo-metilo', name: 'Rojo de metilo', pKa: 5.0, range: [4.4, 6.2],
    acidColour: 'rojo', acidHex: '#c62828', baseColour: 'amarillo', baseHex: '#fbc02d',
    workingConcentration: 2e-5,
  },
  {
    id: 'azul-bromotimol', name: 'Azul de bromotimol', pKa: 7.1, range: [6.0, 7.6],
    acidColour: 'amarillo', acidHex: '#fdd835', baseColour: 'azul', baseHex: '#1565c0',
    workingConcentration: 2e-5,
    notes: 'Centrado en pH 7: el indicador natural para ácido fuerte con base fuerte.',
  },
  {
    id: 'timolftaleina', name: 'Timolftaleína', pKa: 9.9, range: [9.3, 10.5],
    acidColour: 'incoloro', acidHex: '#00000000', baseColour: 'azul', baseHex: '#3949ab',
    workingConcentration: 1e-5,
  },
  {
    id: 'azul-bromofenol', name: 'Azul de bromofenol', pKa: 4.0, range: [3.0, 4.6],
    acidColour: 'amarillo', acidHex: '#fdd835', baseColour: 'azul-violeta', baseHex: '#5e35b1',
    workingConcentration: 2e-5,
  },
];

export const indicatorById = (id: string): Indicator | undefined =>
  INDICATORS.find((i) => i.id === id);

/**
 * Fraction of the indicator in its basic (coloured) form at a given pH.
 * The eye detects a colour change over roughly 10 %–90 %, which is where the
 * conventional "pKa ± 1" transition range comes from — derived here rather
 * than asserted.
 */
export function indicatorFraction(indicator: Indicator, pH: number): number {
  return 1 / (1 + Math.pow(10, indicator.pKa - pH));
}

/** Blend the two indicator colours according to the speciation at this pH. */
export function indicatorColour(indicator: Indicator, pH: number): { hex: string; visible: boolean; description: string } {
  const f = indicatorFraction(indicator, pH);
  const mix = (a: string, b: string, t: number): string => {
    const pa = hexToRgba(a);
    const pb = hexToRgba(b);
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255).toFixed(3)})`;
  };
  const description = f < 0.1 ? indicator.acidColour
    : f > 0.9 ? indicator.baseColour
      : `transición (${(f * 100).toFixed(0)} % forma básica)`;
  return { hex: mix(indicator.acidHex, indicator.baseHex, f), visible: f > 0.02, description };
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 8) {
    return [
      parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16),
    ];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

export interface IndicatorAssessment {
  indicator: Indicator;
  /** Volume at which the eye would call the end point, litres. */
  endPointVolume: number;
  /** Titration error: (V_end − V_eq)/V_eq, in percent. */
  errorPercent: number;
  suitable: boolean;
  reason: string;
}

/**
 * How well would this indicator work on this curve?
 *
 * The titration error is computed by finding where the indicator actually
 * changes colour on the simulated curve, then comparing with the true
 * equivalence point — the calculation students are asked to do by hand, made
 * concrete. An indicator with a transition range outside the break gives a
 * large error, and the number says how large.
 */
export function assessIndicator(curve: TitrationCurve, indicator: Indicator): IndicatorAssessment {
  const eq = curve.equivalencePoints[0];
  if (!eq) {
    return {
      indicator, endPointVolume: NaN, errorPercent: NaN, suitable: false,
      reason: 'La curva no presenta un salto detectable: ningún indicador serviría.',
    };
  }

  // The eye calls the end point when the basic form reaches ~50 %, i.e. pH = pKa.
  let endPointVolume = NaN;
  for (let i = 1; i < curve.points.length; i++) {
    const a = curve.points[i - 1];
    const b = curve.points[i];
    if ((a.pH - indicator.pKa) * (b.pH - indicator.pKa) <= 0 && a.pH !== b.pH) {
      const t = (indicator.pKa - a.pH) / (b.pH - a.pH);
      endPointVolume = a.volume + t * (b.volume - a.volume);
      break;
    }
  }

  if (!Number.isFinite(endPointVolume)) {
    return {
      indicator, endPointVolume: NaN, errorPercent: NaN, suitable: false,
      reason: `El pH nunca atraviesa ${indicator.pKa.toFixed(1)}: el indicador no llega a virar.`,
    };
  }

  const errorPercent = ((endPointVolume - eq.volume) / eq.volume) * 100;
  const withinBreak = indicator.range[0] < eq.pH && eq.pH < indicator.range[1];
  const suitable = Math.abs(errorPercent) < 0.2;

  return {
    indicator, endPointVolume, errorPercent, suitable,
    reason: suitable
      ? `El intervalo de viraje (${indicator.range[0]}–${indicator.range[1]}) cae dentro del salto; error de valoración ${errorPercent.toFixed(3)} %.`
      : withinBreak
        ? `El viraje ocurre dentro del salto pero desplazado del punto de equivalencia (pH ${eq.pH.toFixed(2)}): error ${errorPercent.toFixed(2)} %.`
        : `El intervalo de viraje (${indicator.range[0]}–${indicator.range[1]}) no contiene el pH de equivalencia (${eq.pH.toFixed(2)}): error ${errorPercent.toFixed(2)} %.`,
  };
}

/** Rank every indicator for this curve, best first. */
export function recommendIndicators(curve: TitrationCurve): IndicatorAssessment[] {
  return INDICATORS
    .map((i) => assessIndicator(curve, i))
    .sort((a, b) => {
      const ea = Number.isFinite(a.errorPercent) ? Math.abs(a.errorPercent) : Infinity;
      const eb = Number.isFinite(b.errorPercent) ? Math.abs(b.errorPercent) : Infinity;
      return ea - eb;
    });
}

// ---------------------------------------------------------------------------
// Buffer design
// ---------------------------------------------------------------------------

export interface BufferRecipe {
  acidId: string;
  baseId: string;
  /** Moles of each, for the requested volume. */
  acidMoles: number;
  baseMoles: number;
  acidGrams: number;
  baseGrams: number;
  /** pH the recipe actually produces, from the full solver — not from Henderson–Hasselbalch. */
  actualPH: number;
  /** pH predicted by Henderson–Hasselbalch, for comparison. */
  hendersonPH: number;
  bufferCapacity: number;
  warnings: string[];
}

/**
 * Design a buffer at a target pH and total concentration.
 *
 * The ratio comes from Henderson–Hasselbalch, but the pH reported is the one
 * the full solver gives for that recipe. Showing both is the point: they agree
 * to two decimals in the middle of the buffer range and diverge visibly at the
 * edges, which is the lesson about when the approximation is safe.
 */
export function designBuffer(
  acidSubstanceId: string, pKa: number, targetPH: number,
  totalConcentration: number, volume: number,
  opts: { conjugateReagentId?: string; molarMassAcid?: number; molarMassBase?: number } = {},
): BufferRecipe {
  const warnings: string[] = [];
  const ratio = Math.pow(10, targetPH - pKa);       // [A⁻]/[HA]
  const fractionBase = ratio / (1 + ratio);
  const baseMoles = totalConcentration * volume * fractionBase;
  const acidMoles = totalConcentration * volume * (1 - fractionBase);

  if (Math.abs(targetPH - pKa) > 1) {
    warnings.push(
      `El pH objetivo está a ${Math.abs(targetPH - pKa).toFixed(1)} unidades del pKa: `
      + 'la capacidad tamponante cae rápidamente fuera de pKa ± 1. Considera otro sistema.',
    );
  }

  // Realise the recipe with strong base, which is how it is actually prepared.
  const naohMoles = baseMoles;
  const result = solveSolution({
    additions: [
      { substanceId: acidSubstanceId, moles: acidMoles + baseMoles },
      { substanceId: 'naoh', moles: naohMoles },
    ],
    volume,
  }, { activityModel: 'davies' });

  // β = 2.303·C·Ka·[H⁺] / (Ka + [H⁺])²  — the Van Slyke expression.
  const h = Math.pow(10, -result.pH);
  const ka = Math.pow(10, -pKa);
  const bufferCapacity = (Math.LN10 * totalConcentration * ka * h) / Math.pow(ka + h, 2);

  return {
    acidId: acidSubstanceId,
    baseId: opts.conjugateReagentId ?? 'naoh',
    acidMoles: acidMoles + baseMoles,
    baseMoles: naohMoles,
    acidGrams: (acidMoles + baseMoles) * (opts.molarMassAcid ?? NaN),
    baseGrams: naohMoles * (opts.molarMassBase ?? 39.997),
    actualPH: result.pH,
    hendersonPH: targetPH,
    bufferCapacity,
    warnings: [...warnings, ...result.warnings],
  };
}

/** Speciation of a system as a function of pH — the α-fraction diagram (§25). */
export interface SpeciationSweep {
  pH: number[];
  /** species formula → fraction at each pH. */
  series: Record<string, number[]>;
}

export function speciationVsPH(
  additions: Addition[], volume: number, component: string,
  range: [number, number] = [0, 14], points = 141,
  opts: { activityModel?: ActivityModel; temperature?: number } = {},
): SpeciationSweep {
  const built = buildSolution({ additions, volume, temperature: opts.temperature });
  const pH: number[] = [];
  const series: Record<string, number[]> = {};

  for (let i = 0; i < points; i++) {
    const p = range[0] + ((range[1] - range[0]) * i) / (points - 1);
    pH.push(p);
    const r: Speciation = solveEquilibrium(built.model, built.totals, {
      fixedPH: p,
      activityModel: opts.activityModel ?? 'ideal',
      temperature: opts.temperature,
      allowPrecipitation: false,
    });
    for (const s of r.species) {
      const f = s.fractions[component];
      if (f === undefined) continue;
      (series[s.formula] ??= []).push(f);
    }
  }

  // Drop species that never reach 0.5 % — they clutter the diagram without
  // adding information.
  for (const [k, v] of Object.entries(series)) {
    if (Math.max(...v) < 0.005) delete series[k];
  }
  return { pH, series };
}
