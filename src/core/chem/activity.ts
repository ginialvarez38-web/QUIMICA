/**
 * Ionic strength and activity coefficients.
 *
 * Equilibrium constants are thermodynamic — written in activities — but a
 * student measures concentrations. Ignoring the difference is the single most
 * common source of "my calculated pH doesn't match the meter" in an analytical
 * course, so CHEMIA models it explicitly and lets the activity correction be
 * switched off so the two can be compared side by side.
 */

import { EPS_R_WATER_25, NA, ELEMENTARY_CHARGE, EPSILON_0, KB, T_STANDARD, RHO_WATER_25 } from '../constants.js';

export type ActivityModel = 'ideal' | 'debye-huckel' | 'davies' | 'extended-dh';

export const ACTIVITY_MODEL_LABEL: Record<ActivityModel, string> = {
  ideal: 'Ideal (γ = 1)',
  'debye-huckel': 'Debye–Hückel límite',
  'extended-dh': 'Debye–Hückel ampliada',
  davies: 'Davies',
};

/** Validity ceiling of each model, in mol·L⁻¹ of ionic strength. */
export const ACTIVITY_MODEL_LIMIT: Record<ActivityModel, number> = {
  ideal: 0,
  'debye-huckel': 0.01,
  'extended-dh': 0.1,
  davies: 0.5,
};

/**
 * Inverse Debye length per unit √I, κ/√I, in m⁻¹·(mol·L⁻¹)^(−1/2).
 *
 *   κ² = 2·N_A·e²·I / (ε₀·ε_r·k_B·T)      with I in mol·m⁻³
 *
 * The factor 1000 converts the ionic strength from mol·L⁻¹ to mol·m⁻³.
 */
function kappaPerSqrtI(T: number, epsR: number): number {
  const e2 = ELEMENTARY_CHARGE * ELEMENTARY_CHARGE;
  return Math.sqrt((2 * NA * e2 * 1000) / (EPSILON_0 * epsR * KB * T));
}

/**
 * Debye–Hückel A parameter, in (mol·L⁻¹)^(−1/2), derived from the constants
 * module rather than quoted:
 *
 *   ln γ = −z²·e²·κ / (8π·ε₀·ε_r·k_B·T)   ⟹   log γ = −A·z²·√I
 *
 * At 25 °C in water this evaluates to 0.5108, the value every analytical
 * textbook prints — which makes it a working check on `core/constants`.
 */
export function debyeHuckelA(T: number = T_STANDARD, epsR: number = EPS_R_WATER_25): number {
  const e2 = ELEMENTARY_CHARGE * ELEMENTARY_CHARGE;
  const prefactor = e2 / (8 * Math.PI * EPSILON_0 * epsR * KB * T);
  return (prefactor * kappaPerSqrtI(T, epsR)) / Math.LN10;
}

/**
 * Debye–Hückel B parameter expressed for an ion size å in ångström, so that
 * the denominator of the extended equation reads (1 + B·å·√I).
 * ≈ 0.3281 Å⁻¹·(mol·L⁻¹)^(−1/2) at 25 °C.
 */
export function debyeHuckelB(T: number = T_STANDARD, epsR: number = EPS_R_WATER_25): number {
  return kappaPerSqrtI(T, epsR) * 1e-10;
}

/** Relative permittivity of water as a function of temperature (0–100 °C). */
export function waterPermittivity(T: number): number {
  const t = T - 273.15;
  return 87.740 - 0.40008 * t + 9.398e-4 * t * t - 1.410e-6 * t * t * t;
}

/**
 * Ion size parameter å, in ångström, used by the extended Debye–Hückel
 * equation. Kielland's values for the common ions; the fallback scales with
 * charge, which is the right qualitative trend.
 */
