/**
 * The Substance entity.
 *
 * §2 and §76 of the specification: a substance is one object, shared by every
 * module. The HCl a student meets in Química General I is the same record that
 * the titration engine, the hydrochemistry module, the safety panel, the
 * spectroscopy simulator and the industrial process model all read. Nothing is
 * duplicated; a correction to a pKa fixes every course at once.
 *
 * Fields are optional where the property genuinely may not exist (a solid salt
 * has no boiling point; a non-electrolyte has no pKa). They are never filled
 * with a plausible-looking placeholder — the interface renders "no disponible"
 * instead, because a fabricated number is worse than a missing one (§81).
 */

import { molarMass, parseFormula, type Composition } from '../core/chem/formula.js';

export type Phase = 's' | 'l' | 'g' | 'ac';

export const PHASE_LABEL: Record<Phase, string> = {
  s: 'sólido', l: 'líquido', g: 'gas', ac: 'disolución acuosa',
};

/** GHS hazard classes, used for pictograms and for the laboratory rules. */
export type GHSClass =
  | 'explosivo' | 'inflamable' | 'comburente' | 'gas-presion' | 'corrosivo'
  | 'toxico-agudo' | 'irritante' | 'peligro-salud' | 'peligro-ambiental';

export interface HazardStatement {
  /** H-code, e.g. "H314". */
  code: string;
  text: string;
}

export interface Safety {
  ghs: GHSClass[];
  /** Signal word. */
  signal: 'Peligro' | 'Atención' | null;
  hazards: HazardStatement[];
  /** Required personal protective equipment. */
  ppe: string[];
  storage: string;
  /** Substance ids (or free text) that must not be stored or mixed with this one. */
  incompatibilities: string[];
  wasteStream: string;
  /** Occupational exposure limit, ppm (8 h TWA), where one is defined. */
  exposureLimitPpm?: number;
  /** Additional handling notes surfaced before an experiment starts. */
  notes?: string[];
}

/** Acid–base behaviour. pKa values are listed from the most acidic proton. */
export interface AcidBase {
  /** Successive pKa values at 25 °C, ionic strength → 0. */
  pKa: number[];
  /** Enthalpies of each ionisation step, J·mol⁻¹, for temperature correction. */
  deltaH?: number[];
  /** Formula of the fully protonated form, e.g. "H3PO4". */
  fullyProtonated: string;
  /** Formulae of each successive conjugate base. */
  conjugates: string[];
  /** Charge of the fully protonated form. */
  chargeProtonated: number;
  /** Strong acid/base that dissociates completely — pKa is then nominal. */
  strong?: boolean;
  /** For bases quoted as pKb in the literature. */
  pKbSource?: number[];
}

export interface RedoxCouple {
  /** Half reaction as written, reduction direction. */
  halfReaction: string;
  /** Standard reduction potential vs SHE, V. */
  E0: number;
  /** Electrons transferred. */
  n: number;
  /** Protons consumed per electron set — enables the pH dependence of E. */
  protons?: number;
  /** Species produced/consumed, as formula → stoichiometric coefficient
   *  (negative on the oxidised side). */
  stoich?: Record<string, number>;
  conditions?: string;
}

export interface ThermoData {
  /** Standard enthalpy of formation, kJ·mol⁻¹. */
  dHf?: number;
  /** Standard Gibbs energy of formation, kJ·mol⁻¹. */
  dGf?: number;
  /** Standard molar entropy, J·mol⁻¹·K⁻¹. */
  S0?: number;
  /** Molar heat capacity at constant pressure, J·mol⁻¹·K⁻¹. */
  Cp?: number;
  /** Enthalpy of fusion, kJ·mol⁻¹. */
  dHfus?: number;
  /** Enthalpy of vaporisation, kJ·mol⁻¹. */
  dHvap?: number;
  /** Phase the thermodynamic data refers to. */
  phase: Phase;
}

/** Antoine equation coefficients: log₁₀(P/bar) = A − B/(C + T/K). */
export interface AntoineCoefficients {
  A: number; B: number; C: number;
  /** Validity range in kelvin. */
  range: [number, number];
}

export interface PhysicalProperties {
  /** Melting point, K. */
  meltingPoint?: number;
  /** Normal boiling point, K. */
  boilingPoint?: number;
  /** Density at 293–298 K, g·mL⁻¹. */
  density?: number;
  /** Dynamic viscosity at 298 K, mPa·s. */
  viscosity?: number;
  /** Refractive index n_D at 293 K. */
  refractiveIndex?: number;
  /** Solubility in water at 298 K, g per 100 mL. */
  solubilityWater?: number;
  /** log of the octanol/water partition coefficient. */
  logP?: number;
  /** Dielectric constant (relevant when used as a solvent). */
  permittivity?: number;
  antoine?: AntoineCoefficients;
  /** Flash point, K, for flammable liquids. */
  flashPoint?: number;
  /** Colour of the pure substance / its aqueous solution. */
  appearance?: string;
}