const ION_SIZE: Record<string, number> = {
  'H+': 9, 'Li+': 6, 'Na+': 4.5, 'K+': 3, 'Rb+': 2.5, 'Cs+': 2.5, 'NH4+': 2.5,
  'Ag+': 2.5, 'Tl+': 2.5,
  'Mg2+': 8, 'Ca2+': 6, 'Sr2+': 5, 'Ba2+': 5, 'Ra2+': 5,
  'Cu2+': 6, 'Zn2+': 6, 'Fe2+': 6, 'Mn2+': 6, 'Ni2+': 6, 'Co2+': 6, 'Cd2+': 5,
  'Pb2+': 4.5, 'Hg2+': 5, 'Sn2+': 6, 'UO2 2+': 4.5,
  'Al3+': 9, 'Fe3+': 9, 'Cr3+': 9, 'La3+': 9, 'Ce3+': 9, 'Sc3+': 9,
  'Th4+': 11, 'Zr4+': 11, 'Ce4+': 11, 'Sn4+': 11,
  'OH-': 3.5, 'F-': 3.5, 'Cl-': 3, 'Br-': 3, 'I-': 3, 'NO3-': 3, 'NO2-': 3,
  'ClO4-': 3.5, 'ClO3-': 3.5, 'BrO3-': 3.5, 'IO3-': 3.5, 'HCO3-': 4.5,
  'CH3COO-': 4.5, 'HCOO-': 3.5, 'HS-': 3.5, 'CN-': 3, 'SCN-': 3.5,
  'H2PO4-': 4, 'HSO4-': 4, 'HSO3-': 4, 'MnO4-': 3.5,
  'SO4 2-': 4, 'SO3 2-': 4.5, 'CO3 2-': 4.5, 'S2O3 2-': 4, 'CrO4 2-': 4,
  'Cr2O7 2-': 4, 'C2O4 2-': 4.5, 'HPO4 2-': 4, 'S2-': 5,
  'PO4 3-': 4, 'Fe(CN)6 3-': 4, 'Fe(CN)6 4-': 5,
};

export function ionSize(species: string, charge: number): number {
  const a = ION_SIZE[species];
  if (a !== undefined) return a;
  const z = Math.abs(charge);
  return z <= 1 ? 3.5 : z === 2 ? 5 : z === 3 ? 9 : 11;
}

/**
 * Ionic strength, I = ½·Σ c_i z_i².
 * Neutral species contribute nothing, which is why a 0.1 M glucose solution
 * has I = 0 while 0.1 M NaCl has I = 0.1 and 0.1 M Na₂SO₄ has I = 0.3.
 */
export function ionicStrength(concentrations: Array<{ c: number; z: number }>): number {
  return 0.5 * concentrations.reduce((s, { c, z }) => s + c * z * z, 0);
}

export interface ActivityContext {
  model: ActivityModel;
  /** Ionic strength, mol·L⁻¹. */
  I: number;
  temperature: number;
}

/**
 * Activity coefficient of an ion of charge z.
 *
 *   Debye–Hückel límite      log γ = −A z² √I
 *   Debye–Hückel ampliada    log γ = −A z² √I / (1 + B å √I)
 *   Davies                   log γ = −A z² (√I/(1+√I) − 0.3 I)
 *
 * Neutral species get γ = 1 here; the salting-out correction for neutrals is a
 * refinement CHEMIA does not claim to model (and says so).
 */
export function activityCoefficient(
  z: number,
  ctx: ActivityContext,
  speciesName?: string,
): number {
  if (z === 0 || ctx.model === 'ideal' || ctx.I <= 0) return 1;

  const A = debyeHuckelA(ctx.temperature);
  const sqrtI = Math.sqrt(ctx.I);
  let logGamma: number;

  switch (ctx.model) {
    case 'debye-huckel':
      logGamma = -A * z * z * sqrtI;
      break;
    case 'extended-dh': {
      const B = debyeHuckelB(ctx.temperature);
      const a = ionSize(speciesName ?? '', z);
      logGamma = (-A * z * z * sqrtI) / (1 + B * a * sqrtI);
      break;
    }
    case 'davies':
    default:
      logGamma = -A * z * z * (sqrtI / (1 + sqrtI) - 0.3 * ctx.I);
      break;
  }
  return Math.pow(10, logGamma);
}

/** Is the chosen model being used outside its validated range? */
export function activityWarning(ctx: ActivityContext): string | null {
  const limit = ACTIVITY_MODEL_LIMIT[ctx.model];
  if (ctx.model === 'ideal' && ctx.I > 0.001) {
    return `El modelo ideal ignora la fuerza iónica (I = ${ctx.I.toFixed(3)} M): los resultados se desviarán de la medida experimental.`;
  }
  if (limit > 0 && ctx.I > limit) {
    return `${ACTIVITY_MODEL_LABEL[ctx.model]} está fuera de su intervalo de validez (I = ${ctx.I.toFixed(3)} M > ${limit} M).`;
  }
  return null;
}