/** UV-Vis absorption band. */
export interface UVBand {
  /** Wavelength of maximum absorption, nm. */
  lambdaMax: number;
  /** Molar absorptivity, L·mol⁻¹·cm⁻¹. */
  epsilon: number;
  /** Band width (FWHM), nm — needed to synthesise a realistic spectrum. */
  width: number;
  /** Which species carries the band; matters for indicators and metal complexes. */
  species?: string;
  assignment?: string;
}

/** Infrared absorption band. */
export interface IRBand {
  /** Wavenumber, cm⁻¹. */
  wavenumber: number;
  /** Relative intensity, 0–1. */
  intensity: number;
  /** Band width (FWHM), cm⁻¹. */
  width: number;
  assignment: string;
  /** Vibrational mode, when it can be named. */
  mode?: 'tension' | 'flexion' | 'balanceo' | 'torsion' | 'combinacion';
}

/** ¹H or ¹³C NMR signal. */
export interface NMRSignal {
  nucleus: '1H' | '13C';
  /** Chemical shift, ppm. */
  shift: number;
  /** Number of equivalent nuclei. */
  integration: number;
  /** Multiplicity from n neighbouring nuclei (n + 1 rule). */
  neighbours: number;
  /** Coupling constant, Hz. */
  J?: number;
  assignment: string;
}

export interface SpectralData {
  uv?: UVBand[];
  ir?: IRBand[];
  nmr?: NMRSignal[];
  /** Characteristic MS fragments, as m/z → relative intensity and assignment. */
  msFragments?: Array<{ mz: number; intensity: number; assignment: string }>;
}

/** Chromatographic behaviour, per technique. */
export interface ChromatographyData {
  /** Retention factor on a C18 column with the stated mobile phase. */
  hplcC18?: { k0: number; S: number; note?: string };
  /** Kováts retention index on a non-polar (DB-5 type) GC column. */
  gcKovats?: number;
  /** Boiling point drives GC elution order; stored on physical properties. */
}

export interface Substance {
  /** Stable identifier, used by every cross-reference in CHEMIA. */
  id: string;
  formula: string;
  name: string;
  synonyms: string[];
  casNumber?: string;
  /** Structural formula in SMILES-like shorthand, for the molecular builder. */
  structure?: string;
  /** Molecule id in the 3D library, when a structure exists. */
  moleculeId?: string;
  composition: Composition;
  /** Charge of the species as written. */
  charge: number;
  /** Molar mass, g·mol⁻¹ — derived from the formula, never hand-entered. */
  molarMass: number;
  phase: Phase;
  categories: string[];
  physical: PhysicalProperties;
  thermo?: ThermoData;
  acidBase?: AcidBase;
  redox?: RedoxCouple[];
  spectra?: SpectralData;
  chromatography?: ChromatographyData;
  safety: Safety;
  /** Ids of substances this one reacts with, for the reaction engine index. */
  reactsWith?: string[];
  /** Short teaching note: what this substance is *for* in the curriculum. */
  role?: string;
  /** Ids of the courses where the substance is introduced. */
  courses?: string[];
}

/** Input form: molarMass and composition are derived, not supplied. */
export type SubstanceInput = Omit<Substance, 'molarMass' | 'composition' | 'charge'> &
  Partial<Pick<Substance, 'charge'>>;

/**
 * Build a Substance, deriving the composition, charge and molar mass from the
 * formula. Refusing to accept a hand-entered molar mass is deliberate: it is
 * the field most likely to be wrong, and it is always computable.
 */
export function makeSubstance(input: SubstanceInput): Substance {
  const parsed = parseFormula(input.formula);
  return {
    ...input,
    composition: parsed.composition,
    charge: input.charge ?? parsed.charge,
    molarMass: molarMass(parsed.composition),
  };
}

/** Number of ionisable protons. */
export const proticity = (s: Substance): number => s.acidBase?.pKa.length ?? 0;

/** The dominant acid–base species at a given pH, as a formula. */
export function dominantForm(s: Substance, pH: number): string {
  const ab = s.acidBase;
  if (!ab) return s.formula;
  let index = 0;
  for (let i = 0; i < ab.pKa.length; i++) {
    if (pH > ab.pKa[i]) index = i + 1;
  }
  return index === 0 ? ab.fullyProtonated : ab.conjugates[index - 1];
}

/** Does handling this substance require a fume hood? */
export function requiresFumeHood(s: Substance): boolean {
  return s.safety.ghs.some((g) =>
    ['toxico-agudo', 'corrosivo', 'peligro-salud'].includes(g))
    || (s.physical.boilingPoint !== undefined && s.physical.boilingPoint < 373 && s.phase === 'l');
}

/**
 * Are two substances incompatible? Checked before every transfer in the
 * virtual laboratory (§41) — the safety data is not decoration, it gates
 * what the simulation allows.
 */
export function areIncompatible(a: Substance, b: Substance): boolean {
  return a.safety.incompatibilities.includes(b.id)
    || b.safety.incompatibilities.includes(a.id);
}
